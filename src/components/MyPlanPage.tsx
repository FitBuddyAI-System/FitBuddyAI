import React, { useEffect, useState } from 'react';
import './WorkoutsPage.css';
import {
  loadSavedWorkouts,
  subscribeSavedWorkouts,
  persistSavedWorkouts,
  SavedWorkout
} from '../utils/savedLibrary';

const MyPlanPage: React.FC = () => {
  const [plan, setPlan] = useState<SavedWorkout[]>(() => loadSavedWorkouts());

  useEffect(() => {
    const unsubscribe = subscribeSavedWorkouts(setPlan);
    return unsubscribe;
  }, []);

  const removeFromPlan = (title: string) => {
    setPlan(prev => {
      const next = prev.filter(p => p.title !== title);
      return persistSavedWorkouts(next);
    });
  };

  const clearAll = () => {
    setPlan(persistSavedWorkouts([]));
  };

  return (
    <div className="saved-library-page">
      <div className="saved-hero">
        <div>
          <p className="eyebrow">Personal Library</p>
          <h1>Saved Workouts</h1>
          <p className="hero-sub">Anything you tap “Save” on in the library lands here. Keep your short list tidy.</p>
        </div>
        <div className="saved-controls">
          <span className="saved-count-pill">{plan.length} saved</span>
          <a className="btn-ghost" href="/workouts">Back to Library</a>
          <button className="btn-ghost danger" onClick={clearAll} disabled={plan.length === 0}>Clear all</button>
        </div>
      </div>

      {plan.length === 0 ? (
        <div className="saved-empty">
          <div className="saved-empty-illustration" aria-hidden>
            <svg width="88" height="88" viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="18" height="14" rx="3" fill="#f3fbf6" stroke="#1ecb7b" strokeWidth="1.4"/><path d="M7 10h10M7 13h6" stroke="#1e90cb" strokeWidth="1.4" strokeLinecap="round"/></svg>
          </div>
          <p>No saved workouts yet.</p>
          <p className="saved-empty-sub">Browse the workout library and tap “Save Workout” to build your list.</p>
          <a className="btn-primary" href="/workouts">Find workouts</a>
        </div>
      ) : (
        <div className="saved-grid">
          {plan.map(w => (
            <article key={w.title} className="saved-card">
              <div className="saved-card-header">
                <div>
                  <p className="eyebrow">Workout</p>
                  <h3>{w.title}</h3>
                </div>
                <div className="saved-chip-row">
                  <span className={`difficulty ${w.difficultyClass || 'varies'}`}>{w.displayDifficulty || 'Varies'}</span>
                  {w.displayCategory ? (
                    <span className={`category ${w.categoryClass || ''}`} data-cat={w.displayCategory}>{w.displayCategory}</span>
                  ) : null}
                </div>
              </div>

              <div className="saved-card-body">
                {w.images && w.images[0] ? (
                  <div className="saved-thumb">
                    <img src={w.images[0]} alt={w.imageCaptions?.[0] || w.title} />
                  </div>
                ) : (
                  <div className="saved-thumb fallback">{w.title.charAt(0)}</div>
                )}
                <div className="saved-text">
                  <p className="saved-desc">{w.meta?.description || w.exampleNote || 'Saved from the library.'}</p>
                  {Array.isArray(w.instructions) && w.instructions.length > 0 ? (
                    <p className="saved-instructions"><strong>Key step:</strong> {w.instructions[0]}</p>
                  ) : null}
                </div>
              </div>

              <div className="saved-card-actions">
                <a className="btn-outline" href="/workouts">View in Library</a>
                <button className="btn-ghost danger" onClick={() => removeFromPlan(w.title)}>Remove</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyPlanPage;
