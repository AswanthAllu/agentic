#!/usr/bin/env node

// test-all-features.js
// Comprehensive test script for all TutorAI features

const axios = require('axios');
require('dotenv').config({ path: './server/.env' });

const SERVER_URL = process.env.PORT ? `http://localhost:${process.env.PORT}` : 'http://localhost:5007';
const TEST_USER_ID = '507f1f77bcf86cd799439011'; // Valid ObjectId format

console.log('🧪 TutorAI Comprehensive Feature Test');
console.log('=====================================\n');

// Helper function to make authenticated requests
async function makeRequest(endpoint, method = 'GET', data = null) {
    try {
        const config = {
            method,
            url: `${SERVER_URL}${endpoint}`,
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': TEST_USER_ID
            }
        };
        
        if (data) {
            config.data = data;
        }
        
        const response = await axios(config);
        return response.data;
    } catch (error) {
        if (error.response) {
            throw new Error(`${error.response.status}: ${error.response.data.message || error.response.data}`);
        }
        throw error;
    }
}

// Test 1: Basic Chat Functionality
async function testBasicChat() {
    console.log('💬 Testing Basic Chat...');
    try {
        const response = await makeRequest('/api/chat/message', 'POST', {
            query: 'Hello! Can you tell me about artificial intelligence?',
            history: [],
            systemPrompt: 'You are TutorAI, an educational assistant.'
        });
        
        if (response.success && response.data && response.data.message) {
            console.log('✅ Chat working!');
            console.log(`   📝 Response preview: ${response.data.message.substring(0, 100)}...`);
            return true;
        } else {
            throw new Error('Invalid chat response format');
        }
    } catch (error) {
        console.log('❌ Chat test failed:', error.message);
        return false;
    }
}

// Test 2: Deep Search Functionality
async function testDeepSearch() {
    console.log('🔍 Testing Deep Search...');
    try {
        const response = await makeRequest('/api/chat/deep-search', 'POST', {
            query: 'What are the latest developments in machine learning?',
            history: []
        });
        
        if (response.data && response.data.message) {
            console.log('✅ Deep Search working!');
            console.log(`   📝 Response preview: ${response.data.message.substring(0, 100)}...`);
            return true;
        } else {
            throw new Error('Invalid deep search response');
        }
    } catch (error) {
        console.log('❌ Deep Search test failed:', error.message);
        return false;
    }
}

// Test 3: Agentic Task Functionality
async function testAgenticTask() {
    console.log('🤖 Testing Agentic Task...');
    try {
        const response = await makeRequest('/api/chat/agentic', 'POST', {
            query: 'Create a study plan for learning Python programming in 30 days'
        });
        
        if (response.data && response.data.message) {
            console.log('✅ Agentic Task working!');
            console.log(`   📝 Response preview: ${response.data.message.substring(0, 100)}...`);
            return true;
        } else {
            throw new Error('Invalid agentic response');
        }
    } catch (error) {
        console.log('❌ Agentic Task test failed:', error.message);
        return false;
    }
}

// Test 4: File Upload (if possible)
async function testFileUpload() {
    console.log('📁 Testing File Upload...');
    try {
        // This is a basic test - in real scenario, you'd upload an actual file
        const response = await makeRequest('/api/files', 'GET');
        console.log('✅ File endpoint accessible!');
        return true;
    } catch (error) {
        console.log('❌ File upload test failed:', error.message);
        return false;
    }
}

// Test 5: Network Information
async function testNetwork() {
    console.log('🌐 Testing Network Information...');
    try {
        const response = await makeRequest('/api/network', 'GET');
        if (response.ips && Array.isArray(response.ips)) {
            console.log('✅ Network info working!');
            console.log(`   📡 Available IPs: ${response.ips.length}`);
            return true;
        } else {
            throw new Error('Invalid network response');
        }
    } catch (error) {
        console.log('❌ Network test failed:', error.message);
        return false;
    }
}

// Test API Key Configuration
async function testAPIKeyConfig() {
    console.log('🔑 Testing API Key Configuration...');
    
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
        console.log('⚠️  API Key not configured - features will use fallback responses');
        return false;
    } else if (apiKey.length < 20) {
        console.log('⚠️  API Key appears invalid (too short)');
        return false;
    } else {
        console.log('✅ API Key configured (length:', apiKey.length, 'characters)');
        return true;
    }
}

// Test Server Health
async function testServerHealth() {
    console.log('🏥 Testing Server Health...');
    try {
        const response = await axios.get(SERVER_URL);
        if (response.status === 200) {
            console.log('✅ Server is healthy!');
            console.log(`   📋 Status: ${response.data}`);
            return true;
        }
        return false;
    } catch (error) {
        console.log('❌ Server health check failed:', error.message);
        console.log('   💡 Make sure server is running: cd server && npm run dev');
        return false;
    }
}

// Main test runner
async function runAllTests() {
    console.log('Starting comprehensive feature tests...\n');
    
    const results = {
        serverHealth: await testServerHealth(),
        apiKey: await testAPIKeyConfig(),
        network: false,
        basicChat: false,
        deepSearch: false,
        agenticTask: false,
        fileUpload: false
    };
    
    if (results.serverHealth) {
        console.log(); // Add spacing
        results.network = await testNetwork();
        results.basicChat = await testBasicChat();
        results.deepSearch = await testDeepSearch();
        results.agenticTask = await testAgenticTask();
        results.fileUpload = await testFileUpload();
    }
    
    console.log('\n📊 Feature Test Results:');
    console.log('========================');
    console.log('🏥 Server Health:', results.serverHealth ? '✅ PASS' : '❌ FAIL');
    console.log('🔑 API Key Config:', results.apiKey ? '✅ PASS' : '⚠️  NOT CONFIGURED');
    console.log('🌐 Network Info:', results.network ? '✅ PASS' : '❌ FAIL');
    console.log('💬 Basic Chat:', results.basicChat ? '✅ PASS' : '❌ FAIL');
    console.log('🔍 Deep Search:', results.deepSearch ? '✅ PASS' : '❌ FAIL');
    console.log('🤖 Agentic Tasks:', results.agenticTask ? '✅ PASS' : '❌ FAIL');
    console.log('📁 File System:', results.fileUpload ? '✅ PASS' : '❌ FAIL');
    
    const criticalTests = [results.serverHealth, results.basicChat];
    const allCriticalPassed = criticalTests.every(result => result === true);
    
    const enhancedFeatures = [results.deepSearch, results.agenticTask];
    const enhancedFeaturesWorking = enhancedFeatures.filter(result => result === true).length;
    
    console.log('\n🎯 Summary:');
    console.log('===========');
    
    if (allCriticalPassed) {
        console.log('✅ Core functionality is working!');
        
        if (results.apiKey) {
            console.log('✅ Full AI features available');
            console.log(`✅ Enhanced features working: ${enhancedFeaturesWorking}/${enhancedFeatures.length}`);
        } else {
            console.log('⚠️  Using fallback responses (configure API key for full features)');
        }
        
        console.log('\n🚀 Ready to use TutorAI!');
        console.log('   🌐 Access at: http://localhost:3000');
        console.log('   📚 Available features:');
        console.log('     • Chat with AI assistance');
        console.log('     • Document upload and analysis');
        console.log('     • Podcast generation from documents');
        console.log('     • Mind map creation');
        console.log('     • Report generation');
        console.log('     • Presentation creation');
        console.log('     • Deep search capabilities');
        console.log('     • Agentic task execution');
    } else {
        console.log('❌ Critical issues found. Please check:');
        if (!results.serverHealth) {
            console.log('   • Start the server: cd server && npm run dev');
        }
        if (!results.basicChat) {
            console.log('   • Check API configuration and error logs');
        }
        console.log('   • See TROUBLESHOOTING.md for detailed solutions');
    }
    
    return allCriticalPassed;
}

// Enhanced feature descriptions
function showFeatureDescriptions() {
    console.log('\n📋 TutorAI Enhanced Features:');
    console.log('=============================');
    console.log('');
    console.log('💬 **Smart Chat System**');
    console.log('   • Intelligent responses powered by Gemini AI');
    console.log('   • Context-aware conversations');
    console.log('   • Educational focus with fallback responses');
    console.log('');
    console.log('🎧 **Podcast Generation**');
    console.log('   • Convert documents to engaging podcast scripts');
    console.log('   • Two-host conversational format');
    console.log('   • Educational content with natural flow');
    console.log('');
    console.log('🧠 **Mind Map Creation**');
    console.log('   • Visual representation of document content');
    console.log('   • Hierarchical structure with color coding');
    console.log('   • Interactive node exploration');
    console.log('');
    console.log('📊 **Report Generation**');
    console.log('   • Professional academic reports');
    console.log('   • Comprehensive analysis and insights');
    console.log('   • Structured with executive summary and recommendations');
    console.log('');
    console.log('📽️ **Presentation Creation**');
    console.log('   • Educational slide decks');
    console.log('   • 10-15 slides with engaging content');
    console.log('   • Design notes and delivery tips included');
    console.log('');
    console.log('🔍 **Deep Search**');
    console.log('   • Advanced research capabilities');
    console.log('   • Web search integration');
    console.log('   • Synthesized results from multiple sources');
    console.log('');
    console.log('🤖 **Agentic Tasks**');
    console.log('   • Complex task execution');
    console.log('   • Multi-step problem solving');
    console.log('   • Intelligent task breakdown');
    console.log('');
}

// Handle command line execution
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.includes('--features') || args.includes('-f')) {
        showFeatureDescriptions();
        process.exit(0);
    }
    
    runAllTests().then(success => {
        if (args.includes('--verbose') || args.includes('-v')) {
            showFeatureDescriptions();
        }
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('Test execution failed:', error);
        process.exit(1);
    });
}

module.exports = { runAllTests, testBasicChat, testDeepSearch, testAgenticTask };