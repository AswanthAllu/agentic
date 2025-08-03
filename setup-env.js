#!/usr/bin/env node

// setup-env.js
// Interactive script to help set up the TutorAI environment

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('🎓 Welcome to TutorAI Setup!');
console.log('=====================================\n');

function question(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function setupEnvironment() {
    try {
        const serverEnvPath = path.join(__dirname, 'server', '.env');
        
        console.log('Let\'s set up your environment variables...\n');
        
        // Check if .env already exists
        if (fs.existsSync(serverEnvPath)) {
            const overwrite = await question('❓ .env file already exists. Do you want to overwrite it? (y/n): ');
            if (overwrite.toLowerCase() !== 'y') {
                console.log('✅ Setup cancelled. Your existing .env file is preserved.');
                rl.close();
                return;
            }
        }
        
        // Get Gemini API Key
        console.log('🔑 Google Gemini AI Configuration');
        console.log('   Get your API key from: https://makersuite.google.com/app/apikey\n');
        
        const geminiApiKey = await question('Enter your Gemini API Key: ');
        
        if (!geminiApiKey || geminiApiKey.trim() === '') {
            console.log('⚠️  Warning: No API key provided. You can add it later to the .env file.');
        }
        
        // Get MongoDB URI
        console.log('\n💾 Database Configuration');
        const useDefaultMongo = await question('Use default MongoDB URI (mongodb://localhost:27017/chatbotGeminiDB4)? (y/n): ');
        
        let mongoUri = 'mongodb://localhost:27017/chatbotGeminiDB4';
        if (useDefaultMongo.toLowerCase() !== 'y') {
            mongoUri = await question('Enter your MongoDB connection string: ');
        }
        
        // Generate JWT Secret
        const jwtSecret = require('crypto').randomBytes(64).toString('hex');
        
        // Get server port
        const useDefaultPort = await question('\n🚀 Server Configuration\nUse default port 5007? (y/n): ');
        let port = '5007';
        if (useDefaultPort.toLowerCase() !== 'y') {
            port = await question('Enter server port: ');
        }
        
        // Create .env content
        const envContent = `# Environment Configuration for TutorAI Server
# Generated on: ${new Date().toISOString()}

# === GOOGLE GEMINI AI CONFIGURATION ===
# Required: Get your API key from https://makersuite.google.com/app/apikey
GEMINI_API_KEY=${geminiApiKey || 'your_gemini_api_key_here'}

# === DATABASE CONFIGURATION ===
# MongoDB connection string
MONGO_URI=${mongoUri}

# === SERVER CONFIGURATION ===
# Server port
PORT=${port}

# === JWT CONFIGURATION ===
# JWT secret for user authentication (auto-generated)
JWT_SECRET=${jwtSecret}

# === OPTIONAL CONFIGURATIONS ===
# Node environment
NODE_ENV=development

# File upload limits (in MB)
MAX_FILE_SIZE=50

# Cache settings
CACHE_TTL=3600

# Rate limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# === LOGGING ===
LOG_LEVEL=info
`;
        
        // Write .env file
        fs.writeFileSync(serverEnvPath, envContent);
        
        console.log('\n✅ Environment setup complete!');
        console.log('📁 Created: server/.env');
        
        if (!geminiApiKey || geminiApiKey.trim() === '') {
            console.log('\n⚠️  IMPORTANT: Don\'t forget to add your Gemini API key to server/.env');
            console.log('   The application won\'t work properly without it.');
        }
        
        console.log('\n🚀 Next steps:');
        console.log('   1. Make sure MongoDB is running');
        console.log('   2. Start the server: cd server && npm run dev');
        console.log('   3. Start the client: cd client && npm start');
        console.log('   4. Visit http://localhost:3000 to use TutorAI');
        
        console.log('\n📖 Need help? Check the README.md file for more information.');
        
    } catch (error) {
        console.error('❌ Setup failed:', error.message);
    } finally {
        rl.close();
    }
}

// Self-executing setup
setupEnvironment();