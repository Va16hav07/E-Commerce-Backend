const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
const User = require('../models/User');
const ApprovedEmail = require('../models/ApprovedEmail');

// Local Strategy for email/password login
passport.use(
  new LocalStrategy(
    { usernameField: 'email' },
    async (email, password, done) => {
      try {
        // Find user by email with password
        const user = await User.findOne({ email }).select('+password');
        
        // No user found
        if (!user) {
          return done(null, false, { message: 'Invalid email or password' });
        }
        
        // Check if password matches
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
          return done(null, false, { message: 'Invalid email or password' });
        }
        
        // Remove password before returning user
        const userObject = user.toObject();
        delete userObject.password;
        
        return done(null, userObject);
      } catch (error) {
        return done(error);
      }
    }
  )
);

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/auth/google/callback'
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Extract email from Google profile
      const email = profile.emails[0].value;
      
      // Check if email is in approved list for admin or rider roles
      const approvedEmail = await ApprovedEmail.findOne({ email });
      
      // Check if user already exists
      let user = await User.findOne({ googleId: profile.id });
      
      if (user) {
        return done(null, user);
      }
      
      // Determine role based on approved emails
      let role = 'CUSTOMER'; // Default role is CUSTOMER
      if (approvedEmail) {
        if (email.includes('admin')) {
          role = 'ADMIN';
        } else if (email.includes('rider')) {
          role = 'RIDER';
        }
      }
      
      // Create new user
      user = await User.create({
        name: profile.displayName,
        email: email,
        googleId: profile.id,
        photo: profile.photos[0].value,
        role: role
      });
      
      return done(null, user);
    } catch (error) {
      return done(error);
    }
  }
));

// Serialize user into session
passport.serializeUser((user, done) => {
  console.log('Serializing user:', user._id, user.email, user.role);
  done(null, user._id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    console.log('Deserializing user ID:', id);
    const user = await User.findById(id);
    if (!user) {
      console.log('User not found during deserialization');
      return done(null, false);
    }
    console.log('Found user:', user.email, user.role);
    done(null, user);
  } catch (error) {
    console.error('Error in deserialization:', error);
    done(error);
  }
});

module.exports = passport;
