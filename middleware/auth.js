const User = require('../models/User');

// Check if user is authenticated
exports.isAuthenticated = (req, res, next) => {
  console.log("Checking authentication:", req.isAuthenticated());
  console.log("Session:", req.session);
  console.log("User in request:", req.user);
  
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ success: false, message: 'Not authenticated. Please log in.' });
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
