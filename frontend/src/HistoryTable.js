import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './HistoryTable.css';

function HistoryTable() {
  const [sessions, setSessions] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [collapsed, setCollapsed] = useState(true);

  const API_BASE = process.env.REACT_APP_API_URL || 'https://vocabulary-app-backend.fly.dev';

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/sessions?page=${currentPage}`);
      setSessions(response.data);
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      setLoading(false);
    }
  }, [API_BASE, currentPage]);

  useEffect(() => {
    fetchSessions();
  }, [currentPage, fetchSessions]);

  // Expose refresh function to parent component
  useEffect(() => {
    window.refreshHistoryTable = fetchSessions;
    return () => {
      delete window.refreshHistoryTable;
    };
  }, [fetchSessions]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isMobile = () => {
    return window.innerWidth <= 768;
  };

  const toggleRowExpansion = (sessionId) => {
    const newExpandedRows = new Set(expandedRows);
    if (newExpandedRows.has(sessionId)) {
      newExpandedRows.delete(sessionId);
    } else {
      newExpandedRows.add(sessionId);
    }
    setExpandedRows(newExpandedRows);
  };

  const nextPage = () => {
    setCurrentPage(prev => prev + 1);
  };

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };

  if (loading) {
    return <div className="history-table"><p>Loading history...</p></div>;
  }

  return (
    <div className={`history-table ${collapsed ? 'collapsed' : ''}`}>
      <div className="history-header">
        <h2>Memorization History</h2>
        <button
          className="history-toggle-btn"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Show Details' : 'Minimize'}
        >
          {collapsed ? '📊 Show Details' : '📊 Minimize'}
        </button>
      </div>
      {sessions.length === 0 ? (
        <p>No memorization sessions yet. Complete your first flashcard session to see history here!</p>
      ) : (
        <>
          {!collapsed && (
            <>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Directory</th>
                      <th>Total Words</th>
                      {isMobile() ? (
                        <th>Score</th>
                      ) : (
                        <>
                          <th>Correct</th>
                          <th>Wrong</th>
                          <th>Score</th>
                          <th>Date</th>
                        </>
                      )}
                      {isMobile() && <th></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map(session => (
                      <React.Fragment key={session.id}>
                        <tr
                          className={isMobile() ? 'mobile-row' : ''}
                          onClick={isMobile() ? () => toggleRowExpansion(session.id) : undefined}
                        >
                          <td>{session.directory_name || 'All Words'}</td>
                          <td>{session.total_words}</td>
                          {isMobile() ? (
                            <>
                              <td className="score">
                                {session.score_percentage.toFixed(1)}%
                              </td>
                              <td className="expand-icon">
                                {expandedRows.has(session.id) ? '▼' : '▶'}
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="correct-count">{session.correct}</td>
                              <td className="wrong-count">{session.wrong}</td>
                              <td className="score">
                                {session.score_percentage.toFixed(1)}%
                              </td>
                              <td>{formatDate(session.created_at)}</td>
                            </>
                          )}
                        </tr>
                        {isMobile() && expandedRows.has(session.id) && (
                          <tr className="mobile-expanded-row">
                            <td colSpan="4">
                              <div className="mobile-details">
                                <div className="detail-item">
                                  <span className="detail-label">Correct:</span>
                                  <span className="correct-count">{session.correct}</span>
                                </div>
                                <div className="detail-item">
                                  <span className="detail-label">Wrong:</span>
                                  <span className="wrong-count">{session.wrong}</span>
                                </div>
                                <div className="detail-item">
                                  <span className="detail-label">Date:</span>
                                  <span>{formatDate(session.created_at)}</span>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="pagination">
                <button
                  onClick={prevPage}
                  disabled={currentPage === 1}
                  className="pagination-btn"
                >
                  Previous
                </button>
                <span className="page-info">Page {currentPage}</span>
                <button
                  onClick={nextPage}
                  disabled={sessions.length < 15}
                  className="pagination-btn"
                >
                  Next
                </button>
              </div>
            </>
          )}
          {collapsed && (
            <div className="collapsed-summary">
              <p>
                <strong>{sessions.length}</strong> session{sessions.length !== 1 ? 's' : ''} completed
                {sessions.length > 0 && (
                  <span className="summary-stats">
                    • Latest score: <strong>{sessions[0].score_percentage.toFixed(1)}%</strong>
                  </span>
                )}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default HistoryTable;