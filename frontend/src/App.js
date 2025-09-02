import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import axios from 'axios';
import Navigation from './Navigation';
import HomePage from './HomePage';
import DictionaryPage from './DictionaryPage';
import NotificationContainer from './Notification';
import FlashcardModal from './FlashcardModal';
import ConfirmationModal from './ConfirmationModal';
import DirectorySelectionModal from './DirectorySelectionModal';
import './App.css';

function App() {
  const [directories, setDirectories] = useState([]);
  const [words, setWords] = useState([]);
  const [selectedDirectory, setSelectedDirectory] = useState(null);
  const [viewedDirectory, setViewedDirectory] = useState(null);
  const [flashcardWords, setFlashcardWords] = useState([]);
  const [score, setScore] = useState({ correct: 0, wrong: 0 });
  const [modal, setModal] = useState({ isOpen: false, message: '', onConfirm: null });
  const [directorySelectionModal, setDirectorySelectionModal] = useState(false);
  const [flashcardModal, setFlashcardModal] = useState(false);
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


  const showDirectorySelection = () => {
    setDirectorySelectionModal(true);
  };

  const startFlashcardWithDirectory = (directoryId) => {
    const filteredWords = directoryId ? words.filter(w => w.directory_id === directoryId) : words;
    setFlashcardWords(filteredWords);
    setScore({ correct: 0, wrong: 0 });
    setDirectorySelectionModal(false);
    setFlashcardModal(true);
  };

  const cancelDirectorySelection = () => {
    setDirectorySelectionModal(false);
  };

  const restartFlashcard = () => {
    // Reset flashcard state to start over
    setFlashcardWords([]);
    setScore({ correct: 0, wrong: 0 });
    setFlashcardModal(false);
    // Show directory selection again
    setDirectorySelectionModal(true);
  };

  const closeFlashcardModal = () => {
    setFlashcardModal(false);
    setFlashcardWords([]);
    setScore({ correct: 0, wrong: 0 });
  };

  const updateScore = (isCorrect) => {
    setScore(prev => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      wrong: prev.wrong + (isCorrect ? 0 : 1)
    }));
  };

  const saveProgress = async (results) => {
    try {
      // Send results to backend to save progress
      await axios.post(`${API_BASE}/progress`, { results });
      console.log('Progress saved successfully');
    } catch (error) {
      console.error('Error saving progress:', error);
    }
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
        </Routes>

        <NotificationContainer
          notifications={notifications}
          removeNotification={removeNotification}
        />

        <button className="start-flashcard" onClick={showDirectorySelection}>Start Flashcard</button>

        <ConfirmationModal
          isOpen={modal.isOpen}
          message={modal.message}
          onConfirm={modal.onConfirm}
          onCancel={hideDeleteModal}
        />

        <DirectorySelectionModal
          isOpen={directorySelectionModal}
          directories={directories}
          onSelect={startFlashcardWithDirectory}
          onCancel={cancelDirectorySelection}
        />

        <FlashcardModal
          isOpen={flashcardModal}
          onClose={closeFlashcardModal}
          words={flashcardWords}
          onUpdateScore={updateScore}
          onRestart={restartFlashcard}
          onFinish={saveProgress}
          score={score}
        />
      </div>
    </Router>
  );
}

export default App;
