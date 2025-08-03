#!/usr/bin/env node

// test-chat.js
// Simple test script to verify chat functionality

const axios = require('axios');
require('dotenv').config({ path: './server/.env' });

const SERVER_URL = process.env.PORT ? `http://localhost:${process.env.PORT}` : 'http://localhost:5007';

console.log('🧪 TutorAI Chat Test');
console.log('===================\n');

async function testServerHealth() {
    try {
        console.log('🔍 Testing server health...');
        const response = await axios.get(SERVER_URL);
        console.log('✅ Server is running:', response.data);
        return true;
    } catch (error) {
        console.log('❌ Server health check failed:', error.message);
        console.log('   Make sure the server is running: cd server && npm run dev');
        return false;
    }
}

async function testChatEndpoint() {
    try {
        console.log('🤖 Testing basic chat functionality...');
        
        // Create a test user ID for the request
        const testUserId = '507f1f77bcf86cd799439011'; // Valid ObjectId format
        
        const chatPayload = {
            query: 'Hi, how are you?',
            history: [],
            systemPrompt: 'You are a helpful AI assistant.'
        };
        
        const response = await axios.post(`${SERVER_URL}/api/chat/message`, chatPayload, {
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': testUserId
            }
        });
        
        if (response.data && response.data.data && response.data.data.message) {
            console.log('✅ Chat response received:');
            console.log('   📝 Response:', response.data.data.message.substring(0, 100) + '...');
            return true;
        } else {
            console.log('⚠️  Unexpected response format:', response.data);
            return false;
        }
        
    } catch (error) {
        if (error.response) {
            console.log('❌ Chat test failed with status:', error.response.status);
            console.log('   📝 Error:', error.response.data.message || error.response.data);
            
            if (error.response.status === 401) {
                console.log('   💡 Tip: This might be an authentication issue. Check if a test user exists in MongoDB.');
            } else if (error.response.data.message?.includes('API key')) {
                console.log('   💡 Tip: Check your GEMINI_API_KEY in server/.env');
            }
        } else {
            console.log('❌ Chat test failed:', error.message);
        }
        return false;
    }
}

async function testAPIKey() {
    console.log('🔑 Testing API key configuration...');
    
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
        console.log('❌ GEMINI_API_KEY not configured properly');
        console.log('   📝 Please set your API key in server/.env');
        console.log('   🔗 Get your key from: https://makersuite.google.com/app/apikey');
        return false;
    } else {
        console.log('✅ API key is configured (length:', apiKey.length, 'characters)');
        return true;
    }
}

async function runTests() {
    console.log('Starting comprehensive tests...\n');
    
    const results = {
        apiKey: await testAPIKey(),
        serverHealth: false,
        chatEndpoint: false
    };
    
    if (results.apiKey) {
        results.serverHealth = await testServerHealth();
        
        if (results.serverHealth) {
            // Wait a moment for server to be fully ready
            await new Promise(resolve => setTimeout(resolve, 1000));
            results.chatEndpoint = await testChatEndpoint();
        }
    }
    
    console.log('\n📊 Test Results:');
    console.log('================');
    console.log('🔑 API Key Configuration:', results.apiKey ? '✅ PASS' : '❌ FAIL');
    console.log('🏥 Server Health:', results.serverHealth ? '✅ PASS' : '❌ FAIL');
    console.log('💬 Chat Functionality:', results.chatEndpoint ? '✅ PASS' : '❌ FAIL');
    
    const allPassed = Object.values(results).every(result => result === true);
    
    if (allPassed) {
        console.log('\n🎉 All tests passed! TutorAI should be working correctly.');
        console.log('   🌐 Visit http://localhost:3000 to use the application');
    } else {
        console.log('\n⚠️  Some tests failed. Please check the issues above.');
        console.log('   📖 See TROUBLESHOOTING.md for detailed solutions');
    }
    
    return allPassed;
}

// Handle command line execution
if (require.main === module) {
    runTests().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('Test execution failed:', error);
        process.exit(1);
    });
}

module.exports = { runTests, testServerHealth, testChatEndpoint, testAPIKey };