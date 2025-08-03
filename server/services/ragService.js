// server/services/RagService.js
// This file is now deprecated in favor of ChatService.js
const VectorStore = require('./vectorStore');
const geminiService = require('./geminiService');
const { MESSAGE_TYPES } = require('../models/ChatSession');

const MAX_CONTEXT_LENGTH = 2048;
const MAX_DOCUMENTS = 5;

class RagService {
    constructor() {
        this.vectorStore = new VectorStore();
        this.geminiService = geminiService;
    }

    async getRelevantDocuments(query, userId) {
        try {
            const options = {
                userId,
                limit: MAX_DOCUMENTS,
                strategy: VectorStore.SEARCH_STRATEGIES.COSINE,
                boostRecency: true,
                boostContext: true
            };
            const documents = await this.vectorStore.searchDocuments(query, options);
            return documents.sort((a, b) => b.score - a.score);
        } catch (error) {
            console.error('Error getting relevant documents:', error);
            throw error;
        }
    }

    generateContext(documents) {
        let context = '';
        let currentLength = 0;
        documents.forEach(doc => {
            if (currentLength + doc.content.length + doc.metadata.source.length <= MAX_CONTEXT_LENGTH) {
                context += `\n\nDocument: ${doc.metadata.source}\n${doc.content}`;
                currentLength += doc.content.length + doc.metadata.source.length;
            }
        });
        return context.trim();
    }

    async generateResponse(query, userId, chatHistory, systemPrompt, messageType = MESSAGE_TYPES.TEXT) {
        try {
            const documents = await this.getRelevantDocuments(query, userId);
            const context = this.generateContext(documents);
            let response;
            switch (messageType) {
                case MESSAGE_TYPES.TEXT:
                    response = await this.geminiService.generateChatResponse(
                        query, context, chatHistory, systemPrompt
                    );
                    break;
                case MESSAGE_TYPES.AUDIO:
                    response = await this.generateAudioResponse(query, context);
                    break;
                case MESSAGE_TYPES.MINDMAP:
                    response = await this.generateMindMap(query, context);
                    break;
                default:
                    throw new Error(`Unsupported message type: ${messageType}`);
            }
            return {
                response,
                documents: documents.map(doc => ({
                    source: doc.metadata.source,
                    score: doc.score,
                    content: doc.content.substring(0, 200) + '...'
                }))
            };
        } catch (error) {
            console.error('RAG response generation failed:', error);
            throw error;
        }
    }

    async generateAudioResponse(query, context) {
        try {
            const podcastScript = await this.geminiService.generatePodcastScript(query, context);
            const scriptUrl = await this.generatePodcastScript(podcastScript);
            return { scriptUrl, script: podcastScript };
        } catch (error) {
            console.error('Podcast generation failed:', error);
            throw error;
        }
    }

    async generateMindMap(query, context) {
        try {
            const mindMapData = await this.geminiService.generateMindMapData(query, context);
            return mindMapData;
        } catch (error) {
            console.error('Mindmap generation failed:', error);
            throw error;
        }
    }

    async generatePodcastScript(script) { return 'https://example.com/podcast/script.mp3'; }
}

module.exports = new RagService();