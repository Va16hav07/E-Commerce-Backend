const { OAuth2Client } = require('google-auth-library');

// Check for required environment variables
if (!process.env.GOOGLE_CLIENT_ID) {
  console.error('ERROR: Missing GOOGLE_CLIENT_ID environment variable');
}

if (!process.env.GOOGLE_CLIENT_SECRET) {
  console.error('ERROR: Missing GOOGLE_CLIENT_SECRET environment variable');
}

console.log('Initializing Google OAuth client with:');
console.log('- Client ID:', process.env.GOOGLE_CLIENT_ID ? `${process.env.GOOGLE_CLIENT_ID.substring(0, 10)}...` : 'MISSING');
console.log('- Client Secret:', process.env.GOOGLE_CLIENT_SECRET ? 'PROVIDED' : 'MISSING');
console.log('- Redirect URI:', `${process.env.BACKEND_URL || 'http://localhost:5000'}/auth/google/callback`);

// Create OAuth client with all required parameters
const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.BACKEND_URL || 'http://localhost:5000'}/auth/google/callback`
);

// Export client and utility functions
module.exports = {
  googleClient,
  
  // Function to get Google OAuth URL
  getGoogleAuthUrl(redirectUri) {
    return googleClient.generateAuthUrl({
      access_type: 'offline', // Get refresh token
      scope: [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email'
      ],
      redirect_uri: `${process.env.BACKEND_URL || 'http://localhost:5000'}/auth/google/callback`,
      state: redirectUri // Pass the frontend callback URL as state
    });
  }
};
