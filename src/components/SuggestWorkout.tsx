import React, { useState } from 'react';
import './SuggestWorkout.css';
import { useNavigate } from 'react-router-dom';

interface SuggestWorkoutProps {
  userData?: any;
}

const SuggestWorkout: React.FC<SuggestWorkoutProps> = ({ userData }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [exercisesText, setExercisesText] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setMessage(null);
    const exercises = String(exercisesText || '')
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);
    const payload = {
      userId: userData?.id || null,
      title: String(title).trim(),
      description: String(description).trim(),
      exercises,
    };

    if (!payload.title) {
      setMessage('Please enter a short title for your suggestion.');
      setSaving(false);
      return;
    }

    try {
      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setMessage('Thanks! Your suggestion has been submitted.');
        setTitle('');
        setDescription('');
        setExercisesText('');
        // Optionally navigate back to library after a short delay
        // setTimeout(() => navigate('/library'), 1000);
      } else {
        // fallback: save locally so user doesn't lose suggestion
        try {
          const key = 'fitbuddyai_local_suggestions';
          const prev = JSON.parse(localStorage.getItem(key) || '[]');
          prev.push({ ...payload, created_at: new Date().toISOString() });
          localStorage.setItem(key, JSON.stringify(prev));
          setMessage('Saved locally (server unavailable).');
        } catch (err) {
          setMessage('Failed to submit suggestion.');
        }
      }
    } catch (err) {
      try {
        const key = 'fitbuddyai_local_suggestions';
        const prev = JSON.parse(localStorage.getItem(key) || '[]');
        prev.push({ ...payload, created_at: new Date().toISOString() });
        localStorage.setItem(key, JSON.stringify(prev));
        setMessage('Saved locally (network error).');
      } catch (e) {
        setMessage('Failed to submit suggestion.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="suggest-workout-page">
      <div className="card suggest-card">
        <h2>Suggest a New Workout</h2>
        <p className="sub">Have an idea for a workout or routine? Tell us the title, a short description, and the exercises (one per line).</p>
        <form onSubmit={handleSubmit}>
          <label>
            Title
            <input className="input" value={title} onChange={e => setTitle(e.target.value)} maxLength={100} placeholder="e.g. 10-Minute Core Blast" />
          </label>
          <label>
            Description
            <textarea className="input" value={description} onChange={e => setDescription(e.target.value)} placeholder="Short description / goals" rows={3} />
          </label>
          <label>
            Exercises (one per line)
            <textarea className="input" value={exercisesText} onChange={e => setExercisesText(e.target.value)} placeholder={'e.g.\nPlank - 30s\nRussian Twists - 20 reps'} rows={6} />
          </label>
          {message && <div className="suggest-message">{message}</div>}
          <div className="actions-row">
            <button className="btn-primary" type="submit" disabled={saving}>{saving ? 'Submitting...' : 'Submit Suggestion'}</button>
            <button className="btn-secondary" type="button" onClick={() => navigate(-1)} disabled={saving}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SuggestWorkout;
