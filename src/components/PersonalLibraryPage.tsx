import React from 'react';
import './WorkoutsPage.css';
import BackgroundDots from './BackgroundDots';
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
    meta?: { description?: string } | Record<string, any>;
    // Additional fields from exercises JSON
    primaryMuscles?: string[];
    secondaryMuscles?: string[];
    instructions?: string[];
    resources?: Array<{ label?: string; url?: string }>;
    video?: string;
    featuredVideo?: boolean;
    force?: string;
    level?: string;
    mechanic?: string;
    equipment?: string | string[];
    category?: string;
    exampleNote?: string;
  };
  const capitalizeWords = (s?: string) => {
    if (!s) return '';
    return String(s).split(/\s+/).map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
  };

  const { itemsByTitle } = React.useMemo(() => {
    const mapLevel = (lvl?: string) => {
      if (!lvl) return 'Varies';
      const s = String(lvl).toLowerCase();
      if (s === 'beginner' || s === 'easy') return 'Easy';
      if (s === 'intermediate' || s === 'moderate' || s === 'medium') return 'Medium';
      if (s === 'expert' || s === 'advanced' || s === 'hard') return 'Hard';
      return 'Varies';
    };
    const modules = (import.meta as any).glob('../data/exercises/*.json', { eager: true }) as Record<string, any>;
    const assets = import.meta.glob<string>('../data/exercises/**', { eager: true, query: '?url', import: 'default' });
    const map = new Map<string, LibItem>();
    Object.entries(modules).forEach(([path, mod]) => {
      if (!mod || !mod.default) {
        throw new Error(`Invalid module structure for ${path}: missing default export`);
      }
      const data = mod.default;
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
      const rawLevel = data.level || data.difficulty;
      const displayDifficulty = rawLevel ? mapLevel(String(rawLevel)) : undefined;
      const difficultyClass = displayDifficulty ? String(displayDifficulty).toLowerCase() : undefined;
      const displayCategory = data.category ? capitalizeWords(String(data.category)) : undefined;
      const categoryClass = displayCategory ? String(displayCategory).toLowerCase().replace(/[^a-z0-9]+/g,'-') : undefined;
      const primaryMuscles = Array.isArray(data.primaryMuscles) ? data.primaryMuscles.map((m: any) => String(m)) : [];
      const secondaryMuscles = Array.isArray(data.secondaryMuscles) ? data.secondaryMuscles.map((m: any) => String(m)) : [];
      const instructions = Array.isArray(data.instructions) ? data.instructions : [];
      const resources = Array.isArray(data.resources) ? data.resources : [];
      const video = data.video;
      const featuredVideo = Boolean(data.featuredVideo);
      map.set(title, {
        title,
        images,
        imageCaptions: data.imageCaptions || [],
        displayDifficulty,
        difficultyClass,
        displayCategory,
        categoryClass,
        difficulty: data.difficulty,
        duration: data.duration,
        meta: data.meta || {},
        primaryMuscles,
        secondaryMuscles,
        instructions,
        resources,
        video,
        featuredVideo,
        // Important detail fields used in modal header
        force: data.force || data.meta?.force,
        level: data.level || data.difficulty || data.meta?.level,
        mechanic: data.mechanic,
        equipment: data.equipment,
        category: data.category,
        exampleNote: data.exampleNote
      });
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

  const [selected, setSelected] = React.useState<string | null>(null);

  const selectedItem = selected ? (itemsByTitle.get(selected) || myPlan.find(p => p.title === selected)) : undefined;

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
    <div className="page-with-dots">
      <BackgroundDots />
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
                  <button className="btn-ghost" onClick={(e) => { e.stopPropagation(); setSelected(w.title); }}>View</button>
                  <button className="btn-ghost danger" onClick={() => removeFromPlan(w.title)}>Remove</button>
              </div>
            </article>
          ))}
        </div>
      </section>
        {selectedItem && (
          <div className="workouts-modal-overlay" role="dialog" aria-modal="true" aria-label={`${selectedItem.title} details`}>
            <div className="workouts-modal">
              <header className="modal-head">
                <div>
                  <h2>{selectedItem.title}</h2>
                  <div className="meta-row">
                    <span className={`difficulty ${(selectedItem as any).difficultyClass || ''}`}>{(selectedItem as any).displayDifficulty || (selectedItem as any).difficulty || 'Varies'}</span>
                    {(selectedItem as any).displayCategory ? (
                      <span className={`category-chip ${(selectedItem as any).categoryClass || ''}`}>
                        <span className="chip-dot" aria-hidden />
                        <span className="chip-value">{(selectedItem as any).displayCategory}</span>
                      </span>
                    ) : null}
                    {(selectedItem as any).duration ? (
                      <span className="meta-chip duration-chip">
                        <strong>Time</strong>
                        <span className="chip-value">{(selectedItem as any).duration}</span>
                      </span>
                    ) : null}
                    <div className="meta-chip-group">
                      {(() => {
                          const chips = [] as Array<{ key: string; label: string; value: any }>;
                          const si = (selectedItem as any);
                          if (si.force) chips.push({ key: 'force', label: 'Force', value: si.force });
                          if (si.mechanic) chips.push({ key: 'mechanic', label: 'Mechanic', value: si.mechanic });
                          if (si.equipment) chips.push({ key: 'equipment', label: 'Equipment', value: Array.isArray(si.equipment) ? si.equipment.join(', ') : si.equipment });
                          return chips.map(c => (
                            <span key={c.key} className="meta-chip">
                              <strong>{c.label}</strong>
                              <span className="chip-value">{capitalizeWords(String(c.value))}</span>
                            </span>
                          ));
                        })()}
                    </div>
                  </div>
                </div>
                <button className="modal-close" onClick={() => setSelected(null)} aria-label="Close">×</button>
              </header>

              <main className="modal-body">
                <div className="modal-media">
                  {(selectedItem as any).video ? (
                    <iframe src={(selectedItem as any).video} title={`${selectedItem.title} video`} frameBorder={0} allowFullScreen />
                  ) : (selectedItem.images && selectedItem.images.length > 0) ? (
                    <div className="gallery">
                      {(selectedItem.images ?? []).map((src) => (
                        <img key={src} src={src} alt={selectedItem.imageCaptions?.[selectedItem.images?.indexOf(src) ?? 0] || `${selectedItem.title}`} />
                      ))}
                    </div>
                  ) : (
                    <div className="media-fallback large">{selectedItem.title.charAt(0)}</div>
                  )}
                </div>

                <div className="modal-info">
                  <p className="long-desc">{(selectedItem as any).meta?.description || (selectedItem as any).exampleNote}</p>

                  {Array.isArray((selectedItem as any).instructions) && (selectedItem as any).instructions.length > 0 && (
                    <section className="instructions">
                      <h4>Instructions</h4>
                      <ol>
                        {(selectedItem as any).instructions.map((ins: string, idx: number) => <li key={`${idx}-${ins?.slice(0,20)}`}>{ins}</li>)}
                      </ol>
                    </section>
                  )}

                  {/* Muscles */}
                  {(((selectedItem as any).primaryMuscles && (selectedItem as any).primaryMuscles.length > 0) || ((selectedItem as any).secondaryMuscles && (selectedItem as any).secondaryMuscles.length > 0)) && (
                    <div className="muscle-grid">
                      <div className="muscle-section modal">
                        <div className="muscle-header">Muscles Exercised</div>
                        <div className="muscle-list">
                          {(selectedItem as any).primaryMuscles && (selectedItem as any).primaryMuscles.length > 0 && (
                            <div className="muscle-col">
                              <strong>Primary Muscles</strong>
                              <div>
                                <span className="muscle-badge primary" title={(selectedItem as any).primaryMuscles.join(', ')}>
                                  <span className="muscle-text primary-text">{(selectedItem as any).primaryMuscles.join(', ')}</span>
                                </span>
                              </div>
                            </div>
                          )}
                          {(selectedItem as any).secondaryMuscles && (selectedItem as any).secondaryMuscles.length > 0 && (
                            <div className="muscle-col">
                              <strong>Secondary Muscles</strong>
                              <div>
                                <span className="muscle-badge secondary" title={(selectedItem as any).secondaryMuscles.join(', ')}>
                                  <span className="muscle-text secondary-text">{(selectedItem as any).secondaryMuscles.join(', ')}</span>
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {((selectedItem as any).resources && (selectedItem as any).resources.length) ? (
                    <section className="resources">
                      <h4>Resources</h4>
                      <ul>
                        {(selectedItem as any).resources.map((r: any, i: number) => (
                          <li key={r.url || i}><a href={r.url} target="_blank" rel="noreferrer">{r.label}</a></li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  <div className="meta-grid">
                    {(selectedItem as any).meta && Object.entries((selectedItem as any).meta).map(([k, v]) => (
                      <div key={k} className="meta-item"><strong>{k}</strong><span>{String(v)}</span></div>
                    ))}
                  </div>

                  <div className="modal-actions">
                    <button className="btn-ghost danger" onClick={() => { removeFromPlan(selectedItem.title); setSelected(null); }}>Remove</button>
                    <button className="btn-outline" onClick={() => setSelected(null)}>Close</button>
                  </div>
                </div>
              </main>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PersonalLibraryPage;
