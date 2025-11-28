import React, { useState } from 'react';
import { X, Check, RotateCcw, Clock, Zap, Edit3, Trash2, ArrowRight, ArrowLeft, Save, Dumbbell } from 'lucide-react';
import { DayWorkout, WorkoutType } from '../types';
import './WorkoutModal.css';
import ExerciseDetailModal from './ExerciseDetailModal';
import confetti from 'canvas-confetti';

interface WorkoutModalProps {
  workout: DayWorkout;
  onClose: () => void;
  onComplete: (type?: WorkoutType) => void;
  onRegenerateWorkout: () => void;
  isRegenerating?: boolean;
  onUpdateWorkout?: (updatedWorkout: DayWorkout) => void;
}

const WorkoutModal: React.FC<WorkoutModalProps> = ({ 
  workout, 
  onClose, 
  onComplete, 
  onRegenerateWorkout,
  isRegenerating,
  onUpdateWorkout 
}) => {
  const [showAlternative, setShowAlternative] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<DayWorkout>(workout);
  const [completed, setCompleted] = useState(workout.completed);
  const canonType = (t?: string | null): WorkoutType => {
    const s = (t || '').toString().toLowerCase().trim();
    if (s === 'rest') return 'rest';
    if (s.includes('cardio')) return 'cardio';
    if (s.includes('plyo')) return 'plyometrics';
    if (s.includes('powerlift')) return 'powerlifting';
    if (s.includes('olympic')) return 'olympic';
    if (s.includes('stretch') || s.includes('flex') || s.includes('mobility')) return 'stretching';
    if (s.includes('strongman')) return 'strongman';
    if (s.includes('strength')) return 'strength';
    return 'strength';
  };
  const resolveWorkoutTypes = (target: DayWorkout): WorkoutType[] => {
    const raw = (target as any)?.types;
    const types = Array.isArray(raw) ? raw.filter(Boolean) : [];
    if (types.length === 0 && target.type) types.push(target.type);
    const normalized = types.map(t => canonType(t as string));
    const unique = Array.from(new Set(normalized)).filter(Boolean) as WorkoutType[];
    if (unique.includes('rest') && unique.length > 1) return ['rest'];
    return unique.slice(0, 4) as WorkoutType[];
  };

  const [localCompletedTypes, setLocalCompletedTypes] = useState<WorkoutType[]>(resolveWorkoutTypes(workout).filter(t => (workout.completedTypes || []).includes(t)));
  const availableTypes = resolveWorkoutTypes(workout);
  const [selectedType, setSelectedType] = useState<WorkoutType>(availableTypes[0] || 'strength');

  const getWorkoutTypeLabel = (types: WorkoutType[]) => {
    const formatSingle = (type: WorkoutType) => {
      switch (type) {
        case 'strength': return 'Strength';
        case 'cardio': return 'Cardio';
        case 'plyometrics': return 'Plyometrics';
        case 'powerlifting': return 'Powerlifting';
        case 'olympic': return 'Olympic Weightlifting';
        case 'stretching': return 'Stretching';
        case 'strongman': return 'Strongman';
        case 'rest': return 'Rest';
        default: return 'Strength';
      }
    };
    if (!types || types.length === 0) return 'Strength';
    if (types.length > 1) return types.map(formatSingle).join(' / ');
    return formatSingle(types[0]);
  };

  // Keep local completed state in sync if workout prop changes
  React.useEffect(() => {
    setCompleted(workout.completed);
    setLocalCompletedTypes(resolveWorkoutTypes(workout).filter(t => (workout.completedTypes || []).includes(t)));
  }, [workout.completed]);

  // Keep local editing snapshot in sync with incoming workout changes
  React.useEffect(() => {
    setEditingWorkout(workout);
    const types = resolveWorkoutTypes(workout);
    setSelectedType(types[0] || 'mixed');
    setLocalCompletedTypes(types.filter(t => (workout.completedTypes || []).includes(t)));
  }, [workout]);

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getWorkoutTypeColor = (type: WorkoutType | string) => {
    const t = canonType(type as string);
    switch (t) {
      case 'strength': return 'strength';
      case 'cardio': return 'cardio';
      case 'plyometrics': return 'plyometrics';
      case 'powerlifting': return 'powerlifting';
      case 'olympic': return 'olympic';
      case 'stretching': return 'stretching';
      case 'strongman': return 'strongman';
      case 'rest': return 'rest';
      default: return 'strength';
    }
  };

  const formatDifficulty = (d: string | undefined) => {
    if (!d) return { label: '', cls: '' };
    const key = (d || '').toString().toLowerCase();
    if (key === 'easy' || key === 'beginner') return { label: 'Easy', cls: 'difficulty-easy' };
    if (key === 'medium' || key === 'intermediate') return { label: 'Medium', cls: 'difficulty-medium' };
    if (key === 'hard' || key === 'advanced') return { label: 'Hard', cls: 'difficulty-hard' };
    // fallback: capitalize first letter
    return { label: key.charAt(0).toUpperCase() + key.slice(1), cls: `difficulty-${key.replace(/\s+/g, '-')}` };
  };

  const currentWorkouts = showAlternative ? workout.alternativeWorkouts : workout.workouts;
  const [detailExercise, setDetailExercise] = React.useState<string | null>(null);
  const [detailExerciseObj, setDetailExerciseObj] = React.useState<any | null>(null);

  // Exercise editing functions
  const handleDeleteExercise = (exerciseIndex: number, isAlternative: boolean = false) => {
    const updatedWorkout = { ...editingWorkout };
    if (isAlternative) {
      updatedWorkout.alternativeWorkouts = updatedWorkout.alternativeWorkouts.filter((_, index) => index !== exerciseIndex);
    } else {
      updatedWorkout.workouts = updatedWorkout.workouts.filter((_, index) => index !== exerciseIndex);
    }
    setEditingWorkout(updatedWorkout);
  };

  const handleSwapExercise = (exerciseIndex: number, isAlternative: boolean = false) => {
    if (isAlternative) {
      // Move from alternative to main workouts
      const exercise = editingWorkout.alternativeWorkouts[exerciseIndex];
      setEditingWorkout({
        ...editingWorkout,
        workouts: [...editingWorkout.workouts, exercise],
        alternativeWorkouts: editingWorkout.alternativeWorkouts.filter((_, idx) => idx !== exerciseIndex)
      });
    } else {
      // Move from main workouts to alternative
      const exercise = editingWorkout.workouts[exerciseIndex];
      setEditingWorkout({
        ...editingWorkout,
        workouts: editingWorkout.workouts.filter((_, idx) => idx !== exerciseIndex),
        alternativeWorkouts: [...editingWorkout.alternativeWorkouts, exercise]
      });
    }
  };

  const handleTypeToggle = (type: WorkoutType, checked: boolean) => {
    setEditingWorkout(prev => {
      const current = resolveWorkoutTypes(prev);
      if (checked && current.length >= 4 && !current.includes(type)) return prev;
      let nextTypes = checked ? [...current, type] : current.filter(t => t !== type);
      if (nextTypes.length === 0) nextTypes = [prev.type || 'mixed'];
      return { ...prev, types: nextTypes, type: nextTypes[0] };
    });
  };

  const handleExerciseFieldChange = (
    exerciseIndex: number,
    field: 'duration',
    value: string,
    isAlternative: boolean = false
  ) => {
    setEditingWorkout(prev => {
      const updated = { ...prev };
      const listKey = isAlternative ? 'alternativeWorkouts' : 'workouts';
      const list = [...updated[listKey]];
      list[exerciseIndex] = { ...list[exerciseIndex], [field]: value };
      (updated as any)[listKey] = list;
      return updated;
    });
  };

  const handleSaveChanges = () => {
    // Check if all exercises have been deleted
    const hasMainExercises = editingWorkout.workouts.length > 0;
    const hasAltExercises = editingWorkout.alternativeWorkouts.length > 0;
    
    if (!hasMainExercises && !hasAltExercises) {
      // Delete the entire workout if no exercises remain
      if (onUpdateWorkout) {
        onUpdateWorkout({ ...editingWorkout, workouts: [], alternativeWorkouts: [] });
      }
      onClose(); // Close modal since workout is essentially deleted
      return;
    }
    
    const normalizedTypes = resolveWorkoutTypes(editingWorkout);
    const normalizedWorkout: DayWorkout = {
      ...editingWorkout,
      type: (normalizedTypes[0] || editingWorkout.type || 'strength') as WorkoutType,
      types: normalizedTypes
    };
    if (onUpdateWorkout) {
      onUpdateWorkout(normalizedWorkout);
    }
    setIsEditing(false);
    onClose(); // Close modal to reflect changes in calendar view
  };

  const handleCancelEdit = () => {
    setEditingWorkout(workout);
    setIsEditing(false);
  };

  const handleComplete = () => {
    if (!isTodayDay) {
      alert('You can only complete or undo today\'s workout.');
      return;
    }
    const type = selectedType || availableTypes[0] || 'strength';
    if (!localCompletedTypes.includes(type)) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.3 },
        zIndex: 9999,
      });
    }
    let nextCompleted = localCompletedTypes.includes(type)
      ? localCompletedTypes.filter(t => t !== type)
      : [...localCompletedTypes, type];

    // keep only valid types
    nextCompleted = nextCompleted.filter(t => availableTypes.includes(t));
    const isAllComplete = availableTypes.length > 0 ? nextCompleted.length === availableTypes.length : false;

    setLocalCompletedTypes(nextCompleted);
    setCompleted(isAllComplete);

    if (onUpdateWorkout) {
      onUpdateWorkout({ ...workout, completed: isAllComplete, completedTypes: nextCompleted });
    }
    onComplete(type);
  };

  const typeList = resolveWorkoutTypes(workout);
  const primaryType = typeList[0] || 'strength';
  const typeLabel = getWorkoutTypeLabel(typeList);
  const editingTypes = resolveWorkoutTypes(editingWorkout);
  const selectedTypeCompleted = localCompletedTypes.includes(selectedType);
  const overallCompleted = typeList.length > 0
    ? localCompletedTypes.length === typeList.length
    : completed;
  const [year, month, day] = workout.date.split('-').map(Number);
  const workoutDateObj = new Date(year, month - 1, day);
  const today = new Date(); today.setHours(0,0,0,0);
  const isPastDay = workoutDateObj < today;
  const isTodayDay = workoutDateObj.getTime() === today.getTime();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="workout-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-section">
            <div className={`workout-type-badge ${getWorkoutTypeColor(primaryType)}`}>
              {typeLabel}
            </div>
            <div>
              <h2>{formatDate(workout.date)}</h2>
              {overallCompleted && (
                <span className="completed-badge">
                  <Check size={16} />
                  Completed
                </span>
              )}
            </div>
          </div>          <button className="close-button" onClick={onClose} title="Close modal">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="modal-content">
          {!isTodayDay && (
            <div className="locked-note">
              {isPastDay ? 'Past workouts are locked. View only.' : 'You can only complete workouts on the current day.'}
            </div>
          )}
          {typeList.length > 1 && (
            <div className="type-tab-strip" role="tablist" aria-label="Workout types">
              {typeList.map((type) => {
                const completedType = localCompletedTypes.includes(type);
                return (
                  <button
                    key={type}
                    role="tab"
                    aria-selected={selectedType === type}
                    className={`type-tab ${selectedType === type ? 'active' : ''} ${completedType ? 'completed' : ''}`}
                    onClick={() => setSelectedType(type)}
                  >
                    <span className="dot" aria-hidden="true"></span>
                    {getWorkoutTypeLabel([type])}
                    {completedType && <Check size={14} className="tab-check" />}
                  </button>
                );
              })}
            </div>
          )}
          {primaryType === 'rest' ? (
            (workout as any).isRickroll ? (
              <div className="rest-day-content rickroll-rest">
                <div className="rest-icon">
                  <Zap size={48} />
                </div>
                <h3>Rest & Recharge</h3>
                <p>Today’s a gentle recovery day — take it slow and treat yourself. A short, uplifting break can do wonders. Enjoy this pick-me-up while you rest.</p>
                <div className="rickroll-embed">
                  <iframe width="560" height="315" src="https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0" title="YouTube video player" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
                </div>
                <div className="rest-activities">
                  <div className="activity-item">
                    <span>🧘‍♀️</span>
                    <span>Slow breathing or meditation (5-10 min)</span>
                  </div>
                  <div className="activity-item">
                    <span>☕</span>
                    <span>Enjoy a calming drink while you relax</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rest-day-content">
                <div className="rest-icon">
                  <Zap size={48} />
                </div>
                <h3>Recovery Day</h3>
                <p>Take this day to rest and let your muscles recover. You can do light stretching, meditation, or gentle walking.</p>
                <div className="rest-activities">
                  <div className="activity-item">
                    <span>🧘‍♀️</span>
                    <span>Meditation (10-15 min)</span>
                  </div>
                  <div className="activity-item">
                    <span>🚶‍♀️</span>
                    <span>Light walking</span>
                  </div>
                  <div className="activity-item">
                    <span>🛁</span>
                    <span>Relaxing bath</span>
                  </div>
                  <div className="activity-item">
                    <span>📚</span>
                    <span>Reading or relaxing</span>
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="workout-content">
              {/* Workout Toggle */}
              <div className="workout-toggle">
                <button 
                  className={`toggle-button ${!showAlternative ? 'active' : ''}`}
                  onClick={() => setShowAlternative(false)}
                >
                  Main Workout
                </button>
                <button 
                  className={`toggle-button ${showAlternative ? 'active' : ''}`}
                  onClick={() => setShowAlternative(true)}
                >
                  Alternative
                </button>
              </div>              {/* Exercise List */}
              <div className="exercise-list">
                {(isEditing ? 
                  (showAlternative ? editingWorkout.alternativeWorkouts : editingWorkout.workouts) :
                  currentWorkouts
                ).map((exercise, index) => (
                  <div
                    key={index}
                    className="exercise-card"
                    role={!isEditing ? 'button' : undefined}
                    tabIndex={!isEditing ? 0 : undefined}
                    onClick={() => { if (!isEditing) { setDetailExercise(exercise.name); setDetailExerciseObj(exercise); } }}
                      onKeyDown={(e) => {
                      if (!isEditing && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        setDetailExercise(exercise.name);
                        setDetailExerciseObj(exercise);
                      }
                    }}
                  >
                    <div className="exercise-header">
                      <div className="exercise-title-section">
                        <h4>{exercise.name}</h4>
                        {
                          (() => {
                            const { label, cls } = formatDifficulty(exercise.difficulty);
                            return <div className={`difficulty-badge ${cls}`}>{label}</div>;
                          })()
                        }
                      </div>
                      {isEditing && (
                        <div className="exercise-actions">
                          <button
                            className="action-btn swap-btn"
                            onClick={(e) => { e.stopPropagation(); handleSwapExercise(index, showAlternative); }}
                            title={showAlternative ? "Move to main workout" : "Move to alternative"}
                          >
                            {showAlternative ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}
                          </button>
                          <button
                            className="action-btn delete-btn"
                            onClick={(e) => { e.stopPropagation(); handleDeleteExercise(index, showAlternative); }}
                            title="Delete exercise"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                    
                    <div className="exercise-details">
                      {exercise.sets && exercise.reps && (
                        <div className="detail-item">
                          <Dumbbell size={16} />
                          <span>{exercise.sets} sets × {exercise.reps} reps</span>
                        </div>
                      )}
                      {(isEditing || exercise.duration) && (
                        <div className="detail-item">
                          <Clock size={16} />
                          {isEditing ? (
                            <input
                              type="text"
                              className="duration-input"
                              value={(showAlternative ? editingWorkout.alternativeWorkouts[index].duration : editingWorkout.workouts[index].duration) || ''}
                              onChange={(e) => handleExerciseFieldChange(index, 'duration', e.target.value, showAlternative)}
                              placeholder="e.g., 30 min"
                            />
                          ) : (
                            <span>{exercise.duration}</span>
                          )}
                        </div>
                      )}
                      {exercise.muscleGroups && exercise.muscleGroups.length > 0 && (
                        <div className="detail-item">
                          <Zap size={16} />
                          <span>{exercise.muscleGroups.join(', ')}</span>
                        </div>
                      )}
                    </div>
                    
                    <p className="exercise-description">{exercise.description}</p>
                    {/* removed See details button — entire card is now clickable */}
                    
                    {/* Only show actual equipment (exclude 'No equipment') */}
                    {Array.isArray(exercise.equipment) && exercise.equipment.some(item => item !== 'No equipment') && (
                      <div className="equipment-tags">
                        {exercise.equipment
                          .filter(item => item !== 'No equipment')
                          .map((item, idx) => (
                            <span key={idx} className="equipment-tag">{item}</span>
                          ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        {detailExercise && (
          <ExerciseDetailModal name={detailExercise} exercise={detailExerciseObj || undefined} onClose={() => { setDetailExercise(null); setDetailExerciseObj(null); }} />
        )}
        {/* Footer: Only show for non-rest days */}
        {primaryType !== 'rest' && (
          <div className="modal-footer">
            <div className="action-buttons">
              {!isEditing ? (
                <>
                  <button 
                    className="btn btn-secondary"
                    onClick={() => setIsEditing(true)}
                    disabled={isPastDay}
                  >
                    <Edit3 size={16} />
                    Edit Workout
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={onRegenerateWorkout}
                    disabled={!!(isRegenerating) || isPastDay}
                    aria-busy={!!(isRegenerating)}
                  >
                    {isRegenerating ? (
                      <>
                        <span className="button-spinner">
                          <div className="loading-dumbbell small">
                            <Dumbbell size={16} color="#fff" />
                          </div>
                        </span>
                        <span className="generating-text">Generating...</span>
                      </>
                    ) : (
                      <>
                        <RotateCcw size={16} />
                        New Workout
                      </>
                    )}
                  </button>
                  <button 
                    className={`btn ${selectedTypeCompleted ? 'btn-accent' : 'btn-primary'}`}
                    onClick={handleComplete}
                    disabled={!isTodayDay}
                  >
                    {selectedTypeCompleted ? (
                      <>
                        <RotateCcw size={16} />
                        Mark {getWorkoutTypeLabel([selectedType])} Incomplete
                      </>
                    ) : (
                      <>
                        <Check size={16} />
                        Complete {getWorkoutTypeLabel([selectedType])}
                      </>
                    )}
                  </button>
                </>
              ) : (
                <>
                  <button 
                    className="btn btn-secondary"
                    onClick={handleCancelEdit}
                  >
                    <X size={16} />
                    Cancel
                  </button>
                  <button 
                    className="btn btn-primary"
                    onClick={handleSaveChanges}
                  >
                    <Save size={16} />
                    Save Changes
                  </button>
                </>
              )}
            </div>
          </div>
        )}
        
        {/* Add Workout Day Section: Only show for non-rest days */}
        {primaryType !== 'rest' && (
          <div className="add-workout-section">
            <h3>Select Date and Workout Types</h3>
            <div className="date-picker-container">
              <label htmlFor="workout-date">Date:</label>
              <input
                type="date"
                id="workout-date"
                className="date-picker"
                value={editingWorkout.date}
                onChange={(e) => setEditingWorkout({ ...editingWorkout, date: e.target.value })}
              />
            </div>
            <div className="workout-type-container">
              <label>Workout Types (choose up to 4):</label>
              <div className="type-multi-select">
                {(['cardio','olympic','plyometrics','powerlifting','strength','stretching','strongman','rest'] as WorkoutType[]).map((type) => {
                  const checked = editingTypes.includes(type);
                  return (
                    <label key={type} className={`type-pill ${checked ? 'selected' : ''}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => handleTypeToggle(type, e.target.checked)}
                      />
                      {getWorkoutTypeLabel([type])}
                    </label>
                  );
                })}
              </div>
              <small className="type-helper">First selected type becomes the primary color on the calendar.</small>
            </div>
            <button
              className="add-workout-button"
              onClick={handleSaveChanges}
            >
              Add Workout Day
            </button>
          </div>
        )}

        <style>
          {`
            .add-workout-section {
              margin-top: 20px;
              padding: 15px;
              background-color: var(--light-blue);
              border-radius: 8px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .date-picker-container, .workout-type-container {
              margin-bottom: 15px;
            }
            .date-picker, .workout-type-selector {
              width: 100%;
              padding: 10px;
              border: 1px solid var(--gray);
              border-radius: 4px;
              font-size: 16px;
            }
            .add-workout-button {
              width: 100%;
              padding: 10px;
              background-color: var(--green);
              color: white;
              font-size: 16px;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              transition: background-color 0.3s;
            }
            .add-workout-button:hover {
              background-color: var(--dark-green);
            }
          `}
        </style>
      </div>
    </div>
  );
};

export default WorkoutModal;
