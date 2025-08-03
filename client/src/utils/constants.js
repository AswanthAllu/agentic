// src/utils/constants.js

export const ChatMode = {
    Standard: 'standard',
    RAG: 'rag',
    DeepSearch: 'deep_search',
    Agentic: 'agentic',
    SyllabusChat: 'syllabus_chat',
};

export const getChatModeDisplayName = (mode) => {
    switch (mode) {
        case ChatMode.RAG:
            return 'RAG Mode';
        case ChatMode.DeepSearch:
            return 'Deep Search Mode';
        case ChatMode.Agentic:
            return 'Agentic Mode';
        case ChatMode.SyllabusChat:
            return 'Syllabus Chat Mode';
        default:
            return 'Standard Chat';
    }
};
