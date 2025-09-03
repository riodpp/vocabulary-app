import React, { useState, useCallback } from 'react';
import axios from 'axios';

function WordForm({ onAddWord, directories, showNotification }) {
  const [english, setEnglish] = useState('');
  const [translation, setTranslation] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [selectedDirectory, setSelectedDirectory] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const fetchTranslation = useCallback(async (text) => {
    if (!text.trim()) return;
    setIsTranslating(true);
    try {
      const response = await axios.post(`${API_BASE}/ai-translate`, { text });
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

    setIsSubmitting(true);
    try {
      // Convert word to lowercase before saving
      await onAddWord({
        english: english.toLowerCase(),
        indonesian: translation || '',
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
    setEnglish('');
    setTranslation('');
    setSelectedDirectory('');
    setIsSubmitting(false);
    setValidationError('');
  };

  return (
    <div className="word-form">
      <form onSubmit={handleSubmit}>
        <div className="input-container">
          <input
            value={english}
            onChange={handleEnglishChange}
            placeholder="English word"
            required
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
        <div className="directory-selector">
          <label htmlFor="directory-select">Save to Directory:</label>
          <select
            id="directory-select"
            value={selectedDirectory}
            onChange={(e) => setSelectedDirectory(e.target.value)}
          >
            <option value="">No directory</option>
            {directories.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div className="form-buttons">
          <button
            type="button"
            className="translate-btn"
            onClick={() => fetchTranslation(english)}
            disabled={!english.trim() || isTranslating}
          >
            {isTranslating ? 'Translating...' : 'Translate'}
          </button>
          <button type="submit" disabled={!english.trim() || isSubmitting}>
            {isSubmitting ? 'Adding...' : 'Add Word'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default WordForm;