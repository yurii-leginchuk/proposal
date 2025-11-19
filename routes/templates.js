const express = require('express');
const router = express.Router();
const Template = require('../models/Template');
const Screen = require('../models/Screen');

// Отримати всі шаблони
router.get('/', async (req, res) => {
  try {
    const templates = await Template.find().sort({ createdAt: -1 });
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Отримати один шаблон з екранами
router.get('/:id', async (req, res) => {
  try {
    const template = await Template.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    const screens = await Screen.find({ templateId: template._id }).sort({ order: 1 });
    
    res.json({
      template,
      screens,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Створити шаблон
router.post('/', async (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Template name is required' });
    }

    const template = new Template({
      name,
      description: description || '',
    });
    await template.save();

    res.json(template);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Оновити шаблон
router.put('/:id', async (req, res) => {
  try {
    const { name, description } = req.body;
    const update = {};
    
    if (name !== undefined) update.name = name;
    if (description !== undefined) update.description = description;

    const template = await Template.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true }
    );

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json(template);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Копіювати екрани з бібліотеки до шаблону
router.post('/:id/copy-screens', async (req, res) => {
  try {
    const { screenIds } = req.body;
    const template = await Template.findById(req.params.id);
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (!screenIds || !Array.isArray(screenIds) || screenIds.length === 0) {
      return res.status(400).json({ error: 'Screen IDs array is required' });
    }

    // Отримати екрани з бібліотеки (isDefault: true) або з інших джерел
    const sourceScreens = await Screen.find({ 
      _id: { $in: screenIds }
    });

    if (sourceScreens.length === 0) {
      return res.status(404).json({ error: 'No screens found with provided IDs' });
    }

    // Копіювати екрани до шаблону
    const copiedScreens = [];
    for (const sourceScreen of sourceScreens) {
      // Перевірити, чи існує екран з таким же ім'ям
      let screenName = sourceScreen.name;
      let existingScreen = await Screen.findOne({ 
        templateId: template._id,
        name: screenName 
      });

      // Якщо екран з таким же ім'ям існує, додати суфікс
      let counter = 1;
      while (existingScreen) {
        screenName = `${sourceScreen.name} (${counter})`;
        existingScreen = await Screen.findOne({ 
          templateId: template._id,
          name: screenName 
        });
        counter++;
      }

      const newScreen = new Screen({
        name: screenName,
        originalHtml: sourceScreen.originalHtml,
        editedHtml: sourceScreen.editedHtml || sourceScreen.originalHtml,
        preview: sourceScreen.preview || sourceScreen.editedHtml || sourceScreen.originalHtml,
        order: sourceScreen.order,
        isDefault: false,
        clientId: null,
        templateId: template._id,
      });
      await newScreen.save();
      copiedScreens.push(newScreen);
    }

    res.json({ success: true, copied: copiedScreens.length, screens: copiedScreens });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Застосувати шаблон до клієнта (замінити всі екрани клієнта)
router.post('/:id/apply-to-client/:clientId', async (req, res) => {
  try {
    const template = await Template.findById(req.params.id);
    const clientId = req.params.clientId;
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Отримати екрани шаблону
    const templateScreens = await Screen.find({ templateId: template._id }).sort({ order: 1 });

    // Видалити всі існуючі екрани клієнта
    await Screen.deleteMany({ clientId: clientId });

    // Копіювати екрани шаблону до клієнта
    const appliedScreens = [];
    for (const templateScreen of templateScreens) {
      const newScreen = new Screen({
        name: templateScreen.name,
        originalHtml: templateScreen.originalHtml,
        editedHtml: templateScreen.editedHtml || templateScreen.originalHtml,
        preview: templateScreen.preview || templateScreen.editedHtml || templateScreen.originalHtml,
        order: templateScreen.order,
        isDefault: false,
        clientId: clientId,
        templateId: null,
      });
      await newScreen.save();
      appliedScreens.push(newScreen);
    }

    res.json({ 
      success: true, 
      applied: appliedScreens.length, 
      screens: appliedScreens 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Видалити шаблон (також видалити всі його екрани)
router.delete('/:id', async (req, res) => {
  try {
    const template = await Template.findById(req.params.id);
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Видалити всі екрани шаблону
    await Screen.deleteMany({ templateId: template._id });

    // Видалити шаблон
    await Template.findByIdAndDelete(req.params.id);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

