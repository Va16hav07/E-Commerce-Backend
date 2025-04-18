// Script to create a rider user for testing
const mongoose = require('mongoose');
const User = require('../models/User');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ecomm')
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Create a rider user
async function createRider() {
  try {
    // Check if rider already exists
    const existingRider = await User.findOne({ email: 'rider@example.com' });
    
    if (existingRider) {
      console.log('Rider already exists:', existingRider);
      mongoose.disconnect();
      return;
    }
    
    const rider = await User.create({
      name: 'Rider One',
      email: 'rider@example.com',
      password: 'rider123',
      role: 'RIDER',
      phone: '9876543210'
    });
    
    console.log('Rider created successfully:', rider);
    
    // Create a second rider for testing
    const rider2 = await User.create({
      name: 'Rider Two',
      email: 'rider2@example.com',
      password: 'rider123',
      role: 'RIDER',
      phone: '9876543211'
    });
    
    console.log('Second rider created successfully:', rider2);
    
    mongoose.disconnect();
  } catch (err) {
    console.error('Error creating rider:', err);
    mongoose.disconnect();
  }
}

createRider();
