// server/models/ChatHistory.js
// This model is now superseded by ChatSession.js and can be removed.
const mongoose = require('mongoose');
const MessageSchema = new mongoose.Schema({
    role: {
        type: String,
        enum: ['user', 'model'], // Gemini roles
        required: true
    },
    parts: [{
        text: {
            type: String,
            required: true
        }
    }],
    timestamp: {
        type: Date,
        default: Date.now
    }
}, { _id: false });

const ChatHistorySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sessionId: { type: String, required: true, unique: true, index: true },
    messages: [MessageSchema],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

ChatHistorySchema.pre('save', function (next) {
    if (this.isModified()) { this.updatedAt = Date.now(); }
    next();
});

ChatHistorySchema.pre('findOneAndUpdate', function(next) {
  this.set({ updatedAt: new Date() });
  next();
});

const ChatHistory = mongoose.model('ChatHistory', ChatHistorySchema);
module.exports = ChatHistory;
