import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import axios from 'axios';
import Navigation from './Navigation';
import HomePage from './HomePage';
import DictionaryPage from './DictionaryPage';
import MemorizePage from './MemorizePage';
import SentenceExplanation from './SentenceExplanation';
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

  useEffect(() => {
    // Check connectivity first
    checkConnectivity().then(isConnected => {
      if (isConnected) {
        fetchDirectories();
        fetchWords();
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

  const fetchDirectories = async () => {
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
  };

  const fetchWords = async () => {
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
  };

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

  return (
    <Router>
      <div className="App">
        <Navigation />
        <Routes>
          <Route
            path="/"
            element={
              <HomePage
                onAddWord={addWord}
                directories={directories}
                showNotification={showNotification}
              />
            }
          />
          <Route
            path="/dictionary"
            element={
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
            }
          />
          <Route
            path="/memorize"
            element={<MemorizePage />}
          />
          <Route
            path="/sentence-explanation"
            element={
              <SentenceExplanation
                showNotification={showNotification}
              />
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
