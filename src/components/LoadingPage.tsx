import React from 'react';
import './LoadingPage.css';
import { Dumbbell } from 'lucide-react';

const LoadingPage: React.FC = () => (
  <div className="loading-screen">
    <div className="loading-container fade-in-bounce">
      <div className="loading-dumbbell">
        <Dumbbell size={40} color="#fff" />
      </div>
      <h2 className="loading-title">Hang tight!</h2>
      <p className="loading-desc">Your personalized plan is on its way...</p>
      <p className="ai-disclaimer">Disclaimer: This plan is AI-generated and may not be perfect for everyone. Check important info.</p>
    </div>
  </div>
);

export default LoadingPage;
