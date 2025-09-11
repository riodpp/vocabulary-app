import React, { useState, useEffect, useCallback } from 'react';
import { getAllProgress, getAllDirectories, isIndexedDBSupported } from './indexedDB';
import './HistoryTable.css';

function HistoryTable() {
  const [sessions, setSessions] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [collapsed, setCollapsed] = useState(true);
  const [totalRecords, setTotalRecords] = useState(0);

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);

      if (!isIndexedDBSupported()) {
        console.error('IndexedDB not supported');
        setSessions([]);
        return;
      }

      // Load progress records and directories from local storage
      const [progressRecords, directories] = await Promise.all([
        getAllProgress(),
        getAllDirectories()
      ]);

      // Create directory name lookup map
      const directoryMap = {};
      directories.forEach(dir => {
        directoryMap[dir.id] = dir.name;
      });

      // Transform progress records to session format
      const allSessions = progressRecords
        .map(record => {
          // Calculate correct and wrong counts
          const correct = record.results.filter(r => r.correct).length;
          const wrong = record.results.filter(r => !r.correct).length;
          const scorePercentage = record.total_words > 0 ? (correct / record.total_words) * 100 : 0;

          return {
            id: record.id,
            directory_name: directoryMap[record.directory_id] || 'All Words',
            total_words: record.total_words,
            correct: correct,
            wrong: wrong,
            score_percentage: scorePercentage,
            created_at: record.timestamp
          };
        })
        // Sort by timestamp descending (newest first)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      // Set total records for pagination
      setTotalRecords(allSessions.length);

      // Simple pagination (15 items per page)
      const transformedSessions = allSessions.slice((currentPage - 1) * 15, currentPage * 15);

      setSessions(transformedSessions);
      console.log(`📊 Loaded ${transformedSessions.length} history sessions from local storage (${allSessions.length} total)`);
    } catch (error) {
      console.error('Error fetching sessions from local storage:', error);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage]);

  useEffect(() => {
    fetchSessions();
  }, [currentPage, fetchSessions]);

  // Reset to page 1 if current page exceeds available pages
  useEffect(() => {
    const maxPage = Math.ceil(totalRecords / 15);
    if (currentPage > maxPage && maxPage > 0) {
      setCurrentPage(1);
    }
  }, [totalRecords, currentPage]);

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
    const maxPage = Math.ceil(totalRecords / 15);
    if (currentPage < maxPage) {
      setCurrentPage(prev => prev + 1);
    }
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
                <span className="page-info">
                  Page {currentPage} of {Math.max(1, Math.ceil(totalRecords / 15))}
                </span>
                <button
                  onClick={nextPage}
                  disabled={currentPage >= Math.ceil(totalRecords / 15)}
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