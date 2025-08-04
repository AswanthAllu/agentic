#!/usr/bin/env node

/**
 * Gemini API Setup and Configuration Script
 * This script helps users set up their Gemini API key and test the connection
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const ENV_PATH = path.join(__dirname, 'server', '.env');

// Colors for console output
const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m',
    bright: '\x1b[1m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function createInterface() {
    return readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
}

function question(rl, query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function checkExistingEnv() {
    if (fs.existsSync(ENV_PATH)) {
        const envContent = fs.readFileSync(ENV_PATH, 'utf8');
        const apiKeyMatch = envContent.match(/GEMINI_API_KEY=(.+)/);
        
        if (apiKeyMatch && apiKeyMatch[1] && apiKeyMatch[1] !== 'your_gemini_api_key_here') {
            return apiKeyMatch[1].trim();
        }
    }
    return null;
}

async function testApiKey(apiKey) {
    try {
        log('🧪 Testing API key connection...', 'yellow');
        
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ 
            model: 'gemini-1.5-flash',
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 100,
            }
        });
        
        const result = await model.generateContent('Say "Hello, I am working correctly!" if you can understand this message.');
        const response = result.response.text().trim();
        
        if (response && response.length > 10) {
            log('✅ API key is working correctly!', 'green');
            log(`📝 Test response: "${response.substring(0, 50)}..."`, 'cyan');
            return true;
        } else {
            log('❌ API key test failed - received empty or invalid response', 'red');
            return false;
        }
        
    } catch (error) {
        log('❌ API key test failed:', 'red');
        
        if (error.message?.includes('API key not valid')) {
            log('   🔑 The API key appears to be invalid', 'red');
        } else if (error.message?.includes('quota')) {
            log('   📊 API quota exceeded - the key works but you\'ve hit usage limits', 'yellow');
            return true; // Key is valid, just quota exceeded
        } else if (error.message?.includes('blocked')) {
            log('   🚫 Request was blocked - the key works but content was filtered', 'yellow');
            return true; // Key is valid, just content filtered
        } else {
            log(`   ❓ Error: ${error.message}`, 'red');
        }
        
        return false;
    }
}

function updateEnvFile(apiKey) {
    let envContent = '';
    
    if (fs.existsSync(ENV_PATH)) {
        envContent = fs.readFileSync(ENV_PATH, 'utf8');
        
        // Update existing GEMINI_API_KEY line
        if (envContent.includes('GEMINI_API_KEY=')) {
            envContent = envContent.replace(/GEMINI_API_KEY=.*/g, `GEMINI_API_KEY=${apiKey}`);
        } else {
            // Add GEMINI_API_KEY to existing file
            envContent += `\nGEMINI_API_KEY=${apiKey}\n`;
        }
    } else {
        // Create new .env file
        envContent = `# ===== GOOGLE GEMINI AI CONFIGURATION =====
# Get your API key from https://ai.google.dev/
GEMINI_API_KEY=${apiKey}

# ===== SERVER CONFIGURATION =====
PORT=5007
NODE_ENV=development

# ===== DATABASE CONFIGURATION =====
MONGODB_URI=mongodb://localhost:27017/tutorai

# ===== JWT CONFIGURATION =====
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d

# ===== CORS CONFIGURATION =====
CORS_ORIGIN=http://localhost:3000

# ===== LOGGING =====
LOG_LEVEL=info
`;
    }
    
    fs.writeFileSync(ENV_PATH, envContent);
    log(`✅ Environment file updated: ${ENV_PATH}`, 'green');
}

async function main() {
    log('🚀 Gemini API Setup for TutorAI', 'bright');
    log('==================================\n', 'bright');
    
    const rl = createInterface();
    
    try {
        // Check for existing API key
        const existingKey = await checkExistingEnv();
        
        if (existingKey) {
            log('🔍 Found existing API key in .env file', 'yellow');
            const testExisting = await question(rl, 'Would you like to test the existing key? (y/n): ');
            
            if (testExisting.toLowerCase() === 'y') {
                const isWorking = await testApiKey(existingKey);
                
                if (isWorking) {
                    log('\n🎉 Your existing API key is working correctly!', 'green');
                    log('Your TutorAI system should now provide accurate responses.', 'green');
                    rl.close();
                    return;
                } else {
                    log('\n⚠️  Your existing API key is not working. Let\'s set up a new one.', 'yellow');
                }
            }
        }
        
        // Get API key from user
        log('\n📋 To get your Gemini API key:', 'cyan');
        log('1. Visit https://ai.google.dev/', 'cyan');
        log('2. Click "Get API key in Google AI Studio"', 'cyan');
        log('3. Create a new API key or use an existing one', 'cyan');
        log('4. Copy the API key\n', 'cyan');
        
        const apiKey = await question(rl, '🔑 Please enter your Gemini API key: ');
        
        if (!apiKey || apiKey.trim().length < 10) {
            log('❌ Invalid API key provided. Please try again.', 'red');
            rl.close();
            return;
        }
        
        // Test the API key
        const isWorking = await testApiKey(apiKey.trim());
        
        if (!isWorking) {
            log('❌ API key test failed. Please check your key and try again.', 'red');
            rl.close();
            return;
        }
        
        // Save to .env file
        updateEnvFile(apiKey.trim());
        
        log('\n🎉 Setup completed successfully!', 'green');
        log('✅ Gemini API key configured and tested', 'green');
        log('✅ Environment file updated', 'green');
        log('\n📝 Next steps:', 'cyan');
        log('1. Start your server: cd server && npm run dev', 'cyan');
        log('2. Start your client: cd client && npm start', 'cyan');
        log('3. Visit http://localhost:3000 to use TutorAI', 'cyan');
        log('\n💡 Your AI responses should now be accurate and helpful!', 'bright');
        
    } catch (error) {
        log(`❌ Setup failed: ${error.message}`, 'red');
    } finally {
        rl.close();
    }
}

// Handle script execution
if (require.main === module) {
    main().catch(error => {
        console.error('Setup script failed:', error);
        process.exit(1);
    });
}

module.exports = { main, testApiKey };