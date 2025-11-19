const mongoose = require('mongoose');

const ScreenSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  originalHtml: {
    type: String,
    required: true,
  },
  editedHtml: {
    type: String,
    default: '',
  },
  preview: {
    type: String,
    default: '',
  },
  order: {
    type: Number,
    default: 0,
  },
  isDefault: {
    type: Boolean,
    default: false,
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    default: null,
  },
  templateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Template',
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

ScreenSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Screen', ScreenSchema);

