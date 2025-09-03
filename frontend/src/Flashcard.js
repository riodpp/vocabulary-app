import React, { useState } from 'react';

function Flashcard({ words, onUpdateScore, onRestart, onFinish, score }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showTranslation, setShowTranslation] = useState(false);
  const [results, setResults] = useState([]);
  const [finished, setFinished] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isNewWord, setIsNewWord] = useState(false);

  // Reset state when restarting
  const handleRestart = () => {
    setCurrentIndex(0);
    setShowTranslation(false);
    setResults([]);
    setFinished(false);
    if (onRestart) onRestart();
  };

  if (currentIndex >= words.length) {
    // Call onFinish with results when flashcard is complete (only once)
    if (onFinish && results.length === words.length && !finished) {
      onFinish(results);
      setFinished(true);
    }

    return (
      <div className="flashcard-finished">
        <h3>🎉 Flashcard Complete!</h3>
        <p>You've reviewed all {words.length} words.</p>
        <p>Score: Correct {score.correct}, Wrong {score.wrong}</p>
        <button className="restart-btn" onClick={handleRestart}>Start Again</button>
      </div>
    );
  }

  const word = words[currentIndex];

  const next = (isCorrect) => {
    // Start transition animation
    setIsTransitioning(true);

    // Flip back to front face first
    setShowTranslation(false);

    // After flip animation completes, transition to next word
    setTimeout(() => {
      onUpdateScore(isCorrect);
      const newResults = [...results, { wordId: word.id, correct: isCorrect }];
      setResults(newResults);
      setCurrentIndex(currentIndex + 1);
      setIsTransitioning(false);
      setIsNewWord(true);

      // Remove new-word class after animation completes
      setTimeout(() => setIsNewWord(false), 300);
    }, 200); // Wait for flip animation to complete
  };

  const speakWord = (text) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US'; // English pronunciation
      utterance.rate = 0.8; // Slightly slower for learning
      speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="flashcard-container">
      <div className={`flashcard ${showTranslation ? 'flipped' : ''} ${isTransitioning ? 'transitioning' : ''} ${isNewWord ? 'new-word' : ''}`}>
        <div className="flashcard-face flashcard-front">
          <div className="flashcard-header">
            <button
              className="pronounce-btn"
              onClick={() => speakWord(word.english)}
              title="Pronounce word"
            >
              🔊
            </button>
          </div>
          <div className="flashcard-content">
            <p className="word-text">{word.english}</p>
          </div>
          <div className="flashcard-footer">
            <button className="show-translation" onClick={() => setShowTranslation(true)}>
              Show Translation
            </button>
          </div>
        </div>
        <div className="flashcard-face flashcard-back">
           <div className="flashcard-content">
             <p className="word-text">{word.indonesian}</p>
           </div>
           <div className="flashcard-footer">
             <div className="answer-buttons">
               <button className="correct" onClick={() => next(true)}>Correct</button>
               <button className="wrong" onClick={() => next(false)}>Wrong</button>
             </div>
           </div>
         </div>
      </div>
    </div>
  );
}

export default Flashcard;