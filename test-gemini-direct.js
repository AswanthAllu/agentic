#!/usr/bin/env node

/**
 * Direct Gemini API Test
 * This script tests the Gemini API directly without the server infrastructure
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: './server/.env' });

async function testGeminiDirect() {
    console.log('🧪 Testing Gemini API Directly');
    console.log('===============================\n');
    
    // Check API key
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
        console.log('❌ GEMINI_API_KEY not configured');
        console.log('Please run: node setup-gemini.js');
        return false;
    }
    
    console.log('✅ API key found');
    console.log(`Key length: ${apiKey.length} characters\n`);
    
    try {
        // Initialize Gemini
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ 
            model: 'gemini-1.5-flash',
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 8192,
                topP: 0.8,
                topK: 40,
            }
        });
        
        console.log('🤖 Testing basic response...');
        
        // Test basic response
        const prompt = `You are an expert AI assistant specialized in providing accurate, helpful, and comprehensive responses. 
Follow these guidelines:
1. Provide factual, well-reasoned answers
2. If you're uncertain about something, clearly state your uncertainty
3. Be thorough but concise in your explanations
4. Maintain a helpful and professional tone

User Question: Hello, how are you? Please tell me about your capabilities.

Provide a detailed and accurate response:`;

        const result = await model.generateContent(prompt);
        const response = result.response.text().trim();
        
        console.log('✅ Gemini API Response:');
        console.log('========================');
        console.log(response);
        console.log('========================\n');
        
        // Validate response quality
        if (response.length < 50) {
            console.log('⚠️  Response seems too short');
            return false;
        }
        
        console.log(`📊 Response Stats:`);
        console.log(`   Length: ${response.length} characters`);
        console.log(`   Words: ~${response.split(' ').length} words`);
        
        // Test with a more complex question
        console.log('\n🧠 Testing complex reasoning...');
        
        const complexPrompt = `You are an expert AI assistant. Please explain the concept of machine learning in simple terms, including its main types and real-world applications. Be accurate and comprehensive.`;
        
        const complexResult = await model.generateContent(complexPrompt);
        const complexResponse = complexResult.response.text().trim();
        
        console.log('✅ Complex Response:');
        console.log('====================');
        console.log(complexResponse.substring(0, 200) + '...');
        console.log('====================\n');
        
        console.log('🎉 All tests passed! Gemini API is working correctly.');
        console.log('Your response accuracy issues should now be resolved.');
        
        return true;
        
    } catch (error) {
        console.log('❌ Gemini API Test Failed:');
        console.log(`Error: ${error.message}\n`);
        
        if (error.message?.includes('API key not valid')) {
            console.log('💡 Solution: Your API key appears to be invalid');
            console.log('   1. Visit https://ai.google.dev/');
            console.log('   2. Generate a new API key');
            console.log('   3. Run: node setup-gemini.js');
        } else if (error.message?.includes('quota')) {
            console.log('💡 Solution: API quota exceeded');
            console.log('   1. Check your usage at https://ai.google.dev/');
            console.log('   2. Wait for quota reset or upgrade your plan');
        } else if (error.message?.includes('blocked')) {
            console.log('💡 Solution: Content was blocked');
            console.log('   1. Try rephrasing your prompt');
            console.log('   2. Avoid sensitive content');
        } else {
            console.log('💡 Solution: Check your internet connection and API key');
        }
        
        return false;
    }
}

// Handle command line execution
if (require.main === module) {
    testGeminiDirect().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('Test execution failed:', error);
        process.exit(1);
    });
}

module.exports = { testGeminiDirect };