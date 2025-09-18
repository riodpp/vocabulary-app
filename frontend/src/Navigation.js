import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

function Navigation({ user, onLogout }) {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Check if screen is mobile
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth <= 576);
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);

    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

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

  // Desktop Header Component
  const DesktopHeader = () => (
    <nav className="main-navigation desktop-nav">
      <div className="nav-header desktop-header">
        <div className="logo-section">
          <img src="/vocapp-logo.png" alt="Vocapp Logo" className="app-logo" />
          <h1 className="brand-name">Vocabularis</h1>
        </div>

        {user ? (
          <div className="nav-center">
            <div className="nav-menu">
              <Link
                to="/"
                className={`nav-item ${location.pathname === '/' ? 'active' : ''}`}
              >
                <span className="nav-icon">📝</span>
                <span className="nav-text">Add Words</span>
              </Link>
              <Link
                to="/dictionary"
                className={`nav-item ${location.pathname === '/dictionary' ? 'active' : ''}`}
              >
                <span className="nav-icon">📚</span>
                <span className="nav-text">Dictionary</span>
              </Link>
              <Link
                to="/memorize"
                className={`nav-item ${location.pathname === '/memorize' ? 'active' : ''}`}
              >
                <span className="nav-icon">🎯</span>
                <span className="nav-text">Practice</span>
              </Link>
              <Link
                to="/sentence-explanation"
                className={`nav-item ${location.pathname === '/sentence-explanation' ? 'active' : ''}`}
              >
                <span className="nav-icon">💭</span>
                <span className="nav-text">Explain</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="nav-center">
            <div className="nav-menu">
              <Link
                to="/login"
                className={`nav-item ${location.pathname === '/login' ? 'active' : ''}`}
              >
                <span className="nav-icon">🔑</span>
                <span className="nav-text">Sign In</span>
              </Link>
            </div>
          </div>
        )}

        {user && (
          <div className="user-section">
            <button
              className="user-avatar-btn"
              onClick={toggleUserMenu}
              aria-label="User menu"
              title={user.first_name || user.email}
            >
              <div className="user-avatar">
                <span className="avatar-icon">👤</span>
              </div>
            </button>
            {isUserMenuOpen && (
              <div className="user-menu-dropdown">
                <div className="user-info-display">
                  <span className="user-email-display">{user.first_name || user.email}</span>
                  {user.subscription && (
                    <span className={`subscription-indicator ${user.subscription.plan_type}`}>
                      {user.subscription.plan_type}
                    </span>
                  )}
                </div>
                <button
                  className="menu-logout-btn"
                  onClick={() => {
                    onLogout();
                    closeUserMenu();
                  }}
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );

  // Mobile Header Component
  const MobileHeader = () => (
    <>
      {/* Mobile Menu Backdrop */}
      {isMenuOpen && (
        <div
          className="mobile-menu-backdrop"
          onClick={closeMenu}
        />
      )}

      {/* Mobile Navigation Menu */}
      <div className={`mobile-nav-menu ${isMenuOpen ? 'open' : ''}`}>
        {/* Mobile Logo Section */}
        <div className="mobile-logo-section">
          <img src="/vocapp-logo.png" alt="Vocapp Logo" className="mobile-app-logo" />
          <h1 className="mobile-brand-name">Vocabularis</h1>
          <button
            className={`mobile-menu-toggle ${isMenuOpen ? 'active' : ''}`}
            onClick={toggleMenu}
            aria-label="Toggle navigation menu"
          >
            <span className="toggle-line"></span>
            <span className="toggle-line"></span>
            <span className="toggle-line"></span>
          </button>
        </div>


        {/* Mobile Nav Links */}
        {user ? (
          <>
            <Link
              to="/"
              className={`mobile-nav-item ${location.pathname === '/' ? 'active' : ''}`}
              onClick={closeMenu}
            >
              <span className="nav-icon">📝</span>
              <span className="nav-text">Add Words</span>
            </Link>
            <Link
              to="/dictionary"
              className={`mobile-nav-item ${location.pathname === '/dictionary' ? 'active' : ''}`}
              onClick={closeMenu}
            >
              <span className="nav-icon">📚</span>
              <span className="nav-text">Dictionary</span>
            </Link>
            <Link
              to="/memorize"
              className={`mobile-nav-item ${location.pathname === '/memorize' ? 'active' : ''}`}
              onClick={closeMenu}
            >
              <span className="nav-icon">🎯</span>
              <span className="nav-text">Practice</span>
            </Link>
            <Link
              to="/sentence-explanation"
              className={`mobile-nav-item ${location.pathname === '/sentence-explanation' ? 'active' : ''}`}
              onClick={closeMenu}
            >
              <span className="nav-icon">💭</span>
              <span className="nav-text">Explain</span>
            </Link>
          </>
        ) : (
          <Link
            to="/login"
            className={`mobile-nav-item ${location.pathname === '/login' ? 'active' : ''}`}
            onClick={closeMenu}
          >
            <span className="nav-icon">🔑</span>
            <span className="nav-text">Sign In</span>
          </Link>
        )}

        {/* Mobile User Section */}
        {user && (
          <div className="mobile-user-section">
            <div className="mobile-user-info">
              <div className="mobile-user-avatar">
                <span className="avatar-icon">👤</span>
              </div>
              <div className="mobile-user-details">
                <span className="mobile-user-email">{user.first_name || user.email}</span>
                {user.subscription && (
                  <span className={`mobile-subscription-indicator ${user.subscription.plan_type}`}>
                    {user.subscription.plan_type}
                  </span>
                )}
              </div>
            </div>
            <button
              className="mobile-logout-btn"
              onClick={() => {
                onLogout();
                closeMenu();
              }}
            >
              Sign Out
            </button>
          </div>
        )}
      </div>

      <nav className={`mobile-navigation ${isMenuOpen ? 'menu-open' : ''}`}>
        <div className="nav-header mobile-header">
          <div className="logo-section">
            <img src="/vocapp-logo.png" alt="Vocapp Logo" className="app-logo" />
            <h1 className="brand-name">Vocabularis</h1>
          </div>
          <button
            className={`mobile-menu-toggle ${isMenuOpen ? 'active' : ''}`}
            onClick={toggleMenu}
            aria-label="Toggle navigation menu"
          >
            <span className="toggle-line"></span>
            <span className="toggle-line"></span>
            <span className="toggle-line"></span>
          </button>
        </div>

        {/* Mobile Menu */}

      </nav>
    </>
  );

  return isMobile ? <MobileHeader /> : <DesktopHeader />;
}

export default Navigation;