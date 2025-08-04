const mongoose = require('mongoose');
// const dotenv = require('dotenv'); // Removed dotenv

// dotenv.config(); // Removed dotenv

// Modified connectDB to accept the URI as an argument
const connectDB = async (mongoUri) => {
  if (!mongoUri) {
      console.warn('⚠️  MongoDB URI is missing. Running in development mode without database.');
      return null;
  }
  try {
    // console.log(`Attempting MongoDB connection to: ${mongoUri}`); // Debug: Careful logging URI
    const conn = await mongoose.connect(mongoUri, {
      // Mongoose 6+ uses these defaults, so they are not needed
      // useNewUrlParser: true,
      // useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000 // Timeout faster for development
    });

    console.log(`✓ MongoDB Connected Successfully`); // Simpler success message
    return conn; // Return connection object if needed elsewhere
  } catch (error) {
    console.warn('⚠️  MongoDB Connection Error:', error.message);
    console.warn('⚠️  Running in development mode without database. Some features may be limited.');
    return null; // Don't exit, continue without database
  }
};

module.exports = connectDB;
