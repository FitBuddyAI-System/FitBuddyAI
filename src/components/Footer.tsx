import { Link } from 'react-router-dom';
import './Footer.css';
import { Dumbbell } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="fb-footer">
      <div className="fb-footer-inner">
        <div className="fb-brand">
          <div className="fb-logo"><Dumbbell size={28} color="#fff" /></div>
          <div>
            <h4>FitBuddyAI</h4>
            <p className="muted">Your friendly AI fitness companion</p>
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
        </div>
      </div>
    </footer>
  );
}
