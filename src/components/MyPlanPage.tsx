import React, { useEffect, useState } from 'react';
import './WorkoutsPage.css';

type PlanWorkout = {
  title: string;
  id?: string;
  images?: string[];
  imageCaptions?: string[];
  displayDifficulty?: string;
  difficultyClass?: string;
  displayCategory?: string;
  categoryClass?: string;
  exampleNote?: string;
  meta?: { description?: string };
  instructions?: string[];
};

const PLAN_KEY = 'fitbuddyai_my_plan';

const MyPlanPage: React.FC = () => {
  const [plan, setPlan] = useState<PlanWorkout[]>([]);

  useEffect(() => {
    const load = () => {
      try {
        const saved = localStorage.getItem(PLAN_KEY);
        if (!saved) {
          setPlan([]);
          return;
        }
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setPlan(parsed);
      } catch (e) {
        setPlan([]);
      }
    };
    load();
    const onStorage = (e: StorageEvent) => {
      if (e.key === PLAN_KEY) load();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const removeFromPlan = (title: string) => {
    setPlan(prev => {
      const next = prev.filter(p => p.title !== title);
      try { localStorage.setItem(PLAN_KEY, JSON.stringify(next)); } catch (e) { /* ignore */ }
      return next;
    });
  };

  return (
    <div className="workouts-page">
      <div className="workouts-hero">
        <div className="hero-left">
          <h1>My Plan</h1>
          <p className="hero-sub">Workouts you’ve saved from the library. Remove items to keep it focused.</p>
        </div>
        <div className="hero-right">
          <div className="sort-control">
            <span>Added items: {plan.length}</span>
          </div>
        </div>
      </div>

      <div className="workouts-grid">
        {plan.length === 0 && (
          <div className="empty">
            No workouts in your plan yet. Head to the library and tap “Add to My Plan.”
          </div>
        )}

        {plan.map(w => (
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
            </div>
            <div className="card-footer">
              <button className="btn-ghost danger" onClick={() => removeFromPlan(w.title)}>Remove</button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};

export default MyPlanPage;
