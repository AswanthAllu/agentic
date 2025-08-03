// server/routes/upload.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { tempAuth } = require('../middleware/authMiddleware');
const File = require('../models/File');
const User = require('../models/User');
const { SUPPORTED_MIMETYPES } = require('../utils/constants');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 },
});

router.post('/', tempAuth, upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded.' });
    }
    const logger = req.logger;

    const { documentProcessor } = req.serviceManager.getServices();
    if (!documentProcessor) {
        logger.error("Upload Route: DocumentProcessor not available from serviceManager.");
        return res.status(500).json({ message: 'Server configuration error: DocumentProcessor is not available.' });
    }

    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        if (!Object.values(SUPPORTED_MIMETYPES).includes(req.file.mimetype)) {
            logger.warn('upload_unsupported_file_type', { userId: req.user.id, mimetype: req.file.mimetype });
            return res.status(400).json({ message: 'Unsupported file type.' });
        }

        const newFile = new File({
            user: req.user.id,
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
        });
        
        const extension = path.extname(req.file.originalname);
        const finalFilename = `${newFile._id}${extension}`;
        const userUploadsDir = path.join(__dirname, '..', 'assets', user.username, 'docs');
        const finalPath = path.join(userUploadsDir, finalFilename);

        fs.mkdirSync(userUploadsDir, { recursive: true });
        fs.writeFileSync(finalPath, req.file.buffer);

        newFile.filename = finalFilename;
        newFile.path = finalPath;
        await newFile.save();

        logger.log('file_upload_success', { userId: req.user.id, fileId: newFile._id, filename: newFile.originalname });
        
        documentProcessor.processFile(finalPath, {
            userId: req.user.id.toString(),
            fileId: newFile._id.toString(),
            originalName: req.file.originalname,
            fileType: path.extname(req.file.originalname).substring(1)
        }).then(result => {
            logger.log('rag_processing_started', { userId: req.user.id, fileId: newFile._id });
        }).catch(ragError => {
            logger.error('rag_processing_failed', { userId: req.user.id, fileId: newFile._id, error: ragError.message });
        });

        res.status(201).json(newFile);

    } catch (error) {
        logger.error('file_upload_failed', { userId: req.user.id, error: error.message });
        res.status(500).json({ message: 'Server error during file upload.' });
    }
});

module.exports = router;
