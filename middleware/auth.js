const User = require('../models/User');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');

// Initialize Google OAuth client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Verify JWT token
const verifyToken = async (token) => {
  try {
    if (!token) return null;
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
};

// Check if user is authenticated
exports.isAuthenticated = async (req, res, next) => {
  console.log("Checking authentication:", req.isAuthenticated());
  console.log("Session:", req.session);
  console.log("User in request:", req.user);
  
  // First check if user is authenticated with session
  if (req.isAuthenticated() && req.user) {
    return next();
  }
  
  // If not, check for token in header (for API requests)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    console.log('Found token in Authorization header');
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('Token verified successfully:', decoded);
      
      const user = await User.findById(decoded.id);
      if (!user) {
        console.log('User not found for token');
        return res.status(401).json({ success: false, message: 'User not found' });
      }
      
      console.log('User found for token:', user.email);
      req.user = user;
      return next();
    } catch (tokenError) {
      console.error('Token verification failed:', tokenError);
    }
  } else {
    console.log('No Authorization header with Bearer token found');
  }
  
  // Neither session nor token authentication worked
  return res.status(401).json({ success: false, message: 'Not authenticated. Please log in.' });
};

// Authorization middleware based on user role
exports.authorize = (...roles) => {
  return (req, res, next) => {
    console.log("Authorizing user:", req.user ? req.user.email : 'No user');
    console.log("Required roles:", roles);
    console.log("User role:", req.user ? req.user.role : 'No role');
    
    if (!req.user) {
      console.log("Authorization failed: No user in request");
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    
    if (!roles.includes(req.user.role)) {
      console.log(`Authorization failed: User role '${req.user.role}' not in required roles:`, roles);
      return res.status(403).json({ 
        success: false, 
        message: `User role '${req.user.role}' is not authorized to access this resource` 
      });
    }
    
    console.log("Authorization successful");
    next();
  };
};

// Verify Google token
exports.verifyGoogleToken = async (token) => {
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    
    const payload = ticket.getPayload();
    return payload;
  } catch (error) {
    console.error('Google token verification failed:', error);
    return null;
  }
};

// Middleware to check if user is a customer
exports.isCustomer = (req, res, next) => {
  if (req.user && req.user.role === 'CUSTOMER') {
    next();
  } else {
    res.status(403).json({ success: false, message: 'Access restricted to customers' });
  }
};
