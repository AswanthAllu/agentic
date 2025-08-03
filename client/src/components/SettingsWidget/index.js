// client/src/components/SettingsWidget/index.js
import React from 'react';
import SystemPromptWidget from '../SystemPromptWidget'; // Assuming this component exists
import ApiKeySettings from './ApiKeySettings';
import './index.css';

const SettingsWidget = (props) => {
    return (
        <div className="settings-widget">
            <h3>Settings</h3>
            <ApiKeySettings />
            <SystemPromptWidget {...props} />
            {/* You can add more settings here in the future */}
        </div>
    );
};

export default SettingsWidget;