import React, { useState } from 'react';

function Flashcard({ words, onUpdateScore, onRestart, onFinish, score }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showTranslation, setShowTranslation] = useState(false);
  const [results, setResults] = useState([]);

  if (currentIndex >= words.length) {
    // Call onFinish with results when flashcard is complete
    if (onFinish && results.length === words.length) {
      onFinish(results);
    }

    return (
      <div className="flashcard-finished">
        <h3>🎉 Flashcard Complete!</h3>
        <p>You've reviewed all {words.length} words.</p>
        <p>Score: Correct {score.correct}, Wrong {score.wrong}</p>
        <button className="restart-btn" onClick={onRestart}>Start Again</button>
      </div>
    );
  }

  const word = words[currentIndex];

  const next = (isCorrect) => {
    onUpdateScore(isCorrect);
    const newResults = [...results, { wordId: word.id, correct: isCorrect }];
    setResults(newResults);
    setCurrentIndex(currentIndex + 1);
    setShowTranslation(false);
  };

  return (
    <div className="flashcard">
      <p>{word.english}</p>
      {showTranslation && <p className="translation">{word.indonesian}</p>}
      {!showTranslation && <button className="show-translation" onClick={() => setShowTranslation(true)}>Show Translation</button>}
      {showTranslation && (
        <div>
          <button className="correct" onClick={() => next(true)}>Correct</button>
          <button className="wrong" onClick={() => next(false)}>Wrong</button>
        </div>
      )}
    </div>
  );
}

export default Flashcard;