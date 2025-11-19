const express = require('express');
const router = express.Router();
const Proposal = require('../models/Proposal');
const Screen = require('../models/Screen');

// Отримати всі пропозиції
router.get('/', async (req, res) => {
  try {
    const proposals = await Proposal.find().sort({ createdAt: -1 });
    res.json(proposals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Отримати одну пропозицію
router.get('/:id', async (req, res) => {
  try {
    const proposal = await Proposal.findById(req.params.id)
      .populate('screenOrder.screenId');
    
    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }
    
    res.json(proposal);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Створити пропозицію
router.post('/', async (req, res) => {
  try {
    const { name, screenOrder } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Proposal name is required' });
    }

    const proposal = new Proposal({
      name,
      screenOrder: screenOrder || [],
    });

    await proposal.save();
    res.json(proposal);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Оновити порядок екранів у пропозиції
router.put('/:id/order', async (req, res) => {
  try {
    const { screenOrder } = req.body;
    
    const proposal = await Proposal.findByIdAndUpdate(
      req.params.id,
      { screenOrder },
      { new: true }
    );

    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    res.json(proposal);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Оновити пропозицію
router.put('/:id', async (req, res) => {
  try {
    const { name, screenOrder } = req.body;
    const update = {};
    
    if (name !== undefined) update.name = name;
    if (screenOrder !== undefined) update.screenOrder = screenOrder;

    const proposal = await Proposal.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true }
    );

    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    res.json(proposal);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Видалити пропозицію
router.delete('/:id', async (req, res) => {
  try {
    const proposal = await Proposal.findByIdAndDelete(req.params.id);
    
    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

