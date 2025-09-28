import React from 'react';
import './NotFoundPage.css';
import { Dumbbell } from 'lucide-react';

const NotFoundPage: React.FC = () => {
  return (
    <div className="notfound-container">
      <div className="notfound-content fade-in-bounce">
        <div className="notfound-icon-bg">
          <Dumbbell size={48} color="#fff" />
        </div>
        <h1 className="notfound-title">404</h1>
        <h2 className="notfound-message">Page Not Found</h2>
        <p className="notfound-desc">Oops! The page you are looking for does not exist.</p>
        <a className="notfound-home-btn" href="/?intro=0">Go Home</a>
      </div>
    </div>
  );
};

export default NotFoundPage;
