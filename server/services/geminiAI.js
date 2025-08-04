// server/services/geminiAI.js
const { SUMMARIZATION_TYPES, SUMMARIZATION_STYLES } = require('../utils/constants');
const { getModel } = require('./LLMFactory');

class GeminiAI {
    constructor(modelName) {
        this.model = getModel(modelName);
    }

    async generateChatResponse(userMessage, documentChunks, chatHistory, systemPrompt = '') {
        const context = this.buildContext(documentChunks);
        
        // Enhanced prompt structure for better accuracy
        const enhancedSystemPrompt = systemPrompt || `You are an expert AI assistant specialized in providing accurate, helpful, and comprehensive responses. 
Follow these guidelines:
1. Provide factual, well-reasoned answers
2. If you're uncertain about something, clearly state your uncertainty
3. Use the provided context when available and relevant
4. Be thorough but concise in your explanations
5. Maintain a helpful and professional tone`;

        const prompt = this.buildSystemPrompt(enhancedSystemPrompt, context, chatHistory) + `\n\nUser Question: ${userMessage}\n\nProvide a detailed and accurate response:`;
        
        try {
            if (!this.model) {
                console.error('Gemini model not initialized - API key likely missing or invalid');
                throw new Error('AI service is not properly configured. Please check your Gemini API key.');
            }
            
            const result = await this.model.generateContent(prompt);
            const response = result.response;
            const responseText = response.text().trim();
            
            // Enhanced response validation
            if (!responseText || responseText.length < 10) {
                console.error('Received inadequate response from Gemini API');
                throw new Error('Received an inadequate response from the AI service. Please try rephrasing your question.');
            }
            
            // Check for generic or template responses that might indicate poor quality
            const genericResponses = ['i apologize', 'i cannot', 'i don\'t have access', 'as an ai'];
            const isGeneric = genericResponses.some(phrase => 
                responseText.toLowerCase().includes(phrase) && responseText.length < 50
            );
            
            if (isGeneric) {
                console.warn('Detected potentially generic response, requesting more specific answer');
                // Try again with more specific prompt
                const specificPrompt = `${prompt}\n\nPlease provide a more specific and detailed answer to the user's question. Avoid generic responses.`;
                const retryResult = await this.model.generateContent(specificPrompt);
                const retryResponse = retryResult.response.text().trim();
                return retryResponse || responseText; // Use retry response if available, otherwise original
            }
            
            return responseText;
        } catch (error) {
            console.error('Gemini chat response error:', error.message);
            
            // Throw specific errors instead of using fallbacks
            if (error.message?.includes('API key')) {
                throw new Error('AI service configuration error: Invalid or missing API key. Please check your Gemini API key configuration.');
            } else if (error.message?.includes('rate limit')) {
                throw new Error('AI service is currently experiencing high traffic. Please wait a moment and try again.');
            } else if (error.message?.includes('blocked')) {
                throw new Error('Your request was blocked by content filters. Please try rephrasing your question.');
            } else if (error.message?.includes('quota')) {
                throw new Error('AI service quota exceeded. Please try again later or check your API usage limits.');
            }
            
            // For other errors, throw a more informative message
            throw new Error(`AI service error: ${error.message}. Please try again or contact support if the issue persists.`);
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
