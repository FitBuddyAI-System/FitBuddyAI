import React from 'react';
import './WorkoutsPage.css';
import { loadSavedNames, subscribeSavedNames, persistSavedNames } from '../utils/savedNames';

const PersonalLibraryPage: React.FC = () => {
  type LibItem = {
    title: string;
    images?: string[];
    imageCaptions?: string[];
    displayDifficulty?: string;
    difficultyClass?: string;
    displayCategory?: string;
    categoryClass?: string;
    difficulty?: string;
    duration?: string;
    meta?: { description?: string };
  };

  const { itemsByTitle } = React.useMemo(() => {
    const modules = (import.meta as any).glob('../data/exercises/*.json', { eager: true }) as Record<string, any>;
    const assets = (import.meta as any).glob('../data/exercises/**', { eager: true, as: 'url' }) as Record<string, string>;
    const map = new Map<string, LibItem>();
    Object.entries(modules).forEach(([path, mod]) => {
      const data = (mod && mod.default) ? mod.default : mod;
      const title = data.name || data.id || path.split('/').pop()?.replace('.json', '') || 'Unknown';
      const images: string[] = Array.isArray(data.images) ? data.images.map((p: string) => {
        const exactKey = `../data/exercises/${p}`;
        if (assets && assets[exactKey]) return assets[exactKey];
        if (assets) {
          const found = Object.entries(assets).find(([k]) => k.endsWith(`/${p}`) || k.endsWith(p));
          if (found) return found[1];
        }
        try { return new URL(`../data/exercises/${p}`, import.meta.url).href; } catch { return `/data/exercises/${p}`; }
      }) : [];
      const displayDifficulty = (data.level || data.difficulty) ? String(data.level || data.difficulty) : undefined;
      const difficultyClass = displayDifficulty ? String(displayDifficulty).toLowerCase() : undefined;
      const displayCategory = data.category ? String(data.category) : undefined;
      const categoryClass = displayCategory ? String(displayCategory).toLowerCase().replace(/[^a-z0-9]+/g,'-') : undefined;
      map.set(title, { title, images, imageCaptions: data.imageCaptions || [], displayDifficulty, difficultyClass, displayCategory, categoryClass, difficulty: data.difficulty, duration: data.duration, meta: data.meta });
    });
    return { itemsByTitle: map };
  }, []);

  const [myPlan, setMyPlan] = React.useState<LibItem[]>(() => {
    try {
      const names = loadSavedNames();
      return names.map(n => itemsByTitle.get(n) || { title: n });
    } catch {
      return [];
    }
  });

  React.useEffect(() => {
    const unsub = subscribeSavedNames((list) => {
      setMyPlan(list.map(n => itemsByTitle.get(n) || { title: n }));
    });
    return unsub;
  }, [itemsByTitle]);

  // Persisting is done by explicit user actions (removeFromPlan).
  // We avoid writing localStorage on every state update to prevent event loops.

  const removeFromPlan = (title: string) => {
    setMyPlan(prev => {
      const next = prev.filter(p => p.title !== title);
      try { persistSavedNames(next.map(p => p.title)); } catch (e) {}
      return next;
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
