// server/utils/responseHandler.js
const { createError } = require('./errorUtils');

/**
 * Standard response format for API endpoints
 * @param {Object} res - Express response object
 * @param {number} status - HTTP status code
 * @param {string} message - Response message
 * @param {Object} data - Response data
 * @param {Object} metadata - Additional metadata
 */
function sendResponse(res, status, message, data = null, metadata = null) {
    const response = {
        success: status < 400,
        message,
        data,
        metadata,
        timestamp: new Date().toISOString()
    };

    // Remove null fields
    Object.keys(response).forEach(key => {
        if (response[key] === null) {
            delete response[key];
        }
    });

    return res.status(status).json(response);
}

/**
 * Send success response
 */
function sendSuccess(res, message, data = null, metadata = null) {
    return sendResponse(res, 200, message, data, metadata);
}

/**
 * Send error response with proper formatting
 */
function sendError(res, error, defaultMessage = 'An error occurred') {
    const status = error.status || 500;
    const message = error.message || defaultMessage;
    
    console.error('API Error:', {
        status,
        message,
        stack: error.stack,
        timestamp: new Date().toISOString()
    });

    return sendResponse(res, status, message, null, error.details);
}

/**
 * Async error handler wrapper
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

/**
 * Validate required fields in request body
 */
function validateRequiredFields(body, requiredFields) {
    const missingFields = requiredFields.filter(field => !body[field]);
    
    if (missingFields.length > 0) {
        throw createError(400, `Missing required fields: ${missingFields.join(', ')}`);
    }
}

/**
 * Enhanced chat response handler with fallback
 */
async function handleChatResponse(aiServiceCall, fallbackMessage = "I'm unable to provide a response at the moment.") {
    try {
        const response = await aiServiceCall();
        
        if (!response || (typeof response === 'string' && response.trim().length === 0)) {
            throw new Error('Empty response from AI service');
        }
        
        return response;
    } catch (error) {
        console.error('Chat response error:', error);
        
        // Provide more specific fallback messages based on error type
        if (error.message?.includes('API key')) {
            return "The AI service is currently unavailable due to configuration issues. Please contact support.";
        } else if (error.message?.includes('rate limit')) {
            return "The AI service is experiencing high traffic. Please try again in a few moments.";
        } else if (error.message?.includes('blocked')) {
            return "I couldn't generate a response for that request. Please try rephrasing your question.";
        } else {
            return fallbackMessage;
        }
    }
}

module.exports = {
    sendResponse,
    sendSuccess,
    sendError,
    asyncHandler,
    validateRequiredFields,
    handleChatResponse
};