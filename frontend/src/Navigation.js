import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

function Navigation({ user, onLogout }) {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  const toggleUserMenu = () => {
    setIsUserMenuOpen(!isUserMenuOpen);
  };

  const closeUserMenu = () => {
    setIsUserMenuOpen(false);
  };

  return (
    <>
      {/* Mobile Menu Backdrop */}
      {isMenuOpen && (
        <div
          className="mobile-menu-backdrop"
          onClick={closeMenu}
        />
      )}

      <nav className={`main-navigation ${isMenuOpen ? 'menu-open' : ''}`}>
        <div className="app-title">
          <div className="logo-container">
            <img src="/vocapp-logo.png" alt="Vocapp Logo" className="app-logo" />
            <h1>Vocapp</h1>
          </div>
          {user && (
            <div className="desktop-user-info">
              <button
                className="user-menu-btn"
                onClick={toggleUserMenu}
                aria-label="Toggle user menu"
              >
                👤 {user.first_name || user.email}
                {user.subscription && (
                  <span className={`subscription-badge ${user.subscription.plan_type}`}>
                    {user.subscription.plan_type}
                  </span>
                )}
                <span className={`dropdown-arrow ${isUserMenuOpen ? 'open' : ''}`}>▼</span>
              </button>
              {isUserMenuOpen && (
                <div className="user-dropdown">
                  <button
                    className="logout-btn"
                    onClick={() => {
                      onLogout();
                      closeUserMenu();
                    }}
                  >
                    🚪 Logout
                  </button>
                </div>
              )}
            </div>
          )}
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
        {user ? (
          <>
            <div className="nav-links-container">
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

              <div className="user-info">
                <span className="user-email">
                  👤 {user.first_name || user.email}
                  {user.subscription && (
                    <span className={`subscription-badge ${user.subscription.plan_type}`}>
                      {user.subscription.plan_type}
                    </span>
                  )}
                </span>
                <button
                  className="logout-btn"
                  onClick={() => {
                    onLogout();
                    closeMenu();
                  }}
                >
                  🚪 Logout
                </button>
              </div>
            </div>
            
          </>
        ) : (
          <>
            <div className="nav-links-container">
              <Link
                to="/login"
                className={`nav-link ${location.pathname === '/login' ? 'active' : ''}`}
                onClick={closeMenu}
              >
                🔐 Login
              </Link>
              <Link
                to="/register"
                className={`nav-link ${location.pathname === '/register' ? 'active' : ''}`}
                onClick={closeMenu}
              >
                📝 Sign Up
              </Link>
            </div>
          </>
        )}
      </div>
    </nav>
    </>
  );
}

export default Navigation;