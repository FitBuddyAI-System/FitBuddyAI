import React, { useEffect, useState } from 'react';
import './IntroMobile.css';
import { Dumbbell } from 'lucide-react';

const IntroMobile: React.FC<{ onFinish?: () => void }> = ({ onFinish }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      if (onFinish) onFinish();
    }, 2200); // 2.2s intro
    return () => clearTimeout(t);
  }, [onFinish]);

  if (!visible) return null;

  return (
    <div className="intro-mobile-root" role="presentation">
      <div className="intro-card">
        <div className="intro-badge">
          <Dumbbell size={36} color="#fff" />
        </div>
        <div className="intro-title-wrap">
          <h1 className="intro-title">FitBuddy</h1>
          <p className="intro-sub">Your AI fitness companion</p>
        </div>
        <div className="intro-bubbles" aria-hidden>
          <span className="bubble b1"></span>
          <span className="bubble b2"></span>
          <span className="bubble b3"></span>
        </div>
      </div>
    </div>
  );
};

export default IntroMobile;
