// server/routes/files.js
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { tempAuth } = require('../middleware/authMiddleware');
const File = require('../models/File');
const vectorStore = require('../services/LangchainVectorStore');
const serviceManager = require('../services/serviceManager');

router.get('/', tempAuth, async (req, res) => {
    try {
        const files = await File.find({ user: req.user.id }).sort({ createdAt: -1 });
        res.json(files);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

router.patch('/:id', tempAuth, async (req, res) => {
    const { newOriginalName } = req.body;
    const logger = req.logger;

    if (!newOriginalName) {
        return res.status(400).json({ msg: 'New name is required.' });
    }

    try {
        let file = await File.findById(req.params.id);
        if (!file) {
            return res.status(404).json({ msg: 'File not found' });
        }
        if (file.user.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        const oldName = file.originalname;
        file.originalname = newOriginalName;
        await file.save();

        logger.log('file_renamed', { userId: req.user.id, fileId: file.id, oldName, newName: newOriginalName });
        res.json(file);
    } catch (err) {
        logger.error('file_rename_failed', { userId: req.user.id, fileId: req.params.id, error: err.message });
        res.status(500).send('Server Error');
    }
});


router.delete('/:id', tempAuth, async (req, res) => {
    const logger = req.logger;
    try {
        const file = await File.findById(req.params.id);
        if (!file) return res.status(404).json({ msg: 'File not found in DB' });
        if (file.user.toString() !== req.user.id) return res.status(401).json({ msg: 'Not authorized' });

        const { documentProcessor } = serviceManager.getServices();
        if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
        }

        await documentProcessor.deleteFileAndVectors(req.params.id);
        await File.findByIdAndDelete(req.params.id);

        logger.log('file_deleted', { userId: req.user.id, fileId: file.id, filename: file.originalname });
        res.json({ msg: 'File and all associated data removed' });
    } catch (err) {
        logger.error('file_delete_failed', { userId: req.user.id, fileId: req.params.id, error: err.message });
        res.status(500).send('Server Error');
    }
});

module.exports = router;