import React, { useMemo, useState } from 'react';
import './WorkoutsPage.css';
import { loadAssessmentData } from '../services/localStorage';
import confetti from 'canvas-confetti';

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
};

const WorkoutsPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [difficulty, setDifficulty] = useState<'All' | 'Easy' | 'Medium' | 'Hard'>('All');
  const [categorySort, setCategorySort] = useState<string>('All');
  const [selected, setSelected] = useState<string | null>(null);
  const [myPlan, setMyPlan] = useState<Array<{ title: string; id: string } & Workout>>([]);
  const [aiAdding, setAiAdding] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);

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
  const normalizeCategoryLabel = (s: string) => {
    return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
  };
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

      return { title, ...data, images, displayDifficulty, difficultyClass, displayCategory, categoryClass, primaryMuscles, secondaryMuscles };
    });
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
    const normCategory = normalizeCategoryLabel(categorySort);
    const normDifficulty = difficulty.toLowerCase();
    return workouts.filter(w => {
      if (difficulty !== 'All') {
        const d = (w.displayDifficulty || '').toLowerCase();
        if (d !== normDifficulty) return false;
      }
      if (categorySort !== 'All') {
        const catLabel = getCategoryLabel(w);
        if (normalizeCategoryLabel(catLabel) !== normCategory) return false;
      }
      if (!q) return true;

      const hay = `${w.title || ''} ${w.exampleNote || ''} ${w.meta?.description || ''} ${(w.primaryMuscles || []).join(' ')} ${(w.secondaryMuscles || []).join(' ')} ${(w as any).displayCategory || ''} ${w.category || ''} ${(Array.isArray(w.instructions) ? w.instructions.join(' ') : '')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [workouts, query, difficulty, categorySort]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    // Always keep alphabetical for stability
    list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    return list;
  }, [filtered]);

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

  // My Plan persistence
  const PLAN_KEY = 'fitbuddyai_my_plan';
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(PLAN_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setMyPlan(parsed);
      }
    } catch (e) { /* ignore */ }
  }, []);

  React.useEffect(() => {
    try { localStorage.setItem(PLAN_KEY, JSON.stringify(myPlan)); } catch (e) { /* ignore */ }
  }, [myPlan]);

  const addToPlan = (item: Workout & { title: string }) => {
    setMyPlan(prev => {
      const exists = prev.some(p => p.title === item.title);
      if (exists) return prev;
      const next = [...prev, { ...item, id: item.id || item.title }];
      return next;
    });
  };

  const removeFromPlan = (title: string) => {
    setMyPlan(prev => prev.filter(p => p.title !== title));
  };

  const pickAiPlan = () => {
    setAiAdding(true);
    setAiMessage(null);
    setTimeout(() => {
      try {
        const assessment = loadAssessmentData() || {};
        const prefs: string[] = Array.isArray(assessment.preferences) ? assessment.preferences.map((p: string) => String(p).toLowerCase()) : [];
        const targetCats = new Set<string>();
        prefs.forEach(p => {
          if (p.includes('strength')) targetCats.add('strength training');
          if (p.includes('cardio')) targetCats.add('cardio');
          if (p.includes('yoga') || p.includes('stretch')) targetCats.add('stretching');
          if (p.includes('hiit')) targetCats.add('hiit');
          if (p.includes('bodyweight')) targetCats.add('bodyweight');
        });

        const scored = sorted.map(w => {
          const cat = (w.displayCategory || '').toLowerCase();
          let score = 0;
          if (targetCats.size === 0) score += 1;
          if (targetCats.has(cat)) score += 3;
          if (prefs.some(p => (w.title || '').toLowerCase().includes(p))) score += 2;
          if (Array.isArray(w.primaryMuscles) && prefs.some(p => w.primaryMuscles.some(m => String(m).toLowerCase().includes(p)))) score += 1;
          return { w, score };
        });

        scored.sort((a, b) => b.score - a.score || (a.w.title || '').localeCompare(b.w.title || ''));
        const chosen = scored
          .map(s => s.w)
          .filter(w => !myPlan.some(p => p.title === w.title))
          .slice(0, 8);

        if (chosen.length === 0) {
          setAiMessage('Nothing new to add yet. Try adding more variety from the library.');
        } else {
          chosen.forEach(w => addToPlan(w as any));
          setAiMessage(`Added ${chosen.length} workout${chosen.length === 1 ? '' : 's'} based on your assessment.`);
        }
      } catch (e) {
        setAiMessage('Could not add workouts automatically. Please try again.');
      } finally {
        setAiAdding(false);
      }
    }, 120);
  };

  return (
    <div className="workouts-page">
      <div className="workouts-hero">
        <div className="hero-left">
          <h1>Workouts Library</h1>
          <p className="hero-sub">Explore exercises, watch technique videos, and view trusted resources — curated for quick practice.</p>
        </div>
        <div className="hero-right">
          <button
            className="btn-ghost add ai-plan-btn"
            onClick={pickAiPlan}
            disabled={aiAdding}
          >
            {aiAdding ? 'Adding...' : 'Have AI add workouts to your plan based on assessment responses'}
          </button>
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

      {aiMessage && <div className="ai-plan-message">{aiMessage}</div>}

      <div className="workouts-grid">
        {sorted.length === 0 && (
          <div className="empty">No workouts found. Try a different search.</div>
        )}

        {sorted.map(w => (
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
            </div>
            <div className="card-footer">
              <button className="btn-ghost" onClick={(e) => { e.stopPropagation(); setSelected(w.title); }}>View</button>
              <button
                className="btn-ghost add"
                onClick={(e) => { e.stopPropagation(); addToPlan(w as any); }}
              >
                Add to My Plan
              </button>
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
          onAddToPlan={(item) => {
            addToPlan(item as any);
            confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
            alert('Workout added to your plan');
            window.location.href = '/my-plan';
          }}
        />
      )}

      <section className="my-plan-section" id="my-plan">
        <header className="my-plan-header">
          <div>
            <h2>My Plan</h2>
            <p className="hero-sub">Workouts you’ve saved. Click remove to keep it fresh.</p>
          </div>
        </header>
        <div className="workouts-grid">
          {myPlan.length === 0 && <div className="empty">No workouts added yet. Use “Add to My Plan” above.</div>}
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

function WorkoutModal({ title, data, onClose, onAddToPlan }: { title: string; data: Workout; onClose: () => void; onAddToPlan: (item: Workout) => void }) {
  return (
    <div className="workouts-modal-overlay" role="dialog" aria-modal="true" aria-label={`${title} details`}>
      <div className="workouts-modal">
        <header className="modal-head">
          <div>
            <h2>{title}</h2>
            <div className="meta-row">
              <span className={`difficulty ${(data as any).difficultyClass || ''}`}>{(data as any).displayDifficulty || data.difficulty || 'Varies'}</span>
              <span className="pill meta-pill level">{data.level || 'N/A'}</span>
              <span className="pill meta-pill force">{data.force ? String(data.force) : 'N/A'}</span>
              <span className="pill meta-pill mechanic">{data.mechanic ? String(data.mechanic) : 'N/A'}</span>
              <span className="pill meta-pill category-pill">{(data as any).displayCategory || data.category || 'N/A'}</span>
              <span className="pill meta-pill equipment">{Array.isArray(data.equipment) ? (data.equipment.join(', ') || 'N/A') : (data.equipment || 'N/A')}</span>
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
            <div className="info-card">
              {Array.isArray(data.instructions) && data.instructions.length > 0 && (
                <section className="instructions">
                  <h4>Instructions</h4>
                  <ol>
                    {data.instructions.map((ins, idx) => <li key={idx}>{ins}</li>)}
                  </ol>
                </section>
              )}
              {(data.meta?.description || data.exampleNote) && (
                <section className="description-card">
                  <h4>Description</h4>
                  <p className="long-desc">{data.meta?.description || data.exampleNote}</p>
                </section>
              )}
            </div>

            <div className="muscle-grid">
              <div className="muscle-section modal">
                <div className="muscle-list split">
                  <div className="muscle-col pane">
                    <strong>Primary Muscles</strong>
                    <div className="muscle-badge primary" title={Array.isArray(data.primaryMuscles) && data.primaryMuscles.length ? data.primaryMuscles.join(', ') : 'N/A'}>
                      <span className="muscle-text primary-text">
                        {Array.isArray(data.primaryMuscles) && data.primaryMuscles.length ? data.primaryMuscles.join(', ') : 'N/A'}
                      </span>
                    </div>
                  </div>
                  <div className="muscle-col pane">
                    <strong>Secondary Muscles</strong>
                    <div className="muscle-badge secondary" title={Array.isArray(data.secondaryMuscles) && data.secondaryMuscles.length ? data.secondaryMuscles.join(', ') : 'N/A'}>
                      <span className="muscle-text secondary-text">
                        {Array.isArray(data.secondaryMuscles) && data.secondaryMuscles.length ? data.secondaryMuscles.join(', ') : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
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
          <button className="btn-primary" onClick={() => onAddToPlan(data)}>Add to Plan</button>
          <button className="btn-outline" onClick={onClose}>Close</button>
        </footer>
      </div>
    </div>
  );
}

export default WorkoutsPage;
