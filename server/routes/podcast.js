// server/routes/podcast.js
const express = require('express');
const router = express.Router();
const { tempAuth } = require('../middleware/authMiddleware');
const File = require('../models/File');
const User = require('../models/User');
const UserMultiLLMManager = require('../services/UserMultiLLMManager');
const serviceManager = require('../services/serviceManager');
const { generatePodcastAudio } = require('../services/podcastGenerator');
const path = require('path');
const fs = require('fs');

router.post('/generate', tempAuth, async (req, res) => {
    const { fileId } = req.body;
    const userId = req.user.id;
    const logger = req.logger;

    if (!fileId) {
        return res.status(400).json({ message: 'File ID is required.' });
    }

    try {
        logger.log('podcast_generation_requested', { userId, fileId });
        
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

        const file = await File.findOne({ _id: fileId, user: userId });
        if (!file) {
            logger.warn('podcast_file_not_found', { userId, fileId });
            return res.status(404).json({ message: 'File not found.' });
        }
        if (!fs.existsSync(file.path)) {
            logger.warn('podcast_file_on_disk_not_found', { userId, fileId });
            return res.status(404).json({ message: 'File not found on disk.' });
        }

        const { documentProcessor } = serviceManager.getServices();
        const documentContent = await documentProcessor.parseFile(file.path, file.mimetype);
        
        if (!documentContent || documentContent.trim().length < 500) {
            logger.warn('podcast_insufficient_content', { userId, fileId, length: documentContent.length });
            return res.status(400).json({ message: 'The document does not have enough content to generate a podcast.' });
        }
        
        // Use user-specific AI service
        const userLLMManager = new UserMultiLLMManager(user.geminiApiKey);
        
        logger.log('podcast_script_generation_started', { userId, fileId });
        const script = await userLLMManager.generatePodcastScript(documentContent);
        
        logger.log('podcast_audio_generation_started', { userId, fileId });
        const podcastUrl = await generatePodcastAudio(script, file.originalname);
        
        logger.log('podcast_generation_success', { userId, fileId, podcastUrl });
        res.json({
            message: 'Podcast generated successfully!',
            podcastUrl: podcastUrl,
            script: script,
        });
    } catch (error) {
        logger.error('podcast_generation_failed', { userId, fileId, error: error.message });
        
        if (error.message.includes('API key')) {
            return res.status(400).json({ 
                message: 'Invalid Gemini API key. Please check your API key in settings.',
                requiresApiKey: true
            });
        }
        
        res.status(500).json({ message: 'Failed to generate podcast.', error: error.message });
    }
});

module.exports = router;
