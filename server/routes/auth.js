// server/routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { tempAuth } = require('../middleware/authMiddleware');

router.post('/signup', async (req, res) => {
    const { username, password } = req.body;
    const logger = req.logger;

    if (!username || !password) {
        return res.status(400).json({ message: 'Please provide a username and password.' });
    }
    if (password.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters long.' });
    }

    try {
        let user = await User.findOne({ username });
        if (user) {
            return res.status(400).json({ message: 'Username is already taken.' });
        }

        user = new User({ username, password });
        await user.save();
        logger.log('user_signup', { userId: user.id, username: user.username });

        const payload = { user: { id: user.id } };
        if (!process.env.JWT_SECRET) {
            console.error('FATAL ERROR: JWT_SECRET is not defined in your environment.');
            return res.status(500).send('Server configuration error.');
        }
        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '5d' }, (err, token) => {
            if (err) throw err;
            res.status(201).json({
                token,
                user: { id: user.id, username: user.username }
            });
        });
    } catch (err) {
        logger.error('signup_failed', { error: err.message, username });
        res.status(500).send('Server error');
    }
});

router.get('/me', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.user.id).select('-password');
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json({ user: { ...user.toObject(), id: user._id } });
    } catch (err) {
        if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token is not valid' });
        }
        console.error('Unexpected error in /me:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.post('/signin', async (req, res) => {
    const { username, password } = req.body;
    const logger = req.logger;

    if (!username || !password) {
        return res.status(400).json({ message: 'Please provide a username and password.' });
    }

    try {
        let user = await User.findOne({ username });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials.' });
        }
        logger.log('user_signin', { userId: user.id, username: user.username });

        const payload = { user: { id: user.id } };
        if (!process.env.JWT_SECRET) {
            console.error('FATAL ERROR: JWT_SECRET is not defined in your environment.');
            return res.status(500).send('Server configuration error.');
        }
        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '5d' }, (err, token) => {
            if (err) throw err;
            res.json({
                token,
                user: { id: user.id, username: user.username }
            });
        });
    } catch (err) {
        logger.error('signin_failed', { error: err.message, username });
        res.status(500).send('Server error');
    }
});

// Set user's Gemini API key
router.post('/set-api-key', tempAuth, async (req, res) => {
    const { geminiApiKey } = req.body;
    const userId = req.user.id;
    const logger = req.logger;

    if (!geminiApiKey || geminiApiKey.trim() === '') {
        return res.status(400).json({ message: 'Gemini API key is required.' });
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        user.geminiApiKey = geminiApiKey.trim();
        await user.save();

        logger.log('user_api_key_updated', { userId });
        res.json({ message: 'Gemini API key updated successfully.' });
    } catch (error) {
        logger.error('api_key_update_failed', { userId, error: error.message });
        res.status(500).json({ message: 'Failed to update API key.' });
    }
});

// Get user's API key status (without exposing the actual key)
router.get('/api-key-status', tempAuth, async (req, res) => {
    const userId = req.user.id;

    try {
        const user = await User.findById(userId).select('geminiApiKey');
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const hasApiKey = !!(user.geminiApiKey && user.geminiApiKey.trim() !== '');
        res.json({ 
            hasApiKey,
            keyPreview: hasApiKey ? `${user.geminiApiKey.substring(0, 8)}...` : null
        });
    } catch (error) {
        res.status(500).json({ message: 'Failed to check API key status.' });
    }
});

// Remove user's API key
router.delete('/api-key', tempAuth, async (req, res) => {
    const userId = req.user.id;
    const logger = req.logger;

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        user.geminiApiKey = null;
        await user.save();

        logger.log('user_api_key_removed', { userId });
        res.json({ message: 'Gemini API key removed successfully.' });
    } catch (error) {
        logger.error('api_key_removal_failed', { userId, error: error.message });
        res.status(500).json({ message: 'Failed to remove API key.' });
    }
});

module.exports = router;