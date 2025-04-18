const express = require('express');
const User = require('../models/User');
const { isAuthenticated, authorize } = require('../middleware/auth');
const router = express.Router();

// Get current user info
router.get('/me', isAuthenticated, (req, res) => {
  res.json({
    success: true,
    data: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      photo: req.user.photo,
      phone: req.user.phone
    }
  });
});

// Get all riders (admin only)
router.get('/riders', isAuthenticated, authorize('ADMIN'), async (req, res) => {
  try {
    const riders = await User.find({ role: 'RIDER' })
      .select('name email photo phone');
    
    res.json({
      success: true,
      count: riders.length,
      data: riders
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching riders',
      error: error.message
    });
  }
});

module.exports = router;
