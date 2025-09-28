import React, { useState } from 'react';
import { X, Check, RotateCcw, Clock, Zap, Edit3, Trash2, ArrowRight, ArrowLeft, Save, Dumbbell } from 'lucide-react';
import { DayWorkout } from '../types';
import './WorkoutModal.css';
import ExerciseDetailModal from './ExerciseDetailModal';
import confetti from 'canvas-confetti';

interface WorkoutModalProps {
  workout: DayWorkout;
  onClose: () => void;
  onComplete: () => void;
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

  // Keep local completed state in sync if workout prop changes
  React.useEffect(() => {
    setCompleted(workout.completed);
  }, [workout.completed]);

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

  const getWorkoutTypeColor = (type: string) => {
    switch (type) {
      case 'strength': return 'strength';
      case 'cardio': return 'cardio';
      case 'flexibility': return 'flexibility';
      case 'rest': return 'rest';
      case 'mixed': return 'mixed';
      default: return 'mixed';
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
    
    if (onUpdateWorkout) {
      onUpdateWorkout(editingWorkout);
    }
    setIsEditing(false);
    onClose(); // Close modal to reflect changes in calendar view
  };

  const handleCancelEdit = () => {
    setEditingWorkout(workout);
    setIsEditing(false);
  };

  const handleComplete = () => {
    if (!completed) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.3 },
        zIndex: 9999,
      });
    }
    const newCompleted = !completed;
    setCompleted(newCompleted);
    if (onUpdateWorkout) {
      onUpdateWorkout({ ...workout, completed: newCompleted });
    }
    onComplete();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="workout-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-section">
            <div className={`workout-type-badge ${getWorkoutTypeColor(workout.type)}`}>
              {workout.type === 'rest' ? 'Rest Day' : 
               workout.type === 'strength' ? 'Strength' :
               workout.type === 'cardio' ? 'Cardio' :
               workout.type === 'flexibility' ? 'Flexibility' : 'Mixed'}
            </div>
            <div>
              <h2>{formatDate(workout.date)}</h2>
              {workout.completed && (
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
          {workout.type === 'rest' ? (
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
                      {exercise.duration && (
                        <div className="detail-item">
                          <Clock size={16} />
                          <span>{exercise.duration}</span>
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
        {workout.type !== 'rest' && (
          <div className="modal-footer">
            <div className="action-buttons">
              {!isEditing ? (
                <>
                  <button 
                    className="btn btn-secondary"
                    onClick={() => setIsEditing(true)}
                  >
                    <Edit3 size={16} />
                    Edit Workout
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={onRegenerateWorkout}
                    disabled={!!(isRegenerating)}
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
                    className={`btn ${completed ? 'btn-accent' : 'btn-primary'}`}
                    onClick={handleComplete}
                  >
                    {completed ? (
                      <>
                        <RotateCcw size={16} />
                        Mark Incomplete
                      </>
                    ) : (
                      <>
                        <Check size={16} />
                        Complete Workout
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
        {workout.type !== 'rest' && (
          <div className="add-workout-section">
            <h3>Select Date and Workout Type</h3>
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
              <label htmlFor="workout-type">Workout Type:</label>
              <select
                id="workout-type"
                className="workout-type-selector"
                value={editingWorkout.type}
                onChange={(e) => setEditingWorkout({ ...editingWorkout, type: e.target.value as 'strength' | 'cardio' | 'flexibility' | 'rest' | 'mixed' })}
              >
                <option value="strength">Strength</option>
                <option value="cardio">Cardio</option>
                <option value="flexibility">Flexibility</option>
                <option value="rest">Rest</option>
              </select>
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
