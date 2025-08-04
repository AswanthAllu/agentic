// server/services/geminiService.js
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
const { handleGeminiError, handleRAGError } = require('../utils/errorUtils');

const MODEL_NAME = "gemini-1.5-flash"; // Default model

const baseGenerationConfig = {
    temperature: 0.3,  // Lower temperature for more accurate, focused responses
    maxOutputTokens: 8192,  // Increased token limit for more comprehensive responses
    topP: 0.8,  // Focus on top 80% of probability mass for better coherence
    topK: 40,   // Consider top 40 tokens for balanced creativity and accuracy
};

const baseSafetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
];

class GeminiService {
    constructor(modelName = MODEL_NAME) {
        this.modelName = modelName;
        this.genAI = null;
        this.model = null;
    }

    async initialize() {
        const API_KEY = process.env.GEMINI_API_KEY;
        if (!API_KEY) {
            console.warn(`⚠️ GEMINI_API_KEY not found. AI features for model ${this.modelName} will be disabled.`);
            return;
        }

        try {
            this.genAI = new GoogleGenerativeAI(API_KEY);
            this.model = this.genAI.getGenerativeModel({
                model: this.modelName,
                generationConfig: baseGenerationConfig,
                safetySettings: baseSafetySettings
            });
            console.log(`🤖 Gemini AI service initialized for model: ${this.modelName}`);
        } catch (error) {
            console.error(`❌ Failed to initialize Gemini AI for model ${this.modelName}:`, error.message);
            this.genAI = null;
            this.model = null;
        }
    }

    _validateAndPrepareHistory(chatHistory) {
        if (!Array.isArray(chatHistory) || chatHistory.length === 0) {
            throw new Error("Chat history must be a non-empty array.");
        }
        if (chatHistory[chatHistory.length - 1].role !== 'user') {
            throw new Error("Internal error: Invalid chat history sequence for API call.");
        }
        return chatHistory.slice(0, -1)
            .map(msg => ({
                role: msg.role,
                parts: msg.parts.map(part => ({ text: part.text || '' }))
            }))
            .filter(msg => msg.role && msg.parts.length > 0);
    }

    _configureModel(systemPromptText) {
        if (!this.genAI) throw new Error("Cannot configure model, Gemini AI not initialized.");
        const modelOptions = {
            model: this.modelName,
            generationConfig: baseGenerationConfig,
            safetySettings: baseSafetySettings,
        };
        if (systemPromptText?.trim()) {
            modelOptions.systemInstruction = { parts: [{ text: systemPromptText.trim() }] };
        }
        return this.genAI.getGenerativeModel(modelOptions);
    }

    _processApiResponse(response) {
        const candidate = response?.candidates?.[0];
        if (candidate && (candidate.finishReason === 'STOP' || candidate.finishReason === 'MAX_TOKENS')) {
            const responseText = candidate.content?.parts?.[0]?.text;
            if (typeof responseText === 'string') return responseText;
        }
        const finishReason = candidate?.finishReason || 'Unknown';
        const blockedCategories = candidate?.safetyRatings?.filter(r => r.blocked).map(r => r.category).join(', ');
        let blockMessage = `AI response generation failed. Reason: ${finishReason}.`;
        if (blockedCategories) blockMessage += ` Blocked Categories: ${blockedCategories}.`;
        throw new Error(blockMessage || "Received an empty or invalid response from the AI service.");
    }

    async generateContentWithHistory(chatHistory, systemPromptText = null) {
        if (!this.genAI) throw new Error("Gemini AI service is not available.");
        try {
            const historyForStartChat = this._validateAndPrepareHistory(chatHistory);
            const model = this._configureModel(systemPromptText);
            const chat = model.startChat({ history: historyForStartChat });
            const lastUserMessageText = chatHistory[chatHistory.length - 1].parts[0].text;
            const result = await chat.sendMessage(lastUserMessageText);
            return this._processApiResponse(result.response);
        } catch (error) {
            console.error("Gemini API Call Error:", error?.message || error);
            const clientMessage = error.message.includes("API key not valid")
                ? "AI Service Error: Invalid API Key."
                : `AI Service Error: ${error.message}`;
            const enhancedError = new Error(clientMessage);
            enhancedError.status = error.status || 500;
            throw enhancedError;
        }
    }

    async generateChatResponse(message, documentChunks = [], chatHistory = [], systemPrompt = '') {
        if (!this.genAI) {
            console.error("Gemini AI service not initialized - API key missing or invalid");
            throw new Error("AI service is not properly configured. Please check your API key configuration.");
        }
        
        try {
            // Enhanced system prompt for better accuracy
            let fullSystemPrompt = systemPrompt || `You are an expert AI assistant. Provide accurate, helpful, and detailed responses. 
Always base your answers on factual information and clearly indicate when you're uncertain about something.
Be concise but comprehensive in your explanations.`;

            if (documentChunks && documentChunks.length > 0) {
                const context = documentChunks.map(chunk => chunk.pageContent || chunk.content).join('\n\n');
                fullSystemPrompt += `\n\n## Context from Documents:\n${context}\n\nPlease base your response primarily on the provided context while supplementing with your general knowledge when appropriate.`;
            }

            // Add conversation context awareness
            if (chatHistory && chatHistory.length > 0) {
                fullSystemPrompt += `\n\nMaintain consistency with the ongoing conversation and refer to previous messages when relevant.`;
            }

            const model = this._configureModel(fullSystemPrompt.trim());
            const chat = model.startChat({ history: chatHistory });
            const result = await chat.sendMessage(message);
            
            const response = this._processApiResponse(result.response);
            
            // Validate response quality
            if (!response || response.trim().length < 10) {
                throw new Error("Received inadequate response from AI service");
            }
            
            return response;
        } catch (error) {
            console.error("Error in generateChatResponse:", error);
            // Don't use fallback responses - throw the error to be handled properly
            throw handleGeminiError(error);
        }
    }

    async synthesizeResults(results, query, decomposition) {
        if (!this.genAI || !this.model) {
            return { summary: `I'm sorry, but the AI service is unavailable.`, sources: [], aiGenerated: false, fallback: true };
        }
        try {
            const context = results.map(result => `Source: ${result.metadata?.source || 'Unknown'}\nSnippet: ${result.metadata?.snippet || 'No snippet'}`).join('\n\n');
            const prompt = `Based on the following search results, provide a concise answer to the query: "${query}".\n\nContext:\n${context}`;
            const result = await this.model.generateContent(prompt);
            const text = this._processApiResponse(result.response);
            return {
                summary: text,
                sources: results.map(r => r.metadata?.source || r.source),
                aiGenerated: true,
                decomposition: decomposition || []
            };
        } catch (error) {
            console.error('Error in synthesizeResults:', error);
            throw handleRAGError(error, query);
        }
    }

    async generatePodcastFromTranscript(transcript, title) {
        if (!this.genAI || !this.model) return { error: "AI service is unavailable." };
        const prompt = `Create a short podcast script based on this transcript titled "${title}":\n\n${transcript}`;
        try {
            const result = await this.model.generateContent(prompt);
            return { script: this._processApiResponse(result.response) };
        } catch (error) {
            console.error(`Error generating podcast for "${title}":`, error);
            throw new Error(`Failed to generate podcast script. ${error.message}`);
        }
    }

    async generateMindMapFromTranscript(transcript, title) {
        if (!this.genAI || !this.model) return { error: "AI service is unavailable." };
        const prompt = `Generate a mind map in a structured format (e.g., JSON with nodes and edges) for this transcript titled "${title}":\n\n${transcript}`;
        try {
            const result = await this.model.generateContent(prompt);
            return { mindMapData: this._processApiResponse(result.response) };
        } catch (error) {
            console.error(`Error generating mind map for "${title}":`, error);
            throw new Error(`Failed to generate mind map data. ${error.message}`);
        }
    }
}

module.exports = GeminiService;