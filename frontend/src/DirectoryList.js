import React, { useState } from 'react';

function DirectoryList({ directories, onAddDirectory, onSelect, selectedDirectory, onViewWords, onDeleteDirectory }) {
  const [name, setName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

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
              <span onClick={() => onViewWords(d.id)} className="directory-name">{d.name}</span>
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