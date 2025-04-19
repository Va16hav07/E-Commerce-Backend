const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const { verifyGoogleToken } = require('../middleware/auth');

// Initialize Google OAuth client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

// Regular registration
exports.register = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    
    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ 
        success: false, 
        message: 'User already exists with this email' 
      });
    }
    
    // Create user
    const user = await User.create({
      name,
      email,
      password, // Will be hashed via pre-save hook
      phone,
      role: 'CUSTOMER' // Default role for signup
    });
    
    // Generate token
    const token = generateToken(user._id);
    
    // Return user data without password
    const userData = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone
    };
    
    res.status(201).json({
      success: true,
      data: {
        user: userData,
        token
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Regular login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    // Check password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    // Generate token
    const token = generateToken(user._id);
    
    // Return user data without password
    const userData = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone
    };
    
    res.json({
      success: true,
      data: {
        user: userData,
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Redirect to Google OAuth
exports.googleAuth = (req, res) => {
  try {
    // Use the redirect_uri from query params if provided, otherwise use the configured frontend URL
    const redirectUri = req.query.redirect_uri || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/callback`;
    
    console.log(`Google OAuth Request received. Will redirect back to: ${redirectUri}`);
    
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${
      process.env.GOOGLE_CLIENT_ID
    }&redirect_uri=${
      encodeURIComponent(`${process.env.BACKEND_URL || 'http://localhost:5000'}/auth/google/callback`)
    }&response_type=code&scope=email profile&state=${
      encodeURIComponent(redirectUri) // Pass frontend URL to redirect back after auth
    }`;
    
    console.log(`Redirecting to Google OAuth: ${googleAuthUrl}`);
    res.redirect(googleAuthUrl);
  } catch (error) {
    console.error('Google Auth Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error initiating Google authentication'
    });
  }
};

// Handle Google OAuth callback from redirect flow
exports.googleAuthCallback = async (req, res) => {
  try {
    const { code } = req.query;
    const { state } = req.query;  // This contains the frontend URL
    
    const frontendUrl = state || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/callback`;
    
    console.log(`Google OAuth callback received with code: ${code ? 'present' : 'missing'}`);
    console.log(`Will redirect to: ${frontendUrl}`);
    
    if (!code) {
      return res.redirect(`${frontendUrl}?error=Google authentication failed: No code received`);
    }
    
    try {
      // Exchange code for tokens
      const { tokens } = await googleClient.getToken({
        code,
        redirect_uri: `${process.env.BACKEND_URL || 'http://localhost:5000'}/auth/google/callback`
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
          return res.redirect(`${frontendUrl}?error=Google login is only available for customers`);
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
      
      // Redirect back to frontend with token
      console.log(`Redirecting to frontend with token: ${frontendUrl}?token=${jwtToken}`);
      return res.redirect(`${frontendUrl}?token=${jwtToken}`);
      
    } catch (error) {
      console.error('Google token exchange error:', error);
      return res.redirect(`${frontendUrl}?error=Failed to exchange Google token`);
    }
    
  } catch (error) {
    console.error('Google callback error:', error);
    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=Server error during authentication`);
  }
};

// Handle Google token from frontend
exports.googleCallback = async (req, res) => {
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
};

// Get current user
exports.getCurrentUser = (req, res) => {
  // User is available from isAuthenticated middleware
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }
  
  const user = {
    _id: req.user._id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role,
    profilePicture: req.user.profilePicture,
    phone: req.user.phone
  };
  
  res.json({
    success: true,
    user
  });
};

// Logout
exports.logout = (req, res) => {
  if (req.logout) {
    req.logout((err) => {
      if (err) {
        console.error('Logout error:', err);
        return res.status(500).json({ success: false, message: 'Error during logout' });
      }
      res.json({ success: true, message: 'Successfully logged out' });
    });
  } else {
    // For token-based authentication, just send success response
    // The frontend will handle clearing the token
    res.json({ success: true, message: 'Successfully logged out' });
  }
};
