// server/services/LangchainVectorStore.js
const { MemoryVectorStore } = require("langchain/vectorstores/memory");
const { GoogleGenerativeAIEmbeddings } = require("@langchain/google-genai");

class LangchainVectorStore {
    constructor() {
        this.store = null;
        this.embeddings = null;
    }

    async initialize() {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error("GEMINI_API_KEY environment variable not set.");
        }
        this.embeddings = new GoogleGenerativeAIEmbeddings({
            apiKey: process.env.GEMINI_API_KEY,
            modelName: "embedding-001"
        });
        this.store = new MemoryVectorStore(this.embeddings);
        console.log("✅ In-memory vector store initialized successfully.");
    }

    async addDocuments(documents) {
        if (!this.store) throw new Error("MemoryVectorStore not initialized.");
        if (!documents || documents.length === 0) return { count: 0 };
        const docsWithContent = documents.map(doc => ({
            pageContent: doc.pageContent,
            metadata: doc.metadata
        }));
        await this.store.addDocuments(docsWithContent);
        const count = await this.getStatistics();
        console.log(`[MemoryVectorStore] Added ${documents.length} documents. Total now: ${count.documentCount}`);
        return { count: documents.length };
    }

    async deleteDocumentsByFileId(fileId) {
        if (!this.store) return;
        this.store.memoryVectors = this.store.memoryVectors.filter(doc => doc.metadata.fileId !== fileId);
        console.log(`[MemoryVectorStore] Deleted documents for fileId: ${fileId}. Current document count: ${this.store.memoryVectors.length}`);
    }

    async searchDocuments(query, options = {}) {
        if (!this.store) return [];
        const filterFn = (doc) => {
            if (options.filters?.userId && doc.metadata.userId !== options.filters.userId) return false;
            if (options.filters?.fileId && doc.metadata.fileId !== options.filters.fileId) return false;
            return true;
        };
        const results = await this.store.similaritySearchWithScore(
            query,
            options.limit || 5,
            filterFn
        );
        return results.map(([doc, score]) => ({
            content: doc.pageContent,
            metadata: doc.metadata,
            score: score
        }));
    }

    async getStatistics() {
        if (!this.store) return { documentCount: 0 };
        return { documentCount: this.store.memoryVectors.length };
    }
}

// Export the class, not an instance
module.exports = LangchainVectorStore;
