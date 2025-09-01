import React, { useState } from 'react';

function WordForm({ onAddWord, directories }) {
  const [english, setEnglish] = useState('');
  const [directoryId, setDirectoryId] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onAddWord({ english, directory_id: directoryId ? parseInt(directoryId) : null });
    setEnglish('');
  };

  const speak = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="word-form">
      <form onSubmit={handleSubmit}>
        <input value={english} onChange={e => setEnglish(e.target.value)} placeholder="English word" required />
        <select value={directoryId} onChange={e => setDirectoryId(e.target.value)}>
          <option value="">No directory</option>
          {directories.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <button type="button" onClick={() => speak(english)}>Speak</button>
        <button type="submit">Add Word</button>
      </form>
    </div>
  );
}

export default WordForm;