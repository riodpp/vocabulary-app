import React from 'react';
import Flashcard from './Flashcard';
import './FlashcardModal.css';

function FlashcardModal({ isOpen, onClose, words, onUpdateScore, onRestart, onFinish, score }) {
  if (!isOpen) return null;

  return (
    <div className="flashcard-modal-overlay">
      <div className="flashcard-modal-content">
        <div className="flashcard-modal-header">
          <h2>Flashcard Session</h2>
          <button className="flashcard-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="flashcard-modal-body">
          <Flashcard
            words={words}
            onUpdateScore={onUpdateScore}
            onRestart={onRestart}
            onFinish={onFinish}
            score={score}
          />
        </div>
      </div>
    </div>
  );
}

export default FlashcardModal;