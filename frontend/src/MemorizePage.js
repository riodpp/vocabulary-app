import React, { useState, useEffect, useCallback } from 'react';
import Flashcard from './Flashcard';
import DirectorySelectionModal from './DirectorySelectionModal';
import HistoryTable from './HistoryTable';
import {
  getAllWords,
  getWordsByDirectory,
  getAllDirectories,
  saveProgress as saveProgressLocal,
  initializeDefaultData,
  isIndexedDBSupported
} from './indexedDB';
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

  // API_BASE removed - working offline-only

  const fetchDirectories = useCallback(async () => {
    try {
      if (isIndexedDBSupported()) {
        const localDirectories = await getAllDirectories();
        setDirectories(localDirectories);
        console.log(`📁 Loaded ${localDirectories.length} directories from local storage`);
      } else {
        console.error('❌ IndexedDB not supported');
      }
    } catch (error) {
      console.error('❌ Error loading directories from local storage:', error);
    }
  }, []);

  const fetchWords = useCallback(async () => {
    try {
      if (isIndexedDBSupported()) {
        const localWords = await getAllWords();
        setWords(localWords);
        setLoading(false);
        console.log(`📚 Loaded ${localWords.length} words from local storage`);
      } else {
        console.error('❌ IndexedDB not supported');
        setLoading(false);
      }
    } catch (error) {
      console.error('❌ Error loading words from local storage:', error);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initializeApp = async () => {
      if (isIndexedDBSupported()) {
        await initializeDefaultData();
      }
      await fetchDirectories();
      await fetchWords();
    };

    initializeApp();
  }, [fetchDirectories, fetchWords]);

  const showDirectorySelection = () => {
    setDirectorySelectionModal(true);
  };

  const startFlashcard = async (directoryId) => {
    let filteredWords = [];

    if (directoryId) {
      // Try to get words from local storage first
      if (isIndexedDBSupported()) {
        try {
          filteredWords = await getWordsByDirectory(directoryId);
        } catch (error) {
          console.error('Error loading words from local storage:', error);
        }
      }

      // If no local words or IndexedDB not supported, filter from current words
      if (filteredWords.length === 0) {
        filteredWords = words.filter(w => w.directory_id === directoryId);
      }
    } else {
      // For all words, use current words state (which may be from local storage)
      filteredWords = words;
    }

    setSelectedDirectory(directoryId);
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
      // Transform results for local storage
      const transformedResults = results.map(result => ({
        word_id: result.wordId,
        correct: result.correct
      }));

      // Save to local storage only
      if (isIndexedDBSupported()) {
        await saveProgressLocal({
          directory_id: selectedDirectory,
          total_words: flashcardWords.length,
          results: transformedResults
        });
        console.log('✅ Progress saved to local storage successfully');
      } else {
        console.error('❌ IndexedDB not supported - progress not saved');
      }

      // Refresh history table after saving
      if (window.refreshHistoryTable) {
        window.refreshHistoryTable();
      }
    } catch (error) {
      console.error('❌ Error saving progress to local storage:', error);
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