import React from 'react';
import WordForm from './WordForm';

function HomePage({ onAddWord, directories, showNotification }) {
  return (
    <div className="home-page">
      <h1>Add New Words</h1>
      <div className="centered-content">
        <WordForm onAddWord={onAddWord} directories={directories} showNotification={showNotification} />
      </div>
    </div>
  );
}

export default HomePage;