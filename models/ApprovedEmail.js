const mongoose = require('mongoose');

const ApprovedEmailSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true
  },
  role: {
    type: String,
    enum: ['ADMIN', 'RIDER'],
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('ApprovedEmail', ApprovedEmailSchema);
