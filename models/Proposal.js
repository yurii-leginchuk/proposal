const mongoose = require('mongoose');

const ProposalSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  screenOrder: [{
    screenId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Screen',
    },
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

ProposalSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Proposal', ProposalSchema);

