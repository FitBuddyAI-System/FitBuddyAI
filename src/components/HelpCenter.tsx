import { Dumbbell } from 'lucide-react';
import './Terms.css';
import './HelpCenter.css';
import { useState } from 'react';

export default function HelpCenter() {
  const [modalOpen, setModalOpen] = useState(false);

  const openModal = () => { setModalOpen(true); };

  return (
    <div className="terms-page help-page">
      <header className="terms-hero">
        <div className="terms-hero-inner">
          <div className="hero-logo"><Dumbbell size={36} color="#fff" /></div>
          <div>
            <h1 className="hero-title">Help Center</h1>
            <p className="hero-sub">Find answers to common questions about using FitBuddyAIAI.</p>
          </div>
        </div>
      </header>

      <main className="help-categories">
        <div className="help-cards">
          <article className="help-card">
            <div className="help-card-icon" aria-hidden>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 8v4l3 3"></path></svg>
            </div>
            <div>
              <h3>Getting Started</h3>
              <p>Complete the questionnaire to receive your personalized 30-day workout plan and get tips for first steps.</p>
            </div>
          </article>

          <article className="help-card">
            <div className="help-card-icon" aria-hidden>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            </div>
            <div>
              <h3>Account & Sign-in</h3>
              <p>Sign in to restore backups, save progress, and sync across devices. Reset options are available from the sign-in page.</p>
            </div>
          </article>

          <article className="help-card">
            <div className="help-card-icon" aria-hidden>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"></rect><path d="M16 3v4"></path><path d="M8 3v4"></path></svg>
            </div>
            <div>
              <h3>Workouts & Plans</h3>
              <p>View and edit your plan on the calendar. Swap or regenerate workouts, and mark progress as you train.</p>
            </div>
          </article>

          <article className="help-card">
            <div className="help-card-icon" aria-hidden>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h18"></path><path d="M3 6h18"></path><path d="M3 18h18"></path></svg>
            </div>
            <div>
              <h3>Privacy & Data</h3>
              <p>Learn how we store and protect your data and how to control backups and sharing preferences.</p>
            </div>
          </article>
        </div>

        <div className="faq-spot">
          <h2>Frequently Asked Questions</h2>
          <Accordion />
        </div>

        <div className="help-support">
          <h3>Need more help?</h3>
          <p>If you can't find the answer, contact our support team.</p>
          <button className="btn btn-primary help-contact" onClick={openModal}>Contact Support</button>
        </div>
      </main>
  <SupportModal open={modalOpen} onClose={() => setModalOpen(false)} onSubmitted={() => { setModalOpen(false); console.log('support form submitted'); }} />

      
    </div>
  );
}

// Modal component inside the same file for simplicity
function SupportModal({ open, onClose, onSubmitted }: { open: boolean; onClose: () => void; onSubmitted?: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate submit
    try {
      // Here you'd normally send to your API; we'll just call onSubmitted
      onSubmitted?.();
    } catch (err) {
      // noop
    }
  };

  return (
    <div className="hc-modal-backdrop" role="dialog" aria-modal="true">
      <div className="hc-modal">
        <header className="hc-modal-header">
          <h3>Contact Support</h3>
          <button className="hc-close" onClick={onClose} aria-label="Close">×</button>
        </header>
        <form className="hc-form" onSubmit={handleSubmit}>
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            Subject
            <input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>
          <label>
            Message
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={6} required />
          </label>
          <div className="hc-actions">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Send</button>
          </div>
        </form>
      </div>
    </div>
  );
}


function Accordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const items = [
    {
      q: 'How do I get my personalized workout plan?',
      a: 'Complete the questionnaire accessible from the Get Started button. The AI will generate a 30-day plan based on your answers.',
      icon: (<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 8v4l3 3"></path></svg>)
    },
    {
      q: 'Can I change workouts or difficulty?',
      a: 'Yes. On the calendar, tap a workout to see options for regenerating, swapping, or adjusting difficulty.',
      icon: (<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"></rect><path d="M16 3v4"></path><path d="M8 3v4"></path></svg>)
    },
    {
      q: 'How do I restore my account or backups?',
      a: 'If you signed up with an account, use Sign In to restore. If you used local storage, use the restore options in the settings or contact support for assistance.',
      icon: (<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>)
    },
    {
      q: 'How is my data stored and protected?',
      a: 'We store workout plans and profile data locally and optionally in cloud backups if enabled. See the Privacy Policy for more details.',
      icon: (<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h18"></path><path d="M3 6h18"></path><path d="M3 18h18"></path></svg>)
    }
  ];

  const toggle = (i: number) => setOpenIndex(openIndex === i ? null : i);

  return (
    <div className="accordion" role="region" aria-label="Help center FAQ">
      {items.map((it, i) => (
        <div className={`accordion-item ${openIndex === i ? 'open' : ''}`} key={i}>
          <div className="accordion-card">
            <div className="help-card-icon faq-icon" aria-hidden>
              {it.icon}
            </div>
            <div className="accordion-main">
              <button
                className="accordion-button"
                aria-expanded={openIndex === i}
                aria-controls={`acc-panel-${i}`}
                id={`acc-btn-${i}`}
                onClick={() => toggle(i)}
              >
                <span>{it.q}</span>
                <svg className="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </button>
              <div id={`acc-panel-${i}`} role="region" aria-labelledby={`acc-btn-${i}`} className="accordion-panel">
                <p>{it.a}</p>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
