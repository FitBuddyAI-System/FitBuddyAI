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
import { loadAssessmentData } from '../services/localStorage';

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
  const [categorySort, setCategorySort] = useState<string>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [myPlan, setMyPlan] = useState<SavedWorkout[]>(() => loadSavedWorkouts());
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [aiSaving, setAiSaving] = useState(false);

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
  const { workouts, categoryOptions, categoryBuckets } = useMemo(() => {
    // Dynamically import all exercise JSON files under src/data/exercises
    // Using Vite's import.meta.glob with eager option to bundle them.
    const modules = (import.meta as any).glob('../data/exercises/*.json', { eager: true }) as Record<string, any>;
    // Build an assets map for images (bundled URLs)
    const assets = (import.meta as any).glob('../data/exercises/**', { eager: true, as: 'url' }) as Record<string, string>;
    const categoryMap = new Map<string, string>();
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
      const categoryLabel = (displayCategory && displayCategory.trim())
        || (data.category ? capitalizeWords(String(data.category)) : 'Uncategorized');
      const categoryKey = normalizeCategoryLabel(displayCategory || data.category || 'Uncategorized');
      if (!categoryMap.has(categoryKey)) categoryMap.set(categoryKey, categoryLabel);
      const difficultyKey = (displayDifficulty || '').toLowerCase();

      return { title, ...data, images, displayDifficulty, difficultyClass, displayCategory, categoryClass, primaryMuscles, secondaryMuscles, searchText, categoryKey, difficultyKey };
    });
    // keep deterministic order once to avoid re-sorting during filters
    items.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    // build buckets after items are sorted so intra-category order is stable
    const categoryBuckets = new Map<string, typeof items>();
    items.forEach((item) => {
      const key = item.categoryKey || 'uncategorized';
      if (!categoryBuckets.has(key)) categoryBuckets.set(key, []);
      categoryBuckets.get(key)!.push(item);
    });
    const categoryEntries = Array.from(categoryMap.entries()).map(([key, label]) => ({ key, label }));
    categoryEntries.sort((a, b) => a.label.localeCompare(b.label));
    const categoryOptions = [{ key: 'all', label: 'All' }, ...categoryEntries];
    return { workouts: items, categoryOptions, categoryBuckets };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const difficultyKey = difficulty.toLowerCase();
    const categoryKey = categorySort;
    const baseList = categoryKey === 'all' ? workouts : (categoryBuckets.get(categoryKey) || workouts);
    return baseList.filter(w => {
      if (difficulty !== 'All' && w.difficultyKey !== difficultyKey) return false;
      if (!q) return true;
      return (w as any).searchText ? (w as any).searchText.includes(q) : false;
    });
  }, [workouts, categoryBuckets, query, difficulty, categorySort]);

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

  // removeFromPlan was intentionally removed because it was not referenced anywhere in this component.

  const selectedWorkout = selected ? workouts.find(w => w.title === selected) : undefined;

  const pickWorkoutsFromAssessment = (assessment: any) => {
    if (!assessment) return [];
    const goalRaw = String(assessment.goal || assessment.primaryGoal || assessment.motivation || '').toLowerCase();
    const focusRaw = assessment.focusAreas || assessment.targetMuscles || assessment.primaryMuscles || assessment.focus || [];
    const focusTerms: string[] = Array.isArray(focusRaw)
      ? focusRaw.map((f: any) => String(f).toLowerCase())
      : String(focusRaw).split(/[,/]/).map((s: string) => s.trim().toLowerCase()).filter(Boolean);
    const goalToCategory = () => {
      if (goalRaw.includes('strength') || goalRaw.includes('muscle')) return 'strength';
      if (goalRaw.includes('stretch') || goalRaw.includes('flex') || goalRaw.includes('mobility')) return 'stretching';
      if (goalRaw.includes('cardio') || goalRaw.includes('endurance')) return 'cardio';
      if (goalRaw.includes('power')) return 'powerlifting';
      return '';
    };
    const goalKey = goalToCategory();

    const scored = workouts.map(w => {
      let score = 0;
      if (goalKey && (w.categoryKey === goalKey || (w.categoryKey || '').includes(goalKey))) score += 3;
      if (focusTerms.length) {
        const muscles = [...(w.primaryMuscles || []), ...(w.secondaryMuscles || [])].map(m => m.toLowerCase());
        focusTerms.forEach(term => {
          if (muscles.some(m => m.includes(term))) score += 2;
        });
      }
      // Prefer matching difficulty if present on assessment
      const assessLevel = assessment.level || assessment.experience || assessment.experienceLevel;
      if (assessLevel) {
        const assessKey = mapLevel(assessLevel).toLowerCase();
        if (assessKey && w.difficultyKey === assessKey) score += 1;
      }
      return { w, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 8).map(s => s.w).filter(Boolean);
    if (top.length > 0) return top;
    return workouts.slice(0, 6);
  };

  const saveFromAssessment = () => {
    try {
      const assessment = loadAssessmentData();
      if (!assessment) {
        setSaveNotice('Complete the assessment first to let AI save workouts for you.');
        return;
      }
      setAiSaving(true);
      window.setTimeout(() => {
        const picks = pickWorkoutsFromAssessment(assessment);
        let added = 0;
        setMyPlan(prev => {
          const next = [...prev];
          picks.forEach(p => {
            if (!next.some(n => n.title === p.title)) {
              next.push(sanitizeWorkout(p));
              added += 1;
            }
          });
          return persistSavedWorkouts(next);
        });
        setSaveNotice(added > 0 ? `Saved ${added} workouts from your assessment.` : 'Those workouts are already saved.');
        setAiSaving(false);
      }, 120);
    } catch (err) {
      console.warn('AI save failed', err);
      setSaveNotice('Could not save workouts. Try again.');
      setAiSaving(false);
    }
  };

  return (
    <div className="workouts-page">
      <div className="workouts-hero">
        <div className="hero-left">
          <h1>
            Workout Library
            <span className="saved-count" aria-hidden="true"> ({myPlan.length} saved)</span>
          </h1>
          <p className="hero-sub">Explore exercises, watch technique videos, and view trusted resources — curated for quick practice.</p>
          <div className="ai-save-row">
            <button className="btn-primary ai-save-btn" onClick={saveFromAssessment} disabled={aiSaving}>
              {aiSaving ? 'Saving from assessment…' : 'AI: Save for Me'}
            </button>
            <span className="ai-save-hint">Uses your assessment responses to pick workouts automatically.</span>
          </div>
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
                onChange={e => setCategorySort(normalizeCategoryLabel(e.target.value) || 'all')}
                aria-label="Sort workouts by category"
              >
                {categoryOptions.map(opt => (
                  <option key={opt.key} value={opt.key}>{opt.label}</option>
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
