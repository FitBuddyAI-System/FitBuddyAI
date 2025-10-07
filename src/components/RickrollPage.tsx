import React, { useEffect, useState } from 'react';
import NotFoundPage from './NotFoundPage';
import './RickrollPage.css';

const RICK_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

const RickrollPage: React.FC = () => {
  const [choice, setChoice] = useState<'pending' | 'rick' | 'notfound'>('pending');

  useEffect(() => {
    // 50/50 chance
    const rand = Math.random();
    if (rand < 0.5) {
      setChoice('rick');
    } else {
      setChoice('notfound');
    }
  }, []);

  useEffect(() => {
    if (choice === 'rick') {
      // report the event to server, then redirect
      const report = async () => {
        try {
          let headers: any = { 'Content-Type': 'application/json' };
          try {
            const { getAuthToken } = await import('../services/localStorage');
            const token = getAuthToken();
            if (token) headers['Authorization'] = `Bearer ${token}`;
          } catch {}
          await fetch('/api/rickroll', { method: 'POST', headers, body: JSON.stringify({ userId: null }) });
        } catch (e) {
          // ignore
        } finally {
          window.location.href = RICK_URL;
        }
      };
      const t = setTimeout(report, 150);
      return () => clearTimeout(t);
    }
  }, [choice]);

  if (choice === 'pending') {
    return (
      <div className="rickroll-loading">
        <p>Deciding your fate...</p>
      </div>
    );
  }

  if (choice === 'notfound') {
    return <NotFoundPage />;
  }

  // choice === 'rick' will redirect; render a friendly message as fallback
  return (
    <div className="rickroll-redirect">
      <p>Redirecting you to something special...</p>
      <a href={RICK_URL} target="_blank" rel="noopener noreferrer">Open</a>
    </div>
  );
};

export default RickrollPage;
