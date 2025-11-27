import { Dumbbell, Search } from 'lucide-react';
import './HelpCenter.css';
import { useState } from 'react';

export default function HelpCenter() {
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const openModal = () => setModalOpen(true);

  const categories = [
    { id: 'start', title: 'Getting Started', desc: 'Create your profile and generate a plan.', icon: (<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 8v4l3 3"></path></svg>) },
    { id: 'account', title: 'Account & Sign-in', desc: 'Manage sign-ins, backups and recovery.', icon: (<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>) },
    { id: 'plans', title: 'Workouts & Plans', desc: 'Edit your calendar, swap workouts, and track progress.', icon: (<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"></rect><path d="M16 3v4"></path><path d="M8 3v4"></path></svg>) },
    { id: 'privacy', title: 'Privacy & Data', desc: 'How your data is stored and secured.', icon: (<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h18"></path><path d="M3 6h18"></path><path d="M3 18h18"></path></svg>) }
  ];

  const faqs = [
    { q: 'How do I get my personalized workout plan?', a: 'Complete the questionnaire accessible from the Get Started button. The AI will generate a plan based on your answers.' },
    { q: 'Can I change workouts or difficulty?', a: 'Yes. On the calendar, tap a workout to see options for regenerating, swapping, or adjusting difficulty.' },
    { q: 'How do I restore my account or backups?', a: 'If you signed up with an account, use Sign In to restore. If you used local storage, use the restore options in settings.' },
    { q: 'How is my data stored and protected?', a: 'We store plans locally and optionally in cloud backups if enabled. See Privacy Policy for details.' }
  ];

  const popular = [
    { title: 'Restore Backups', desc: 'How to restore from your cloud backups or local exports.' },
    { title: 'Regenerate a Workout', desc: 'Steps to regenerate a single workout in your plan.' },
    { title: 'Cancel Subscription', desc: 'How to manage and cancel billing.' }
  ];

  return (
    <div className="hc-page">
      <header className="hc-hero">
        <div className="hc-hero-inner">
          <div className="hc-brand">
            <Dumbbell size={36} />
            <div className="hc-brand-text">
              <h1>Help Center</h1>
              <p>Fast answers and guides to get the most from FitBuddyAI.</p>
            </div>
          </div>

          <div className="hc-search">
            <div className="hc-search-input">
              <Search size={18} />
              <input placeholder="Search help articles, e.g. 'backup'" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="hc-search-hint">Try: "restore", "calendar", "account"</div>
          </div>
        </div>
      </header>

      <main className="hc-grid">
        <aside className="hc-left">
          <div className="hc-card compact">
            <h3>Popular Articles</h3>
            <ul className="hc-popular">
              {popular.map((p, i) => (
                <li key={i}>
                  <button className="link-like" onClick={openModal}>{p.title}</button>
                  <p className="muted">{p.desc}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="hc-card compact">
            <h3>Contact</h3>
            <p className="muted">Need help from a human? Our support responds within 24 hours.</p>
            <button className="btn btn-primary" onClick={openModal}>Contact Support</button>
          </div>
        </aside>

        <section className="hc-main">
          <div className="hc-cats">
            {categories.map((c) => (
              <article key={c.id} className="hc-category">
                <div className="hc-cat-icon" aria-hidden>{c.icon}</div>
                <div>
                  <h4>{c.title}</h4>
                  <p className="muted">{c.desc}</p>
                </div>
              </article>
            ))}
          </div>

          <div className="hc-faq">
            <h2>Frequently Asked Questions</h2>
            <Accordion items={faqs} />
          </div>
        </section>

        <aside className="hc-right">
          <div className="hc-card spotlight">
            <h3>Featured Guide</h3>
            <h4>Optimize Your 30-Day Plan</h4>
            <p className="muted">Tips on balancing strength, cardio, and recovery to hit your goals.</p>
            <div className="guide-actions">
              <button className="btn btn-secondary">Read Guide</button>
              <button className="btn btn-accent" onClick={openModal}>Ask Support</button>
            </div>
          </div>

          <div className="hc-card">
            <h3>Resources</h3>
            <ul className="hc-links">
              <li><a href="/help/privacy">Privacy Policy</a></li>
              <li><a href="/help/changelog">Changelog</a></li>
              <li><a href="/help/api">Developer API</a></li>
            </ul>
          </div>
        </aside>
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


function Accordion({ items }: { items: { q: string; a: string }[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const toggle = (i: number) => setOpenIndex(openIndex === i ? null : i);

  return (
    <div className="accordion" role="region" aria-label="Help center FAQ">
      {items.map((it, i) => (
        <div className={`accordion-item ${openIndex === i ? 'open' : ''}`} key={i}>
          <button
            className="accordion-button"
            aria-expanded={openIndex === i}
            onClick={() => toggle(i)}
          >
            <span>{it.q}</span>
            <svg className="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </button>
          <div className="accordion-panel">
            <p>{it.a}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
