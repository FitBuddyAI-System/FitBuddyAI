import React from 'react';
import './LoadingMobile.css';
import { Dumbbell } from 'lucide-react';

const LoadingMobile: React.FC = () => {
  return (
    <div className="loading-mobile-screen">
      <div className="loading-mobile-card">
        <div className="mobile-dumbbell">
          <Dumbbell size={28} color="#fff" />
        </div>
        <div className="mobile-text">
          <div className="mobile-title">Preparing your plan…</div>
          <div className="mobile-sub">This usually takes a few seconds</div>
        </div>
        <div className="mobile-dots" aria-hidden>
          <span></span><span></span><span></span>
        </div>
      </div>
    </div>
  );
};

export default LoadingMobile;
