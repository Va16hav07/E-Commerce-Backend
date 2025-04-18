const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

async function fixGoogleIdIndex() {
  try {
    console.log('Connecting to MongoDB...');
    
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('Connected. Dropping googleId index...');
    
    // Drop the problematic index
    await mongoose.connection.db.collection('users').dropIndex('googleId_1');
    
    console.log('Index dropped successfully.');
    console.log('You can now run the server and registration should work.');
    
    process.exit(0);
  } catch (error) {
    if (error.code === 27) {
      console.log('Index not found. This is not an issue.');
      process.exit(0);
    }
    console.error('Error fixing index:', error);
    process.exit(1);
  }
}

fixGoogleIdIndex();
