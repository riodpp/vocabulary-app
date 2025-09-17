import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { supabase } from './supabase';
import Navigation from './Navigation';
import HomePage from './HomePage';
import DictionaryPage from './DictionaryPage';
import MemorizePage from './MemorizePage';
import SentenceExplanation from './SentenceExplanation';
import LoginPage from './LoginPage';
import RegisterPage from './RegisterPage';
import NotificationContainer from './Notification';
import ConfirmationModal from './ConfirmationModal';
import { initializeDefaultData, isIndexedDBSupported } from './indexedDB';
import './App.css';

function App() {
  const [modal, setModal] = useState({ isOpen: false, message: '', onConfirm: null });
  const [notifications, setNotifications] = useState([]);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const user = {
          id: session.user.id,
          email: session.user.email,
          first_name: session.user.user_metadata?.first_name || '',
          last_name: session.user.user_metadata?.last_name || '',
        };
        setUser(user);
      }
      setIsLoading(false);
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          const user = {
            id: session.user.id,
            email: session.user.email,
            first_name: session.user.user_metadata?.first_name || '',
            last_name: session.user.user_metadata?.last_name || '',
          };
          setUser(user);
        } else {
          setUser(null);
        }
      }
    );

    // Initialize local storage for vocabulary data
    if (isIndexedDBSupported()) {
      initializeDefaultData().catch(error => {
        console.error('Error initializing default data:', error);
      });
    }

    return () => subscription.unsubscribe();
  }, []);

  // Vocabulary data is now handled locally - no backend API calls needed


  // Vocabulary CRUD operations removed - handled locally in components

  // Modal functions removed - not needed for offline-only app




  // Directory management moved to local components

  const showNotification = (message, type = 'success', duration = 3000) => {
    const id = Date.now() + Math.random();
    setNotifications(prev => [...prev, { id, message, type, duration }]);
  };

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  };

  // Vocabulary data variables removed - handled locally in components

  // Authentication handlers
  const handleLogin = () => {
    // Redirect to home page after login
    window.location.hash = '#/';
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      showNotification('Logged out successfully', 'success');
      // Redirect to login page after logout
      window.location.hash = '#/login';
    } catch (error) {
      console.error('Logout error:', error);
      showNotification('Logout failed', 'error');
    }
  };

  // Modal functions
  const showModal = (message, onConfirm) => {
    setModal({ isOpen: true, message, onConfirm });
  };

  const hideModal = () => {
    setModal({ isOpen: false, message: '', onConfirm: null });
  };

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{
              border: '4px solid #f3f3f3',
              borderTop: '4px solid #667eea',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 20px'
            }}></div>
            <p>Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="App">
        <Navigation user={user} onLogout={handleLogout} />
        <Routes>
          {/* Authentication routes */}
          <Route
            path="/login"
            element={
              user ? (
                // Redirect to home if already logged in
                <HomePage
                  showNotification={showNotification}
                />
              ) : (
                <LoginPage onLogin={handleLogin} showNotification={showNotification} />
              )
            }
          />
          <Route
            path="/register"
            element={
              user ? (
                // Redirect to home if already logged in
                <HomePage
                  showNotification={showNotification}
                />
              ) : (
                <RegisterPage onRegister={handleLogin} showNotification={showNotification} />
              )
            }
          />

          {/* Default route - redirect to login if not authenticated */}
          <Route
            path="/"
            element={
              user ? (
                <HomePage
                  showNotification={showNotification}
                />
              ) : (
                // Redirect to login page for unauthenticated users
                <LoginPage onLogin={handleLogin} showNotification={showNotification} />
              )
            }
          />
          <Route
            path="/dictionary"
            element={
              user ? (
                <DictionaryPage
                  showNotification={showNotification}
                  showModal={showModal}
                  hideModal={hideModal}
                />
              ) : (
                <LoginPage onLogin={handleLogin} showNotification={showNotification} />
              )
            }
          />
          <Route
            path="/memorize"
            element={
              user ? (
                <MemorizePage />
              ) : (
                <LoginPage onLogin={handleLogin} showNotification={showNotification} />
              )
            }
          />
          <Route
            path="/sentence-explanation"
            element={
              user ? (
                <SentenceExplanation
                  showNotification={showNotification}
                />
              ) : (
                <LoginPage onLogin={handleLogin} showNotification={showNotification} />
              )
            }
          />
        </Routes>

        <NotificationContainer
          notifications={notifications}
          removeNotification={removeNotification}
        />

        <ConfirmationModal
          isOpen={modal.isOpen}
          message={modal.message}
          onConfirm={modal.onConfirm}
          onCancel={() => setModal({ isOpen: false, message: '', onConfirm: null })}
        />

      </div>
    </Router>
  );
}

export default App;
