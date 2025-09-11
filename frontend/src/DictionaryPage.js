import React, { useState, useEffect } from 'react';
import axios from 'axios';
import DirectoryList from './DirectoryList';
import { getAllDirectories, saveDirectory, deleteDirectory, getWordsByDirectory, saveWord, updateWord, deleteWord, getAllWords } from './indexedDB';
import './App.css';

function QuickWordForm({ onAddWord, selectedDirectoryId, showNotification }) {
  const [english, setEnglish] = useState('');
  const [translation, setTranslation] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [validationError, setValidationError] = useState('');

  const API_BASE = process.env.REACT_APP_API_URL || 'https://vocabulary-app-backend.fly.dev';

  // Validation function - only allow letters, spaces, hyphens, and apostrophes
  const validateWord = (word) => {
    const wordRegex = /^[a-zA-Z\s\-']+$/;
    return wordRegex.test(word) || word === '';
  };

  // Handle English word input with validation
  const handleEnglishChange = (e) => {
    const value = e.target.value;
    if (validateWord(value)) {
      setEnglish(value);
      setValidationError('');
    } else {
      setValidationError('Only letters, spaces, hyphens, and apostrophes are allowed');
    }
  };

  const fetchTranslation = async (text, from = 'en', to = 'id') => {
    if (!text.trim()) return;
    setIsTranslating(true);
    try {
      const response = await axios.post(`${API_BASE}/ai-translate`, { text, from, to });

      // Access the nested data field from ApiResponse
      let translatedText = '';
      if (response.data && response.data.data) {
        translatedText = response.data.data.translation ||
                        response.data.data.translated ||
                        response.data.data.result ||
                        response.data.data.text ||
                        (typeof response.data.data === 'string' ? response.data.data : '');
      }

      setTranslation(translatedText);

      if (translatedText && translatedText.trim()) {
        // Don't show notification, just update the translation state
        // The translation will be displayed below the input field
      } else {
        showNotification('Translation received but empty. Please enter manually.', 'warning');
      }
    } catch (error) {
      console.error('Error fetching translation:', error);
      setTranslation('');
      showNotification('Translation service unavailable. Please enter manually.', 'warning');
    } finally {
      setIsTranslating(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return; // Prevent multiple submissions

    // Check for validation errors
    if (validationError) {
      showNotification('Please fix the validation errors before submitting.', 'error');
      return;
    }

    // Check if directory is selected (should always be true for QuickWordForm, but safety check)
    if (!selectedDirectoryId) {
      showNotification('No directory selected. Please select a directory first.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      let finalTranslation = translation;

      // Auto-translate if no translation exists
      if (!finalTranslation || finalTranslation.trim() === '') {
        setIsTranslating(true);
        try {
          const response = await axios.post(`${API_BASE}/ai-translate`, { text: english, from: 'en', to: 'id' });
          const translatedText = response.data.data?.translation ||
                                response.data.data?.translated ||
                                response.data.data?.result ||
                                response.data.data?.text ||
                                (typeof response.data.data === 'string' ? response.data.data : '');
          finalTranslation = translatedText;
        } catch (translateError) {
          console.error('Auto-translation failed:', translateError);
          finalTranslation = `[Translation failed: ${english}]`;
        } finally {
          setIsTranslating(false);
        }
      }

      const wordData = {
        english: english.toLowerCase(),
        indonesian: finalTranslation || '',
        directory_id: selectedDirectoryId
      };
      await onAddWord(wordData);
      showNotification(`Word saved with translation: ${finalTranslation}`, 'success');
      setEnglish('');
      setTranslation('');
      setShowForm(false);
      setValidationError('');
    } catch (error) {
      console.error('Error adding word:', error);
      showNotification('Failed to save word. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const speak = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
  };

  if (!showForm) {
    return (
      <button
        className="add-word-to-directory-btn"
        onClick={() => setShowForm(true)}
      >
        ➕ Add Word to Directory
      </button>
    );
  }

  return (
    <div className="quick-word-form">
      <form onSubmit={handleSubmit}>
        <div className="input-container">
          <input
            type="text"
            value={english}
            onChange={handleEnglishChange}
            placeholder="English word"
            required
            autoFocus
            className={validationError ? 'error' : ''}
          />
          <button
            type="button"
            className="speak-icon"
            onClick={() => speak(english)}
            title="Pronounce word"
            disabled={!english.trim() || validationError}
          >
            🔊
          </button>
        </div>
        {validationError && (
          <div className="validation-error">
            {validationError}
          </div>
        )}
        {translation && (
          <div className="translation-preview">
            <span className="translation-label">Translation:</span>
            <span className="translation-text">{isTranslating ? 'Translating...' : translation}</span>
          </div>
        )}
        <div className="form-actions">
          <button
            type="button"
            className="translate-btn"
            onClick={() => fetchTranslation(english)}
            disabled={!english.trim() || isTranslating}
          >
            {isTranslating ? 'Translating...' : 'Translate'}
          </button>
          <button type="submit" disabled={!english.trim() || !selectedDirectoryId || isSubmitting || validationError}>
            {isSubmitting ? 'Translating & Adding...' : 'Add Word'}
          </button>
          <button
            type="button"
            className="cancel-btn"
            onClick={() => {
              setShowForm(false);
              setEnglish('');
              setTranslation('');
              setIsSubmitting(false);
              setValidationError('');
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function DictionaryPage({ directories, words, onDeleteWord, onDeleteDirectory, onViewWords, viewedDirectory, viewedDirectoryName, viewedDirectoryWords, onRefreshWords, onAddDirectory, showNotification }) {

  const [directoryWords, setDirectoryWords] = useState([]);
  const [localDirectories, setLocalDirectories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentViewedDirectory, setCurrentViewedDirectory] = useState(null);
  const [currentViewedDirectoryName, setCurrentViewedDirectoryName] = useState('');

  // Load directories from local storage
  useEffect(() => {
    const loadDirectories = async () => {
      try {
        const localDirs = await getAllDirectories();
        setLocalDirectories(localDirs);
        setLoading(false);
      } catch (error) {
        console.error('Error loading directories:', error);
        setLocalDirectories([]); // Ensure it's always an array
        setLoading(false);
      }
    };

    loadDirectories();
  }, []);

  // Function to fetch words for a specific directory from local storage
  const fetchWordsByDirectory = async (directoryId) => {
    try {
      const words = await getWordsByDirectory(directoryId);
      return words || [];
    } catch (error) {
      console.error('Error fetching words for directory:', error);
      return [];
    }
  };

  // Handle viewing words for a directory
  const handleViewWords = async (directoryId) => {
    if (directoryId) {
      // Find the directory name
      const directory = localDirectories.find(d => d.id === directoryId);
      const directoryName = directory ? directory.name : '';

      // Fetch words for this directory
      const words = await fetchWordsByDirectory(directoryId);
      setDirectoryWords(words);
      setCurrentViewedDirectory(directoryId);
      setCurrentViewedDirectoryName(directoryName);
    } else {
      // Clear words when closing directory view
      setDirectoryWords([]);
      setCurrentViewedDirectory(null);
      setCurrentViewedDirectoryName('');
    }
  };

  const refreshData = async () => {
    if (onRefreshWords) {
      onRefreshWords();
    }
    // Also refresh directory words if we're viewing a directory
    if (currentViewedDirectory) {
      const words = await fetchWordsByDirectory(currentViewedDirectory);
      setDirectoryWords(words);
    }
  };
  const [editingWord, setEditingWord] = useState(null);
  const [editTranslation, setEditTranslation] = useState('');

  const API_BASE = process.env.REACT_APP_API_URL || 'https://vocabulary-app-backend.fly.dev';

  const speakWord = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
  };

  const updateWordTranslation = async (wordId, newTranslation) => {
    try {
      // First, get the existing word data
      const allWords = await getAllWords();
      const existingWord = allWords.find(word => word.id === wordId);

      if (!existingWord) {
        showNotification('Word not found.', 'error');
        return;
      }

      // Update only the translation field while preserving other data
      const updatedWordData = {
        ...existingWord,
        indonesian: newTranslation,
        updated_at: new Date().toISOString()
      };

      await updateWord(updatedWordData);
      // Refresh the data to reflect changes
      refreshData();
      // Refresh directories in MemorizePage if it exists
      if (window.refreshDirectories) {
        window.refreshDirectories();
      }
    } catch (error) {
      console.error('Error updating translation:', error);
      showNotification('Failed to update translation.', 'error');
    }
  };

  const improveTranslationWithAI = async (wordId) => {
    try {
      // Find the word in the current directory words
      const word = directoryWords.find(w => w.id === wordId);
      if (!word) {
        showNotification('Word not found.', 'error');
        return;
      }

      const response = await axios.post(`${API_BASE}/ai-translate`, { text: word.english, from: 'en', to: 'id' });
      if (response.data.data?.translation) {
        await updateWordTranslation(wordId, response.data.data.translation);
        // Update local state if we're currently editing this word
        if (editingWord === wordId) {
          setEditTranslation(response.data.data.translation);
        }
        showNotification('Translation improved with AI!', 'success');
        // Refresh data to show changes immediately
        refreshData();
      }
    } catch (error) {
      console.error('Error improving translation with AI:', error);
      showNotification('Failed to improve translation with AI. Please check your OpenRouter API key.', 'error');
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
      // Refresh data to show changes immediately
      refreshData();
    }
  };

  // Directory management functions
  const handleAddDirectory = async (name) => {
    if (!name.trim()) return;

    try {
      const newDirectory = {
        name: name.trim(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const savedDirId = await saveDirectory(newDirectory);
      const savedDir = {
        id: savedDirId,
        ...newDirectory
      };
      setLocalDirectories(prev => [...prev, savedDir]);
      showNotification('Directory added successfully!', 'success');
    } catch (error) {
      console.error('Error adding directory:', error);
      showNotification('Failed to add directory. Please try again.', 'error');
    }
  };

  const handleDeleteDirectory = async (directoryId, directoryName) => {
    try {
      await deleteDirectory(directoryId);
      setLocalDirectories(prev => prev.filter(dir => dir.id !== directoryId));
      showNotification(`Directory "${directoryName}" deleted successfully!`, 'success');
    } catch (error) {
      console.error('Error deleting directory:', error);
      showNotification('Failed to delete directory. Please try again.', 'error');
    }
  };

  const handleDeleteWord = async (wordId) => {
    try {
      await deleteWord(wordId);
      // Remove the word from the local state
      setDirectoryWords(prev => prev.filter(word => word.id !== wordId));
      showNotification('Word deleted successfully!', 'success');
      // Refresh directories in MemorizePage if it exists
      if (window.refreshDirectories) {
        window.refreshDirectories();
      }
    } catch (error) {
      console.error('Error deleting word:', error);
      showNotification('Failed to delete word. Please try again.', 'error');
    }
  };

  if (loading) {
    return (
      <div className="dictionary-page">
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
          <p>Loading directories...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dictionary-page">
      <h1>My Dictionary</h1>

      <div className="dictionary-content">
        <div className="directory-management">
          <DirectoryList
            directories={localDirectories}
            onAddDirectory={handleAddDirectory}
            onSelect={() => {}}
            selectedDirectory={null}
            onViewWords={handleViewWords}
            onDeleteDirectory={handleDeleteDirectory}
          />
        </div>

        <div className="words-display">
          {currentViewedDirectory ? (
            <div className="directory-words">
              <div className="directory-header">
                <h2>Words in "{currentViewedDirectoryName}"</h2>
                <button className="close-btn" onClick={() => handleViewWords(null)}>×</button>
              </div>
              <QuickWordForm
                onAddWord={async (word) => {
                  try {
                    await saveWord(word);
                    showNotification('Word added successfully!', 'success');
                    // Refresh the directory words
                    const updatedWords = await fetchWordsByDirectory(currentViewedDirectory);
                    setDirectoryWords(updatedWords);
                    // Refresh directories in MemorizePage if it exists
                    if (window.refreshDirectories) {
                      window.refreshDirectories();
                    }
                  } catch (error) {
                    console.error('Error adding word:', error);
                    showNotification('Failed to add word. Please try again.', 'error');
                  }
                }}
                selectedDirectoryId={currentViewedDirectory}
                showNotification={showNotification}
              />
              {directoryWords.length > 0 ? (
                <ul className="word-list">
                  {directoryWords.map(word => (
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
                          <div>
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
                        onClick={() => handleDeleteWord(word.id)}
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
          ) : (
            <div className="no-directory-selected">
              <h2>Select a Directory</h2>
              <p>Choose a directory from the list to view and manage your words.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DictionaryPage;