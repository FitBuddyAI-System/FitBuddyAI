import React, { useMemo, useState } from 'react';
import './WorkoutsPage.css';
import confetti from 'canvas-confetti';
import {
  loadSavedWorkouts,
  persistSavedWorkouts,
  sanitizeWorkout,
  subscribeSavedWorkouts,
  SavedWorkout
} from '../utils/savedLibrary';

type Workout = {
  id?: string;
  name?: string;
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
  // Fields matching the exercises JSON schema
  force?: string | null;
  level?: string;
  mechanic?: string | null;
  equipment?: string | string[] | null;
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  instructions?: string[];
  category?: string;
  // UI helpers added at runtime
  displayDifficulty?: string;
  difficultyClass?: string;
  displayCategory?: string;
  categoryClass?: string;
  searchText?: string;
  categoryKey?: string;
  difficultyKey?: string;
};

const WorkoutsPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [difficulty, setDifficulty] = useState<'All' | 'Easy' | 'Medium' | 'Hard'>('All');
  const [categorySort, setCategorySort] = useState<string>('All');
  const [selected, setSelected] = useState<string | null>(null);
  const [myPlan, setMyPlan] = useState<SavedWorkout[]>(() => loadSavedWorkouts());
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  // Map JSON level values to UI difficulty labels
  const mapLevel = (lvl?: string) => {
    if (!lvl) return 'Varies';
    const s = String(lvl).toLowerCase();
    if (s === 'beginner') return 'Easy';
    if (s === 'intermediate') return 'Medium';
    if (s === 'expert' || s === 'advanced') return 'Hard';
    // normalize some alternate shapes
    if (s === 'easy' || s === 'medium' || s === 'moderate' || s === 'hard') {
      if (s === 'moderate') return 'Medium';
      return s.charAt(0).toUpperCase() + s.slice(1);
    }
    return 'Varies';
  };
  const capitalizeWords = (s?: string) => {
    if (!s) return '';
    return String(s).split(/\s+/).map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
  };
  const sanitizeClassName = (s?: string) => {
    if (!s) return 'uncategorized';
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'uncategorized';
  };
  const normalizeCategoryLabel = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const workouts = useMemo(() => {
    // Dynamically import all exercise JSON files under src/data/exercises
    // Using Vite's import.meta.glob with eager option to bundle them.
    const modules = (import.meta as any).glob('../data/exercises/*.json', { eager: true }) as Record<string, any>;
    // Build an assets map for images (bundled URLs)
    const assets = (import.meta as any).glob('../data/exercises/**', { eager: true, as: 'url' }) as Record<string, string>;
    const items: Array<{ title: string } & Workout & Record<string, any>> = Object.entries(modules).map(([path, mod]) => {
      const data = (mod && mod.default) ? mod.default : mod;
      const title = data.name || data.id || path.split('/').pop()?.replace('.json', '') || 'Unknown';
      // Resolve image URLs relative to this module using new URL()
      const images: string[] = Array.isArray(data.images) ? data.images.map((p: string) => {
        // prefer pre-bundled asset URL (exact match)
        const exactKey = `../data/exercises/${p}`;
        if (assets && assets[exactKey]) return assets[exactKey];

        // Robust lookup: try to find any asset key that ends with the image path
        if (assets) {
          const found = Object.entries(assets).find(([k]) => k.endsWith(`/${p}`) || k.endsWith(p));
          if (found) return found[1];
        }

        // fallback: attempt to build a relative URL
        try { return new URL(`../data/exercises/${p}`, import.meta.url).href; } catch (e) { return `/data/exercises/${p}`; }
      }) : [];
      // compute a UI difficulty label based on JSON 'level' or 'difficulty'
      const displayDifficulty = mapLevel(data.level || data.difficulty);
      const difficultyClass = (displayDifficulty || 'Varies').toLowerCase();
      const displayCategory = data.category ? capitalizeWords(data.category) : '';
      const categoryClass = sanitizeClassName(data.category);
      // Normalize and capitalize muscle names so UI can assume consistent casing
      const primaryMuscles = Array.isArray(data.primaryMuscles) ? data.primaryMuscles.map((m: string) => capitalizeWords(String(m))) : [];
      const secondaryMuscles = Array.isArray(data.secondaryMuscles) ? data.secondaryMuscles.map((m: string) => capitalizeWords(String(m))) : [];
      const searchText = [
        title,
        data.exampleNote,
        data.meta?.description,
        primaryMuscles.join(' '),
        secondaryMuscles.join(' '),
        data.displayCategory || data.category,
        Array.isArray(data.instructions) ? data.instructions.join(' ') : ''
      ].filter(Boolean).join(' ').toLowerCase();
      const categoryKey = normalizeCategoryLabel(displayCategory || data.category || 'uncategorized');
      const difficultyKey = (displayDifficulty || '').toLowerCase();

      return { title, ...data, images, displayDifficulty, difficultyClass, displayCategory, categoryClass, primaryMuscles, secondaryMuscles, searchText, categoryKey, difficultyKey };
    });
    // keep deterministic order once to avoid re-sorting during filters
    items.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    return items;
  }, []);

  const getCategoryLabel = (w: Workout & { displayCategory?: string }) => {
    const label = (w.displayCategory && w.displayCategory.trim())
      || (w.category ? capitalizeWords(String(w.category)) : '')
      || 'Uncategorized';
    return label;
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const difficultyKey = difficulty.toLowerCase();
    const categoryKey = normalizeCategoryLabel(categorySort);
    return workouts.filter(w => {
      if (difficulty !== 'All' && w.difficultyKey !== difficultyKey) return false;
      if (categorySort !== 'All' && w.categoryKey !== categoryKey) return false;
      if (!q) return true;
      return (w as any).searchText ? (w as any).searchText.includes(q) : false;
    });
  }, [workouts, query, difficulty, categorySort]);

  const categoryOptions = useMemo(() => {
    const map = new Map<string, string>();
    workouts.forEach(w => {
      const label = getCategoryLabel(w);
      const key = normalizeCategoryLabel(label);
      if (!map.has(key)) map.set(key, label);
    });
    const opts = Array.from(map.values()).sort((a, b) => a.localeCompare(b));
    return ['All', ...opts];
  }, [workouts]);

  React.useEffect(() => {
    const unsubscribe = subscribeSavedWorkouts((list) => setMyPlan(list));
    return unsubscribe;
  }, []);

  const addToPlan = (item: Workout & { title: string }) => {
    setMyPlan(prev => {
      const exists = prev.some(p => p.title === item.title);
      if (exists) {
        setSaveNotice('Already saved to your workouts.');
        return prev;
      }
      const next = persistSavedWorkouts([...prev, sanitizeWorkout(item)]);
      setSaveNotice('Saved to your workouts!');
      try {
        confetti({
          particleCount: 90,
          spread: 65,
          origin: { y: 0.6 }
        });
      } catch {}
      window.setTimeout(() => setSaveNotice(null), 2600);
      return next;
    });
  };

  const removeFromPlan = (title: string) => {
    setMyPlan(prev => {
      const next = prev.filter(p => p.title !== title);
      return persistSavedWorkouts(next);
    });
  };

  const selectedWorkout = selected ? workouts.find(w => w.title === selected) : undefined;

  return (
    <div className="workouts-page">
      <div className="workouts-hero">
        <div className="hero-left">
          <h1>Workout Library</h1>
          <p className="hero-sub">Explore exercises, watch technique videos, and view trusted resources — curated for quick practice.</p>
        </div>
        <div className="hero-right">
          <div className="search-wrap">
            <input
              className="search-input"
              placeholder="Search workouts, muscles, etc."
              value={query}
              onChange={e => setQuery(e.target.value)}
              aria-label="Search workouts"
            />
          </div>
          <div className="filters-row">
            <div className="filters">
              {(['All', 'Easy', 'Medium', 'Hard'] as const).map(d => (
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
            <div className="sort-control">
              <label htmlFor="workout-sort">Sort by category</label>
              <select
                id="workout-sort"
                value={categorySort}
                onChange={e => setCategorySort(e.target.value)}
                aria-label="Sort workouts by category"
              >
                {categoryOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
      {saveNotice && (
        <div className="save-notice" role="status">
          {saveNotice}
        </div>
      )}

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
                    <span className={`difficulty ${w.difficultyClass || 'varies'}`}>{w.displayDifficulty || 'Varies'}</span>
                    {w.displayCategory ? (
                      <span className={`category ${w.categoryClass || ''}`} data-cat={w.displayCategory}>{w.displayCategory}</span>
                    ) : null}
                  </div>
              <p className="card-desc">{w.exampleNote || w.meta?.description?.slice(0,120) || (w.instructions && w.instructions[0]) || 'No description available.'}</p>
              {((Array.isArray(w.primaryMuscles) && w.primaryMuscles.length > 0) || (Array.isArray(w.secondaryMuscles) && w.secondaryMuscles.length > 0)) && (
                <div className="muscle-section">
                  <div className="muscle-header">Muscles Exercised</div>
                  <div className="muscle-list">
                    {Array.isArray(w.primaryMuscles) && w.primaryMuscles.length > 0 && (
                      <span className="muscle-badge primary" title={w.primaryMuscles.join(', ')}>
                        <strong>Primary:</strong>
                        <span className="muscle-text primary-text">{w.primaryMuscles.join(', ')}</span>
                      </span>
                    )}
                    {Array.isArray(w.secondaryMuscles) && w.secondaryMuscles.length > 0 && (
                      <span className="muscle-badge secondary" title={w.secondaryMuscles.join(', ')}>
                        <strong>Secondary:</strong>
                        <span className="muscle-text secondary-text">{w.secondaryMuscles.join(', ')}</span>
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="card-footer">
              <button className="btn-ghost" onClick={(e) => { e.stopPropagation(); setSelected(w.title); }}>View</button>
              <button className="btn-ghost" onClick={(e) => { e.stopPropagation(); addToPlan(w); }}>Save Workout</button>
            </div>
          </article>
        ))}
      </div>

      {selectedWorkout && (
        <WorkoutModal
          title={selectedWorkout.title}
          data={selectedWorkout}
          onClose={() => setSelected(null)}
          onAdd={() => {
            addToPlan(selectedWorkout);
            setSelected(null);
          }}
        />
      )}

      <section className="my-plan-section">
        <header className="my-plan-header">
          <div>
            <h2>Personal Library</h2>
            <p className="hero-sub">Workouts you’ve saved. Click remove to keep it fresh.</p>
          </div>
        </header>
        <div className="workouts-grid">
          {myPlan.length === 0 && <div className="empty">No workouts added yet. Use “Save Workout” above.</div>}
          {myPlan.map(w => (
            <article key={w.title} className="workout-card">
              <div className="card-media">
                {w.images && w.images[0] ? (
                  <img src={w.images[0]} alt={w.imageCaptions?.[0] || w.title} />
                ) : (
                  <div className="media-fallback">{w.title.charAt(0)}</div>
                )}
              </div>
              <div className="card-body">
                <h3 className="card-title">{w.title}</h3>
                <div className="card-meta">
                  <span className={`difficulty ${w.difficultyClass || 'varies'}`}>{w.displayDifficulty || 'Varies'}</span>
                  {w.displayCategory ? (
                    <span className={`category ${w.categoryClass || ''}`} data-cat={w.displayCategory}>{w.displayCategory}</span>
                  ) : null}
                </div>
                <p className="card-desc">{w.exampleNote || w.meta?.description?.slice(0,120) || (w.instructions && w.instructions[0]) || 'No description available.'}</p>
              </div>
              <div className="card-footer">
                <button className="btn-ghost" onClick={() => setSelected(w.title)}>View</button>
                <button className="btn-ghost danger" onClick={() => removeFromPlan(w.title)}>Remove</button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};

function WorkoutModal({ title, data, onClose, onAdd }: { title: string; data: Workout; onClose: () => void; onAdd?: () => void }) {
  return (
    <div className="workouts-modal-overlay" role="dialog" aria-modal="true" aria-label={`${title} details`}>
      <div className="workouts-modal">
        <header className="modal-head">
          <div>
            <h2>{title}</h2>
            <div className="meta-row">
              <span className={`difficulty ${(data as any).difficultyClass || ''}`}>{(data as any).displayDifficulty || data.difficulty || 'Varies'}</span>
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
            ) : data.images && data.images.length > 0 ? (
              <div className="gallery">
                {data.images.map((src, i) => (
                  <img key={i} src={src} alt={data.imageCaptions?.[i] || `${title} ${i+1}`} />
                ))}
              </div>
            ) : (
              <div className="media-fallback large">{title.charAt(0)}</div>
            )}
          </div>

          <div className="modal-info">
            <p className="long-desc">{data.meta?.description || data.exampleNote}</p>

            <section className="details">
              <div><strong>ID:</strong> {data.id || '—'}</div>
              <div><strong>Force:</strong> {String(data.force ?? '—')}</div>
              <div><strong>Level:</strong> {data.level || '—'}</div>
              <div><strong>Mechanic:</strong> {data.mechanic || '—'}</div>
              <div><strong>Equipment:</strong> {Array.isArray(data.equipment) ? data.equipment.join(', ') : data.equipment || '—'}</div>
              <div><strong>Category:</strong> {data.category ? (
                <span className={`category ${(data as any).categoryClass || ''}`} data-cat={(data as any).displayCategory || data.category}>{(data as any).displayCategory || data.category}</span>
              ) : '—'}</div>
            </section>

            {Array.isArray(data.instructions) && data.instructions.length > 0 && (
              <section className="instructions">
                <h4>Instructions</h4>
                <ol>
                  {data.instructions.map((ins, idx) => <li key={idx}>{ins}</li>)}
                </ol>
              </section>
            )}

            <div className="muscle-grid">
              {((Array.isArray(data.primaryMuscles) && data.primaryMuscles.length > 0) || (Array.isArray(data.secondaryMuscles) && data.secondaryMuscles.length > 0)) && (
                <div className="muscle-section modal">
                  <div className="muscle-header">Muscles Exercised</div>
                  <div className="muscle-list">
                    {Array.isArray(data.primaryMuscles) && (
                      <div className="muscle-col">
                        <strong>Primary Muscles</strong>
                        <div>
                          <span className="muscle-badge primary" title={data.primaryMuscles.join(', ')}>
                            <span className="muscle-text primary-text">{data.primaryMuscles.join(', ')}</span>
                          </span>
                        </div>
                      </div>
                    )}
                    {Array.isArray(data.secondaryMuscles) && (
                      <div className="muscle-col">
                        <strong>Secondary Muscles</strong>
                        <div>
                          <span className="muscle-badge secondary" title={data.secondaryMuscles.join(', ')}>
                            <span className="muscle-text secondary-text">{data.secondaryMuscles.join(', ')}</span>
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

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
          <button className="btn-primary" onClick={onAdd}>Save Workout</button>
          <button className="btn-outline" onClick={onClose}>Close</button>
        </footer>
      </div>
    </div>
  );
}

export default WorkoutsPage;
