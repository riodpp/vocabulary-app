import React, { useState } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';

function SentenceExplanation({ showNotification }) {
  const [sentence, setSentence] = useState('');
  const [translation, setTranslation] = useState('');
  const [explanation, setExplanation] = useState('');
  const [isExplaining, setIsExplaining] = useState(false);
  const [isExplanationCollapsed, setIsExplanationCollapsed] = useState(true);

  const API_BASE = process.env.REACT_APP_API_URL || 'https://vocabulary-app-backend.fly.dev';

  const handleExplain = async () => {
    if (!sentence.trim()) {
      showNotification('Please enter a sentence to explain.', 'error');
      return;
    }

    setIsExplaining(true);
    try {
      const response = await axios.post(`${API_BASE}/explain-sentence`, { sentence });

      // Access the nested data field from ApiResponse
      let translation = '';
      let explanation = '';

      if (response.data && response.data.data) {
        const data = response.data.data;
        translation = data.translation ||
                     data.result ||
                     data.text ||
                     (typeof data === 'string' ? data : '');

        explanation = data.explanation ||
                     data.result ||
                     data.text ||
                     (typeof data === 'string' ? data : '');
      }

      setTranslation(translation || 'Translation unavailable.');
      setExplanation(explanation || 'Explanation unavailable.');
      showNotification('Sentence explained successfully!', 'success');
    } catch (error) {
      console.error('Error explaining sentence:', error);
      setTranslation('Translation unavailable.');
      setExplanation('Failed to explain the sentence. Please try again.');
      showNotification('Failed to explain sentence. Please try again.', 'error');
    } finally {
      setIsExplaining(false);
    }
  };

  const resetForm = () => {
    setSentence('');
    setTranslation('');
    setExplanation('');
    setIsExplanationCollapsed(false);
  };

  return (
    <div className="sentence-explanation">
      <h2>Sentence Explanation</h2>
      <p>Enter a sentence in English and get an explanation of its meaning in Indonesian.</p>
      <div className="input-section">
        <textarea
          value={sentence}
          onChange={(e) => setSentence(e.target.value)}
          placeholder="Enter your sentence here..."
          rows="4"
          className="sentence-input"
        />
      </div>
      <div className="button-section">
        <button
          onClick={handleExplain}
          disabled={!sentence.trim() || isExplaining}
          className="explain-btn"
        >
          {isExplaining ? 'Explaining...' : 'Explain Sentence'}
        </button>
        <button
          onClick={resetForm}
          className="reset-btn"
        >
          Reset
        </button>
      </div>
      {(translation || explanation) && (
        <div className="results-section">
          {translation && (
            <div className="translation-section">
              <h3>📝 Translation:</h3>
              <div className="translation-text">
                <p>{translation}</p>
              </div>
            </div>
          )}

          {explanation && (
            <div className="explanation-section">
              <div className="explanation-header">
                <h3>🔍 Detailed Analysis:</h3>
                <button
                  onClick={() => setIsExplanationCollapsed(!isExplanationCollapsed)}
                  className="collapse-toggle"
                  title={isExplanationCollapsed ? 'Show Analysis' : 'Hide Analysis'}
                >
                  {isExplanationCollapsed ? '▶' : '▼'}
                </button>
              </div>
              {!isExplanationCollapsed && (
                <div className="explanation-text">
                  <ReactMarkdown>{explanation}</ReactMarkdown>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SentenceExplanation;