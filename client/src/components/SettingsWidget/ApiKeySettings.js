// client/src/components/SettingsWidget/ApiKeySettings.js
import React, { useState, useEffect } from 'react';
import { setGeminiApiKey, getApiKeyStatus, removeGeminiApiKey } from '../../services/api';
import './ApiKeySettings.css';

const ApiKeySettings = () => {
    const [apiKey, setApiKey] = useState('');
    const [hasApiKey, setHasApiKey] = useState(false);
    const [keyPreview, setKeyPreview] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [showApiKey, setShowApiKey] = useState(false);

    useEffect(() => {
        checkApiKeyStatus();
    }, []);

    const checkApiKeyStatus = async () => {
        try {
            const response = await getApiKeyStatus();
            setHasApiKey(response.data.hasApiKey);
            setKeyPreview(response.data.keyPreview || '');
        } catch (error) {
            console.error('Error checking API key status:', error);
        }
    };

    const handleSetApiKey = async (e) => {
        e.preventDefault();
        if (!apiKey.trim()) {
            setMessage({ type: 'error', text: 'Please enter a valid API key' });
            return;
        }

        setIsLoading(true);
        setMessage({ type: '', text: '' });

        try {
            await setGeminiApiKey(apiKey);
            setMessage({ type: 'success', text: 'API key updated successfully!' });
            setApiKey('');
            await checkApiKeyStatus();
        } catch (error) {
            setMessage({ 
                type: 'error', 
                text: error.response?.data?.message || 'Failed to update API key' 
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleRemoveApiKey = async () => {
        if (!window.confirm('Are you sure you want to remove your API key? This will disable AI features.')) {
            return;
        }

        setIsLoading(true);
        try {
            await removeGeminiApiKey();
            setMessage({ type: 'success', text: 'API key removed successfully' });
            await checkApiKeyStatus();
        } catch (error) {
            setMessage({ 
                type: 'error', 
                text: error.response?.data?.message || 'Failed to remove API key' 
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="api-key-settings">
            <h3>🔑 Gemini API Key Settings</h3>
            <p className="description">
                Configure your personal Google Gemini API key to enable AI-powered features like podcast generation, 
                mindmaps, reports, and presentations.
            </p>

            {hasApiKey && (
                <div className="current-key-info">
                    <div className="key-status">
                        <span className="status-indicator active">✓</span>
                        <span>API Key configured: {keyPreview}</span>
                    </div>
                    <button 
                        type="button" 
                        className="remove-key-btn"
                        onClick={handleRemoveApiKey}
                        disabled={isLoading}
                    >
                        Remove API Key
                    </button>
                </div>
            )}

            <form onSubmit={handleSetApiKey} className="api-key-form">
                <div className="input-group">
                    <label htmlFor="apiKey">
                        {hasApiKey ? 'Update API Key' : 'Enter your Gemini API Key'}
                    </label>
                    <div className="input-wrapper">
                        <input
                            type={showApiKey ? 'text' : 'password'}
                            id="apiKey"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="AIzaSy..."
                            className="api-key-input"
                            disabled={isLoading}
                        />
                        <button
                            type="button"
                            className="toggle-visibility"
                            onClick={() => setShowApiKey(!showApiKey)}
                            disabled={isLoading}
                        >
                            {showApiKey ? '👁️‍🗨️' : '👁️'}
                        </button>
                    </div>
                </div>

                <button 
                    type="submit" 
                    className="set-key-btn"
                    disabled={isLoading || !apiKey.trim()}
                >
                    {isLoading ? 'Saving...' : hasApiKey ? 'Update API Key' : 'Set API Key'}
                </button>
            </form>

            {message.text && (
                <div className={`message ${message.type}`}>
                    {message.text}
                </div>
            )}

            <div className="help-section">
                <h4>How to get your Gemini API Key:</h4>
                <ol>
                    <li>Go to <a href="https://ai.google.dev" target="_blank" rel="noopener noreferrer">Google AI Studio</a></li>
                    <li>Sign in with your Google account</li>
                    <li>Click "Get API key" and create a new key</li>
                    <li>Copy the key and paste it above</li>
                </ol>
                <p className="security-note">
                    🔒 Your API key is stored securely and only used to make requests on your behalf.
                </p>
            </div>
        </div>
    );
};

export default ApiKeySettings;