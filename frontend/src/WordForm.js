import React, { useState, useCallback } from 'react';
import axios from 'axios';

function WordForm({ onAddWord, directories, showNotification }) {
  const [english, setEnglish] = useState('');
  const [translation, setTranslation] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [selectedDirectory, setSelectedDirectory] = useState('');

  const API_BASE = process.env.REACT_APP_API_URL || 'https://vocabulary-app-backend.fly.dev';

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
    try {
      await onAddWord({
        english,
        indonesian: translation || '',
        directory_id: selectedDirectory ? parseInt(selectedDirectory) : null
      });
      showNotification('Word added successfully!', 'success');
      setEnglish('');
      setTranslation('');
      setSelectedDirectory('');
    } catch (error) {
      console.error('Error adding word:', error);
      showNotification('Failed to add word. Please try again.', 'error');
    }
  };

  const speak = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="word-form">
      <form onSubmit={handleSubmit}>
        <div className="input-container">
          <input
            value={english}
            onChange={e => setEnglish(e.target.value)}
            placeholder="English word"
            required
          />
          <button
            type="button"
            className="speak-icon"
            onClick={() => speak(english)}
            title="Pronounce word"
            disabled={!english.trim()}
          >
            🔊
          </button>
        </div>
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
          <button type="submit" disabled={!english.trim()}>Add Word</button>
        </div>
      </form>
    </div>
  );
}

export default WordForm;