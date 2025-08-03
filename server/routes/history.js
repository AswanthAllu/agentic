// server/routes/history.js
const express = require('express');
const router = express.Router();
const { tempAuth } = require('../middleware/authMiddleware');
const ChatSession = require('../models/ChatSession');

router.post('/', tempAuth, async (req, res) => {
    if (!req.user) { return res.status(401).json({ message: 'Not authorized' }); }
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
});

router.get('/', tempAuth, async (req, res) => {
    if (!req.user) { return res.status(401).json({ message: 'Not authorized' }); }
    try {
        const sessions = await ChatSession.find({ user: req.user.id })
            .sort({ createdAt: -1 })
            .select('sessionId title createdAt'); 
        res.json(sessions);
    } catch (error) {
        req.logger.error('chat_history_fetch_failed', { userId: req.user.id, error: error.message });
        res.status(500).json({ message: 'Server error while fetching history.' });
    }
});

router.get('/:sessionId', tempAuth, async (req, res) => {
    if (!req.user) { return res.status(401).json({ message: 'Not authorized' }); }
    try {
        const session = await ChatSession.findOne({ 
            sessionId: req.params.sessionId, 
            user: req.user.id 
        });
        if (!session) {
            return res.status(404).json({ message: 'Chat session not found.' });
        }
        res.json(session);
    } catch (error) {
        req.logger.error('single_session_fetch_failed', { userId: req.user.id, sessionId: req.params.sessionId, error: error.message });
        res.status(500).json({ message: 'Server error.' });
    }
});


router.delete('/:sessionId', tempAuth, async (req, res) => {
    if (!req.user) { return res.status(401).json({ message: 'Not authorized' }); }
    try {
        const session = await ChatSession.findOneAndDelete({ 
            sessionId: req.params.sessionId, 
            user: req.user.id 
        });
        if (!session) {
            return res.status(404).json({ message: 'Chat session not found or you are not authorized to delete it.' });
        }
        req.logger.log('chat_session_deleted', { userId: req.user.id, sessionId: session.sessionId, title: session.title });
        res.json({ message: 'Chat session deleted successfully.' });
    } catch (error) {
        req.logger.error('chat_session_delete_failed', { userId: req.user.id, sessionId: req.params.sessionId, error: error.message });
        res.status(500).json({ message: 'Server error while deleting session.' });
    }
});

module.exports = router;
