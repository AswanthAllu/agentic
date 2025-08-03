// server/routes/chat.js
const express = require('express');
const router = express.Router();
const { tempAuth } = require('../middleware/authMiddleware');
const { 
    getSessions, 
    getSessionDetails, 
    createSession, 
    saveChatHistory,
    handleStandardMessage,
    handleRagMessage,
    handleDeepSearch,
    deleteSession,
    handleHybridRagMessage,
    handleAgenticTask,
} = require('../controllers/chatController');
const { ChatSession, SESSION_STATES, SESSION_CONTEXTS, MESSAGE_TYPES } = require('../models/ChatSession');
const DeepSearchService = require('../deep_search/services/deepSearchService');


router.post('/session', tempAuth, createSession);
router.get('/sessions', tempAuth, getSessions);
router.get('/session/:sessionId', tempAuth, getSessionDetails);
router.delete('/session/:sessionId', tempAuth, deleteSession);
router.post('/history', tempAuth, saveChatHistory);


router.post('/message', tempAuth, handleStandardMessage);
router.post('/rag', tempAuth, handleRagMessage);
router.post('/rag-v2', tempAuth, handleHybridRagMessage);
router.post('/deep-search', tempAuth, handleDeepSearch);
router.post('/agentic', tempAuth, handleAgenticTask);

module.exports = router;