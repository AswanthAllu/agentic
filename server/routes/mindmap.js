// server/routes/mindmap.js
const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const { tempAuth } = require('../middleware/authMiddleware');
const File = require('../models/File');
const User = require('../models/User');
const UserMultiLLMManager = require('../services/UserMultiLLMManager');
const serviceManager = require('../services/serviceManager');
const MindMapGenerator = require('../services/MindMapGenerator');
const DocumentProcessor = require('../services/documentProcessor');

router.post('/generate', tempAuth, async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ message: "Authentication failed." });
    }
    const { fileId } = req.body;
    const userId = req.user.id;
    const logger = req.logger;

    if (!fileId) {
        return res.status(400).json({ message: 'File ID is required.' });
    }

    try {
        logger.log('mindmap_generation_requested', { userId, fileId });
        
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
        const fsPath = file?.path;
        let fileExists = false;
        if (fsPath) {
            try {
                await fs.access(fsPath);
                fileExists = true;
            } catch (e) {
                fileExists = false;
            }
        }
        if (!file || !fileExists) {
            return res.status(404).json({ message: 'File not found on server. Please re-upload.' });
        }

        const { documentProcessor } = serviceManager.getServices();
        const fileContent = await documentProcessor.parseFile(file.path, file.mimetype);
        
        if (!fileContent || fileContent.trim().length === 0) {
            return res.status(400).json({ message: 'File is empty or contains no readable content.' });
        }

        let mindMapData = null;
        try {
            // Use user-specific AI service
            const userLLMManager = new UserMultiLLMManager(user.geminiApiKey);
            mindMapData = await userLLMManager.generateMindMapData(fileContent, file.originalname);
        } catch (aiError) {
            logger.warn('mindmap_ai_fallback', { userId, fileId, error: aiError.message });
            
            if (aiError.message.includes('API key')) {
                return res.status(400).json({ 
                    message: 'Invalid Gemini API key. Please check your API key in settings.',
                    requiresApiKey: true
                });
            }
        }

        if (!mindMapData || !mindMapData.nodes || mindMapData.nodes.length === 0) {
            logger.log('mindmap_generating_fallback', { userId, fileId });
            mindMapData = MindMapGenerator.createHierarchicalMindMap(fileContent);
            if (!mindMapData.nodes || mindMapData.nodes.length === 0) {
                mindMapData = MindMapGenerator.createBasicMindMap(fileContent);
            }
            if (!mindMapData || !mindMapData.nodes || mindMapData.nodes.length === 0) {
                mindMapData = MindMapGenerator.createFallbackMindMap(fileContent);
            }
        }

        try {
            const formattedMindMapData = MindMapGenerator.formatForReactFlow(mindMapData);
            if (!formattedMindMapData.nodes || formattedMindMapData.nodes.length === 0) {
                throw new Error('No nodes generated in mind map');
            }
            logger.log('mindmap_generation_success', { userId, fileId, nodes: formattedMindMapData.nodes.length });
            return res.json(formattedMindMapData);
        } catch (formatError) {
            logger.error('mindmap_format_error', { userId, fileId, error: formatError.message });
            const basicMindMap = MindMapGenerator.createBasicMindMap(fileContent);
            return res.json(basicMindMap);
        }
    } catch (error) {
        logger.error('mindmap_generation_failed', { userId, fileId, error: error.message });
        const message = 'An internal server error occurred while generating the mind map.';
        res.status(500).json({ message });
    }
});

module.exports = router;