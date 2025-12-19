import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Target, Calendar, Zap, Dumbbell } from 'lucide-react';
import './WelcomePage.css';
import { loadUserData } from '../services/localStorage';
// Footer is now rendered site-wide in `App.tsx`
import IntroBubbles from './IntroBubbles';
import BackgroundDots from './BackgroundDots';


// Only generate random features once per page load
const features = ["Set Goals", "Track Progress", "Plan Workouts", "Stay Motivated", "AI Powered", "Fun & Easy", "Personalized"];
const random: number[] = [];
while (random.length < 3) {
  const idx = Math.floor(Math.random() * 7);
  if (!random.includes(idx)) {
    random.push(idx);
  }
}

const WelcomePage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  // Parse query param
  const params = new URLSearchParams(location.search);
  const introParam = params.get('intro');
  const shouldShowIntro = introParam === null || introParam === '1';
  const [showIntro, setShowIntro] = useState(shouldShowIntro);
  const [mainVisible, setMainVisible] = useState(!shouldShowIntro);
  const [currentUser, setCurrentUser] = useState<any>(() => loadUserData());
  // When intro=0 we still render the main content but avoid entrance animations
  const shouldAnimateLogo = introParam !== '0';
  const hideIntroTimer = useRef<number | null>(null);
  const failSafeTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (hideIntroTimer.current) {
        clearTimeout(hideIntroTimer.current);
      }
      if (failSafeTimer.current) {
        clearTimeout(failSafeTimer.current);
      }
    };
  }, []);

  // Notify other components that the intro is active so they can hide UI like header/footer
  // Also lock page scrolling while the intro overlay is active to avoid scroll bleed.
  const introScrollRef = useRef<number | null>(null);
  useEffect(() => {
    try {
      if (showIntro) {
        // Dispatch start event for other components
        window.dispatchEvent(new CustomEvent('fitbuddyai-intro-start'));
        try { document.body.classList.add('intro-active'); } catch (e) {}
        // Lock scrolling: save scroll pos and fix body
        try {
          introScrollRef.current = window.scrollY || window.pageYOffset || 0;
          document.body.style.position = 'fixed';
          document.body.style.top = `-${introScrollRef.current}px`;
          document.body.style.left = '0';
          document.body.style.right = '0';
          document.body.style.overflow = 'hidden';
          // also disable html overflow for some browsers
          try { document.documentElement.style.overflow = 'hidden'; } catch (e) {}
        } catch (e) {}
      } else {
        // Dispatch end event and restore scrolling
        window.dispatchEvent(new CustomEvent('fitbuddyai-intro-end'));
        try {
          const y = introScrollRef.current || 0;
          document.body.style.position = '';
          document.body.style.top = '';
          document.body.style.left = '';
          document.body.style.right = '';
          document.body.style.overflow = '';
          try { document.documentElement.style.overflow = ''; } catch (e) {}
          window.scrollTo(0, y);
          introScrollRef.current = null;
        } catch (e) {}
      }
    } catch (e) {
      // ignore in non-browser environments
    }
    return () => {
      // Ensure cleanup if component unmounts while intro active
      try {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.overflow = '';
        try { document.documentElement.style.overflow = ''; } catch (e) {}
        try { document.body.classList.remove('intro-active'); } catch (e) {}
        if (introScrollRef.current !== null) {
          try { window.scrollTo(0, introScrollRef.current); } catch (e) {}
          introScrollRef.current = null;
        }
      } catch (e) {}
    };
  }, [showIntro]);

  // Keep user state in sync with storage (cross-tab or sign-in changes)
  useEffect(() => {
    const handleStorage = () => setCurrentUser(loadUserData());
    window.addEventListener('storage', handleStorage);
    try { const bc = new BroadcastChannel('fitbuddyai'); bc.onmessage = () => handleStorage(); return () => { bc.close(); window.removeEventListener('storage', handleStorage); }; } catch(e) { return () => window.removeEventListener('storage', handleStorage); }
  }, []);

  // When intro finishes, remove ?intro from URL
  const handleIntroFinish = () => {
    setMainVisible(true);
    try { window.dispatchEvent(new CustomEvent('fitbuddyai-intro-end')); } catch (e) {}
    hideIntroTimer.current = window.setTimeout(() => setShowIntro(false), 900);
    if (location.search.includes('intro')) {
      navigate('/', { replace: true });
    }
  };

  // Fail-safe: always reveal the main content after a short delay
  // so the page can't get stuck showing only the background if the intro fails.
  useEffect(() => {
    if (!showIntro) return;
    failSafeTimer.current = window.setTimeout(() => {
      setMainVisible(true);
      setShowIntro(false);
    }, 6000);
    return () => {
      if (failSafeTimer.current) {
        clearTimeout(failSafeTimer.current);
        failSafeTimer.current = null;
      }
    };
  }, [showIntro]);
  return (
    <div className="welcome-page">
      {showIntro && <IntroBubbles onFinish={handleIntroFinish} />}
      <div className={`welcome-main ${mainVisible ? 'is-visible' : ''}`}>
        {/* Hero Section */}
        <div className="hero-section">
          <BackgroundDots />
          <div className="hero-content centered-absolute">
              <div className={"logo-section" + (shouldAnimateLogo ? " bounce-in" : "") }>
                <div className="logo logo-centered">
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-dumbbell"><path d="m6.5 6.5 11 11"></path><path d="m21 21-1-1"></path><path d="m3 3 1 1"></path><path d="m18 22 4-4"></path><path d="m2 6 4-4"></path><path d="m3 10 7-7"></path><path d="m14 21 7-7"></path></svg>
                </div>
                <h1 className="app-title">FitBuddyAI</h1>
                <p className="app-subtitle">Your AI-Powered Fitness Companion</p>
              </div>
            <div className="hero-text fade-in-up">
              <h2>Transform Your Fitness Journey</h2>
              <p>Get personalized workout plans powered by AI, track your progress, and achieve your fitness goals with fun, gamified experience.</p>
            </div>
            <div className="cta-section fade-in-up">
              <Link to={currentUser && (currentUser.id || currentUser?.data?.id) ? '/calendar' : '/questionnaire'} className="btn btn-primary btn-large" data-discover="true">
                {currentUser && (currentUser.id || currentUser?.data?.id) ? 'Continue Your Journey' : 'Start Your Journey'}
              </Link>
              <p className="cta-subtitle">Free • Personalized • AI-Powered</p>
            </div>
          </div>
          <div className="hero-illustration">
            <div className="floating-card card-1">
              <Target size={24} />
              <span>{features[random[0]]}</span>
            </div>
            <div className="floating-card card-2">
              <Calendar size={24} />
              <span>{features[random[1]]}</span>
            </div>
            <div className="floating-card card-3">
              <Zap size={24} />
              <span>{features[random[2]]}</span>
            </div>
            <div className="floating-card card-4">
              <Dumbbell size={24} />
              <span>Strength Training</span>
            </div>
          </div>
        </div>
        {/* Features Section */}
        <div className="features-section">
          <div className="container">
            <h3 className="section-title">Why Choose FitBuddyAI?</h3>
            <div className="features-grid">
              <div className="feature-card card fade-in-up">
                <div className="feature-icon">
                  <Target size={32} />
                </div>
                <h4>AI-Powered Plans</h4>
                <p>Get personalized workout routines generated by advanced AI based on your goals, fitness level, and preferences.</p>
              </div>
              <div className="feature-card card fade-in-up">
                <div className="feature-icon">
                  <Calendar size={32} />
                </div>
                <h4>Smart Calendar</h4>
                <p>Visualize your workout schedule with an intuitive calendar. Easily modify or request new workouts for any day.</p>
              </div>
              <div className="feature-card card fade-in-up">
                <div className="feature-icon">
                  <Zap size={32} />
                </div>
                <h4>Adaptive Training</h4>
                <p>Your workouts evolve with you. The AI adjusts difficulty and variety based on your progress and feedback.</p>
              </div>
            </div>
          </div>
        </div>
        {/* How It Works Section */}
        <div className="how-it-works-section">
          <div className="container">
            <h3 className="section-title">How It Works</h3>
            <div className="steps-container">
              <div className="step">
                <div className="step-number">1</div>
                <div className="step-content">
                  <h4>Tell Us About You</h4>
                  <p>Answer a few questions about your fitness goals, experience level, and preferences.</p>
                </div>
              </div>
              <div className="step">
                <div className="step-number">2</div>
                <div className="step-content">
                  <h4>Get Your AI Plan</h4>
                  <p>Our AI creates a personalized workout calendar tailored specifically for you.</p>
                </div>
              </div>
              <div className="step">
                <div className="step-number">3</div>
                <div className="step-content">
                  <h4>Train & Adapt</h4>
                  <p>Follow your workouts, track progress, and request changes whenever you need them.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* CTA Section */}
        <div className="final-cta-section">
          <div className="container">
            <div className="final-cta-content">
              <h3>Ready to Transform Your Fitness?</h3>
              <p>Start your journey with Fatbuddy Today.</p>
              <Link to="/questionnaire" className="btn btn-primary btn-large">
                Get Started Now
              </Link>
            </div>
          </div>
        </div>
      </div>
      {/* Footer is rendered site-wide in App.tsx to ensure visibility on all routes */}
    </div>
  );
};

export default WelcomePage;
