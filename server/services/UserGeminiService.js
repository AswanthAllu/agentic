// server/services/UserGeminiService.js
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { handleGeminiError } = require('../utils/errorUtils');

class UserGeminiService {
    constructor(userApiKey, modelName = 'gemini-1.5-flash') {
        this.modelName = modelName;
        this.userApiKey = userApiKey;
        this.genAI = null;
        this.model = null;
    }

    async initialize() {
        if (!this.userApiKey) {
            throw new Error('User Gemini API key is required');
        }

        try {
            this.genAI = new GoogleGenerativeAI(this.userApiKey);
            this.model = this.genAI.getGenerativeModel({
                model: this.modelName,
                generationConfig: {
                    temperature: 0.7,
                    topP: 0.95,
                    topK: 64,
                    maxOutputTokens: 8192,
                }
            });
            console.log(`🤖 User Gemini AI service initialized for model: ${this.modelName}`);
        } catch (error) {
            console.error(`❌ Failed to initialize User Gemini AI for model ${this.modelName}:`, error.message);
            throw error;
        }
    }

    async generateText(prompt) {
        if (!this.model) {
            throw new Error('Gemini AI service is not initialized');
        }

        try {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (error) {
            console.error("User Gemini API Call Error:", error?.message || error);
            throw handleGeminiError(error);
        }
    }

    async generateChatResponse(userMessage, documentChunks = [], chatHistory = [], systemPrompt = '') {
        const context = this.buildContext(documentChunks);
        const history = this.formatChatHistory(chatHistory);
        
        const prompt = `${systemPrompt}\n\n${context}\n\n${history}\n\nUser: ${userMessage}\nAssistant:`;
        
        return await this.generateText(prompt);
    }

    async generatePodcastScript(documentContent) {
        const prompt = `Create an engaging podcast script based on the following content. The script should:
1. Have a compelling introduction that hooks the listener
2. Present the main points in a conversational, engaging way
3. Include natural transitions between topics
4. Have a strong conclusion that summarizes key takeaways
5. Be written in a tone suitable for audio narration
6. Include [PAUSE] markers where appropriate for emphasis

Content to base the podcast on:
${documentContent}

Generate the podcast script:`;

        const response = await this.generateText(prompt);
        
        // Extract JSON if the response contains it
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                return JSON.parse(jsonMatch[0]);
            } catch (e) {
                return { script: response };
            }
        }
        
        return { script: response };
    }

    async generateMindMapFromTranscript(documentContent, title = 'Document') {
        const prompt = `Create a comprehensive mind map structure based on the following content. Return ONLY valid JSON in this exact format:
{
  "nodes": [
    {"id": "1", "data": {"label": "Main Topic"}, "position": {"x": 0, "y": 0}, "type": "default"},
    {"id": "2", "data": {"label": "Subtopic 1"}, "position": {"x": -200, "y": 100}, "type": "default"}
  ],
  "edges": [
    {"id": "e1-2", "source": "1", "target": "2", "type": "smoothstep"}
  ]
}

Content: ${documentContent.substring(0, 3000)}

Generate mind map JSON:`;

        const response = await this.generateText(prompt);
        
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }
            return JSON.parse(jsonMatch[0]);
        } catch (error) {
            console.error('Error parsing mind map JSON:', error);
            // Return a fallback structure
            return {
                nodes: [
                    {
                        id: "1",
                        data: { label: title || "Main Topic" },
                        position: { x: 0, y: 0 },
                        type: "default"
                    }
                ],
                edges: []
            };
        }
    }

    async generateReport(content, title) {
        const prompt = `Generate a comprehensive report based on the following content. The report should include:
1. Executive Summary
2. Main Findings
3. Detailed Analysis
4. Conclusions
5. Recommendations (if applicable)

Title: ${title}
Content: ${content}

Generate a well-structured report:`;

        return await this.generateText(prompt);
    }

    async generatePresentation(content, title) {
        const prompt = `Create a presentation outline based on the following content. Structure it as:
1. Title slide
2. Agenda/Overview
3. Main content slides (3-7 slides)
4. Conclusion
5. Q&A slide

Each slide should have:
- A clear title
- 3-5 bullet points max
- Engaging content

Title: ${title}
Content: ${content}

Generate presentation structure:`;

        return await this.generateText(prompt);
    }

    buildContext(documentChunks) {
        if (!documentChunks || documentChunks.length === 0) {
            return '';
        }
        return `Context from uploaded documents:\n${documentChunks.map(chunk => chunk.content || chunk).join('\n\n')}`;
    }

    formatChatHistory(chatHistory) {
        if (!chatHistory || chatHistory.length === 0) {
            return '';
        }
        return chatHistory.map(msg => `${msg.sender}: ${msg.message}`).join('\n');
    }
}

module.exports = UserGeminiService;