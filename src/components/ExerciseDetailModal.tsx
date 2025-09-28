import React from 'react';
import './ExerciseDetailModal.css';
import { X, Dumbbell } from 'lucide-react';
import resources from '../data/workoutResources.json';

interface Props {
  name: string;
  exercise?: any;
  onClose: () => void;
}

const ExerciseDetailModal: React.FC<Props> = ({ name, exercise, onClose }) => {
  // If the parent passes the exercise object (from the card), prefer it for header info
  const rawFromJson = (resources as any)[name] || (resources as any)['Default'] || {};
  const raw = exercise ? { ...rawFromJson, ...exercise } : rawFromJson;
  // Ensure shape safety
  const data: any = {
    images: raw.images || [],
    galleryImages: raw.galleryImages || [],
    imageCaptions: raw.imageCaptions || [],
    video: raw.video || '',
    featuredVideo: raw.featuredVideo || false,
    resources: Array.isArray(raw.resources) ? raw.resources : [],
    difficulty: raw.difficulty || '',
    duration: raw.duration || '',
    exampleNote: raw.exampleNote || '',
    meta: raw.meta || {}
  };

  // Prefer muscleGroups from the clicked exercise object (card) then fall back to meta/muscleGroups
  const targetText = (exercise && exercise.muscleGroups && exercise.muscleGroups.length)
    ? exercise.muscleGroups.join(', ')
    : (data.meta?.muscleGroups && data.meta.muscleGroups.length)
      ? data.meta.muscleGroups.join(', ')
      : (raw.muscleGroups && raw.muscleGroups.join ? raw.muscleGroups.join(', ') : '—');

  // Reps text: prefer exercise.sets and exercise.reps from the card, else fallback to meta or data
  const repsText = (exercise && (exercise.sets || exercise.reps))
    ? (exercise.sets ? `${exercise.sets} sets × ${exercise.reps || '—'}` : `${exercise.reps} reps`)
    : (data.sets && data.reps) ? `${data.sets} sets × ${data.reps}` : (data.meta?.reps ? `${data.meta.reps} reps` : null);

  // Append 'reps' if not present already (avoid duplicate)
  const repsTextWithSuffix = repsText ? (repsText.toString().toLowerCase().endsWith('reps') ? repsText : `${repsText} reps`) : null;

  return (
    <div className="exercise-modal-overlay" onClick={onClose}>
      <div className="exercise-detail-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`${name} details`}>
        <div className="exercise-detail-header">
          <div className="header-left">
            <div className="illustration" aria-hidden>
              {/* friendly workout illustration (simple SVG) */}
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="11" width="18" height="8" rx="2" fill="#F3FBF6" />
                <path d="M7 11V8a3 3 0 0 1 3-3h4" stroke="#2EB06A" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="17" cy="6" r="1.6" fill="#2EB06A" />
              </svg>
            </div>
            <div className="title-block">
              <div className="title-text">
                <h3>{name}</h3>
                <div className="tag-row">
                  {(() => {
                    // Prefer exercise.difficulty (card) first, then data.difficulty
                    const rawDiff = (exercise && exercise.difficulty) ? exercise.difficulty : data.difficulty || '';
                    const diffRaw = (rawDiff || '').toString().toLowerCase().trim();
                    let diffLabel = 'Unknown';
                    let cls = 'unknown';
                    if (diffRaw.includes('easy') || diffRaw.includes('beginner')) { diffLabel = 'Beginner'; cls = 'beginner'; }
                    else if (diffRaw.includes('moder') || diffRaw.includes('inter') || diffRaw.includes('medium') || diffRaw.includes('intermediate')) { diffLabel = 'Intermediate'; cls = 'intermediate'; }
                    else if (diffRaw.includes('hard') || diffRaw.includes('adv') || diffRaw.includes('advanced')) { diffLabel = 'Advanced'; cls = 'advanced'; }
                    else if (diffRaw) { diffLabel = diffRaw.charAt(0).toUpperCase() + diffRaw.slice(1); cls = diffRaw.replace(/\s+/g, '-'); }
                    return (
                      <span className={`tag tag-difficulty tag-${cls}`}>{diffLabel}</span>
                    );
                  })()}
                  <span className="meta-pill duration"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-clock"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>{data.duration || '—'}</span>
                  {repsTextWithSuffix ? (
                    <span className="meta-pill reps"><Dumbbell size={14} />{repsTextWithSuffix}</span>
                  ) : null}
                  <span className="meta-pill target"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-zap"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>{targetText}</span>
                </div>
              </div>

              <div className="header-subinfo" aria-hidden>
              </div>
            </div>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div className="exercise-body">
          <div className="hero-media">
            {data.video ? (
              <div className="hero-video">
                <iframe src={data.video} title={`${name} video`} frameBorder="0" allowFullScreen />
              </div>
            ) : (
              <div className="hero-placeholder">{/* placeholder illustration */}
                <svg width="96" height="64" viewBox="0 0 96 64" fill="none"><rect width="96" height="64" rx="8" fill="#F3FBF6"/></svg>
              </div>
            )}
          </div>

          <div className="meta-grid">
            <div className="meta-item">
              <div className="meta-icon"> 
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2v20" stroke="#4CAF50" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div className="meta-content">
                <div className="meta-label">Exercise</div>
                <div className="meta-value">{data.meta?.exercise || '—'}</div>
              </div>
            </div>

            <div className="meta-item">
              <div className="meta-icon"> 
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 12h16" stroke="#1E90CB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div className="meta-content">
                <div className="meta-label">Movement</div>
                <div className="meta-value">{data.meta?.movement || '—'}</div>
              </div>
            </div>

            <div className="meta-item">
              <div className="meta-icon"> 
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="18" height="12" rx="2" stroke="#FF9600" strokeWidth="1.2"/></svg>
              </div>
              <div className="meta-content">
                <div className="meta-label">Equipment</div>
                <div className="meta-value">{data.meta?.equipment || '—'}</div>
              </div>
            </div>

            <div className="meta-item">
              <div className="meta-icon"> 
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 20V4" stroke="#6A5ACD" strokeWidth="1.2" strokeLinecap="round"/></svg>
              </div>
              <div className="meta-content">
                <div className="meta-label">Type of Training</div>
                <div className="meta-value">{data.meta?.trainingType || '—'}</div>
              </div>
            </div>

            <div className="meta-item">
              <div className="meta-icon"> 
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke="#2E8B57" strokeWidth="1.2"/></svg>
              </div>
              <div className="meta-content">
                <div className="meta-label">Plane of Motion</div>
                <div className="meta-value">{data.meta?.planeOfMotion || '—'}</div>
              </div>
            </div>
          </div>

          <div className="description">
            <div className="desc-label">Description</div>
            <div className="desc-text">{data.meta?.description || data.exampleNote || 'No description available.'}</div>
          </div>

          {/* Image gallery: up to two images with captions */}
          <div className="image-gallery">
            {((data.galleryImages && data.galleryImages.length) ? data.galleryImages : (data.images || [])).slice(0,2).map((src: string, idx: number) => (
              <figure className="gallery-item" key={idx}>
                <img src={src} alt={`${name} image ${idx+1}`} />
                <figcaption>{(data.imageCaptions && data.imageCaptions[idx]) || data.resources?.[idx]?.label || ''}</figcaption>
              </figure>
            ))}
          </div>

          <div className="section-divider" />

          <div className="meta-resources">
            <h4>Resources</h4>
            <div className="resource-cards">
              {data.resources.map((r: any, i: number) => (
                <div className="resource-card" key={i}>
                  <div className="resource-card-left">
                    <div className="resource-icon"> 
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.4"/></svg>
                    </div>
                    <div className="resource-body">
                      <div className="resource-title">{r.label}</div>
                      <div className="resource-caption">{r.caption || ''}</div>
                    </div>
                  </div>
                  <div className="resource-actions">
                    <a className={`resource-btn btn btn-primary ${i % 2 === 0 ? 'green' : 'blue'}`} href={r.url} target="_blank" rel="noreferrer">Open</a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

};

export default ExerciseDetailModal;
