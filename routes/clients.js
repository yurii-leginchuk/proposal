const express = require('express');
const router = express.Router();
const Client = require('../models/Client');
const Screen = require('../models/Screen');

// Отримати всіх клієнтів
router.get('/', async (req, res) => {
  try {
    const clients = await Client.find().sort({ createdAt: -1 });
    res.json(clients);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Отримати одного клієнта з екранами
router.get('/:id', async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    const screens = await Screen.find({ clientId: client._id }).sort({ order: 1 });
    
    res.json({
      client,
      screens,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create client (without copying screens by default)
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, notes } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Client name is required' });
    }

    // Create client
    const client = new Client({
      name,
      email: email || '',
      phone: phone || '',
      notes: notes || '',
    });
    await client.save();

    res.json(client);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Import default screens to client (replaces existing screens)
router.post('/:id/import-default-screens', async (req, res) => {
  try {
    const { replace = false } = req.body; // replace: true = delete existing screens first
    const client = await Client.findById(req.params.id);
    
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Delete existing client screens if replace is true
    if (replace) {
      await Screen.deleteMany({ clientId: client._id });
    }

    // Get default screens
    const defaultScreens = await Screen.find({ isDefault: true });

    // Copy default screens to client
    for (const defaultScreen of defaultScreens) {
      const newScreen = new Screen({
        name: defaultScreen.name,
        originalHtml: defaultScreen.originalHtml,
        editedHtml: defaultScreen.editedHtml || defaultScreen.originalHtml,
        preview: defaultScreen.preview || defaultScreen.editedHtml || defaultScreen.originalHtml,
        order: defaultScreen.order,
        isDefault: false,
        clientId: client._id,
        tags: defaultScreen.tags && Array.isArray(defaultScreen.tags) ? [...defaultScreen.tags] : [],
      });
      await newScreen.save();
    }

    res.json({ success: true, imported: defaultScreens.length, replaced: replace });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Оновити клієнта
router.put('/:id', async (req, res) => {
  try {
    const { name, email, phone, notes } = req.body;
    const update = {};
    
    if (name !== undefined) update.name = name;
    if (email !== undefined) update.email = email;
    if (phone !== undefined) update.phone = phone;
    if (notes !== undefined) update.notes = notes;

    const client = await Client.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true }
    );

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json(client);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Copy specific screens to client
router.post('/:id/copy-screens', async (req, res) => {
  try {
    const { screenIds } = req.body;
    const client = await Client.findById(req.params.id);
    
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    if (!screenIds || !Array.isArray(screenIds) || screenIds.length === 0) {
      return res.status(400).json({ error: 'Screen IDs array is required' });
    }

    // Get default screens by IDs
    const defaultScreens = await Screen.find({ 
      _id: { $in: screenIds },
      isDefault: true 
    });

    if (defaultScreens.length === 0) {
      return res.status(404).json({ error: 'No default screens found with provided IDs' });
    }

    // Copy screens to client
    const copiedScreens = [];
    for (const defaultScreen of defaultScreens) {
      // Allow duplicate screens - add suffix if name exists
      let screenName = defaultScreen.name;
      let existingScreen = await Screen.findOne({ 
        clientId: client._id,
        name: screenName 
      });

      // If screen with same name exists, add suffix
      let counter = 1;
      while (existingScreen) {
        screenName = `${defaultScreen.name} (${counter})`;
        existingScreen = await Screen.findOne({ 
          clientId: client._id,
          name: screenName 
        });
        counter++;
      }

      const newScreen = new Screen({
        name: screenName,
        originalHtml: defaultScreen.originalHtml,
        editedHtml: defaultScreen.editedHtml || defaultScreen.originalHtml,
        preview: defaultScreen.preview || defaultScreen.editedHtml || defaultScreen.originalHtml,
        order: defaultScreen.order,
        isDefault: false,
        clientId: client._id,
        tags: defaultScreen.tags && Array.isArray(defaultScreen.tags) ? [...defaultScreen.tags] : [],
      });
      await newScreen.save();
      copiedScreens.push(newScreen);
    }

    res.json({ success: true, copied: copiedScreens.length, screens: copiedScreens });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Видалити клієнта (також видалити всі його екрани та групи)
router.delete('/:id', async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Видалити всі екрани клієнта
    await Screen.deleteMany({ clientId: client._id });

    // Видалити клієнта
    await Client.findByIdAndDelete(req.params.id);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

