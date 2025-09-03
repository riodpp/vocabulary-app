import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Flashcard from './Flashcard';
import DirectorySelectionModal from './DirectorySelectionModal';
import HistoryTable from './HistoryTable';
import './MemorizePage.css'; // Assuming we create this CSS file

function MemorizePage() {
  const [directories, setDirectories] = useState([]);
  const [words, setWords] = useState([]);
  const [selectedDirectory, setSelectedDirectory] = useState(null);
  const [flashcardWords, setFlashcardWords] = useState([]);
  const [score, setScore] = useState({ correct: 0, wrong: 0 });
  const [sessionStarted, setSessionStarted] = useState(false);
  const [directorySelectionModal, setDirectorySelectionModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const API_BASE = process.env.REACT_APP_API_URL || 'https://vocabulary-app-backend.fly.dev';

  useEffect(() => {
    fetchDirectories();
    fetchWords();
  }, []);

  const fetchDirectories = async () => {
    try {
      const res = await axios.get(`${API_BASE}/directories`, { timeout: 10000 });
      setDirectories(res.data);
    } catch (error) {
      console.error('Error fetching directories:', error);
    }
  };

  const fetchWords = async () => {
    try {
      const res = await axios.get(`${API_BASE}/words`, { timeout: 10000 });
      setWords(res.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching words:', error);
      setLoading(false);
    }
  };

  const showDirectorySelection = () => {
    setDirectorySelectionModal(true);
  };

  const startFlashcard = (directoryId) => {
    const filteredWords = directoryId ? words.filter(w => w.directory_id === directoryId) : words;
    setSelectedDirectory(directoryId); // Set the selected directory
    setFlashcardWords(filteredWords);
    setScore({ correct: 0, wrong: 0 });
    setSessionStarted(true);
    setDirectorySelectionModal(false);
  };

  const cancelDirectorySelection = () => {
    setDirectorySelectionModal(false);
  };

  const restartFlashcard = () => {
    setFlashcardWords([]);
    setScore({ correct: 0, wrong: 0 });
    setSessionStarted(false);
  };

  const updateScore = (isCorrect) => {
    setScore(prev => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      wrong: prev.wrong + (isCorrect ? 0 : 1)
    }));
  };

  const saveProgress = async (results) => {
    if (saving) return; // Prevent duplicate saves

    setSaving(true);
    try {
      // Transform results to match backend expected format (wordId -> word_id)
      const transformedResults = results.map(result => ({
        word_id: result.wordId,
        correct: result.correct
      }));

      await axios.post(`${API_BASE}/progress`, {
        directory_id: selectedDirectory,
        total_words: flashcardWords.length,
        results: transformedResults
      });
      console.log('Progress saved successfully');

      // Refresh history table after saving
      if (window.refreshHistoryTable) {
        window.refreshHistoryTable();
      }
    } catch (error) {
      console.error('Error saving progress:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="memorize-page"><p>Loading...</p></div>;
  }

  return (
    <div className="memorize-page">
      <h1>Memorize Words</h1>
      {!sessionStarted ? (
        <div className="start-section">
          <button className="start-flashcard-btn" onClick={showDirectorySelection}>
            Start Flashcard
          </button>
        </div>
      ) : (
        <div className="flashcard-session">
          <button className="back-btn" onClick={restartFlashcard}>Back to Selection</button>
          <Flashcard
            words={flashcardWords}
            onUpdateScore={updateScore}
            onRestart={restartFlashcard}
            onFinish={saveProgress}
            score={score}
          />
        </div>
      )}

      <DirectorySelectionModal
        isOpen={directorySelectionModal}
        directories={directories}
        onSelect={startFlashcard}
        onCancel={cancelDirectorySelection}
      />

      <HistoryTable />
    </div>
  );
}

export default MemorizePage;