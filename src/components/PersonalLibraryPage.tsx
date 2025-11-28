import React from 'react';
import './WorkoutsPage.css';
import {
  loadSavedWorkouts,
  persistSavedWorkouts,
  subscribeSavedWorkouts,
  SavedWorkout
} from '../utils/savedLibrary';

const PersonalLibraryPage: React.FC = () => {
  const [myPlan, setMyPlan] = React.useState<SavedWorkout[]>([]);

  const loadSavedLibrary = () => {
    setMyPlan(loadSavedWorkouts());
  };

  React.useEffect(() => {
    loadSavedLibrary();
    const unsubscribe = subscribeSavedWorkouts((list) => setMyPlan(list));
    return unsubscribe;
  }, []);

  React.useEffect(() => {
    persistSavedWorkouts(myPlan);
  }, [myPlan]);

  const removeFromPlan = (title: string) => {
    setMyPlan(prev => {
      const next = prev.filter(p => p.title !== title);
      return persistSavedWorkouts(next);
    });
  };

  return (
    <div className="workouts-page">
      <div className="workouts-hero">
        <div className="hero-left">
          <h1>Saved Workouts</h1>
          <p className="hero-sub">Workouts you’ve saved from the library.</p>
        </div>
      </div>

      <section className="my-plan-section">
        <header className="my-plan-header">
          <div>
            <h2>My Saved Workouts</h2>
            <p className="hero-sub">Remove items to keep your list curated.</p>
          </div>
        </header>
        <div className="workouts-grid">
          {myPlan.length === 0 && <div className="empty">No workouts saved yet. Head to the Workout Library to save some.</div>}
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
                  <span className={`difficulty ${w.difficultyClass || 'varies'}`}>{w.displayDifficulty || w.difficulty || 'Varies'}</span>
                  {w.displayCategory ? (
                    <span className={`category ${w.categoryClass || ''}`} data-cat={w.displayCategory}>{w.displayCategory}</span>
                  ) : null}
                </div>
                <p className="card-desc">{w.exampleNote || w.meta?.description?.slice(0,120) || 'No description available.'}</p>
              </div>
              <div className="card-footer">
                <button className="btn-ghost danger" onClick={() => removeFromPlan(w.title)}>Remove</button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};

export default PersonalLibraryPage;
