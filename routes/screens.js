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

// Отримати всі екрани (з фільтрацією по clientId, templateId або isDefault)
router.get('/', async (req, res) => {
  try {
    const { clientId, templateId, isDefault } = req.query;
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
    
    const screen = new Screen({
      name: screenName,
      originalHtml: htmlContent,
      editedHtml: htmlContent,
      preview: htmlContent,
      isDefault: isDefault === 'true' || isDefault === true,
      clientId: clientId && clientId !== 'null' ? clientId : null,
      templateId: templateId && templateId !== 'null' ? templateId : null,
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
    const { name, html, isDefault, clientId, templateId } = req.body;
    
    if (!html) {
      return res.status(400).json({ error: 'HTML content is required' });
    }

    const screen = new Screen({
      name: name || 'New Screen',
      originalHtml: html,
      editedHtml: html,
      preview: html,
      isDefault: isDefault === 'true' || isDefault === true,
      clientId: clientId && clientId !== 'null' ? clientId : null,
      templateId: templateId && templateId !== 'null' ? templateId : null,
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

// Оновити екран (назва)
router.put('/:id', async (req, res) => {
  try {
    const { name } = req.body;
    const update = {};
    
    if (name !== undefined) update.name = name;

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

module.exports = router;

