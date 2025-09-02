import React, { useState } from 'react';

function DirectoryMenu({ directories, selectedDirectory, onSelectDirectory, onAddDirectory }) {
  const [newDirectoryName, setNewDirectoryName] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleAddDirectory = async (e) => {
    e.preventDefault();
    if (newDirectoryName.trim()) {
      await onAddDirectory(newDirectoryName.trim());
      setNewDirectoryName('');
      setIsAdding(false);
    }
  };

  return (
    <div className="directory-menu">
      <h3>Directories</h3>
      <div className="directory-list">
        {directories.map(directory => (
          <button
            key={directory.id}
            className={`directory-option ${selectedDirectory === directory.id ? 'selected' : ''}`}
            onClick={() => onSelectDirectory(directory.id)}
          >
            📂 {directory.name}
          </button>
        ))}
      </div>

      {isAdding ? (
        <form onSubmit={handleAddDirectory} className="add-directory-form">
          <input
            type="text"
            value={newDirectoryName}
            onChange={(e) => setNewDirectoryName(e.target.value)}
            placeholder="New directory name"
            autoFocus
          />
          <button type="submit">Add</button>
          <button type="button" onClick={() => setIsAdding(false)}>Cancel</button>
        </form>
      ) : (
        <button
          className="add-directory-btn"
          onClick={() => setIsAdding(true)}
        >
          ➕ Add Directory
        </button>
      )}
    </div>
  );
}

export default DirectoryMenu;