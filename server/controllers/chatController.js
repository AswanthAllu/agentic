// server/controllers/chatController.js
const { ChatSession } = require('../models/ChatSession');
const { v4: uuidv4 } = require('uuid');
const File = require('../models/File');
const { MESSAGE_TYPES } = require('../models/ChatSession');
const { sendSuccess, sendError, asyncHandler, validateRequiredFields, handleChatResponse } = require('../utils/responseHandler');

const getSessions = async (req, res) => {
    try {
        const sessions = await ChatSession.find({ user: req.user.id }).sort({ updatedAt: -1 });
        res.json(sessions);
    } catch (err) {
        console.error('Error fetching sessions:', err.message);
        res.status(500).send('Server Error');
    }
};

const getSessionDetails = async (req, res) => {
    try {
        const session = await ChatSession.findOne({ sessionId: req.params.sessionId, user: req.user.id });
        if (!session) {
            return res.status(404).json({ message: 'Session not found' });
        }
        res.json(session);
    } catch (err) {
        console.error('Error fetching session details:', err.message);
        res.status(500).send('Server Error');
    }
};

const createSession = async (req, res) => {
    try {
        const newSession = new ChatSession({
            user: req.user.id,
            sessionId: uuidv4(),
            title: 'New Conversation',
            messages: [],
        });
        await newSession.save();
        res.status(201).json(newSession);
    } catch (err) {
        console.error('Error creating session:', err.message);
        res.status(500).send('Server Error');
    }
};

const saveChatHistory = async (req, res) => {
    const { sessionId, messages, systemPrompt, title } = req.body;
    if (!sessionId || !messages) {
        return res.status(400).json({ message: 'Session ID and messages are required.' });
    }
    try {
        const updatedSession = await ChatSession.findOneAndUpdate(
            { sessionId: sessionId, user: req.user.id },
            { 
                $set: {
                    messages: messages,
                    systemPrompt: systemPrompt,
                    title: title || 'New Conversation',
                    user: req.user.id
                }
            },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
        req.logger.log('chat_history_saved', { userId: req.user.id, sessionId });
        res.status(201).json(updatedSession);
    } catch (error) {
        req.logger.error('chat_history_save_failed', { userId: req.user.id, sessionId, error: error.message });
        res.status(500).json({ message: 'Server error while saving chat history.' });
    }
};

const handleStandardMessage = asyncHandler(async (req, res) => {
    const { query, history = [], systemPrompt } = req.body;
    
    // Validate required fields
    validateRequiredFields(req.body, ['query']);
    
    try {
        const { chatService } = req.serviceManager.getServices();
        
        // Enhanced response handling with fallback
        const response = await handleChatResponse(
            () => chatService.handleStandardMessage(query, history, systemPrompt),
            "Hello! I'm having trouble connecting to the AI service right now, but I'm here to help. Please try again in a moment."
        );
        
        // Ensure we always have a valid response
        const messageText = typeof response === 'object' ? response.message : response;
        
        return sendSuccess(res, 'Response generated successfully', {
            message: messageText || "I'm here to help! How can I assist you today?"
        });
        
    } catch (error) {
        console.error("Standard chat error:", error);
        return sendError(res, error, "Failed to get a response from the AI service");
    }
});

const handleRagMessage = async (req, res) => {
    res.status(404).json({ message: 'This endpoint is deprecated. Please use /api/chat/rag-v2' });
};

const handleDeepSearch = async (req, res) => {
    const { query, history = [] } = req.body;
    if (!query) {
        return res.status(400).json({ message: 'Query is required' });
    }
    try {
        const deepSearchService = req.serviceManager.getDeepSearchService(req.user.id);
        const result = await deepSearchService.performSearch(query, history);
        res.status(200).json({
            message: result.summary,
            metadata: {
                sources: result.sources,
                searchType: 'deep_search'
            }
        });
    } catch (error) {
        console.error('Deep search controller error:', error);
        res.status(500).json({ message: 'Deep search failed.' });
    }
};

const deleteSession = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const userId = req.user.id;
        const result = await ChatSession.findOneAndDelete({ 
            sessionId: sessionId, 
            user: userId 
        });
        if (!result) {
            return res.status(404).json({ message: 'Chat session not found or you are not authorized to delete it.' });
        }
        res.status(200).json({ message: 'Chat session deleted successfully.' });
    } catch (error) {
        console.error('Error deleting session:', error);
        res.status(500).json({ message: 'Server error while deleting session.' });
    }
};

const handleHybridRagMessage = async (req, res) => {
    try {
        const { query, fileId, allowDeepSearch } = req.body;
        const userId = req.user.id;
        if (!query) {
            return res.status(400).json({ message: 'Query is required.' });
        }
        const { chatService } = req.serviceManager.getServices();
        const result = await chatService.handleHybridRagMessage(query, userId, fileId, allowDeepSearch);
        res.status(200).json(result);
    } catch (error) {
        console.error('Hybrid RAG Error:', error);
        res.status(500).json({ message: 'An error occurred during the RAG process.' });
    }
};

const handleAgenticTask = async (req, res) => {
    try {
        const { query } = req.body;
        if (!query) {
            return res.status(400).json({ message: 'Query is required.' });
        }
        const { chatService } = req.serviceManager.getServices();
        const response = await chatService.handleAgenticTask(query, req.user.id);
        res.status(200).json({ message: response });
    } catch (error) {
        console.error('Agentic Task Error:', error);
        res.status(500).json({ message: 'An error occurred during the agentic process.' });
    }
};

module.exports = {
    getSessions,
    getSessionDetails,
    createSession,
    saveChatHistory,
    handleStandardMessage,
    handleRagMessage,
    handleDeepSearch,
    deleteSession,
    handleHybridRagMessage,
    handleAgenticTask
};
