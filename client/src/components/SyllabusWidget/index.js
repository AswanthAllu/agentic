// src/components/SyllabusWidget/index.js
import React from 'react';
import { FaBookOpen, FaCommentDots } from 'react-icons/fa';
import './index.css';

// This is a static list of available syllabi for demonstration.
const availableSyllabi = [
    { id: 'cs101', name: 'Intro to Computer Science' },
    { id: 'ai502', name: 'Advanced AI' },
    { id: 'ml301', name: 'Machine Learning Fundamentals' },
];

const SyllabusWidget = ({ onChatWithSyllabus }) => {
    return (
        <div className="syllabus-widget">
            <h3>Syllabi</h3>
            <ul className="syllabus-list">
                {availableSyllabi.map(syllabus => (
                    <li key={syllabus.id} className="syllabus-item">
                        <span className="syllabus-name" title={syllabus.name}>
                            <FaBookOpen /> {syllabus.name}
                        </span>
                        <button 
                            onClick={() => onChatWithSyllabus(syllabus.id, syllabus.name)} 
                            className="syllabus-chat-btn" 
                            title={`Chat about ${syllabus.name}`}
                        >
                            <FaCommentDots />
                        </button>
                    </li>
                ))}
            </ul>
            <div className="info-box">
                <p>Select a syllabus to start a Q&A session. The AI will only use the syllabus content to answer your questions.</p>
            </div>
        </div>
    );
};

export default SyllabusWidget;
