// IndexedDB utilities for vocabulary app local storage
const DB_NAME = 'VocabularyAppDB';
const DB_VERSION = 2;

// Open database connection
export const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const oldVersion = event.oldVersion;

      // Create words object store
      if (!db.objectStoreNames.contains('words')) {
        const wordsStore = db.createObjectStore('words', { keyPath: 'id', autoIncrement: true });
        wordsStore.createIndex('directory_id', 'directory_id', { unique: false });
        wordsStore.createIndex('english', 'english', { unique: false });
      }

      // Create directories object store
      if (!db.objectStoreNames.contains('directories')) {
        const directoriesStore = db.createObjectStore('directories', { keyPath: 'id', autoIncrement: true });
        directoriesStore.createIndex('name', 'name', { unique: false });
      }

      // Create progress object store
      if (!db.objectStoreNames.contains('progress')) {
        const progressStore = db.createObjectStore('progress', { keyPath: 'id', autoIncrement: true });
        progressStore.createIndex('directory_id', 'directory_id', { unique: false });
        progressStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // Handle migration to version 2: Add progress fields to words
      if (oldVersion < 2) {
        const transaction = event.target.transaction;
        const wordsStore = transaction.objectStore('words');

        // Get all existing words and update them with progress fields
        const getAllRequest = wordsStore.getAll();
        getAllRequest.onsuccess = () => {
          const words = getAllRequest.result;
          words.forEach(word => {
            // Add progress fields if they don't exist
            if (!word.hasOwnProperty('correct_count')) {
              word.correct_count = 0;
            }
            if (!word.hasOwnProperty('wrong_count')) {
              word.wrong_count = 0;
            }
            if (!word.hasOwnProperty('last_practiced')) {
              word.last_practiced = null;
            }
            // Update the word
            wordsStore.put(word);
          });
        };
      }
    };
  });
};

// Words operations
export const saveWord = async (word) => {
  const db = await openDB();
  const transaction = db.transaction(['words'], 'readwrite');
  const store = transaction.objectStore('words');

  const wordData = {
    ...word,
    correct_count: word.correct_count || 0,
    wrong_count: word.wrong_count || 0,
    last_practiced: word.last_practiced || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  return new Promise((resolve, reject) => {
    const request = store.add(wordData);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const getAllWords = async () => {
  const db = await openDB();
  const transaction = db.transaction(['words'], 'readonly');
  const store = transaction.objectStore('words');

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const getWordsByDirectory = async (directoryId) => {
  const db = await openDB();
  const transaction = db.transaction(['words'], 'readonly');
  const store = transaction.objectStore('words');
  const index = store.index('directory_id');

  return new Promise((resolve, reject) => {
    const request = index.getAll(directoryId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const updateWord = async (word) => {
  const db = await openDB();
  const transaction = db.transaction(['words'], 'readwrite');
  const store = transaction.objectStore('words');

  const wordData = {
    ...word,
    correct_count: word.correct_count || 0,
    wrong_count: word.wrong_count || 0,
    last_practiced: word.last_practiced || null,
    updated_at: new Date().toISOString()
  };

  return new Promise((resolve, reject) => {
    const request = store.put(wordData);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const deleteWord = async (wordId) => {
  const db = await openDB();
  const transaction = db.transaction(['words'], 'readwrite');
  const store = transaction.objectStore('words');

  return new Promise((resolve, reject) => {
    const request = store.delete(wordId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const updateWordProgress = async (wordId, isCorrect) => {
  const db = await openDB();
  const transaction = db.transaction(['words'], 'readwrite');
  const store = transaction.objectStore('words');

  return new Promise((resolve, reject) => {
    const getRequest = store.get(wordId);
    getRequest.onsuccess = () => {
      const word = getRequest.result;
      if (word) {
        // Update progress fields
        word.correct_count = (word.correct_count || 0) + (isCorrect ? 1 : 0);
        word.wrong_count = (word.wrong_count || 0) + (isCorrect ? 0 : 1);
        word.last_practiced = new Date().toISOString();
        word.updated_at = new Date().toISOString();

        const putRequest = store.put(word);
        putRequest.onsuccess = () => resolve(putRequest.result);
        putRequest.onerror = () => reject(putRequest.error);
      } else {
        reject(new Error('Word not found'));
      }
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
};

// Directories operations
export const saveDirectory = async (directory) => {
  const db = await openDB();
  const transaction = db.transaction(['directories'], 'readwrite');
  const store = transaction.objectStore('directories');

  const directoryData = {
    ...directory,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  return new Promise((resolve, reject) => {
    const request = store.add(directoryData);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const getAllDirectories = async () => {
  const db = await openDB();
  const transaction = db.transaction(['directories'], 'readonly');
  const store = transaction.objectStore('directories');

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const updateDirectory = async (directory) => {
  const db = await openDB();
  const transaction = db.transaction(['directories'], 'readwrite');
  const store = transaction.objectStore('directories');

  const directoryData = {
    ...directory,
    updated_at: new Date().toISOString()
  };

  return new Promise((resolve, reject) => {
    const request = store.put(directoryData);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const deleteDirectory = async (directoryId) => {
  const db = await openDB();
  const transaction = db.transaction(['directories'], 'readwrite');
  const store = transaction.objectStore('directories');

  return new Promise((resolve, reject) => {
    const request = store.delete(directoryId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Progress operations
export const saveProgress = async (progressData) => {
  const db = await openDB();
  const transaction = db.transaction(['progress'], 'readwrite');
  const store = transaction.objectStore('progress');

  const progress = {
    ...progressData,
    timestamp: new Date().toISOString()
  };

  return new Promise((resolve, reject) => {
    const request = store.add(progress);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const getProgressByDirectory = async (directoryId) => {
  const db = await openDB();
  const transaction = db.transaction(['progress'], 'readonly');
  const store = transaction.objectStore('progress');
  const index = store.index('directory_id');

  return new Promise((resolve, reject) => {
    const request = index.getAll(directoryId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const getAllProgress = async () => {
  const db = await openDB();
  const transaction = db.transaction(['progress'], 'readonly');
  const store = transaction.objectStore('progress');

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Local-only operations - no backend sync needed
export const initializeDefaultData = async () => {
  try {
    const directories = await getAllDirectories();
    if (directories.length === 0) {
      // Create default directory if none exist
      await saveDirectory({
        name: 'General',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      console.log('✅ Default directory created');
    }
  } catch (error) {
    console.error('❌ Error initializing default data:', error);
  }
};

// Debug function for testing local storage
export const debugIndexedDB = async () => {
  console.log('🔍 IndexedDB Debug Info:');

  try {
    const words = await getAllWords();
    console.log(`📚 Words stored: ${words.length}`, words);

    const directories = await getAllDirectories();
    console.log(`📁 Directories stored: ${directories.length}`, directories);

    const progress = await getAllProgress();
    console.log(`📊 Progress records: ${progress.length}`, progress);

    return { words, directories, progress };
  } catch (error) {
    console.error('❌ Error reading IndexedDB:', error);
    return null;
  }
};

// Make it globally available for console testing
if (typeof window !== 'undefined') {
  window.debugIndexedDB = debugIndexedDB;
}

// Check if IndexedDB is supported
export const isIndexedDBSupported = () => {
  return 'indexedDB' in window;
};