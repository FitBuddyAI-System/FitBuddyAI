import { Link } from 'react-router-dom';
import './Footer.css';
import { Dumbbell } from 'lucide-react';

interface FooterProps {
  themeMode?: 'auto' | 'light' | 'dark';
  onChangeThemeMode?: (mode: 'auto' | 'light' | 'dark') => void;
}

export default function Footer({ themeMode = 'auto', onChangeThemeMode }: FooterProps) {
  const cur = themeMode || 'auto';
  return (
    <footer className="fitbuddy-footer">
      <div className="fitbuddy-footer-inner">
        <div className="fb-brand">
          <div className="fb-logo"><Dumbbell size={28} color="#fff" /></div>
          <div>
            <h4>FitBuddyAI</h4>
            <p className="muted">Your friendly AI Fitness Companion</p>
          </div>
        </div>

        <div className="fb-links">
          <div className="fb-col">
            <h5>Product</h5>
            <Link to="/questionnaire">Get Started</Link>
            <Link to="/chat">AI Coach</Link>
            <Link to="/shop">Shop</Link>
          </div>
          <div className="fb-col">
            <h5>Legal</h5>
            <Link to="/terms">Terms of Service</Link>
            <Link to="/privacy">Privacy Policy</Link>
          </div>
          <div className="fb-col">
            <h5>Support</h5>
            <a href="mailto:fitbuddyaig@gmail.com">fitbuddyaig@gmail.com</a>
            <Link to="/help">Help Center</Link>
          </div>
        </div>

        <div className="fb-bottom">
          <div>© {new Date().getFullYear()} FitBuddyAI, LLC. All rights reserved.</div>
          <div className="socials muted">Made with ❤️ for a healthier life</div>
          <div className="fb-theme">
            <label className="fb-theme-label">Theme</label>
            <div className="fb-theme-selector" role="tablist" aria-label="Theme selector">
              <button className={`fb-theme-btn ${cur === 'auto' ? 'active' : ''}`} onClick={() => onChangeThemeMode?.('auto')}>Auto</button>
              <button className={`fb-theme-btn ${cur === 'light' ? 'active' : ''}`} onClick={() => onChangeThemeMode?.('light')}>Light</button>
              <button className={`fb-theme-btn ${cur === 'dark' ? 'active' : ''}`} onClick={() => onChangeThemeMode?.('dark')}>Dark</button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
