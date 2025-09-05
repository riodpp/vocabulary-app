import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

function Navigation() {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  return (
    <nav className="main-navigation">
      <div className="app-title">
        <div className="logo-container">
          <img src="/vocapp-logo.png" alt="Vocapp Logo" className="app-logo" />
          <h1>Vocapp</h1>
        </div>
        <button
          className={`hamburger-btn ${isMenuOpen ? 'open' : ''}`}
          onClick={toggleMenu}
          aria-label="Toggle menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
      <div className={`nav-container ${isMenuOpen ? 'open' : ''}`}>
        <Link
          to="/"
          className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
          onClick={closeMenu}
        >
          🏠 Add Words
        </Link>
        <Link
          to="/dictionary"
          className={`nav-link ${location.pathname === '/dictionary' ? 'active' : ''}`}
          onClick={closeMenu}
        >
          📚 My Dictionary
        </Link>
        <Link
          to="/memorize"
          className={`nav-link ${location.pathname === '/memorize' ? 'active' : ''}`}
          onClick={closeMenu}
        >
          🧠 Memorize
        </Link>
        <Link
          to="/sentence-explanation"
          className={`nav-link ${location.pathname === '/sentence-explanation' ? 'active' : ''}`}
          onClick={closeMenu}
        >
          💬 Explain Sentences
        </Link>
      </div>
    </nav>
  );
}

export default Navigation;