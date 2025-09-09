import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import axios from 'axios';
import Navigation from './Navigation';
import HomePage from './HomePage';
import DictionaryPage from './DictionaryPage';
import MemorizePage from './MemorizePage';
import SentenceExplanation from './SentenceExplanation';
import LoginPage from './LoginPage';
import RegisterPage from './RegisterPage';
import NotificationContainer from './Notification';
import ConfirmationModal from './ConfirmationModal';
import './App.css';

function App() {
  const [directories, setDirectories] = useState([]);
  const [words, setWords] = useState([]);
  const [selectedDirectory, setSelectedDirectory] = useState(null);
  const [viewedDirectory, setViewedDirectory] = useState(null);
  const [modal, setModal] = useState({ isOpen: false, message: '', onConfirm: null });
  const [notifications, setNotifications] = useState([]);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing authentication
    const token = localStorage.getItem('authToken');
    const savedUser = localStorage.getItem('user');

    if (token && savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        // Set default authorization header for all axios requests
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      } catch (error) {
        console.error('Error parsing saved user data:', error);
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
      }
    }

    setIsLoading(false);

    // Check connectivity first
    checkConnectivity().then(isConnected => {
      if (isConnected) {
        fetchDirectories();
        // fetchWords(); // Remove global fetch - let individual pages handle their own data fetching
      } else {
        console.error('API not reachable. Please check your connection.');
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const API_BASE = process.env.REACT_APP_API_URL || 'https://vocabulary-app-backend.fly.dev';
  console.log('Using API_BASE:', API_BASE);
  console.log('Using REACT_APP_API_URL:', process.env.REACT_APP_API_URL);

  // Check API connectivity
  const checkConnectivity = async () => {
    try {
      const res = await axios.get(`${API_BASE}/health`, { timeout: 5000 });
      console.log('API connectivity check:', res.data);
      return true;
    } catch (error) {
      console.error('API connectivity check failed:', error);
      return false;
    }
  };

  const fetchDirectories = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/directories`, { timeout: 10000 });
      setDirectories(res.data);
    } catch (error) {
      console.error('Error fetching directories:', error);
      // Don't show alert on mobile, just log the error
      if (!/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        alert('Failed to load directories. Please check your connection.');
      }
    }
  }, [API_BASE]);

  const fetchWords = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/words`, { timeout: 10000 });
      setWords(res.data);
    } catch (error) {
      console.error('Error fetching words:', error);
      // Don't show alert on mobile, just log the error
      if (!/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        alert('Failed to load words. Please check your connection.');
      }
    }
  }, [API_BASE]);

  const addWord = async (word) => {
    await axios.post(`${API_BASE}/words`, word);
    fetchWords();
  };


  const viewDirectoryWords = (directoryId) => {
    setViewedDirectory(directoryId);
  };

  const deleteWord = async (wordId) => {
    try {
      await axios.delete(`${API_BASE}/words/${wordId}`);
      fetchWords();
      // If we're viewing a directory and the deleted word was in it, refresh the view
      if (viewedDirectory) {
        setViewedDirectory(null);
        setTimeout(() => setViewedDirectory(viewedDirectory), 100);
      }
    } catch (error) {
      console.error('Error deleting word:', error);
    }
  };

  const deleteDirectory = async (directoryId) => {
    try {
      await axios.delete(`${API_BASE}/directories/${directoryId}`);
      fetchDirectories();
      fetchWords(); // Refresh words since directory deletion also deletes words
      // Close the viewed directory if it was the one deleted
      if (viewedDirectory === directoryId) {
        setViewedDirectory(null);
      }
      // Reset selected directory if it was the one deleted
      if (selectedDirectory === directoryId) {
        setSelectedDirectory(null);
      }
    } catch (error) {
      console.error('Error deleting directory:', error);
    }
  };

  const showDeleteModal = (message, onConfirm) => {
    setModal({ isOpen: true, message, onConfirm });
  };

  const hideDeleteModal = () => {
    setModal({ isOpen: false, message: '', onConfirm: null });
  };




  const addDirectory = async (name) => {
    try {
      await axios.post(`${API_BASE}/directories`, { name });
      fetchDirectories();
      showNotification('Directory added successfully!', 'success');
    } catch (error) {
      console.error('Error adding directory:', error);
      showNotification('Failed to add directory. Please try again.', 'error');
    }
  };

  const showNotification = (message, type = 'success', duration = 3000) => {
    const id = Date.now() + Math.random();
    setNotifications(prev => [...prev, { id, message, type, duration }]);
  };

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  };

  const viewedDirectoryWords = viewedDirectory ? words.filter(w => w.directory_id === viewedDirectory) : [];
  const viewedDirectoryName = viewedDirectory ? directories.find(d => d.id === viewedDirectory)?.name : '';

  // Authentication handlers
  const handleLogin = (userData) => {
    setUser(userData);
    // Redirect to home page after login
    window.location.hash = '#/';
  };

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (token) {
        await axios.post(`${API_BASE}/auth/logout`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    }

    // Clear local storage and state
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);

    showNotification('Logged out successfully', 'success');
    // Redirect to login page after logout
    window.location.hash = '#/login';
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
                  onAddWord={addWord}
                  directories={directories}
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
                  onAddWord={addWord}
                  directories={directories}
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
                  onAddWord={addWord}
                  directories={directories}
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
                  directories={directories}
                  words={words}
                  onDeleteWord={deleteWord}
                  onDeleteDirectory={(id, name) => showDeleteModal(
                    `Are you sure you want to delete the directory "${name}" and all its words?`,
                    () => {
                      deleteDirectory(id);
                      hideDeleteModal();
                    }
                  )}
                  onViewWords={viewDirectoryWords}
                  viewedDirectory={viewedDirectory}
                  viewedDirectoryName={viewedDirectoryName}
                  viewedDirectoryWords={viewedDirectoryWords}
                  onRefreshWords={fetchWords}
                  onAddDirectory={addDirectory}
                  showNotification={showNotification}
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
          onCancel={hideDeleteModal}
        />

      </div>
    </Router>
  );
}

export default App;
