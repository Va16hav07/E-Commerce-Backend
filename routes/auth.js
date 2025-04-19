const express = require('express');
const bcrypt = require('bcrypt');
const passport = require('passport');
const User = require('../models/User');
const { isAuthenticated, verifyGoogleToken } = require('../middleware/auth');
const router = express.Router();
const jwt = require('jsonwebtoken');

// Import googleClient from the config file
const { googleClient, getGoogleAuthUrl } = require('../config/googleConfig');

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

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
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authenticated'
    });
  }

  // Add debug logging
  console.log('Returning current user:', req.user.email);
  
  res.json({
    success: true,
    authenticated: true,
    user: {
      id: req.user._id,
      _id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      profilePicture: req.user.profilePicture
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

// Google authentication routes
// Redirect to Google OAuth
router.get('/google', (req, res) => {
  try {
    // Use the redirect_uri from query params if provided, otherwise use the configured frontend URL
    const redirectUri = req.query.redirect_uri || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/callback`;
    
    console.log(`Google OAuth Request received. Will redirect back to: ${redirectUri}`);
    
    // Use the getGoogleAuthUrl function from config
    const googleAuthUrl = getGoogleAuthUrl(redirectUri);
    
    console.log(`Redirecting to Google OAuth: ${googleAuthUrl}`);
    res.redirect(googleAuthUrl);
  } catch (error) {
    console.error('Google Auth Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error initiating Google authentication'
    });
  }
});

// Handle Google OAuth callback
router.get('/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    const { state } = req.query;  // This contains the frontend URL
    
    const frontendUrl = state || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/callback`;
    
    console.log(`Google OAuth callback received with code: ${code ? 'present' : 'missing'}`);
    console.log(`Will redirect to: ${frontendUrl}`);
    
    if (!code) {
      return res.redirect(`${frontendUrl}?error=${encodeURIComponent('Google authentication failed: No code received')}`);
    }
    
    try {
      // Print environment variables for debugging (mask sensitive info)
      console.log('Environment check:', {
        clientIdExists: !!process.env.GOOGLE_CLIENT_ID,
        clientSecretExists: !!process.env.GOOGLE_CLIENT_SECRET,
        BACKEND_URL: process.env.BACKEND_URL || 'http://localhost:5000'
      });
      
      const redirectUri = `${process.env.BACKEND_URL || 'http://localhost:5000'}/auth/google/callback`;
      console.log('Using redirect URI for token exchange:', redirectUri);
      
      // Exchange code for tokens
      try {
        console.log('Attempting to exchange code for tokens...');
        
        const { tokens } = await googleClient.getToken({
          code,
          redirect_uri: redirectUri
        });
        
        console.log('Token exchange successful, received tokens:', {
          hasIdToken: !!tokens.id_token,
          hasAccessToken: !!tokens.access_token,
          expiresIn: tokens.expires_in
        });
        
        // Verify the ID token
        const ticket = await googleClient.verifyIdToken({
          idToken: tokens.id_token,
          audience: process.env.GOOGLE_CLIENT_ID
        });
        
        const payload = ticket.getPayload();
        const { email, name, picture, sub } = payload;
        
        console.log(`Google user authenticated: ${email}`);
        
        // Find or create user
        let user = await User.findOne({ email });
        
        if (user) {
          // If user exists but is not a customer, reject Google login
          if (user.role !== 'CUSTOMER') {
            return res.redirect(`${frontendUrl}?error=${encodeURIComponent('Google login is only available for customers')}`);
          }
          
          // Update user's Google ID if not set
          if (!user.googleId) {
            user.googleId = sub;
            user.profilePicture = user.profilePicture || picture;
            await user.save();
          }
        } else {
          // Create new user with Google data
          const randomPassword = Math.random().toString(36).slice(-8);
          const salt = await bcrypt.genSalt(10);
          const hashedPassword = await bcrypt.hash(randomPassword, salt);
          
          user = await User.create({
            name,
            email,
            password: hashedPassword,
            googleId: sub,
            profilePicture: picture,
            role: 'CUSTOMER' // Always customer for Google signup
          });
          
          console.log(`Created new user from Google auth: ${email}`);
        }
        
        // Generate token
        const jwtToken = generateToken(user._id);
        
        // Make sure we're not trying to redirect to the callback endpoint itself
        // This prevents infinite redirects
        let redirectUrl = frontendUrl;
        if (!redirectUrl.includes('/auth/callback')) {
          redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/callback`;
        }
        
        // Redirect back to frontend with token
        console.log(`Redirecting to frontend with token: ${redirectUrl}?token=${jwtToken}`);
        return res.redirect(`${redirectUrl}?token=${jwtToken}`);
        
      } catch (tokenError) {
        console.error('Google token exchange error details:', tokenError);
        
        // Provide more detailed error information
        let errorDetails = 'Unknown error';
        if (tokenError.response && tokenError.response.data) {
          errorDetails = JSON.stringify(tokenError.response.data);
        } else if (tokenError.message) {
          errorDetails = tokenError.message;
        }
        
        return res.redirect(`${frontendUrl}?error=${encodeURIComponent(`Failed to exchange Google token: ${errorDetails}`)}`);
      }
    } catch (error) {
      console.error('Google token exchange outer error:', error);
      return res.redirect(`${frontendUrl}?error=${encodeURIComponent(`Failed to exchange Google token: ${error.message}`)}`);
    }
    
  } catch (error) {
    console.error('Google callback error:', error);
    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=${encodeURIComponent('Server error during authentication')}`);
  }
});

// Handle Google token from frontend
router.post('/google-callback', async (req, res) => {
  try {
    const { token } = req.body;
    
    // Verify the token
    const payload = await verifyGoogleToken(token);
    if (!payload) {
      return res.status(400).json({ success: false, message: 'Invalid Google token' });
    }
    
    const { email, name, picture, sub } = payload;
    
    // Find or create user
    let user = await User.findOne({ email });
    
    if (user) {
      // If user exists but is not a customer, reject Google login
      if (user.role !== 'CUSTOMER') {
        return res.status(403).json({ 
          success: false, 
          message: 'Google login is only available for customers' 
        });
      }
      
      // Update user's Google ID if not set
      if (!user.googleId) {
        user.googleId = sub;
        await user.save();
      }
    } else {
      // Create new user with Google data
      const randomPassword = Math.random().toString(36).slice(-8);
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(randomPassword, salt);
      
      user = await User.create({
        name,
        email,
        password: hashedPassword,
        googleId: sub,
        profilePicture: picture,
        role: 'CUSTOMER' // Always customer for Google signup
      });
    }
    
    // Generate token
    const jwtToken = generateToken(user._id);
    
    // Return user data
    const userData = {
      _id: user._id,
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      profilePicture: user.profilePicture || picture
    };
    
    res.json({
      success: true,
      data: {
        user: userData,
        token: jwtToken
      }
    });
  } catch (error) {
    console.error('Google callback error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
