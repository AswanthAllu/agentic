// server/routes/reports.js
const express = require('express');
const router = express.Router();
const { tempAuth } = require('../middleware/authMiddleware');
const serviceManager = require('../services/serviceManager');
const File = require('../models/File');
const fs = require('fs'); // Import the standard fs module for synchronous checks
const { promises: fsp } = require('fs'); // Use a different alias for the promises API

router.post('/generate', tempAuth, async (req, res) => {
    const { fileId, query } = req.body;
    const userId = req.user.id;
    const logger = req.logger;

    if (!fileId && !query) {
        return res.status(400).json({ message: 'Either fileId or query is required.' });
    }

    logger.log('report_generation_requested', { userId, fileId, query });
    try {
        const { documentProcessor, multiLLMManager } = serviceManager.getServices();
        let sourceContent = '';
        let file = null; // Declare file here so it's always accessible

        if (fileId) {
            file = await File.findOne({ _id: fileId, user: userId });
            // Correctly use the synchronous existsSync method from the standard fs import
            if (!file || !fs.existsSync(file.path)) {
                return res.status(404).json({ message: 'File not found.' });
            }
            // Use the correct fs module for async operations if needed, or pass the content directly
            sourceContent = await documentProcessor.parseFile(file.path, file.mimetype);
        } else if (query) {
            sourceContent = query;
        }

        if (!sourceContent || sourceContent.length < 500) {
            return res.status(400).json({ message: 'Insufficient content to generate a report.' });
        }

        const reportData = await multiLLMManager.generateReport(sourceContent, fileId ? file.originalname : 'User Query');
        
        logger.log('report_generation_success', { userId, fileId, query });
        res.json({
            message: 'Report generated successfully.',
            report: reportData
        });
    } catch (error) {
        logger.error('report_generation_failed', { userId, fileId, query, error: error.message });
        res.status(500).json({ message: 'Failed to generate report.', error: error.message });
    }
});

module.exports = router;
