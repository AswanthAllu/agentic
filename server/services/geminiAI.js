// server/services/geminiAI.js
const { SUMMARIZATION_TYPES, SUMMARIZATION_STYLES } = require('../utils/constants');
const { getModel } = require('./LLMFactory');

class GeminiAI {
    constructor(modelName) {
        this.model = getModel(modelName);
    }

    async generateChatResponse(userMessage, documentChunks, chatHistory, systemPrompt = '') {
        const context = this.buildContext(documentChunks);
        const prompt = this.buildSystemPrompt(systemPrompt, context, chatHistory) + `\nUser: ${userMessage}\nAssistant: `;
        
        try {
            if (!this.model) {
                console.warn('Gemini model not initialized, using fallback response');
                return this.getFallbackResponse(userMessage, context);
            }
            
            const result = await this.model.generateContent(prompt);
            const response = result.response;
            const responseText = response.text().trim();
            
            // Validate response quality
            if (!responseText || responseText.length < 3) {
                console.warn('Received empty or very short response from Gemini, using fallback');
                return this.getFallbackResponse(userMessage, context);
            }
            
            return responseText;
        } catch (error) {
            console.error('Gemini chat response error:', error.message);
            
            // Check for specific error types and provide appropriate fallbacks
            if (error.message?.includes('API key')) {
                return "I'm currently unable to connect to the AI service due to configuration issues. Please ensure your API key is properly set up.";
            } else if (error.message?.includes('rate limit')) {
                return "I'm experiencing high traffic right now. Please wait a moment and try again.";
            } else if (error.message?.includes('blocked')) {
                return "I understand your question, but I'm not able to provide a response to that particular query. Could you try rephrasing it?";
            }
            
            return this.getFallbackResponse(userMessage, context);
        }
    }

    async generateSummary(documentContent, options = {}) {
        if (!this.model) { throw new Error('Failed to generate summary due to AI service initialization issues.'); }
        const {
            type = SUMMARIZATION_TYPES.MEDIUM,
            style = SUMMARIZATION_STYLES.FORMAL,
            length,
            focus
        } = options;
        const prompt = `You are an expert summarizer. Generate a ${style} summary of the following document:
${documentContent.substring(0, 4000)}...
Summary requirements:
1. Type: ${type}
2. Style: ${style}
3. Focus: ${focus || 'main points'}
4. Length: ${length ? `${length} words` : 'appropriate'}
Provide the summary in JSON format with these fields:
- text: The main summary text
- keyPoints: Array of bullet points highlighting main points
- sentiment: Overall sentiment (positive, negative, neutral)
- confidence: Confidence score (0-1)
- metadata: { wordCount: number, readingTime: number, topics: array of main topics }
Respond with ONLY a valid JSON object in this format.`;
        try {
            const result = await this.model.generateContent(prompt);
            const response = result.response;
            let text = response.text().trim();
            if (text.startsWith('```json')) { text = text.replace(/```json\s*/, '').replace(/\s*```$/, ''); } else if (text.startsWith('```')) { text = text.replace(/```\s*/, '').replace(/\s*```$/, ''); }
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) { throw new Error('No valid JSON found in response'); }
            const summary = JSON.parse(jsonMatch[0]);
            if (!summary || !summary.text || !summary.keyPoints) { throw new Error('Invalid summary format'); }
            return summary;
        } catch (error) {
            console.error('Gemini summary error:', error.message);
            throw new Error('Failed to generate summary');
        }
    }

    async generatePodcastScript(documentContent) {
        const summary = await this.generateSummary(documentContent, {
            type: SUMMARIZATION_TYPES.MEDIUM,
            style: SUMMARIZATION_STYLES.CONVERSATIONAL
        });
        const prompt = `You are an expert podcast scriptwriter. Based on the following summary and key points, create a podcast script for two hosts (Host A and Host B) discussing the key topics in an engaging, conversational style. The script should be structured as an array of JSON objects, each with:
- speaker: "Host A" or "Host B"
- text: The dialogue text (keep each segment between 2-4 sentences for natural flow)
- duration: Estimated duration in seconds (approximate)
- focus: Main topic of discussion
Summary:
${summary.text}
Key Points:
${summary.keyPoints.join('\n')}
Main Topics:
${summary.metadata.topics.join(', ')}
ALL DIALOGUE MUST BE IN ENGLISH.
Create a script with 8-12 segments, covering all key points from the summary, with a total duration of about 3-4 minutes. Use a friendly, informative tone suitable for a general audience. Make sure Host A and Host B alternate naturally and have distinct personalities - Host A can be more analytical, Host B more curious and engaging.
Each segment should be conversational and flow naturally into the next. Include questions, reactions, and natural transitions between topics.
Respond with ONLY a valid JSON array of script segments.`;
        try {
            const result = await this.model.generateContent(prompt);
            const response = result.response;
            let text = response.text().trim();
            if (text.startsWith('```json')) { text = text.replace(/```json\s*/, '').replace(/\s*```$/, ''); } else if (text.startsWith('```')) { text = text.replace(/```\s*/, '').replace(/\s*```$/, ''); }
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (!jsonMatch) { throw new Error('Invalid JSON response from Gemini'); }
            const script = JSON.parse(jsonMatch[0]);
            if (!Array.isArray(script) || script.length < 8) { throw new Error('Podcast script is too short or invalid'); }
            return script;
        } catch (error) {
            console.error('Gemini podcast script error:', error.message);
            return [{ speaker: 'Host A', text: 'Sorry, we could not generate the podcast script today.', duration: 10 }, { speaker: 'Host B', text: 'Let us move on to another topic!', duration: 10 }];
        }
    }

    async generateMindMapFromTranscript(documentContent, title) {
        if (!this.model) { throw new Error('Failed to generate mind map due to AI service initialization issues.'); }
        const prompt = `You are an expert in creating mind maps. Based on the following content from the document titled "${title}", generate a hierarchical mind map. The content is as follows:
---
${documentContent}
---
Provide the output in a structured JSON format with nodes and edges, suitable for a mind map visualization library like React Flow.
The JSON object should have two properties: "nodes" and "edges".
Each node in the "nodes" array must have an "id", a "position" (with "x" and "y" coordinates, which you should determine for a good layout), and a "data" object with a "label". The root node should be at position { x: 250, y: 5 }.
Each edge in the "edges" array must have an "id", a "source" node ID, and a "target" node ID.
The mind map should start with a central root node representing the main topic, and then branch out to main ideas, sub-ideas, and key concepts.
Ensure the structure is logical and easy to understand.`;
        try {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = await response.text();
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch && jsonMatch[0]) {
                return JSON.parse(jsonMatch[0]);
            } else {
                throw new Error("Failed to extract valid JSON from the AI's response for the mind map.");
            }
        } catch (error) {
            console.error('Error generating mind map with Gemini:', error);
            throw new Error('Failed to generate mind map data due to an AI service error.');
        }
    }

    async generateReport(content, title) {
        const prompt = `Generate a comprehensive, structured report based on the following content. The report should have a title, an executive summary, a table of contents, and several detailed sections with headers and bullet points. The content for the report is:
---
Title: ${title}
Content:
${content}
---
Provide the full report content in a structured Markdown format.`;
        try {
            const result = await this.model.generateContent(prompt);
            return result.response.text();
        } catch (error) {
            console.error("Error generating report:", error);
            throw new Error("Failed to generate report.");
        }
    }

    async generatePresentation(content, title) {
        const prompt = `Generate a concise presentation outline based on the following content. The outline should be structured with slide titles and bullet points for each slide. The content for the presentation is:
---
Title: ${title}
Content:
${content}
---
Provide the presentation outline in a structured Markdown format.`;
        try {
            const result = await this.model.generateContent(prompt);
            return result.response.text();
        } catch (error) {
            console.error("Error generating presentation:", error);
            throw new Error("Failed to generate presentation outline.");
        }
    }

    async generateText(prompt) {
        try {
            const result = await this.model.generateContent(prompt);
            const response = result.response;
            return response.text().trim();
        } catch (error) {
            console.error('Gemini text generation error:', error.message);
            throw new Error('Failed to generate text response');
        }
    }

    getFallbackResponse(userMessage, context) {
        // Provide more intelligent fallback responses based on message content
        const lowerMessage = userMessage.toLowerCase();
        
        // Handle greetings
        if (lowerMessage.includes('hi') || lowerMessage.includes('hello') || lowerMessage.includes('hey')) {
            return "Hello! I'm TutorAI, your learning assistant. While I'm experiencing some technical difficulties with my main AI system, I'm still here to help. How can I assist you today?";
        }
        
        // Handle thanks
        if (lowerMessage.includes('thank') || lowerMessage.includes('thanks')) {
            return "You're welcome! I'm glad I could help. Is there anything else you'd like to know?";
        }
        
        // Handle help requests
        if (lowerMessage.includes('help') || lowerMessage.includes('assist')) {
            return "I'd be happy to help you! I can assist with explanations, answer questions about uploaded documents, generate study materials, and more. What would you like help with?";
        }
        
        if (context && context !== 'No relevant document context available.') {
            return `I understand you're asking about: "${userMessage}". I can see you have relevant documents available, but I'm currently experiencing technical difficulties with my AI processing. Please try again in a moment, or try rephrasing your question.`;
        } else {
            return `Thank you for your question: "${userMessage}". I'm currently experiencing some technical difficulties, but I'm working to resolve them. In the meantime, you might try:
            
• Uploading a document to get context-specific help
• Asking a more specific question
• Trying again in a few moments

I'm here to help with your learning journey!`;
        }
    }

    buildContext(documentChunks) {
        if (!Array.isArray(documentChunks)) { documentChunks = []; }
        if (!documentChunks || documentChunks.length === 0) {
            return 'No relevant document context available.';
        }
        return documentChunks
            .map(chunk => `Document: ${chunk.metadata?.source || 'Unknown'}\n${chunk.content}`)
            .join('\n\n');
    }

    buildSystemPrompt(systemPrompt, context, chatHistory) {
        const basePrompt = systemPrompt || 'You are a helpful AI assistant providing accurate and concise answers.';
        const contextSection = context ? `\n\nRelevant Context:\n${context}` : '';
        const historySection = chatHistory && chatHistory.length > 0
            ? `\n\nConversation History:\n${chatHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}`
            : '';
        return `${basePrompt}${contextSection}${historySection}`;
    }
}

module.exports = { GeminiAI };
