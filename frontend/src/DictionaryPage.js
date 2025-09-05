import React, { useState } from 'react';
import axios from 'axios';
import DirectoryList from './DirectoryList';
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

  const fetchTranslation = async (text) => {
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
      await onAddWord({
        english: english.toLowerCase(),
        indonesian: translation || '',
        directory_id: selectedDirectoryId
      });
      setEnglish('');
      setTranslation('');
      setShowForm(false);
      setValidationError('');
    } catch (error) {
      console.error('Error adding word:', error);
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
            {isSubmitting ? 'Adding...' : 'Add Word'}
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
        {translation && (
          <div className="translation-preview">
            <span className="translation-label">Translation:</span>
            <span className="translation-text">{translation}</span>
          </div>
        )}
      </form>
    </div>
  );
}

function DictionaryPage({ directories, words, onDeleteWord, onDeleteDirectory, onViewWords, viewedDirectory, viewedDirectoryName, viewedDirectoryWords, onRefreshWords, onAddDirectory, showNotification }) {

  const refreshData = () => {
    if (onRefreshWords) {
      onRefreshWords();
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
      await axios.put(`${API_BASE}/words/${wordId}`, { indonesian: newTranslation });
      // Refresh the data to reflect changes
      refreshData();
    } catch (error) {
      console.error('Error updating translation:', error);
      showNotification('Failed to update translation.', 'error');
    }
  };

  const improveTranslationWithAI = async (wordId) => {
    try {
      const response = await axios.post(`${API_BASE}/words/${wordId}/ai-translate`);
      if (response.data.translation) {
        await updateWordTranslation(wordId, response.data.translation);
        // Update local state if we're currently editing this word
        if (editingWord === wordId) {
          setEditTranslation(response.data.translation);
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

  return (
    <div className="dictionary-page">
      <h1>My Dictionary</h1>

      <div className="dictionary-content">
        <div className="directory-management">
          <DirectoryList
            directories={directories}
            onAddDirectory={onAddDirectory}
            onSelect={() => {}}
            selectedDirectory={null}
            onViewWords={onViewWords}
            onDeleteDirectory={onDeleteDirectory}
          />
        </div>

        <div className="words-display">
          {viewedDirectory ? (
            <div className="directory-words">
              <div className="directory-header">
                <h2>Words in "{viewedDirectoryName}"</h2>
                <button className="close-btn" onClick={() => onViewWords(null)}>×</button>
              </div>
              <QuickWordForm
                onAddWord={async (word) => {
                  try {
                    await axios.post(`${API_BASE}/words`, word);
                    showNotification('Word added successfully!', 'success');
                    if (onRefreshWords) {
                      onRefreshWords();
                    }
                  } catch (error) {
                    console.error('Error adding word:', error);
                    showNotification('Failed to add word. Please try again.', 'error');
                  }
                }}
                selectedDirectoryId={viewedDirectory}
                showNotification={showNotification}
              />
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
                        onClick={() => onDeleteWord(word.id)}
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