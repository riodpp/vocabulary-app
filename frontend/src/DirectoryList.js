import React, { useState } from 'react';

function DirectoryList({ directories, onAddDirectory, onSelect, selectedDirectory, onViewWords, onDeleteDirectory }) {
  const [name, setName] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onAddDirectory(name);
    setName('');
  };

  return (
    <div className="directory-list">
      <div className="directory-form">
        <form onSubmit={handleSubmit}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Directory name" required />
          <button type="submit">Add Directory</button>
        </form>
      </div>
      <ul>
        {directories.map(d => (
          <li key={d.id} className={d.id === selectedDirectory ? 'selected' : ''}>
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
  );
}

export default DirectoryList;