// server/services/LLMFactory.js
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');

const DEFAULT_MODEL = 'gemini-1.5-flash';

const models = {};

const getGeminiModel = (modelName) => {
    if (models[modelName]) {
        return models[modelName];
    }
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.warn('GEMINI_API_KEY is not set. AI services will be disabled.');
        return null;
    }
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            ]
        });
        models[modelName] = model;
        return model;
    } catch (error) {
        console.error(`Failed to create model instance for ${modelName}:`, error);
        return null;
    }
};

module.exports = { getModel: getGeminiModel };