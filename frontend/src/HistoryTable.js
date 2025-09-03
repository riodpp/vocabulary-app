import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './HistoryTable.css';

function HistoryTable() {
  const [sessions, setSessions] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const API_BASE = process.env.REACT_APP_API_URL || 'https://vocabulary-app-backend.fly.dev';

  useEffect(() => {
    fetchSessions();
  }, [currentPage]);

  // Expose refresh function to parent component
  useEffect(() => {
    window.refreshHistoryTable = fetchSessions;
    return () => {
      delete window.refreshHistoryTable;
    };
  }, []);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/sessions?page=${currentPage}`);
      setSessions(response.data);
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
    <div className="history-table">
      <h2>Memorization History</h2>
      {sessions.length === 0 ? (
        <p>No memorization sessions yet. Complete your first flashcard session to see history here!</p>
      ) : (
        <>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Directory</th>
                  <th>Total Words</th>
                  <th>Correct</th>
                  <th>Wrong</th>
                  <th>Score</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(session => (
                  <tr key={session.id}>
                    <td>{session.directory_name || 'All Words'}</td>
                    <td>{session.total_words}</td>
                    <td className="correct-count">{session.correct}</td>
                    <td className="wrong-count">{session.wrong}</td>
                    <td className="score">
                      {session.score_percentage.toFixed(1)}%
                    </td>
                    <td>{formatDate(session.created_at)}</td>
                  </tr>
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
    </div>
  );
}

export default HistoryTable;