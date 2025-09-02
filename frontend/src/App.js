import React, { useState, useEffect } from 'react';
import axios from 'axios';
import WordForm from './WordForm';
import DirectoryList from './DirectoryList';
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
  const [editingWord, setEditingWord] = useState(null);
  const [editTranslation, setEditTranslation] = useState('');

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
  }, []);

  const API_BASE = process.env.REACT_APP_API_URL || 'https://vocabulary-app-backend.fly.dev';

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
    try {
      await axios.post(`${API_BASE}/words`, word);
      fetchWords();
    } catch (error) {
      console.error('Error adding word:', error);
    }
  };

  const addDirectory = async (name) => {
    try {
      await axios.post(`${API_BASE}/directories`, { name });
      fetchDirectories();
    } catch (error) {
      console.error('Error adding directory:', error);
    }
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

  const speakWord = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
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

  const updateWordTranslation = async (wordId, newTranslation) => {
    try {
      await axios.put(`${API_BASE}/words/${wordId}`, { indonesian: newTranslation });
      fetchWords();
    } catch (error) {
      console.error('Error updating translation:', error);
    }
  };

  const improveTranslationWithAI = async (wordId) => {
    try {
      const response = await axios.post(`${API_BASE}/words/${wordId}/ai-translate`);
      if (response.data.translation) {
        await updateWordTranslation(wordId, response.data.translation);
      }
    } catch (error) {
      console.error('Error improving translation with AI:', error);
      alert('Failed to improve translation with AI. Please check your OpenRouter API key.');
    }
  };

  const startEditing = (word) => {
    setEditingWord(word.id);
    setEditTranslation(word.indonesian || '');
  };

  const cancelEditing = () => {
    setEditingWord(null);
    setEditTranslation('');
  };

  const saveEditing = async () => {
    if (editingWord) {
      await updateWordTranslation(editingWord, editTranslation);
      cancelEditing();
    }
  };

  const viewedDirectoryWords = viewedDirectory ? words.filter(w => w.directory_id === viewedDirectory) : [];
  const viewedDirectoryName = viewedDirectory ? directories.find(d => d.id === viewedDirectory)?.name : '';

  return (
    <div className="App">
      <h1>Vocabulary App</h1>
      <WordForm onAddWord={addWord} directories={directories} />
      <DirectoryList
        directories={directories}
        onAddDirectory={addDirectory}
        onSelect={setSelectedDirectory}
        selectedDirectory={selectedDirectory}
        onViewWords={viewDirectoryWords}
        onDeleteDirectory={(id, name) => showDeleteModal(
          `Are you sure you want to delete the directory "${name}" and all its words?`,
          () => {
            deleteDirectory(id);
            hideDeleteModal();
          }
        )}
      />

      {viewedDirectory && (
        <div className="directory-words">
          <div className="directory-header">
            <h2>Words in "{viewedDirectoryName}"</h2>
            <button className="close-btn" onClick={() => setViewedDirectory(null)}>×</button>
          </div>
          {viewedDirectoryWords.length > 0 ? (
            <ul className="word-list">
              {viewedDirectoryWords.map(word => (
                <li key={word.id} className="word-item">
                  <div className="word-content">
                    <div className="english-section">
                      <span className="english">{word.english}</span>
                      <button
                        className="speak-btn"
                        onClick={() => speakWord(word.english)}
                        title="Pronounce word"
                      >
                        🔊
                      </button>
                    </div>
                    {editingWord === word.id ? (
                      <div className="edit-section">
                        <input
                          type="text"
                          value={editTranslation}
                          onChange={(e) => setEditTranslation(e.target.value)}
                          placeholder="Enter Indonesian translation"
                        />
                        <button onClick={saveEditing} className="save-btn">Save</button>
                        <button onClick={cancelEditing} className="cancel-btn">Cancel</button>
                        <button onClick={() => improveTranslationWithAI(word.id)} className="ai-btn" title="Improve with AI">
                          🤖
                        </button>
                      </div>
                    ) : (
                      <div className="translation-section">
                        <span className="indonesian">{word.indonesian}</span>
                        <button
                          className="edit-btn"
                          onClick={() => startEditing(word)}
                          title="Edit translation"
                        >
                          ✏️
                        </button>
                        <button
                          className="ai-improve-btn"
                          onClick={() => improveTranslationWithAI(word.id)}
                          title="Improve with AI"
                        >
                          🤖
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    className="delete-word-btn"
                    onClick={() => deleteWord(word.id)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p>No words in this directory yet.</p>
          )}
        </div>
      )}

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
  );
}

export default App;
