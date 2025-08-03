// server/services/ChatService.js
const ChatSession = require('../models/ChatSession');
const File = require('../models/File');
const { promises: fs } = require('fs');
const path = require('path');
const serviceManager = require('./serviceManager');
const TaskExecutor = require('./TaskExecutor');

const RAG_CONFIDENCE_THRESHOLD = 0.65;
const loadedFilesCache = new Set();
const DEFAULT_SYSTEM_PROMPT = "You are a helpful AI assistant.";

/**
 * Chat Service handles core chat logic, including RAG and Agentic tasks.
 */
class ChatService {
    constructor() {
        this.taskExecutor = new TaskExecutor();
    }

    async getRecentChatHistory(userId, count = 5) {
        try {
            const recentSessions = await ChatSession.find({ user: userId })
                .sort({ updatedAt: -1 })
                .limit(count);
            
            const history = [];
            for (const session of recentSessions) {
                history.push(...session.messages);
            }
            return history;
        } catch (error) {
            console.error("Failed to get recent chat history:", error);
            return [];
        }
    }
    
    async handleStandardMessage(query, history, systemPrompt) {
        const { multiLLMManager } = serviceManager.getServices();
        const responseText = await multiLLMManager.generateChatResponse(query, [], history, systemPrompt);
        return { message: responseText };
    }

    async handleHybridRagMessage(query, userId, fileId, allowDeepSearch) {
        const { multiLLMManager, vectorStore } = serviceManager.getServices();
        
        if (!fileId) {
            return {
                message: "Please select a file to chat with from the 'My Files' list before asking a question in RAG mode.",
                metadata: { searchType: 'rag_error', sources: [] }
            };
        }
        
        await this.ensureFileIsLoaded(fileId, userId);

        const relevantChunks = await vectorStore.searchDocuments(query, {
            limit: 5,
            filters: { userId, fileId }
        });

        const isContextSufficient = relevantChunks.length > 0 && relevantChunks[0].score > RAG_CONFIDENCE_THRESHOLD;

        if (isContextSufficient) {
            const context = relevantChunks.map(chunk => chunk.content).join('\n\n');
            const prompt = this.buildStandardRagPrompt(query, context);
            const answer = await multiLLMManager.generateText(prompt);
            return {
                message: answer,
                metadata: { searchType: 'rag', sources: this.formatSources(relevantChunks) }
            };
        } else if (allowDeepSearch) {
            const deepSearchService = serviceManager.getDeepSearchService(userId);
            const result = await deepSearchService.performSearch(query, []);
            return {
                message: result.summary,
                metadata: { searchType: 'deep_search_fallback', sources: result.sources }
            };
        } else {
            return {
                message: "I couldn't find a confident answer for that in your document. Please try rephrasing your question or asking something else about the file.",
                metadata: { searchType: 'rag_fallback', sources: [] }
            };
        }
    }

    async handleAgenticTask(query, userId) {
        return this.taskExecutor.executeTask(query, userId);
    }
    
    async ensureFileIsLoaded(fileId, userId) {
        if (loadedFilesCache.has(fileId)) {
            return;
        }
        const { documentProcessor } = serviceManager.getServices();
        const file = await File.findOne({ _id: fileId, user: userId });
        if (!file) {
            throw new Error(`File not found or user not authorized for fileId: ${fileId}`);
        }
        await documentProcessor.processFile(file.path, {
            userId: file.user.toString(),
            fileId: file._id.toString(),
            originalName: file.originalname,
        });
        loadedFilesCache.add(fileId);
    }
    
    buildStandardRagPrompt(query, context) {
        return `You are an expert assistant. Answer the user's question based ONLY on the following context. If the answer is not in the context, say "I could not find an answer in the provided documents." Context: --- ${context} --- Question: "${query}" Answer:`;
    }

    formatSources(chunks) {
        const uniqueSources = [...new Set(chunks.map(chunk => chunk.metadata.source))];
        return uniqueSources.map(source => ({ title: source, type: 'document' }));
    }
}

module.exports = ChatService;
