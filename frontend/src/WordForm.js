import React, { useState, useCallback } from 'react';
import axios from 'axios';

function WordForm({ onAddWord, directories, showNotification, isEnglish }) {
  const [word, setWord] = useState('');
  const [english, setEnglish] = useState('');
  const [translation, setTranslation] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [selectedDirectory, setSelectedDirectory] = useState(() => {
    return localStorage.getItem('selectedDirectory') || '';
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState('');

  const API_BASE = process.env.REACT_APP_API_URL || 'https://vocabulary-app-backend.fly.dev';

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
      setTranslation(response.data.translation || '');
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
        await fetchTranslation(word, 'id', 'en');
        englishWord = translation.toLowerCase(); // Assuming translation is now English
        indonesianWord = word; // Original Indonesian
      } else {
        englishWord = word.toLowerCase();
      }

      await onAddWord({
        english: englishWord,
        indonesian: indonesianWord,
        directory_id: selectedDirectory ? parseInt(selectedDirectory) : null
      });
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
    setEnglish('');
    setTranslation('');
    // Keep selectedDirectory persistent
    setIsSubmitting(false);
    setValidationError('');
  };

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
    </div>
  );
}

export default WordForm;