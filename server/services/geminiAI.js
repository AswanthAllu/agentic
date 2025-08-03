// server/services/geminiAI.js
const { SUMMARIZATION_TYPES, SUMMARIZATION_STYLES } = require('../utils/constants');
const { getModel } = require('./LLMFactory');

class GeminiAI {
    constructor(modelName) {
        this.model = getModel(modelName);
    }

    async generateChatResponse(userMessage, documentChunks, chatHistory, systemPrompt = '') {
        try {
            if (!this.model) {
                console.warn('Gemini model not initialized');
                throw new Error('Gemini AI model is not available. Please check your API key configuration.');
            }
            
            // Build comprehensive system prompt
            let fullSystemPrompt = systemPrompt || "You are TutorAI, an intelligent educational assistant specialized in helping students learn. Provide clear, accurate, and engaging responses.";
            
            // Add document context if available
            const context = this.buildContext(documentChunks);
            if (context && context !== 'No relevant document context available.') {
                fullSystemPrompt += `\n\nContext from Documents:\n${context}\n\nUse this context to provide accurate answers.`;
            }
            
            // Prepare chat history for Gemini
            const formattedHistory = chatHistory.map(msg => ({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.parts?.[0]?.text || msg.content || msg.text || '' }]
            })).filter(msg => msg.parts[0].text.trim().length > 0);
            
            // Create model with system instruction
            const model = this.model;
            if (fullSystemPrompt) {
                // For models that support system instructions
                try {
                    const enhancedModel = this.model.genAI?.getGenerativeModel({
                        model: this.model.model || 'gemini-1.5-flash',
                        systemInstruction: { parts: [{ text: fullSystemPrompt }] },
                        generationConfig: {
                            temperature: 0.7,
                            maxOutputTokens: 2048,
                            topP: 0.8,
                            topK: 40
                        }
                    });
                    
                    if (enhancedModel) {
                        const chat = enhancedModel.startChat({ history: formattedHistory });
                        const result = await chat.sendMessage(userMessage);
                        const responseText = result.response.text().trim();
                        
                        if (responseText && responseText.length > 3) {
                            console.log("Gemini response generated successfully");
                            return responseText;
                        }
                    }
                } catch (systemInstError) {
                    console.warn('System instruction not supported, using fallback approach');
                }
            }
            
            // Fallback to regular approach
            const chat = model.startChat({ history: formattedHistory });
            const enhancedPrompt = fullSystemPrompt ? `${fullSystemPrompt}\n\nUser: ${userMessage}\nAssistant:` : userMessage;
            const result = await chat.sendMessage(enhancedPrompt);
            const responseText = result.response.text().trim();
            
            // Validate response quality
            if (!responseText || responseText.length < 3) {
                console.warn('Received empty or very short response from Gemini');
                throw new Error('Empty response from AI service');
            }
            
            console.log("Gemini response generated successfully, length:", responseText.length);
            return responseText;
            
        } catch (error) {
            console.error('Gemini chat response error:', error.message);
            
            // For this service, we'll throw the error to be handled by the calling code
            if (error.message?.includes('API key') || error.message?.includes('API_KEY_INVALID')) {
                throw new Error("Invalid Gemini API Key. Please verify your configuration.");
            } else if (error.message?.includes('rate limit') || error.message?.includes('RATE_LIMIT')) {
                throw new Error("Rate limit exceeded. Please try again in a moment.");
            } else if (error.message?.includes('blocked') || error.message?.includes('SAFETY')) {
                throw new Error("Response was blocked by safety filters. Please rephrase your question.");
            }
            
            throw new Error(`Gemini API Error: ${error.message}`);
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
        try {
            if (!this.model) {
                throw new Error('Gemini AI model is not available');
            }
            
            // First generate a comprehensive summary
            const summary = await this.generateSummary(documentContent, {
                type: SUMMARIZATION_TYPES.MEDIUM,
                style: SUMMARIZATION_STYLES.CONVERSATIONAL
            });
            
            const prompt = `You are an expert podcast scriptwriter creating educational content. Based on the following material, create an engaging podcast script for two hosts discussing the key topics.

CONTENT TO DISCUSS:
${summary.text}

KEY POINTS TO COVER:
${summary.keyPoints.join('\n')}

MAIN TOPICS:
${summary.metadata.topics.join(', ')}

SCRIPT REQUIREMENTS:
- Create a JSON array of script segments
- Each segment should have: speaker, text, duration, focus
- Speakers: "Host A" (analytical, teacher-like) and "Host B" (curious, student-like)
- 10-15 segments total, 3-5 minutes duration
- Natural conversation flow with questions, reactions, and transitions
- Educational but engaging tone
- Include interesting facts, examples, and insights

SEGMENT STRUCTURE:
{
  "speaker": "Host A" or "Host B",
  "text": "Natural dialogue (2-4 sentences)",
  "duration": estimated seconds,
  "focus": "main topic of this segment"
}

Create a comprehensive, engaging podcast script that would help students understand this material better. Make it conversational, informative, and interesting.

Respond with ONLY a valid JSON array:`;

            const result = await this.model.generateContent(prompt);
            const response = result.response;
            let text = response.text().trim();
            
            // Clean up response
            text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            text = text.replace(/^```\s*/, '').replace(/\s*```$/, '');
            
            // Extract JSON
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
                console.warn('No valid JSON found in podcast response');
                throw new Error('Invalid JSON response from Gemini');
            }
            
            const script = JSON.parse(jsonMatch[0]);
            
            // Validate script
            if (!Array.isArray(script) || script.length < 5) {
                throw new Error('Podcast script is too short or invalid');
            }
            
            // Ensure all segments have required fields
            const validatedScript = script.map((segment, index) => ({
                speaker: segment.speaker || (index % 2 === 0 ? 'Host A' : 'Host B'),
                text: segment.text || 'Let\'s continue with our discussion.',
                duration: segment.duration || 15,
                focus: segment.focus || 'General discussion'
            }));
            
            console.log(`Generated podcast script with ${validatedScript.length} segments`);
            return validatedScript;
            
        } catch (error) {
            console.error('Gemini podcast script error:', error.message);
            
            // Return a meaningful fallback script
            return [
                { 
                    speaker: 'Host A', 
                    text: `Welcome to our educational podcast! Today we're discussing some fascinating material.`, 
                    duration: 15, 
                    focus: 'Introduction' 
                },
                { 
                    speaker: 'Host B', 
                    text: `That's right! The content we're covering today includes several key concepts that students should understand.`, 
                    duration: 15, 
                    focus: 'Overview' 
                },
                { 
                    speaker: 'Host A', 
                    text: `While we're experiencing some technical difficulties with our AI-generated script, we hope this gives you a starting point for learning.`, 
                    duration: 15, 
                    focus: 'Explanation' 
                },
                { 
                    speaker: 'Host B', 
                    text: `Please refer to the original document for more detailed information. Thanks for listening!`, 
                    duration: 10, 
                    focus: 'Conclusion' 
                }
            ];
        }
    }

    async generateMindMapFromTranscript(documentContent, title) {
        try {
            if (!this.model) {
                throw new Error('Failed to generate mind map due to AI service initialization issues.');
            }
            
            const prompt = `You are an expert in creating educational mind maps. Create a comprehensive mind map for the document titled "${title}".

CONTENT TO ANALYZE:
---
${documentContent.substring(0, 4000)}...
---

REQUIREMENTS:
1. Create a hierarchical mind map with a central topic and branching subtopics
2. Include 10-20 nodes with logical connections
3. Use clear, concise labels for each node
4. Arrange nodes in a visually appealing layout
5. Include different levels: main topics, subtopics, and key details

OUTPUT FORMAT - JSON with "nodes" and "edges" arrays:

NODES STRUCTURE:
{
  "id": "unique_id",
  "position": { "x": number, "y": number },
  "data": { 
    "label": "Clear, concise text",
    "level": 0-3 (0=root, 1=main, 2=sub, 3=detail)
  },
  "style": {
    "background": "#color_based_on_level",
    "border": "2px solid #border_color"
  }
}

EDGES STRUCTURE:
{
  "id": "edge_id",
  "source": "source_node_id", 
  "target": "target_node_id",
  "type": "smoothstep",
  "animated": false
}

LAYOUT GUIDELINES:
- Root node at position { x: 400, y: 200 }
- Main branches spread radially around root
- Each level spaced 150-200 pixels apart
- Use color coding: Root=#8B5CF6, Main=#06B6D4, Sub=#10B981, Detail=#F59E0B

Create a comprehensive, well-structured mind map that helps students understand the material visually.

Respond with ONLY valid JSON:`;

            const result = await this.model.generateContent(prompt);
            const response = result.response;
            const text = response.text();
            
            // Clean and extract JSON
            let cleanText = text.trim();
            cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
            
            const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                console.warn('No valid JSON found in mind map response');
                throw new Error("Failed to extract valid JSON from the AI's response for the mind map.");
            }
            
            const mindMapData = JSON.parse(jsonMatch[0]);
            
            // Validate structure
            if (!mindMapData.nodes || !mindMapData.edges || !Array.isArray(mindMapData.nodes)) {
                throw new Error('Invalid mind map structure received');
            }
            
            // Ensure nodes have required properties
            const validatedNodes = mindMapData.nodes.map((node, index) => ({
                id: node.id || `node_${index}`,
                position: node.position || { x: 100 + (index % 5) * 150, y: 100 + Math.floor(index / 5) * 100 },
                data: {
                    label: node.data?.label || node.label || `Topic ${index + 1}`,
                    level: node.data?.level || (index === 0 ? 0 : Math.min(index, 3))
                },
                style: node.style || {
                    background: index === 0 ? '#8B5CF6' : ['#06B6D4', '#10B981', '#F59E0B'][Math.min(node.data?.level || 1, 2)],
                    border: '2px solid #374151',
                    borderRadius: '8px',
                    padding: '10px',
                    color: 'white',
                    fontWeight: 'bold'
                }
            }));
            
            // Ensure edges have required properties
            const validatedEdges = mindMapData.edges.map((edge, index) => ({
                id: edge.id || `edge_${index}`,
                source: edge.source || validatedNodes[0]?.id,
                target: edge.target || validatedNodes[index + 1]?.id,
                type: edge.type || 'smoothstep',
                animated: edge.animated || false
            })).filter(edge => edge.source && edge.target);
            
            const finalMindMap = {
                nodes: validatedNodes,
                edges: validatedEdges
            };
            
            console.log(`Generated mind map with ${finalMindMap.nodes.length} nodes and ${finalMindMap.edges.length} edges`);
            return finalMindMap;
            
        } catch (error) {
            console.error('Error generating mind map with Gemini:', error);
            
            // Return a fallback mind map structure
            const fallbackMindMap = {
                nodes: [
                    {
                        id: 'root',
                        position: { x: 400, y: 200 },
                        data: { label: title || 'Main Topic', level: 0 },
                        style: { background: '#8B5CF6', color: 'white', padding: '10px', borderRadius: '8px' }
                    },
                    {
                        id: 'concept1',
                        position: { x: 200, y: 100 },
                        data: { label: 'Key Concept 1', level: 1 },
                        style: { background: '#06B6D4', color: 'white', padding: '8px', borderRadius: '6px' }
                    },
                    {
                        id: 'concept2',
                        position: { x: 600, y: 100 },
                        data: { label: 'Key Concept 2', level: 1 },
                        style: { background: '#06B6D4', color: 'white', padding: '8px', borderRadius: '6px' }
                    },
                    {
                        id: 'detail1',
                        position: { x: 200, y: 300 },
                        data: { label: 'Important Detail', level: 2 },
                        style: { background: '#10B981', color: 'white', padding: '6px', borderRadius: '4px' }
                    }
                ],
                edges: [
                    { id: 'e1', source: 'root', target: 'concept1', type: 'smoothstep' },
                    { id: 'e2', source: 'root', target: 'concept2', type: 'smoothstep' },
                    { id: 'e3', source: 'concept1', target: 'detail1', type: 'smoothstep' }
                ]
            };
            
            return fallbackMindMap;
        }
    }

    async generateReport(content, title) {
        try {
            if (!this.model) {
                throw new Error('Gemini AI model is not available');
            }
            
            const prompt = `You are an expert technical writer creating comprehensive reports for educational purposes. Generate a detailed, professional report based on the provided content.

CONTENT TO ANALYZE:
---
Title: ${title}
Content:
${content.substring(0, 5000)}...
---

REPORT REQUIREMENTS:
1. Professional, academic tone
2. Clear structure with logical flow
3. Comprehensive analysis and insights
4. Evidence-based conclusions
5. Actionable recommendations where applicable

REPORT STRUCTURE (use Markdown formatting):

# [Report Title]

## Executive Summary
- Brief overview of key findings
- Main conclusions
- Critical recommendations

## Table of Contents
- Numbered list of main sections

## 1. Introduction
- Background and context
- Scope and objectives
- Methodology (if applicable)

## 2. Key Findings
- Major discoveries or insights
- Data analysis and interpretation
- Supporting evidence

## 3. Detailed Analysis
- In-depth examination of topics
- Multiple subsections as needed
- Charts, graphs, or data references

## 4. Implications and Impact
- Significance of findings
- Potential consequences
- Areas of concern or opportunity

## 5. Recommendations
- Specific, actionable suggestions
- Implementation strategies
- Next steps

## 6. Conclusion
- Summary of main points
- Final thoughts
- Future considerations

## Appendices (if needed)
- Supporting materials
- Additional data
- References

FORMATTING GUIDELINES:
- Use proper Markdown headers (##, ###)
- Include bullet points and numbered lists
- Add emphasis with **bold** and *italic*
- Include tables where appropriate
- Maintain professional language throughout

Create a comprehensive, well-structured report that provides valuable insights and analysis.`;

            const result = await this.model.generateContent(prompt);
            const reportText = result.response.text();
            
            // Validate and enhance the report
            if (!reportText || reportText.trim().length < 500) {
                throw new Error('Generated report is too short or empty');
            }
            
            console.log(`Generated comprehensive report, length: ${reportText.length} characters`);
            return reportText;
            
        } catch (error) {
            console.error("Error generating report:", error);
            
            // Return a structured fallback report
            const fallbackReport = `# Report: ${title}

## Executive Summary

This report provides an analysis of the submitted content. Due to technical limitations, a comprehensive AI-generated analysis could not be completed at this time.

## Key Findings

- The content contains valuable information that warrants further analysis
- Multiple topics and concepts are present in the material
- Further investigation is recommended for deeper insights

## Analysis

The submitted material appears to cover several important topics. While a full AI analysis is not available, the content shows:

- **Relevant Information**: The material contains pertinent data and insights
- **Educational Value**: The content has potential for learning and development
- **Further Study Needed**: Additional analysis would provide more comprehensive understanding

## Recommendations

1. **Review Original Content**: Examine the source material in detail
2. **Conduct Manual Analysis**: Perform human review for deeper insights
3. **Seek Additional Resources**: Consult related materials for context
4. **Try Again Later**: Attempt AI analysis when technical issues are resolved

## Conclusion

While this automated report could not provide the full analysis requested, the content appears valuable for educational purposes. We recommend manual review and further investigation of the topics presented.

---
*This report was generated with limited AI capabilities. For comprehensive analysis, please ensure proper AI service configuration.*`;

            return fallbackReport;
        }
    }

    async generatePresentation(content, title) {
        try {
            if (!this.model) {
                throw new Error('Gemini AI model is not available');
            }
            
            const prompt = `You are an expert presentation designer creating educational slide decks. Generate a comprehensive, engaging presentation based on the provided content.

CONTENT TO PRESENT:
---
Title: ${title}
Content:
${content.substring(0, 4000)}...
---

PRESENTATION REQUIREMENTS:
1. 10-15 slides total
2. Clear, engaging slide titles
3. Concise bullet points (3-5 per slide)
4. Visual design suggestions
5. Progressive information flow
6. Interactive elements where appropriate

SLIDE STRUCTURE (use Markdown format):

# ${title}
*A Comprehensive Educational Presentation*

---

## Slide 1: Title Slide
- **${title}**
- Subtitle: [Engaging subtitle]
- Presenter: TutorAI Educational System
- Date: [Current date]

## Slide 2: Agenda/Overview
- **What We'll Cover**
- Topic 1: [Main topic]
- Topic 2: [Main topic]
- Topic 3: [Main topic]
- Q&A Session

## Slide 3: Introduction
- **Getting Started**
- [Key introductory points]
- [Context and background]
- [Why this matters]

## Slides 4-12: Main Content
[Create detailed content slides with:]
- **Clear slide titles**
- 3-5 bullet points per slide
- Key concepts and definitions
- Examples and illustrations
- Visual suggestions (charts, diagrams, images)

## Slide 13: Key Takeaways
- **Main Points to Remember**
- [Most important concept 1]
- [Most important concept 2]
- [Most important concept 3]
- [Practical applications]

## Slide 14: Next Steps
- **Moving Forward**
- [Recommended actions]
- [Further learning resources]
- [Practice opportunities]
- [Implementation suggestions]

## Slide 15: Thank You
- **Questions & Discussion**
- Contact information
- Additional resources
- Next session preview

DESIGN NOTES:
- Use consistent color scheme (blues and greens for education)
- Include visual elements: charts, diagrams, images
- Add animations for key transitions
- Use large, readable fonts
- Include interactive elements where possible

Create an engaging, educational presentation that effectively communicates the key concepts and keeps the audience engaged throughout.`;

            const result = await this.model.generateContent(prompt);
            const presentationText = result.response.text();
            
            // Validate the presentation
            if (!presentationText || presentationText.trim().length < 500) {
                throw new Error('Generated presentation is too short or empty');
            }
            
            // Enhance the presentation with additional formatting
            const enhancedPresentation = `${presentationText}

---

## 📊 Presentation Notes

### Design Recommendations:
- **Color Scheme**: Use professional blues (#1e40af) and greens (#059669)
- **Fonts**: Modern sans-serif fonts (Open Sans, Roboto)
- **Layout**: Clean, minimalist design with plenty of white space
- **Images**: High-quality, relevant visuals to support content

### Interactive Elements:
- **Polls**: Include audience polls on key concepts
- **Q&A**: Dedicated time for questions after each major section
- **Activities**: Hands-on exercises where appropriate
- **Discussions**: Small group discussions on complex topics

### Delivery Tips:
- **Timing**: Allow 45-60 minutes for full presentation
- **Engagement**: Ask questions throughout to maintain audience interest
- **Examples**: Use real-world examples to illustrate concepts
- **Practice**: Rehearse transitions between slides

### Technical Setup:
- **Equipment**: Ensure projector/screen, microphone, pointer
- **Backup**: Have offline version and handouts ready
- **Testing**: Test all multimedia elements beforehand

---
*Generated by TutorAI Educational System - Enhancing Learning Through Technology*`;
            
            console.log(`Generated comprehensive presentation, length: ${enhancedPresentation.length} characters`);
            return enhancedPresentation;
            
        } catch (error) {
            console.error("Error generating presentation:", error);
            
            // Return a structured fallback presentation
            const fallbackPresentation = `# ${title}
*Educational Presentation*

---

## Slide 1: Title Slide
- **${title}**
- An Educational Overview
- Presented by TutorAI
- Today's Date

## Slide 2: Overview
- **What We'll Explore Today**
- Key concepts and topics
- Important information from the content
- Practical applications
- Discussion and Q&A

## Slide 3: Introduction
- **Getting Started**
- Understanding the topic
- Why this subject matters
- Learning objectives

## Slide 4: Main Content - Part 1
- **Core Concepts**
- Fundamental principles
- Key definitions
- Important relationships

## Slide 5: Main Content - Part 2
- **Detailed Analysis**
- In-depth exploration
- Examples and applications
- Real-world connections

## Slide 6: Main Content - Part 3
- **Advanced Topics**
- Complex concepts
- Specialized knowledge
- Expert insights

## Slide 7: Key Takeaways
- **Most Important Points**
- Essential knowledge to remember
- Practical applications
- Further study recommendations

## Slide 8: Thank You
- **Questions & Discussion**
- Contact for more information
- Additional resources available
- Thank you for your attention

---

## 📝 Presentation Notes

Due to technical limitations, this is a simplified presentation outline. For a more comprehensive presentation:

1. Add specific content details from your source material
2. Include relevant visuals and diagrams
3. Customize slides based on your audience
4. Add interactive elements and activities

---
*This presentation was generated with basic AI capabilities. For enhanced presentations, ensure proper AI service configuration.*`;

            return fallbackPresentation;
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
