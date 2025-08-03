// server/services/aiService.js
const { GeminiAI } = require('./geminiAI');
const { SUMMARIZATION_TYPES, SUMMARIZATION_STYLES } = require('../utils/constants');
const MultiLLMManager = require('./MultiLLMManager');

class AIService {
    constructor() {
        this.multiLLMManager = new MultiLLMManager();
    }

    async generateChatResponse(userMessage, documentChunks, chatHistory, systemPrompt = '') {
        const model = this.multiLLMManager.getChatModel(userMessage);
        return await model.generateChatResponse(userMessage, documentChunks, chatHistory, systemPrompt);
    }

    async generateSummary(documentContent, options = {}) {
        const model = this.multiLLMManager.getSummaryModel(documentContent);
        return await model.generateSummary(documentContent, options);
    }

    async generatePodcastScript(documentContent) {
        const model = this.multiLLMManager.getCreativeModel(documentContent);
        return await model.generatePodcastScript(documentContent);
    }

    async generateMindMapData(documentContent, title) {
        const model = this.multiLLMManager.getMindMapModel(documentContent);
        return await model.generateMindMapFromTranscript(documentContent, title);
    }

    async generateReport(content, title) {
        const model = this.multiLLMManager.getTechnicalModel(content);
        return await model.generateReport(content, title);
    }

    async generatePresentation(content, title) {
        const model = this.multiLLMManager.getCreativeModel(content);
        return await model.generatePresentation(content, title);
    }
    
    async generateText(prompt) {
        const model = this.multiLLMManager.getChatModel(prompt);
        return await model.generateText(prompt);
    }

    buildSystemPrompt(systemPrompt, context, chatHistory) {
        const model = this.multiLLMManager.getChatModel(systemPrompt);
        return model.buildSystemPrompt(systemPrompt, context, chatHistory);
    }

    buildContext(documentChunks) {
        const model = this.multiLLMManager.getChatModel('');
        return model.buildContext(documentChunks);
    }
}

module.exports = new AIService();
