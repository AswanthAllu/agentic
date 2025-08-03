// server/services/UserMultiLLMManager.js
const UserGeminiService = require('./UserGeminiService');

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

class UserMultiLLMManager {
    constructor(userApiKey) {
        this.userApiKey = userApiKey;
        this.modelInstances = {};
        this.initialized = false;
    }

    async initializeModels() {
        if (this.initialized) return;
        
        if (!this.userApiKey) {
            throw new Error('User Gemini API key is required');
        }

        try {
            // Initialize unique model instances for this user
            const uniqueModels = [...new Set(Object.values(MODELS))];
            
            for (const modelName of uniqueModels) {
                const service = new UserGeminiService(this.userApiKey, modelName);
                await service.initialize();
                this.modelInstances[modelName] = service;
            }
            
            this.initialized = true;
            console.log(`✅ User MultiLLM Manager initialized with ${uniqueModels.length} models`);
        } catch (error) {
            console.error('❌ Failed to initialize User MultiLLM Manager:', error.message);
            throw error;
        }
    }

    _selectModel(userQuery, type) {
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

    async ensureInitialized() {
        if (!this.initialized) {
            await this.initializeModels();
        }
    }

    async generateReport(content, title) {
        await this.ensureInitialized();
        const model = this._selectModel(content, 'report');
        return await model.generateReport(content, title);
    }
    
    async generatePresentation(content, title) {
        await this.ensureInitialized();
        const model = this._selectModel(content, 'presentation');
        return await model.generatePresentation(content, title);
    }
    
    async generateChatResponse(userMessage, documentChunks, chatHistory, systemPrompt) {
        await this.ensureInitialized();
        const model = this._selectModel(userMessage, 'chat');
        return await model.generateChatResponse(userMessage, documentChunks, chatHistory, systemPrompt);
    }
    
    async generateText(prompt) {
        await this.ensureInitialized();
        const model = this._selectModel(prompt, 'chat');
        return await model.generateText(prompt);
    }
    
    async generateMindMapData(documentContent, title) {
        await this.ensureInitialized();
        const model = this._selectModel(documentContent, 'mindmap');
        return await model.generateMindMapFromTranscript(documentContent, title);
    }
    
    async generatePodcastScript(documentContent) {
        await this.ensureInitialized();
        const model = this._selectModel(documentContent, 'creative');
        return await model.generatePodcastScript(documentContent);
    }
    
    async querySyllabus(query, syllabusContent) {
        await this.ensureInitialized();
        const model = this._selectModel(query, 'chat');
        const prompt = `You are an expert assistant focused on providing concise answers based ONLY on the provided syllabus content. Syllabus Content: ---${syllabusContent}--- Question: ${query} Answer:`;
        return await model.generateText(prompt);
    }
}

module.exports = UserMultiLLMManager;