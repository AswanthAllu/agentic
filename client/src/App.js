// src/App.js
import React, { useState, useEffect, Suspense } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CircularProgress, CssBaseline } from '@mui/material';
import { getCurrentUser } from './services/api';

const AuthPage = React.lazy(() => import('./components/AuthPage'));
const ChatPage = React.lazy(() => import('./components/ChatPage'));
const LandingPage = React.lazy(() => import('./components/LandingPage'));

const darkTheme = createTheme({
    palette: {
        mode: 'dark',
        background: {
            default: '#131314',
            paper: '#1e1f20',
        },
        primary: {
            main: '#8ab4f8',
        },
        text: {
            primary: '#e3e3e3',
            secondary: '#9aa0a6',
        }
    },
    components: {
        MuiPopover: {
            styleOverrides: {
                paper: {
                    backgroundColor: '#282a2c',
                    border: '1px solid #3c4043',
                }
            }
        },
        MuiButton: {
            styleOverrides: {
                root: {
                    textTransform: 'none',
                }
            }
        }
    }
});

const LoadingFallback = () => (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#131314' }}>
        <CircularProgress />
    </div>
);

function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isAuthLoading, setIsAuthLoading] = useState(true);

    useEffect(() => {
        const checkAuth = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                setIsAuthenticated(false);
                setIsAuthLoading(false);
                return;
            }
            try {
                const response = await getCurrentUser();
                const userId = response.data.user.id || response.data.user._id;
                localStorage.setItem('userId', String(userId));
                localStorage.setItem('username', response.data.user.username);
                setIsAuthenticated(true);
            } catch (err) {
                localStorage.clear();
                setIsAuthenticated(false);
            } finally {
                setIsAuthLoading(false);
            }
        };
        checkAuth();
    }, []);

    if (isAuthLoading) {
        return <LoadingFallback />;
    }

    return (
        <ThemeProvider theme={darkTheme}>
            <CssBaseline />
            <Router>
                <Suspense fallback={<LoadingFallback />}>
                    <Routes>
                        <Route path="/" element={<LandingPage />} />
                        <Route
                            path="/login"
                            element={!isAuthenticated ? (<AuthPage setIsAuthenticated={setIsAuthenticated} />) : (<Navigate to="/chat" replace />)}
                        />
                        <Route
                            path="/chat"
                            element={isAuthenticated ? (<ChatPage setIsAuthenticated={setIsAuthenticated} />) : (<Navigate to="/login" replace />)}
                        />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </Suspense>
            </Router>
        </ThemeProvider>
    );
}

export default App;
