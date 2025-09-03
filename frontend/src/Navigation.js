import React from 'react';
import { Link, useLocation } from 'react-router-dom';

function Navigation() {
  const location = useLocation();

  return (
    <nav className="main-navigation">
      <div className="app-title">
        <h1>Vocapp</h1>
      </div>
      <div className="nav-container">
        <Link
          to="/"
          className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
        >
          🏠 Add Words
        </Link>
        <Link
          to="/dictionary"
          className={`nav-link ${location.pathname === '/dictionary' ? 'active' : ''}`}
        >
          📚 My Dictionary
        </Link>
        <Link
          to="/memorize"
          className={`nav-link ${location.pathname === '/memorize' ? 'active' : ''}`}
        >
          🧠 Memorize
        </Link>
      </div>
    </nav>
  );
}

export default Navigation;