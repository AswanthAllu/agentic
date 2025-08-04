// server/server.js
const path = require('path');
const dotenv = require('dotenv');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const multer = require('multer');
const fs = require('fs');

const connectDB = require('./config/db');
const { getLocalIPs } = require('./utils/networkUtils');
const { performAssetCleanup } = require('./utils/assetCleanup');
const serviceManager = require('./services/serviceManager');
const LoggingService = require('./services/LoggingService');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const PORT = process.env.PORT || 5007;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/chatbotGeminiDB4';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
    console.warn("⚠️  WARNING: GEMINI_API_KEY environment variable is not set.");
    console.warn("⚠️  AI-powered features will be disabled, but the server will still run.");
    console.warn("⚠️  To enable AI features, set GEMINI_API_KEY in your .env file.");
}

const app = express();
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'] }));
app.use(express.json());

const startServer = async () => {
    try {
        console.log("--- Starting Server ---");
        const dbConnection = await connectDB(MONGO_URI);
        if (dbConnection) {
            console.log("✓ MongoDB connected successfully");
        } else {
            console.log("⚠️  Running without database connection");
        }

        await serviceManager.initialize();
        await performAssetCleanup();

        app.use((req, res, next) => {
            req.serviceManager = serviceManager;
            req.logger = new LoggingService(req);
            next();
        });

        app.use('/podcasts', express.static(path.join(__dirname, 'public', 'podcasts')));
        app.use('/syllabi', express.static(path.join(__dirname, 'syllabi')));

        app.get('/', (req, res) => res.send('Chatbot Backend API is running...'));
        app.use('/api/network', require('./routes/network'));
        app.use('/api/auth', require('./routes/auth'));
        app.use('/api/chat', require('./routes/chat'));
        app.use('/api/upload', require('./routes/upload'));
        app.use('/api/files', require('./routes/files'));
        app.use('/api/podcast', require('./routes/podcast'));
        app.use('/api/mindmap', require('./routes/mindmap'));
        app.use('/api/syllabus', require('./routes/syllabus'));
        app.use('/api/reports', require('./routes/reports'));
        app.use('/api/presentations', require('./routes/presentations'));
        
        const availableIPs = getLocalIPs();
        app.listen(PORT, '0.0.0.0', () => {
            console.log('\n=== Server Ready ===');
            console.log(`🚀 Server listening on port ${PORT}`);
            console.log('Access URLs:');
            availableIPs.forEach(ip => {
                console.log(`  - http://${ip}:3004 (Frontend) -> Backend: http://${ip}:${PORT}`);
            });
            console.log('==================\n');
        });
    } catch (error) {
        console.error("!!! Failed to start server:", error.message);
        process.exit(1);
    }
};

startServer();
module.exports = app;
