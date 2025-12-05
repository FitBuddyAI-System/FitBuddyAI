import React, { useMemo, useState } from 'react';
import './WorkoutsPage.css';
import BackgroundDots from './BackgroundDots';
// savedLibrary types unused here; using saved-names storage for saved list
import { loadSavedNames, addSavedName, subscribeSavedNames, persistSavedNames, removeSavedName } from '../utils/savedNames';
import { loadAssessmentData } from '../services/localStorage';
import { Workout, getAllWorkouts, getCategoryOptions, getCategoryBuckets } from '../services/workoutLibrary';
import { pickWorkoutsFromAssessment } from '../services/assessmentWorkouts';
import confetti from 'canvas-confetti';

const workouts = getAllWorkouts();
const categoryOptions = getCategoryOptions();
const categoryBuckets = getCategoryBuckets();

const ITEMS_PER_BATCH = 18;
const INITIAL_BATCHES = 5;
const INITIAL_VISIBLE_COUNT = ITEMS_PER_BATCH * INITIAL_BATCHES;

const normalizeCategoryLabel = (value: string) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'all';

const WorkoutsPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [difficulty, setDifficulty] = useState<'All' | 'Easy' | 'Medium' | 'Hard'>('All');
  const [categorySort, setCategorySort] = useState<string>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [mySavedNames, setMySavedNames] = useState<string[]>(() => loadSavedNames());
  const [aiSaving, setAiSaving] = useState(false);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const notify = (opts: { title?: string; message: string; variant?: 'info' | 'success' | 'warning' | 'error' }) => {
    window.showFitBuddyNotification?.({
      durationMs: 3600,
      ...opts
    });
  };

  const removeFromPlan = (item: Workout & { title: string }) => {
    setMySavedNames(prev => {
      if (!prev.includes(item.title)) {
        notify({ title: 'Not Saved', message: 'That workout is not in your saved list.', variant: 'warning' });
        return prev;
      }
      const next = removeSavedName(item.title);
      notify({ title: 'Removed', message: 'Removed from your workouts.', variant: 'info' });
      return next;
    });
  };

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

  const loadMoreRef = React.useRef<HTMLDivElement | null>(null);
  const visibleCountRef = React.useRef(visibleCount);
  const loadingRef = React.useRef(isLoadingMore);
  const filteredLengthRef = React.useRef(filtered.length);
  const loadTimerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (loadTimerRef.current) {
      window.clearTimeout(loadTimerRef.current);
      loadTimerRef.current = null;
    }
    setVisibleCount(Math.min(filtered.length, INITIAL_VISIBLE_COUNT));
    setIsLoadingMore(false);
  }, [filtered]);

  React.useEffect(() => { visibleCountRef.current = visibleCount; }, [visibleCount]);
  React.useEffect(() => { loadingRef.current = isLoadingMore; }, [isLoadingMore]);
  React.useEffect(() => { filteredLengthRef.current = filtered.length; }, [filtered.length]);

  React.useEffect(() => {
    const trigger = loadMoreRef.current;
    if (!trigger) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        if (loadingRef.current) return;
        if (visibleCountRef.current >= filteredLengthRef.current) return;
        setIsLoadingMore(true);
        loadTimerRef.current = window.setTimeout(() => {
          setVisibleCount((prev) => Math.min(prev + ITEMS_PER_BATCH, filteredLengthRef.current));
          setIsLoadingMore(false);
          loadTimerRef.current = null;
        }, 420);
      });
    }, { rootMargin: '160px' });
    observer.observe(trigger);
    return () => {
      observer.disconnect();
      if (loadTimerRef.current) {
        window.clearTimeout(loadTimerRef.current);
        loadTimerRef.current = null;
      }
    };
  }, []);

  React.useEffect(() => {
    const unsub = subscribeSavedNames((list) => setMySavedNames(list));
    return unsub;
  }, []);

  const addToPlan = (item: Workout & { title: string }) => {
    setMySavedNames(prev => {
      if (prev.includes(item.title)) {
        notify({ title: 'Already Saved', message: 'That workout is already in your list.', variant: 'info' });
        return prev;
      }
      const next = addSavedName(item.title);
      notify({ title: 'Workout Saved', message: 'Saved to your workouts!', variant: 'success' });
      confetti({
        particleCount: 110,
        spread: 80,
        origin: { y: 0.45 },
        zIndex: 9999,
      });
      return next;
    });
  };

  const visibleWorkouts = filtered.slice(0, Math.min(visibleCount, filtered.length));

  const selectedWorkout = selected ? workouts.find(w => w.title === selected) : undefined;

  const saveFromAssessment = () => {
    try {
      const assessment = loadAssessmentData();
      if (!assessment) {
        notify({ title: 'Assessment Needed', message: 'Complete the assessment first to let AI save workouts for you.', variant: 'warning' });
        return;
      }
      setAiSaving(true);
      window.setTimeout(() => {
        const picks = pickWorkoutsFromAssessment(assessment);
        let added = 0;
        setMySavedNames(prev => {
          const next = [...prev];
          picks.forEach(p => {
            if (!next.includes(p.title)) {
              next.push(p.title);
              added += 1;
            }
          });
          try { persistSavedNames(next); } catch (e) {}
          return next;
        });
        if (added > 0) {
          confetti({
            particleCount: 120,
            spread: 90,
            origin: { y: 0.4 },
            zIndex: 9999,
          });
          notify({ title: 'Workouts Saved', message: `Saved ${added} workouts from your assessment.`, variant: 'success' });
        } else {
          notify({ title: 'No New Workouts', message: 'Those workouts are already saved.', variant: 'info' });
        }
        setAiSaving(false);
      }, 120);
    } catch (err) {
      console.warn('AI save failed', err);
      notify({ title: 'Save Failed', message: 'Could not save workouts. Try again.', variant: 'error' });
      setAiSaving(false);
    }
  };

  return (
    <div className="page-with-dots">
      <BackgroundDots />
      <div className="workouts-page">
        <div className="workouts-hero">
          <h1>
            Workout Library
            <span className="saved-count" aria-hidden="true"> ({mySavedNames.length} saved)</span>
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

      <div className="workouts-grid">
        {filtered.length === 0 && (
          <div className="empty">No workouts found. Try a different search.</div>
        )}

        {visibleWorkouts.map(w => (
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
              {mySavedNames.includes(w.title) ? (
                <button className="btn-ghost danger" onClick={(e) => { e.stopPropagation(); removeFromPlan(w); }}>Remove</button>
              ) : (
                <button className="btn-ghost" onClick={(e) => { e.stopPropagation(); addToPlan(w); }}>Save Workout</button>
              )}
            </div>
          </article>
        ))}
      </div>

      <div className="workouts-grid-footer">
        <div ref={loadMoreRef} className="load-more-trigger" aria-hidden="true" />
        {isLoadingMore && (
          <div className="loading-indicator" role="status">
            <span className="spinner" aria-hidden="true" />
            Loading more workouts…
          </div>
        )}
      </div>

      {selectedWorkout && (
        <WorkoutModal
          title={selectedWorkout.title}
          data={selectedWorkout}
          onClose={() => setSelected(null)}
          isSaved={mySavedNames.includes(selectedWorkout.title)}
          onAdd={() => {
            if (mySavedNames.includes(selectedWorkout.title)) {
              removeFromPlan(selectedWorkout);
            } else {
              addToPlan(selectedWorkout);
            }
            setSelected(null);
          }}
        />
      )}
    </div>
  </div>
  );
};

function WorkoutModal({ title, data, onClose, onAdd, isSaved }: { title: string; data: Workout; onClose: () => void; onAdd?: () => void; isSaved?: boolean }) {
  const formatDetailValue = (val: any) => {
    if (val === undefined || val === null) return '—';
    const text = Array.isArray(val) ? val.filter(Boolean).join(', ') : String(val);
    if (!text.trim()) return '—';
    return text.split(/[\s,_]+/).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
  };

  const categoryLabel = (data as any).displayCategory || data.category || '';
  const categoryClass = (data as any).categoryClass || '';

  const detailChips = [
    { key: 'force', label: 'Force', value: formatDetailValue(data.force) },
    { key: 'mechanic', label: 'Mechanic', value: formatDetailValue(data.mechanic) },
    { key: 'equipment', label: 'Equipment', value: formatDetailValue(Array.isArray(data.equipment) ? data.equipment.join(', ') : data.equipment) }
  ].filter(chip => chip.value !== '—');

  return (
    <div className="workouts-modal-overlay" role="dialog" aria-modal="true" aria-label={`${title} details`}>
      <div className="workouts-modal">
        <header className="modal-head">
          <div>
            <h2>{title}</h2>
            <div className="meta-row">
              <span className={`difficulty ${(data as any).difficultyClass || ''}`}>{(data as any).displayDifficulty || data.difficulty || 'Varies'}</span>
              {categoryLabel ? (
                <span className={`category-chip ${categoryClass || ''}`}>
                  <span className="chip-dot" aria-hidden />
                  <span className="chip-value">{categoryLabel}</span>
                </span>
              ) : null}
              {data.duration ? (
                <span className="meta-chip duration-chip">
                  <strong>Time</strong>
                  <span className="chip-value">{data.duration}</span>
                </span>
              ) : null}
              <div className="meta-chip-group">
                {detailChips.map(chip => (
                  <span key={chip.key} className="meta-chip">
                    <strong>{chip.label}</strong>
                    <span className="chip-value">{chip.value}</span>
                  </span>
                ))}
              </div>
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

            {Array.isArray(data.instructions) && data.instructions.length > 0 && (
              <section className="instructions">
                <h4>Instructions</h4>
                <ol>
                  {data.instructions.map((ins, idx) => (
                    <li key={idx}>{ins}</li>
                  ))}
                </ol>
              </section>
            )}

            <div className="muscle-grid">
              {((Array.isArray(data.primaryMuscles) && data.primaryMuscles.length > 0) ||
                (Array.isArray(data.secondaryMuscles) && data.secondaryMuscles.length > 0)) && (
                <div className="muscle-section modal">
                  <div className="muscle-header">Muscles Exercised</div>
                  <div className="muscle-list">
                    {Array.isArray(data.primaryMuscles) && data.primaryMuscles.length > 0 && (
                      <div className="muscle-col">
                        <strong>Primary Muscles</strong>
                        <div>
                          <span className="muscle-badge primary" title={data.primaryMuscles.join(', ')}>
                            <span className="muscle-text primary-text">
                              {data.primaryMuscles.join(', ')}
                            </span>
                          </span>
                        </div>
                      </div>
                    )}
                    {Array.isArray(data.secondaryMuscles) && data.secondaryMuscles.length > 0 && (
                      <div className="muscle-col">
                        <strong>Secondary Muscles</strong>
                        <div>
                          <span className="muscle-badge secondary" title={data.secondaryMuscles.join(', ')}>
                            <span className="muscle-text secondary-text">
                              {data.secondaryMuscles.join(', ')}
                            </span>
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
          <button className={isSaved ? 'btn-ghost danger' : 'btn-primary'} onClick={onAdd}>{isSaved ? 'Remove Workout' : 'Save Workout'}</button>
          <button className="btn-outline" onClick={onClose}>Close</button>
        </footer>
      </div>
    </div>
  );
}

export default WorkoutsPage;
