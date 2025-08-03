// src/services/api.js
import axios from 'axios';

const getApiBaseUrl = () => {
    const backendPort = process.env.REACT_APP_BACKEND_PORT || 5007;
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return `${protocol}//${hostname}:${backendPort}/api`;
    }
    return '/api';
};

const API_BASE_URL = getApiBaseUrl();
console.log("API Base URL:", API_BASE_URL);

const api = axios.create({
    baseURL: API_BASE_URL,
});

api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) { config.headers['Authorization'] = `Bearer ${token}`; }
        const userId = localStorage.getItem('userId');
        if (userId) { config.headers['x-user-id'] = userId; }
        if (config.data instanceof FormData) {
            delete config.headers['Content-Type'];
        } else if (!config.headers['Content-Type']) {
            config.headers['Content-Type'] = 'application/json';
        }
        return config;
    },
    (error) => Promise.reject(error)
);

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.clear();
            window.location.href = '/login?sessionExpired=true';
        }
        return Promise.reject(error);
    }
);

export const signupUser = (userData) => api.post('/auth/signup', userData);
export const signinUser = (userData) => api.post('/auth/signin', userData);
export const getCurrentUser = () => api.get('/auth/me');
export const sendMessage = (messageData) => api.post('/chat/message', messageData);
export const saveChatHistory = (historyData) => api.post('/chat/history', historyData);
export const getChatSessions = () => api.get('/chat/sessions');
export const getSessionDetails = (sessionId) => api.get(`/chat/session/${sessionId}`);
export const deleteChatSession = (sessionId) => api.delete(`/chat/session/${sessionId}`);
export const queryRagService = (queryData) => api.post('/chat/rag', queryData);
export const performDeepSearch = (query, history = []) => api.post('/chat/deep-search', { query, history });
export const queryHybridRagService = (queryData) => api.post('/chat/rag-v2', queryData);
export const querySyllabus = (subjectId, query) => api.post(`/syllabus/${subjectId}`, { query });
export const queryAgentic = (query) => api.post('/chat/agentic', { query });
export const uploadFile = (formData) => api.post('/upload', formData);
export const getUserFiles = () => api.get('/files');
export const deleteUserFile = (fileId) => api.delete(`/files/${fileId}`);
export const renameUserFile = (fileId, newOriginalName) => api.patch(`/files/${fileId}`, { newOriginalName });
export const generatePodcast = (fileId) => api.post('/podcast/generate', { fileId });
export const generateMindMap = (fileId) => api.post('/mindmap/generate', { fileId });
export const generateReport = (fileId, query) => api.post('/reports/generate', { fileId, query });
export const generatePresentation = (fileId, query) => api.post('/presentations/generate', { fileId, query });
