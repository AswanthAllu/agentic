// server/routes/syllabus.js
const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const { tempAuth } = require('../middleware/authMiddleware');
const serviceManager = require('../services/serviceManager');

const SYLLABI_DIR = path.join(__dirname, '..', 'syllabi');

router.post('/:subjectId', tempAuth, async (req, res) => {
    const { subjectId } = req.params;
    const { query } = req.body;
    const logger = req.logger;

    if (!query || typeof query !== 'string') {
        return res.status(400).json({ message: 'A query string is required.' });
    }

    const sanitizedSubjectId = subjectId.replace(/[^a-zA-Z0-9_]/g, '');
    if (sanitizedSubjectId !== subjectId) {
        logger.warn('syllabus_invalid_id', { userId: req.user.id, subjectId });
        return res.status(400).json({ message: 'Invalid subject ID format.' });
    }

    const filePath = path.join(SYLLABI_DIR, `${sanitizedSubjectId}.md`);
    
    try {
        await fs.access(filePath);
        const syllabusContent = await fs.readFile(filePath, 'utf-8');
        logger.log('syllabus_query_received', { userId: req.user.id, subjectId, query });

        const { multiLLMManager } = serviceManager.getServices();
        const responseText = await multiLLMManager.querySyllabus(query, syllabusContent);

        res.status(200).json({ 
            message: responseText.trim(),
            source: `${sanitizedSubjectId}.md`
        });

    } catch (error) {
        if (error.code === 'ENOENT') {
            logger.warn('syllabus_file_not_found', { userId: req.user.id, subjectId });
            return res.status(404).json({ message: `Syllabus for '${subjectId}' not found.` });
        }
        logger.error('syllabus_query_failed', { userId: req.user.id, subjectId, query, error: error.message });
        res.status(500).json({ message: 'An internal server error occurred while processing the request.' });
    }
});

module.exports = router;
