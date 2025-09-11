import React, { useState } from 'react';
import WordForm from './WordForm';

function HomePage({ showNotification }) {
  const [isEnglish, setIsEnglish] = useState(true);
  const [isFlipping, setIsFlipping] = useState(false);

  const handleLanguageToggle = () => {
    setIsFlipping(true);
    setTimeout(() => {
      setIsEnglish(!isEnglish);
      setIsFlipping(false);
    }, 150); // Half of animation duration
  };

  return (
    <div className="home-page">
      <h1>Add New Words</h1>
      <div className="language-toggle-container">
        <button
          onClick={handleLanguageToggle}
          className={`language-toggle-btn ${isEnglish ? 'english' : 'indonesian'}`}
          disabled={isFlipping}
        >
          {isEnglish ? '🇺🇸 English' : '🇮🇩 Bahasa Indonesia'}
        </button>
      </div>
      <div className="centered-content">
        <div className={`word-form-container ${isFlipping ? 'flipping' : ''}`}>
          <WordForm
            showNotification={showNotification}
            isEnglish={isEnglish}
          />
        </div>
      </div>
    </div>
  );
}

export default HomePage;