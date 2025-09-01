import React from 'react';
import './DirectorySelectionModal.css';

function DirectorySelectionModal({ isOpen, directories, onSelect, onCancel }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content directory-selection-modal">
        <h3>Select Directory for Flashcard</h3>
        <p>Choose a directory to practice words from:</p>

        <div className="directory-options">
          <button
            className="directory-option all-words"
            onClick={() => onSelect(null)}
          >
            <div className="directory-name">All Words</div>
            <div className="directory-description">Practice with all words from all directories</div>
          </button>

          {directories.map(directory => (
            <button
              key={directory.id}
              className="directory-option"
              onClick={() => onSelect(directory.id)}
            >
              <div className="directory-name">{directory.name}</div>
              <div className="directory-description">
                Practice words from this directory only
              </div>
            </button>
          ))}
        </div>

        <div className="modal-buttons">
          <button className="cancel-btn" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default DirectorySelectionModal;