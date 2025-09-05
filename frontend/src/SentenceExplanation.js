import React, { useState } from 'react';
import axios from 'axios';

function SentenceExplanation({ showNotification }) {
  const [sentence, setSentence] = useState('');
  const [explanation, setExplanation] = useState('');
  const [isExplaining, setIsExplaining] = useState(false);

  const API_BASE = process.env.REACT_APP_API_URL || 'https://vocabulary-app-backend.fly.dev';

  const handleExplain = async () => {
    if (!sentence.trim()) {
      showNotification('Please enter a sentence to explain.', 'error');
      return;
    }

    setIsExplaining(true);
    try {
      const response = await axios.post(`${API_BASE}/explain-sentence`, { sentence });
      setExplanation(response.data.explanation || 'No explanation available.');
      showNotification('Sentence explained successfully!', 'success');
    } catch (error) {
      console.error('Error explaining sentence:', error);
      setExplanation('Failed to explain the sentence. Please try again.');
      showNotification('Failed to explain sentence. Please try again.', 'error');
    } finally {
      setIsExplaining(false);
    }
  };

  const resetForm = () => {
    setSentence('');
    setExplanation('');
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
      {explanation && (
        <div className="explanation-section">
          <h3>Explanation:</h3>
          <p className="explanation-text">{explanation}</p>
        </div>
      )}
    </div>
  );
}

export default SentenceExplanation;