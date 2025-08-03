// server/routes/presentations.js
const express = require('express');
const router = express.Router();
const { tempAuth } = require('../middleware/authMiddleware');
const User = require('../models/User');
const UserMultiLLMManager = require('../services/UserMultiLLMManager');
const serviceManager = require('../services/serviceManager');
const File = require('../models/File');
const { promises: fs } = require('fs');

router.post('/generate', tempAuth, async (req, res) => {
    const { fileId, query } = req.body;
    const userId = req.user.id;
    const logger = req.logger;

    if (!fileId && !query) {
        return res.status(400).json({ message: 'Either fileId or query is required.' });
    }
    
    logger.log('presentation_generation_requested', { userId, fileId, query });
    try {
        // Get user and check for API key
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        if (!user.geminiApiKey) {
            return res.status(400).json({ 
                message: 'Please set your Gemini API key in settings to use AI features.',
                requiresApiKey: true
            });
        }

        const { documentProcessor } = serviceManager.getServices();
        let sourceContent = '';
        let file = null;

        if (fileId) {
            file = await File.findOne({ _id: fileId, user: userId });
            if (!file || !fs.existsSync(file.path)) {
                return res.status(404).json({ message: 'File not found.' });
            }
            sourceContent = await documentProcessor.parseFile(file.path, file.mimetype);
        } else if (query) {
            sourceContent = query;
        }

        if (!sourceContent || sourceContent.length < 200) {
            return res.status(400).json({ message: 'Insufficient content to generate a presentation.' });
        }

        // Use user-specific AI service
        const userLLMManager = new UserMultiLLMManager(user.geminiApiKey);
        const presentationData = await userLLMManager.generatePresentation(sourceContent, fileId ? file.originalname : 'User Query');
        
        logger.log('presentation_generation_success', { userId, fileId, query });
        res.json({
            message: 'Presentation outline generated successfully.',
            presentation: presentationData
        });
    } catch (error) {
        logger.error('presentation_generation_failed', { userId, fileId, query, error: error.message });
        
        if (error.message.includes('API key')) {
            return res.status(400).json({ 
                message: 'Invalid Gemini API key. Please check your API key in settings.',
                requiresApiKey: true
            });
        }
        
        res.status(500).json({ message: 'Failed to generate presentation.', error: error.message });
    }
});

module.exports = router;