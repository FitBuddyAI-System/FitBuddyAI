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

  const savedCountCopy = myPlan.length === 1 ? '1 saved workout' : `${myPlan.length} saved workouts`;
  const emptyCopy = 'Nothing saved yet — add workouts from the library to see them here.';

  return (
    <div className="workouts-page">
      <div className="workouts-hero">
        <div className="hero-left">
          <h1>Saved Workouts</h1>
          <p className="hero-sub">Everything you save in the Workout Library shows up here.</p>
        </div>
      </div>

      <section className="my-plan-section">
        <header className="my-plan-header">
          <p className="hero-sub">{myPlan.length ? `${savedCountCopy}. Remove items to keep your list curated.` : emptyCopy}</p>
          <a className="btn-ghost" href="/workouts">Open Workout Library</a>
        </header>
        <div className="workouts-grid">
          {myPlan.length === 0 && <div className="empty">{emptyCopy}</div>}
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
