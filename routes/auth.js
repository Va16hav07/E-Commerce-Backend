const express = require('express');
const bcrypt = require('bcrypt');
const passport = require('passport');
const User = require('../models/User');
const { isAuthenticated } = require('../middleware/auth');
const router = express.Router();

// Register a new user
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    
    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }
    
    // Create new user
    user = new User({
      name,
      email,
      password,  // Will be hashed in the User model pre-save hook
      phone
    });
    
    await user.save();
    
    // Log in the user automatically after registration
    req.login(user, (err) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Error logging in after registration',
          error: err.message
        });
      }
      
      // Return user info
      return res.status(201).json({
        success: true,
        data: {
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role
          }
        }
      });
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error registering user',
      error: error.message
    });
  }
});

// Login with Passport
router.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      return res.status(500).json({
        success: false, 
        message: 'Authentication error',
        error: err.message
      });
    }
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: info ? info.message : 'Invalid email or password'
      });
    }
    
    // Log in the user
    req.login(user, (loginErr) => {
      if (loginErr) {
        return res.status(500).json({
          success: false,
          message: 'Error during login',
          error: loginErr.message
        });
      }
      
      // Return success with user info
      return res.json({
        success: true,
        data: {
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role
          }
        }
      });
    });
  })(req, res, next);
});

// Get current user
router.get('/me', isAuthenticated, (req, res) => {
  // User is already attached to req by isAuthenticated middleware
  res.json({
    success: true,
    authenticated: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role
    }
  });
});

// Logout
router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Error logging out',
        error: err.message
      });
    }
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  });
});

module.exports = router;
