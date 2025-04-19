require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const cors = require('cors');
const dotenv = require('dotenv');

// Initialize express app
const app = express();

// Connect to MongoDB with enhanced error handling
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 15000,
  heartbeatFrequencyMS: 10000, // Check server status every 10 seconds
  retryWrites: true, // Enable retryable writes
  socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
})
.then(() => console.log('MongoDB Connected'))
.catch(err => {
  console.error('MongoDB Connection Error:', err);
  process.exit(1);
});

// Monitor for MongoDB connection issues
mongoose.connection.on('error', err => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected. Attempting to reconnect...');
});

mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconnected');
});

// Graceful shutdown handling
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('MongoDB connection closed due to app termination');
  process.exit(0);
});

// CORS middleware - Important to place BEFORE other middleware
app.use(cors({
  origin: function(origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      // Add your frontend URL here
    ];
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // This is important for cookies/auth
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parse JSON bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your_session_secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ 
    mongoUrl: process.env.MONGO_URI,
    ttl: 60 * 60 * 24 // 1 day
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24, // 1 day
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  }
}));

// Passport config
require('./config/passport');
app.use(passport.initialize());
app.use(passport.session());

// Debug middleware to see request details
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  console.log('Session ID:', req.sessionID);
  console.log('Authenticated:', req.isAuthenticated());
  console.log('User:', req.user ? `${req.user.email} (${req.user.role})` : 'Not logged in');
  next();
});

// Debug Google OAuth configuration
console.log('Starting server with Google OAuth configuration:');
console.log('- GOOGLE_CLIENT_ID exists:', !!process.env.GOOGLE_CLIENT_ID);
console.log('- GOOGLE_CLIENT_SECRET exists:', !!process.env.GOOGLE_CLIENT_SECRET);
console.log('- JWT_SECRET exists:', !!process.env.JWT_SECRET);
console.log('- FRONTEND_URL:', process.env.FRONTEND_URL || 'http://localhost:5173');
console.log('- BACKEND_URL:', process.env.BACKEND_URL || 'http://localhost:5000');

// Routes
app.use('/auth', require('./routes/auth'));

// Print all registered routes for debugging
app._router.stack.forEach((middleware) => {
  if(middleware.route){ // routes registered directly on the app
    console.log(`Route: ${Object.keys(middleware.route.methods)} ${middleware.route.path}`);
  } else if(middleware.name === 'router'){ // router middleware
    middleware.handle.stack.forEach((handler) => {
      if(handler.route){
        const path = handler.route.path;
        console.log(`Router Route: ${Object.keys(handler.route.methods)} ${path}`);
      }
    });
  }
});

// Add try/catch blocks around route imports for better error handling
try {
  app.use('/products', require('./routes/products'));
  console.log('Registered /products routes');
} catch (err) {
  console.error('Error loading products route:', err);
}

try {
  app.use('/orders', require('./routes/orders'));
  console.log('Registered /orders routes');
} catch (err) {
  console.error('Error loading orders route:', err);
}

try {
  app.use('/users', require('./routes/users'));
} catch (err) {
  console.error('Error loading users route:', err);
}

try {
  app.use('/customer', require('./routes/customer'));
} catch (err) {
  console.error('Error loading customer route:', err);
}

try {
  app.use('/admin', require('./routes/admin'));
} catch (err) {
  console.error('Error loading admin route:', err);
}

// Basic route
app.get('/', (req, res) => {
  res.send('E-commerce API is running');
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err.stack);
  res.status(500).json({
    success: false,
    message: 'Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} - ${new Date().toLocaleString()}`);
  console.log('------ API SERVER CONFIGURATION ------');
  console.log('Frontend URL:', process.env.FRONTEND_URL || 'http://localhost:5173');
  console.log('Backend URL:', process.env.BACKEND_URL || 'http://localhost:5000');
  console.log('Google OAuth Configured:', !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET);
  console.log('Using OAuth callback:', `${process.env.BACKEND_URL || 'http://localhost:5000'}/auth/google/callback`);
  console.log('------------------------------------');
});
