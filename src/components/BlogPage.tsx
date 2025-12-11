import React from 'react';
import './BlogPage.css';

const BlogPage: React.FC = () => {
  const today = new Date().toLocaleDateString();
  return (
    <div className="fb-news-root">
      <header className="fb-masthead" role="banner">
        <div className="masthead-left" aria-hidden>
          <div className="newspaper-logo">🏋️‍♂️</div>
        </div>
        <div className="masthead-right">
          <h1 className="paper-title">The FitBuddy Times</h1>
          <div className="paper-sub">Daily fitness &amp; dev dispatch — {today}</div>
        </div>
      </header>

      <main className="fb-paper card" role="main">
        <section className="lead">
          <div className="hero">
            <svg
              className="mascot"
              viewBox="0 0 120 120"
              xmlns="http://www.w3.org/2000/svg"
              role="img"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0" stopColor="#1ecb7b" />
                  <stop offset="1" stopColor="#1e90cb" />
                </linearGradient>
              </defs>
              <rect width="120" height="120" rx="18" fill="url(#g)" />
              <g transform="translate(18,30) scale(0.7)">
                <circle cx="24" cy="12" r="10" fill="#fff" />
                <rect x="8" y="36" width="32" height="8" rx="4" fill="#fff" />
                <rect x="0" y="48" width="48" height="8" rx="4" fill="#fff" />
              </g>
            </svg>

            <div className="lead-text">
              <h2 className="lead-title">Three students sprint forward — progress, humor, and curiosity lead the way</h2>
              <p className="lead-dek">A light-hearted look at an earnest trio building something that helps people move more — and have fun doing it.</p>
            </div>
          </div>
        </section>

        <article className="story">
          <p>
            In a bright corner of the internet, three motivated students — Dakota, William, and Zade — have been tinkering, testing, and
            cheering each other on as they shape a playful fitness companion. Their work is part curiosity, part stubborn optimism, and
            part careful problem-solving. Today they take another step forward.
          </p>

          <p>
            Dakota has been polishing the user experience, smoothing rough edges until clicks feel like a friendly handshake. William is
            hunting bugs with the focus of a cat on a laser pointer — relentless, amused, and usually victorious. Zade brings the glue:
            creativity, structure, and the occasional very-good pun that lightens long debug sessions.
          </p>

          <p>
            Progress in small, steady steps has produced something meaningful: a product that encourages movement and learning. Along the
            way they've learned to ship often, laugh at odd console errors, and celebrate tiny wins — like a calendar date that finally
            renders correctly or an AI reply that doesn't accidentally suggest a dinosaur as a warm-up.
          </p>

          <p>
            This paper encourages Dakota, William, and Zade to keep exploring. Try an experiment, break one thing, fix two. Ask a bold
            question of the AI coach. Share your findings and keep the momentum: every small improvement helps someone move a little more.
          </p>

          <div className="encouragement">
            <strong>To Dakota, William, &amp; Zade:</strong>
            <p>Keep building. Keep testing. Keep laughing. The site is already making a difference — and the best features are still ahead.</p>
          </div>

          <footer className="story-foot">
            <p className="byline">By The FitBuddy Times — Community Dispatch</p>
            <div className="story-actions">
              <a className="cta" href="/" aria-label="Go to dashboard">Back to dashboard</a>
            </div>
          </footer>
        </article>
      </main>
    </div>
  );
};

export default BlogPage;
