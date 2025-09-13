import React, { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import { saveWord, getAllDirectories } from './indexedDB';

function WordForm({ showNotification, isEnglish }) {
  const [word, setWord] = useState('');
  const [translation, setTranslation] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [selectedDirectory, setSelectedDirectory] = useState(() => {
    return localStorage.getItem('selectedDirectory') || '';
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [directories, setDirectories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastSavedDirectory, setLastSavedDirectory] = useState(null);

  const API_BASE = process.env.REACT_APP_API_URL || 'https://vocabulary-app-backend.fly.dev';

  // Load directories from local storage
  useEffect(() => {
    const loadDirectories = async () => {
      try {
        const localDirectories = await getAllDirectories();
        setDirectories(localDirectories);
        setLoading(false);
      } catch (error) {
        console.error('Error loading directories:', error);
        setDirectories([]); // Ensure directories is always an array
        setLoading(false);
      }
    };

    loadDirectories();
  }, []);

  // Validation function - only allow letters, spaces, hyphens, and apostrophes
  const validateWord = (word) => {
    const wordRegex = /^[a-zA-Z\s\-']+$/;
    return wordRegex.test(word) || word === '';
  };

  // Handle word input with validation
  const handleWordChange = (e) => {
    const value = e.target.value;
    if (validateWord(value)) {
      setWord(value);
      setValidationError('');
    } else {
      setValidationError('Only letters, spaces, hyphens, and apostrophes are allowed');
    }
  };


  const fetchTranslation = useCallback(async (text, from = 'en', to = 'id') => {
    if (!text.trim()) return;
    setIsTranslating(true);
    try {
      const response = await axios.post(`${API_BASE}/ai-translate`, { text, from, to });
      setTranslation(response.data.data?.translation || '');
    } catch (error) {
      console.error('Error fetching translation:', error);
      setTranslation('');
    } finally {
      setIsTranslating(false);
    }
  }, [API_BASE]);

  // Remove automatic translation - now manual only

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return; // Prevent multiple submissions

    // Check for validation errors
    if (validationError) {
      showNotification('Please fix the validation errors before submitting.', 'error');
      return;
    }

    // Check if directory is selected
    if (!selectedDirectory) {
      showNotification('Please select a directory before saving the word.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      let englishWord = word;
      let indonesianWord = translation || '';

      if (!isEnglish) {
        // Translate Indonesian to English
        const response = await axios.post(`${API_BASE}/ai-translate`, { text: word, from: 'id', to: 'en' });
        const translatedText = response.data.data?.translation || '';
        englishWord = translatedText.toLowerCase(); // Use the direct response
        indonesianWord = word; // Original Indonesian
      } else {
        englishWord = word.toLowerCase();
      }

      // Save word directly to local storage
      const wordData = {
        english: englishWord,
        indonesian: indonesianWord,
        directory_id: selectedDirectory ? parseInt(selectedDirectory) : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const savedWord = await saveWord(wordData);
      console.log('✅ Word saved to local storage:', savedWord);

      // Find the directory name that was used for saving
      const savedDirectory = directories.find(dir => dir.id === parseInt(selectedDirectory));
      if (savedDirectory) {
        setLastSavedDirectory(savedDirectory);
      }

      showNotification('Word added successfully!', 'success');
      resetForm();
    } catch (error) {
      console.error('Error adding word:', error);
      showNotification('Failed to add word. Please try again.', 'error');
      setIsSubmitting(false); // Reset on error
    } finally {
      // Keep the finally block for any cleanup if needed
    }
  };

  const speak = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
  };

  const resetForm = () => {
    setWord('');
    setTranslation('');
    // Keep selectedDirectory persistent
    setIsSubmitting(false);
    setValidationError('');
    // Don't clear lastSavedDirectory - keep it visible as a shortcut
  };

  if (loading) {
    return (
      <div className="word-form">
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <div style={{
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #667eea',
            borderRadius: '50%',
            width: '30px',
            height: '30px',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 10px'
          }}></div>
          <p>Loading directories...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="word-form">
      <form onSubmit={handleSubmit}>
        <div className="input-container">
          <input
            value={word}
            onChange={handleWordChange}
            placeholder={isEnglish ? "English word" : "Kata Bahasa Indonesia"}
            required
            className={validationError ? 'error' : ''}
            maxLength="50"
          />
          <button
            type="button"
            className="speak-icon"
            onClick={() => speak(word)}
            title="Pronounce word"
            disabled={!word.trim() || validationError}
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
        <div className="directory-selector">
          <label htmlFor="directory-select">Save to Directory: <span className="required">*</span></label>
          <select
            id="directory-select"
            value={selectedDirectory}
            onChange={(e) => {
              const value = e.target.value;
              setSelectedDirectory(value);
              localStorage.setItem('selectedDirectory', value);
            }}
            className={!selectedDirectory ? 'error' : ''}
          >
            <option value="">Select a directory...</option>
            {directories.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          {!selectedDirectory && (
            <div className="directory-hint">
              📁 Choose a directory to organize your vocabulary words
            </div>
          )}
        </div>
        <div className="form-buttons">
          <button
            type="button"
            className="translate-btn"
            onClick={() => fetchTranslation(word, isEnglish ? 'en' : 'id', isEnglish ? 'id' : 'en')}
            disabled={!word.trim() || isTranslating}
          >
            {isTranslating ? 'Translating...' : 'Translate'}
          </button>
          <button
            type="submit"
            disabled={!word.trim() || !selectedDirectory || isSubmitting || validationError}
            onClick={(e) => {
              if (!selectedDirectory) {
                e.preventDefault();
                showNotification('Please select a directory before saving the word.', 'error');
              }
            }}
          >
            {isSubmitting ? 'Adding...' : 'Add Word'}
          </button>
        </div>
      </form>

      {lastSavedDirectory && (
        <div className="last-saved-directory">
          <div className="last-saved-header">
            <span className="last-saved-icon">📁</span>
            <span className="last-saved-text">Last saved to:</span>
            <button
              type="button"
              className="last-saved-directory-btn"
              onClick={() => {
                // Store the directory ID for the dictionary page to use
                localStorage.setItem('autoSelectDirectory', lastSavedDirectory.id.toString());
                // Navigate to dictionary page using hash
                window.location.hash = '#/dictionary';
              }}
              title="View all words in this directory"
            >
              {lastSavedDirectory.name}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default WordForm;