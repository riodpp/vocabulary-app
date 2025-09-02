import React from 'react';
import { Link, useLocation } from 'react-router-dom';

function Navigation() {
  const location = useLocation();

  return (
    <nav className="main-navigation">
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
      </div>
    </nav>
  );
}

export default Navigation;