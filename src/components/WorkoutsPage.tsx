import React, { useMemo, useState } from 'react';
import './WorkoutsPage.css';
import workoutsData from '../data/workoutResources.json';

type Workout = {
  images?: string[];
  video?: string;
  featuredVideo?: boolean;
  resources?: Array<{ label: string; url: string }>;
  galleryImages?: string[];
  imageCaptions?: string[];
  difficulty?: string;
  duration?: string;
  exampleNote?: string;
  meta?: Record<string, any>;
};

const WorkoutsPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [difficulty, setDifficulty] = useState<'All' | 'Easy' | 'Moderate' | 'Hard'>('All');
  const [selected, setSelected] = useState<string | null>(null);

  const workouts = useMemo(() => {
    const entries = Object.entries(workoutsData) as Array<[string, Workout]>;
    return entries.map(([title, data]) => ({ title, ...data }));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return workouts.filter(w => {
      if (difficulty !== 'All') {
        const d = (w.difficulty || '').toLowerCase();
        if (difficulty.toLowerCase() !== d && !(difficulty === 'Moderate' && d === 'moderate')) return false;
      }
      if (!q) return true;
      return (
        w.title.toLowerCase().includes(q) ||
        (w.exampleNote || '').toLowerCase().includes(q) ||
        (w.meta?.description || '').toLowerCase().includes(q)
      );
    });
  }, [workouts, query, difficulty]);

  return (
    <div className="workouts-page">
      <div className="workouts-hero">
        <div className="hero-left">
          <h1>Workouts Library</h1>
          <p className="hero-sub">Explore exercises, watch technique videos, and view trusted resources — curated for quick practice.</p>
        </div>
        <div className="hero-right">
          <div className="search-wrap">
            <input
              className="search-input"
              placeholder="Search workouts, muscles, or equipment..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              aria-label="Search workouts"
            />
          </div>
          <div className="filters">
            {(['All', 'Easy', 'Moderate', 'Hard'] as const).map(d => (
              <button
                key={d}
                className={`filter-btn ${difficulty === d ? 'active' : ''}`}
                onClick={() => setDifficulty(d)}
                aria-pressed={difficulty === d}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="workouts-grid">
        {filtered.length === 0 && (
          <div className="empty">No workouts found. Try a different search.</div>
        )}

        {filtered.map(w => (
          <article
            key={w.title}
            className="workout-card"
          >
            <div className="card-media">
              {w.images && w.images[0] ? (
                <img src={w.images[0]} alt={w.imageCaptions?.[0] || w.title} />
              ) : (
                <div className="media-fallback">{w.title.charAt(0)}</div>
              )}
              {w.featuredVideo && <span className="featured-pill">Video</span>}
            </div>
            <div className="card-body">
              <h3 className="card-title">{w.title}</h3>
              <div className="card-meta">
                <span className={`difficulty ${(w.difficulty||'').toLowerCase()}`}>{w.difficulty || 'Varies'}</span>
                <span className="duration">{w.duration || 'Varies'}</span>
              </div>
              <p className="card-desc">{w.exampleNote || w.meta?.description?.slice(0,120) || 'No description available.'}</p>
            </div>
            <div className="card-footer">
              <button className="btn-ghost" onClick={(e) => { e.stopPropagation(); setSelected(w.title); }}>View</button>
              <a className="btn-link" href={w.resources?.[0]?.url || '#'} target="_blank" rel="noreferrer" onClick={(e)=>e.stopPropagation()}>Resources</a>
            </div>
          </article>
        ))}
      </div>

      {selected && (
        <WorkoutModal
          title={selected}
          data={workouts.find(w => w.title === selected)!}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
};

function WorkoutModal({ title, data, onClose }: { title: string; data: Workout; onClose: () => void }) {
  return (
    <div className="workouts-modal-overlay" role="dialog" aria-modal="true" aria-label={`${title} details`}>
      <div className="workouts-modal">
        <header className="modal-head">
          <div>
            <h2>{title}</h2>
            <div className="meta-row">
              <span className={`difficulty ${(data.difficulty||'').toLowerCase()}`}>{data.difficulty || 'Varies'}</span>
              <span className="duration">{data.duration}</span>
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <main className="modal-body">
          <div className="modal-media">
            {data.video ? (
              <iframe src={data.video} title={`${title} video`} frameBorder={0} allowFullScreen />
            ) : data.images && data.images[0] ? (
              <img src={data.images[0]} alt={data.imageCaptions?.[0] || title} />
            ) : (
              <div className="media-fallback large">{title.charAt(0)}</div>
            )}
          </div>

          <div className="modal-info">
            <p className="long-desc">{data.meta?.description || data.exampleNote}</p>

            {data.resources?.length ? (
              <section className="resources">
                <h4>Resources</h4>
                <ul>
                  {data.resources!.map((r, i) => (
                    <li key={i}><a href={r.url} target="_blank" rel="noreferrer">{r.label}</a></li>
                  ))}
                </ul>
              </section>
            ) : null}

            <div className="meta-grid">
              {data.meta && Object.entries(data.meta).map(([k,v]) => (
                <div key={k} className="meta-item"><strong>{k}</strong><span>{String(v)}</span></div>
              ))}
            </div>
          </div>
        </main>

        <footer className="modal-actions">
          <button className="btn-primary" onClick={() => { /* placeholder for add to plan */ }}>Add to Plan</button>
          <button className="btn-outline" onClick={onClose}>Close</button>
        </footer>
      </div>
    </div>
  );
}

export default WorkoutsPage;
