// server/utils/constants.js

const SUPPORTED_MIMETYPES = {
    PDF: 'application/pdf',
    TXT: 'text/plain',
    DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    DOC: 'application/msword',
    PPTX: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    PPT: 'application/vnd.ms-powerpoint',
    PY: 'text/x-python',
    JS: 'application/javascript',
    BMP: 'image/bmp',
    PNG: 'image/png',
    JPG: 'image/jpeg',
    JPEG: 'image/jpeg'
};

const SUMMARIZATION_TYPES = {
    SHORT: 'short',
    MEDIUM: 'medium',
    LONG: 'long',
    BULLET_POINTS: 'bullet_points',
    CONVERSATIONAL: 'conversational'
};

const SUMMARIZATION_STYLES = {
    FORMAL: 'formal',
    CASUAL: 'casual',
    TECHNICAL: 'technical',
    CREATIVE: 'creative'
};

module.exports = {
    SUPPORTED_MIMETYPES,
    SUMMARIZATION_TYPES,
    SUMMARIZATION_STYLES,
};
 