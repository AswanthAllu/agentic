// server/services/serviceManager.js
const LangchainVectorStore = require('./LangchainVectorStore');
const DocumentProcessor = require('./documentProcessor');
const DeepSearchService = require('../deep_search/services/deepSearchService');
const DuckDuckGoService = require('../utils/duckduckgo');
const MultiLLMManager = require('./MultiLLMManager');
const ChatService = require('./ChatService');
const TaskExecutor = require('./TaskExecutor');
const GeminiService = require('./geminiService');

class ServiceManager {
    constructor() {
        this.vectorStore = null;
        this.documentProcessor = null;
        this.multiLLMManager = null;
        this.chatService = null;
        this.taskExecutor = null;
        this.deepSearchServices = new Map();
        this.duckDuckGo = null;
        this.geminiServiceInstances = new Map();
    }

    async initialize() {
        this.vectorStore = new LangchainVectorStore();
        await this.vectorStore.initialize();
        this.documentProcessor = new DocumentProcessor(this.vectorStore);
        this.duckDuckGo = new DuckDuckGoService();

        const modelsToInitialize = [
            'gemini-1.5-flash',
            'gemini-1.5-pro'
        ];
        for (const modelName of modelsToInitialize) {
            const service = new GeminiService(modelName);
            await service.initialize();
            this.geminiServiceInstances.set(modelName, service);
        }

        this.multiLLMManager = new MultiLLMManager(this);
        this.taskExecutor = new TaskExecutor(this);
        this.chatService = new ChatService(this);

        console.log('✅ All services initialized successfully with LangchainVectorStore.');
    }

    getGeminiService(modelName) {
        const service = this.geminiServiceInstances.get(modelName);
        if (!service) {
            console.error(`GeminiService for model "${modelName}" not found.`);
            throw new Error(`GeminiService for model "${modelName}" not found.`);
        }
        return service;
    }

    getDeepSearchService(userId) {
        if (!userId) { throw new Error('userId is required for DeepSearchService'); }
        if (!this.deepSearchServices.has(userId)) {
            const deepSearchService = new DeepSearchService(userId, this.multiLLMManager, this.duckDuckGo);
            this.deepSearchServices.set(userId, deepSearchService);
            console.log(`Created DeepSearchService for user: ${userId}`);
        }
        return this.deepSearchServices.get(userId);
    }

    getServices() {
        return {
            vectorStore: this.vectorStore,
            documentProcessor: this.documentProcessor,
            multiLLMManager: this.multiLLMManager,
            chatService: this.chatService,
            duckDuckGo: this.duckDuckGo,
            taskExecutor: this.taskExecutor
        };
    }
}

const serviceManager = new ServiceManager();
module.exports = serviceManager;
