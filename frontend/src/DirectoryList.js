import React, { useState, useEffect } from 'react';
import { getWordsByDirectory } from './indexedDB';

function DirectoryList({ directories, onAddDirectory, onSelect, selectedDirectory, onViewWords, onDeleteDirectory }) {
  const [name, setName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [wordCounts, setWordCounts] = useState({});

  // Fetch word counts for all directories
  useEffect(() => {
    const fetchWordCounts = async () => {
      if (!directories || directories.length === 0) return;

      const counts = {};
      for (const directory of directories) {
        if (directory && directory.id) {
          try {
            const words = await getWordsByDirectory(directory.id);
            counts[directory.id] = words ? words.length : 0;
          } catch (error) {
            console.error('Error fetching word count for directory:', directory.id, error);
            counts[directory.id] = 0;
          }
        }
      }
      setWordCounts(counts);
    };

    fetchWordCounts();
  }, [directories]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onAddDirectory(name);
    setName('');
  };

  // Filter directories based on search term
  const filteredDirectories = directories.filter(d =>
    d && d.id && d.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="directory-list">
      <div className="directory-form">
        <form onSubmit={handleSubmit}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Directory name" required />
          <button type="submit">Add Directory</button>
        </form>
      </div>

      {/* Search input */}
      <div className="directory-search">
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search directories..."
          className="search-input"
        />
      </div>

      <div className="directory-list-container">
        <ul>
          {filteredDirectories.map((d, index) => (
            <li key={d.id || `dir-${index}`} className={d.id === selectedDirectory ? 'selected' : ''}>
              <div className="directory-content" onClick={() => onViewWords(d.id)}>
                <span className="directory-name">{d.name}</span>
                <span className="word-count">({wordCounts[d.id] || 0} words)</span>
              </div>
              <button
                className="delete-dir-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteDirectory(d.id, d.name);
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default DirectoryList;