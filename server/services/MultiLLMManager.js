// server/services/MultiLLMManager.js
const { GeminiAI } = require('./geminiAI');
const { getModel } = require('./LLMFactory');

const MODELS = {
    CHAT: 'gemini-1.5-flash',
    REASONING: 'gemini-1.5-pro',
    TECHNICAL: 'gemini-1.5-pro',
    CREATIVE: 'gemini-1.5-flash',
    MINDMAP: 'gemini-1.5-pro',
    SUMMARY: 'gemini-1.5-pro',
    REPORT: 'gemini-1.5-pro',
    PRESENTATION: 'gemini-1.5-flash'
};

class MultiLLMManager {
    constructor() {
        this.modelInstances = {};
        Object.keys(MODELS).forEach(key => {
            const modelName = MODELS[key];
            if (!this.modelInstances[modelName]) {
                this.modelInstances[modelName] = new GeminiAI(modelName);
            }
        });
    }

    _selectModel(userQuery, type) {
        // Simple keyword-based selection for demonstration
        const lowerQuery = userQuery.toLowerCase();
        if (type === 'chat' && (lowerQuery.includes('code') || lowerQuery.includes('technical'))) {
            return this.modelInstances[MODELS.TECHNICAL];
        }
        if (type === 'reasoning' || type === 'report') {
            return this.modelInstances[MODELS.REASONING];
        }
        if (type === 'mindmap' || type === 'summary') {
             return this.modelInstances[MODELS.MINDMAP];
        }
        if (type === 'presentation' || lowerQuery.includes('creative') || lowerQuery.includes('story')) {
            return this.modelInstances[MODELS.CREATIVE];
        }
        return this.modelInstances[MODELS.CHAT];
    }

    getChatModel(userQuery) {
        return this._selectModel(userQuery, 'chat');
    }

    getReasoningModel(userQuery) {
        return this._selectModel(userQuery, 'reasoning');
    }
    
    getTechnicalModel(userQuery) {
        return this._selectModel(userQuery, 'technical');
    }

    getCreativeModel(userQuery) {
        return this._selectModel(userQuery, 'creative');
    }
    
    getMindMapModel(userQuery) {
        return this._selectModel(userQuery, 'mindmap');
    }

    getSummaryModel(userQuery) {
        return this._selectModel(userQuery, 'summary');
    }

    async generateReport(content, title) {
        const model = this._selectModel(content, 'report');
        return await model.generateReport(content, title);
    }
    
    async generatePresentation(content, title) {
        const model = this._selectModel(content, 'presentation');
        return await model.generatePresentation(content, title);
    }
    
    async generateChatResponse(userMessage, documentChunks, chatHistory, systemPrompt) {
        const model = this.getChatModel(userMessage);
        return await model.generateChatResponse(userMessage, documentChunks, chatHistory, systemPrompt);
    }
    
    async generateMindMapData(documentContent, title) {
        const model = this.getMindMapModel(documentContent);
        return await model.generateMindMapFromTranscript(documentContent, title);
    }
    
    async generatePodcastScript(documentContent) {
        const model = this.getCreativeModel(documentContent);
        return await model.generatePodcastScript(documentContent);
    }
    
    async querySyllabus(query, syllabusContent) {
        const model = this.getChatModel(query);
        const prompt = `You are an expert assistant focused on providing concise answers based ONLY on the provided syllabus content. Syllabus Content: ---${syllabusContent}--- Question: ${query} Answer:`;
        return await model.generateText(prompt);
    }
}

module.exports = MultiLLMManager;