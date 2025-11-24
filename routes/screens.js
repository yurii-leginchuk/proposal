const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const Screen = require('../models/Screen');
const { parseHTML, updateTextContent } = require('../utils/htmlEditor');

// Налаштування multer для завантаження файлів
const upload = multer({
  dest: 'uploads/temp/',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Створення директорії для завантажень
const ensureUploadsDir = async () => {
  const dirs = ['uploads', 'uploads/temp'];
  for (const dir of dirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (err) {
      // Директорія вже існує
    }
  }
};

ensureUploadsDir();

// Отримати всі екрани (з фільтрацією по clientId, templateId, isDefault або tags)
router.get('/', async (req, res) => {
  try {
    const { clientId, templateId, isDefault, tags } = req.query;
    const query = {};
    
    if (templateId) {
      query.templateId = templateId;
    } else if (clientId === 'null' || clientId === null) {
      query.isDefault = true;
    } else if (clientId) {
      query.clientId = clientId;
    } else if (isDefault === 'true') {
      query.isDefault = true;
    } else {
      // Якщо немає параметрів, повертаємо дефолтні
      query.isDefault = true;
    }
    
    // Фільтрація по тегам
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : [tags];
      query.tags = { $in: tagArray };
    }
    
    const screens = await Screen.find(query).sort({ order: 1 });
    res.json(screens);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Отримати один екран
router.get('/:id', async (req, res) => {
  try {
    const screen = await Screen.findById(req.params.id);
    if (!screen) {
      return res.status(404).json({ error: 'Screen not found' });
    }
    res.json(screen);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Прев'ю екрана (повертає HTML)
router.get('/:id/preview', async (req, res) => {
  try {
    const screen = await Screen.findById(req.params.id);
    if (!screen) {
      return res.status(404).send('<html><body><h1>Screen not found</h1></body></html>');
    }
    const html = screen.editedHtml || screen.originalHtml || '';
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    res.status(500).send(`<html><body><h1>Error loading screen</h1><p>${error.message}</p></body></html>`);
  }
});

// Імпортувати HTML екран
router.post('/import', upload.single('htmlFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const htmlContent = await fs.readFile(filePath, 'utf-8');
    
    // Видалити тимчасовий файл
    await fs.unlink(filePath);

    // Використовувати ім'я з поля вводу, якщо воно вказане, інакше - ім'я файлу
    const fileName = req.file.originalname.replace('.html', '');
    const { name, isDefault, clientId, templateId } = req.body;
    const screenName = name && name.trim() ? name.trim() : fileName;
    
    // Parse tags from request body (FormData sends as string)
    let tags = [];
    if (req.body.tags) {
      if (typeof req.body.tags === 'string') {
        // Try to parse as JSON first (if sent as JSON string)
        try {
          const parsed = JSON.parse(req.body.tags);
          if (Array.isArray(parsed)) {
            tags = parsed.map(t => String(t).trim()).filter(t => t);
          } else {
            tags = req.body.tags.split(',').map(t => t.trim()).filter(t => t);
          }
        } catch (e) {
          // If not JSON, treat as comma-separated string
          tags = req.body.tags.split(',').map(t => t.trim()).filter(t => t);
        }
      } else if (Array.isArray(req.body.tags)) {
        tags = req.body.tags.map(t => String(t).trim()).filter(t => t);
      }
    }
    
    const screen = new Screen({
      name: screenName,
      originalHtml: htmlContent,
      editedHtml: htmlContent,
      preview: htmlContent,
      isDefault: isDefault === 'true' || isDefault === true,
      clientId: clientId && clientId !== 'null' ? clientId : null,
      templateId: templateId && templateId !== 'null' ? templateId : null,
      tags: tags,
    });

    await screen.save();
    res.json(screen);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Імпортувати HTML через текст
router.post('/import-text', async (req, res) => {
  try {
    const { name, html, isDefault, clientId, templateId, tags } = req.body;
    
    if (!html) {
      return res.status(400).json({ error: 'HTML content is required' });
    }

    // Parse tags
    let parsedTags = [];
    if (tags) {
      if (typeof tags === 'string') {
        parsedTags = tags.split(',').map(t => t.trim()).filter(t => t);
      } else if (Array.isArray(tags)) {
        parsedTags = tags.map(t => String(t).trim()).filter(t => t);
      }
    }

    const screen = new Screen({
      name: name || 'New Screen',
      originalHtml: html,
      editedHtml: html,
      preview: html,
      isDefault: isDefault === 'true' || isDefault === true,
      clientId: clientId && clientId !== 'null' ? clientId : null,
      templateId: templateId && templateId !== 'null' ? templateId : null,
      tags: parsedTags,
    });

    await screen.save();
    res.json(screen);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Оновити текстовий контент екрана
router.put('/:id/content', async (req, res) => {
  try {
    const { textEdits } = req.body;
    const screen = await Screen.findById(req.params.id);
    
    if (!screen) {
      return res.status(404).json({ error: 'Screen not found' });
    }

    // Оновити текстовий контент без зміни стилів
    const updatedHtml = updateTextContent(screen.editedHtml || screen.originalHtml, textEdits);
    
    screen.editedHtml = updatedHtml;
    screen.preview = updatedHtml;
    await screen.save();

    res.json(screen);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Оновити весь HTML екрана (новий метод - простіше та надійніше)
router.put('/:id/html', async (req, res) => {
  try {
    const { html } = req.body;
    const screen = await Screen.findById(req.params.id);
    
    if (!screen) {
      return res.status(404).json({ error: 'Screen not found' });
    }

    if (!html && html !== '') {
      return res.status(400).json({ error: 'HTML content is required' });
    }

    // Оновити весь HTML екрана
    screen.editedHtml = html;
    screen.preview = html;
    screen.updatedAt = new Date();
    await screen.save();

    res.json(screen);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Оновити порядок екранів
router.put('/reorder', async (req, res) => {
  try {
    const { screens } = req.body; // [{ id, order }]
    
    for (const item of screens) {
      await Screen.findByIdAndUpdate(item.id, {
        order: item.order,
      });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Оновити екран (назва, теги)
router.put('/:id', async (req, res) => {
  try {
    const { name, tags } = req.body;
    const update = {};
    
    if (name !== undefined) update.name = name;
    if (tags !== undefined) update.tags = Array.isArray(tags) ? tags : [];

    const screen = await Screen.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true }
    );

    if (!screen) {
      return res.status(404).json({ error: 'Screen not found' });
    }

    res.json(screen);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Дублювати екран
router.post('/:id/duplicate', async (req, res) => {
  try {
    const originalScreen = await Screen.findById(req.params.id);
    
    if (!originalScreen) {
      return res.status(404).json({ error: 'Screen not found' });
    }

    // Створити новий екран з копією даних
    const duplicatedScreen = new Screen({
      name: `${originalScreen.name} (Copy)`,
      originalHtml: originalScreen.originalHtml,
      editedHtml: originalScreen.editedHtml || originalScreen.originalHtml,
      preview: originalScreen.preview || originalScreen.editedHtml || originalScreen.originalHtml,
      order: originalScreen.order,
      isDefault: originalScreen.isDefault,
      clientId: originalScreen.clientId,
      tags: originalScreen.tags && Array.isArray(originalScreen.tags) ? [...originalScreen.tags] : [],
    });

    await duplicatedScreen.save();
    res.json(duplicatedScreen);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Видалити екран
router.delete('/:id', async (req, res) => {
  try {
    const screen = await Screen.findByIdAndDelete(req.params.id);
    
    if (!screen) {
      return res.status(404).json({ error: 'Screen not found' });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Отримати всі унікальні теги
router.get('/tags/all', async (req, res) => {
  try {
    const screens = await Screen.find({ isDefault: true });
    const allTags = new Set();
    
    screens.forEach(screen => {
      if (screen.tags && Array.isArray(screen.tags)) {
        screen.tags.forEach(tag => {
          if (tag && tag.trim()) {
            allTags.add(tag.trim());
          }
        });
      }
    });
    
    res.json(Array.from(allTags).sort());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

