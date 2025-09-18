import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import DirectorySelectionModal from './DirectorySelectionModal';
import { getAllDirectories, saveWord, getAllWords } from './indexedDB';

function SentenceExplanation({ showNotification }) {
  const [sentence, setSentence] = useState('');
  const [translation, setTranslation] = useState('');
  const [explanation, setExplanation] = useState('');
  const [isExplaining, setIsExplaining] = useState(false);
  const [isExplanationCollapsed, setIsExplanationCollapsed] = useState(true);

  // Vocabulary extraction states
  const [vocabulary, setVocabulary] = useState([]);
  const [wordTranslations, setWordTranslations] = useState({});
  const [includedWords, setIncludedWords] = useState(new Set());
  const [directories, setDirectories] = useState([]);
  const [isDirectoryModalOpen, setIsDirectoryModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTranslatingWords, setIsTranslatingWords] = useState(false);
  const [characterCount, setCharacterCount] = useState(0);

  const API_BASE = process.env.REACT_APP_API_URL || 'https://vocabulary-app-backend.fly.dev';

  // Common words to filter out
  const commonWords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
    'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
    'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can',
    'this', 'that', 'these', 'those', 'my', 'your', 'his', 'her', 'its', 'our', 'their',
    'what', 'when', 'where', 'why', 'how', 'who', 'which'
  ]);

  // Extract vocabulary from sentence using AI
  const extractVocabulary = async (text) => {
    try {
      const response = await axios.post(`${API_BASE}/extract-vocabulary`, { sentence: text });

      if (response.data && response.data.data && response.data.data.vocabulary) {
        let vocabulary = response.data.data.vocabulary;

        // Filter out words that are already saved in any directory
        try {
          const allSavedWords = await getAllWords();
          const savedWordSet = new Set(
            allSavedWords
              .filter(word => word && word.english) // Filter out null/undefined words
              .map(word => word.english.toLowerCase())
          );
          vocabulary = vocabulary.filter(word => !savedWordSet.has(word.toLowerCase()));
        } catch (error) {
          console.error('Error checking saved words:', error);
          // Continue with AI-extracted vocabulary even if saved words check fails
        }

        return vocabulary;
      } else {
        console.error('Invalid response format from vocabulary extraction API');
        return [];
      }
    } catch (error) {
      console.error('Error extracting vocabulary with AI:', error);
      // Fallback to manual extraction if AI fails
      console.log('Falling back to manual vocabulary extraction...');
      return extractVocabularyManual(text);
    }
  };

  // Manual vocabulary extraction as fallback
  const extractVocabularyManual = (text) => {
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .split(/\s+/) // Split by whitespace
      .filter(word => word.length > 0) // Remove empty strings
      .filter(word => !commonWords.has(word)) // Filter out common words
      .filter((word, index, arr) => arr.indexOf(word) === index); // Remove duplicates

    return words;
  };

  // Translate individual words
  const translateWords = async (words) => {
    setIsTranslatingWords(true);
    const translations = {};

    try {
      for (const word of words) {
        try {
          const response = await axios.post(`${API_BASE}/ai-translate`, {
            text: word,
            from: 'en',
            to: 'id'
          });

          if (response.data && response.data.data) {
            translations[word] = response.data.data.translation ||
                               response.data.data.result ||
                               response.data.data.text ||
                               response.data.data ||
                               (typeof response.data.data === 'string' ? response.data.data : 'Translation unavailable');
          } else {
            translations[word] = 'Translation unavailable';
          }
        } catch (error) {
          console.error(`Error translating word "${word}":`, error);
          translations[word] = 'Translation unavailable';
        }
      }
    } catch (error) {
      console.error('Error in word translation process:', error);
    } finally {
      setIsTranslatingWords(false);
    }

    setWordTranslations(translations);
  };

  // Load directories on component mount
  useEffect(() => {
    const loadDirectories = async () => {
      try {
        const dirs = await getAllDirectories();
        setDirectories(dirs);
      } catch (error) {
        console.error('Error loading directories:', error);
      }
    };
    loadDirectories();
  }, []);

  // Update character count when sentence changes
  useEffect(() => {
    setCharacterCount(sentence.length);
  }, [sentence]);

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

      // Always reset vocabulary state first
      setVocabulary([]);
      setIncludedWords(new Set());
      setWordTranslations({});

      // Extract vocabulary from the original sentence
      const extractedVocab = await extractVocabulary(sentence);
      setVocabulary(extractedVocab);

      // Translate the extracted words
      if (extractedVocab.length > 0) {
        translateWords(extractedVocab);
      }

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
    setVocabulary([]);
    setWordTranslations({});
    setIncludedWords(new Set());
    setIsExplanationCollapsed(false);
    setCharacterCount(0);
  };

  // Handle word inclusion toggle
  const toggleWordInclusion = (word) => {
    const newIncluded = new Set(includedWords);
    if (newIncluded.has(word)) {
      newIncluded.delete(word);
    } else {
      newIncluded.add(word);
    }
    setIncludedWords(newIncluded);
  };

  // Handle select all words
  const selectAllWords = () => {
    setIncludedWords(new Set(vocabulary));
  };

  // Handle deselect all words
  const deselectAllWords = () => {
    setIncludedWords(new Set());
  };

  // Handle saving words to directory
  const handleSaveToDirectory = async (directoryId) => {
    if (vocabulary.length === 0) {
      showNotification('No vocabulary to save.', 'error');
      return;
    }

    const wordsToSave = Array.from(includedWords);
    if (wordsToSave.length === 0) {
      showNotification('No words selected to save.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      for (const word of wordsToSave) {
        await saveWord({
          english: word,
          indonesian: wordTranslations[word] || 'Translation not available',
          directory_id: directoryId,
          // Add other required fields as needed
        });
      }
      showNotification(`Saved ${wordsToSave.length} words successfully!`, 'success');
      setIsDirectoryModalOpen(false);

      // Remove saved words from the vocabulary list
      setVocabulary(prevVocab => prevVocab.filter(word => !wordsToSave.includes(word)));
      setIncludedWords(new Set()); // Reset selections
    } catch (error) {
      console.error('Error saving words:', error);
      showNotification('Failed to save words. Please try again.', 'error');
    } finally {
      setIsSaving(false);
    }
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
          maxLength="200"
        />
        <div className="character-counter">
          <span className={`character-count ${characterCount > 180 ? 'warning' : ''} ${characterCount >= 200 ? 'error' : ''}`}>
            {characterCount}/200
          </span>
        </div>
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

          {/* Vocabulary Section */}
          {vocabulary.length > 0 && (
            <div className="vocabulary-section">
              <h3>📚 Extracted Vocabulary:</h3>
              <p>Check the words you want to save to your vocabulary:</p>
              {isTranslatingWords && (
                <p className="translating-notice">🔄 Translating words...</p>
              )}
              <div className="vocabulary-controls">
                <button
                  onClick={selectAllWords}
                  disabled={vocabulary.length === 0 || isTranslatingWords}
                  className="select-all-btn"
                >
                  Select All
                </button>
                <button
                  onClick={deselectAllWords}
                  disabled={vocabulary.length === 0 || isTranslatingWords}
                  className="deselect-all-btn"
                >
                  Deselect All
                </button>
              </div>
              <div className="vocabulary-list">
                {vocabulary.map((word, index) => (
                  <label key={index} className="vocabulary-item">
                    <input
                      type="checkbox"
                      checked={includedWords.has(word)}
                      onChange={() => toggleWordInclusion(word)}
                    />
                    <div className="word-content">
                      <span className={`english-word ${includedWords.has(word) ? 'included' : ''}`}>
                        {word}
                      </span>
                      <span className="indonesian-translation">
                        {wordTranslations[word] || (isTranslatingWords ? '...' : 'Loading...')}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
              <div className="vocabulary-actions">
                <button
                  onClick={() => setIsDirectoryModalOpen(true)}
                  disabled={includedWords.size === 0 || isTranslatingWords}
                  className="save-vocab-btn"
                >
                  Save Selected Words ({includedWords.size})
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Directory Selection Modal */}
      <DirectorySelectionModal
        isOpen={isDirectoryModalOpen}
        directories={directories}
        onSelect={handleSaveToDirectory}
        onCancel={() => setIsDirectoryModalOpen(false)}
      />
    </div>
  );
}

export default SentenceExplanation;