// server/services/geminiService.js
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
const { handleGeminiError, handleRAGError } = require('../utils/errorUtils');

const MODEL_NAME = "gemini-1.5-flash"; // Default model

const baseGenerationConfig = {
    temperature: 0.7,
    maxOutputTokens: 4096,
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
            console.warn("Gemini AI service not initialized");
            throw new Error("Gemini AI service is not available. Please check your API key configuration.");
        }
        
        try {
            // Build comprehensive system prompt
            let fullSystemPrompt = systemPrompt || "You are TutorAI, an intelligent educational assistant. Provide helpful, accurate, and engaging responses to help users learn.";
            
            // Add document context if available
            if (documentChunks && documentChunks.length > 0) {
                const context = documentChunks.map(chunk => chunk.pageContent || chunk.content).join('\n\n');
                fullSystemPrompt += `\n\n## Context from Documents:\n${context}\n\nPlease use this context to provide accurate and relevant responses.`;
            }
            
            // Configure model with system prompt
            const model = this._configureModel(fullSystemPrompt.trim());
            
            // Prepare chat history in correct format
            const formattedHistory = chatHistory.map(msg => ({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.parts?.[0]?.text || msg.content || msg.text || '' }]
            })).filter(msg => msg.parts[0].text.trim().length > 0);
            
            // Start chat with history
            const chat = model.startChat({ 
                history: formattedHistory,
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 2048,
                    topP: 0.8,
                    topK: 40
                }
            });
            
            // Send message and get response
            const result = await chat.sendMessage(message);
            const response = this._processApiResponse(result.response);
            
            console.log("Gemini response generated successfully, length:", response.length);
            return response;
            
        } catch (error) {
            console.error("Error in generateChatResponse:", error);
            
            // Handle specific error types
            if (error.message?.includes('API_KEY_INVALID') || error.message?.includes('API key not valid')) {
                throw new Error("Invalid Gemini API Key. Please check your configuration.");
            } else if (error.message?.includes('RATE_LIMIT_EXCEEDED')) {
                throw new Error("Rate limit exceeded. Please try again in a moment.");
            } else if (error.message?.includes('SAFETY')) {
                throw new Error("Response was blocked by safety filters. Please rephrase your question.");
            }
            
            throw new Error(`Gemini API Error: ${error.message}`);
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