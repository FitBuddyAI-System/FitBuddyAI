import { loadUserData, saveUserData } from '../services/localStorage';

export type SavedWorkout = {
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
  difficulty?: string;
  duration?: string;
};

const PLAN_KEY = 'fitbuddyai_my_plan';
const EVENT_KEY = 'fitbuddyai-saved-library-updated';
let inMemoryLibrary: SavedWorkout[] = [];
let storageUnavailable = false;

export const sanitizeWorkout = (item: SavedWorkout): SavedWorkout => {
  if (!item) return { title: 'Workout' };
  const safeTitle = item.title || 'Workout';
  return {
    title: safeTitle,
    id: item.id || safeTitle,
    images: item.images || [],
    imageCaptions: item.imageCaptions || [],
    displayDifficulty: item.displayDifficulty,
    difficultyClass: item.difficultyClass,
    displayCategory: item.displayCategory,
    categoryClass: item.categoryClass,
    exampleNote: item.exampleNote,
    meta: item.meta,
    difficulty: item.difficulty,
    duration: item.duration
  };
};

export const loadSavedWorkouts = (): SavedWorkout[] => {
  if (storageUnavailable) {
    return [...inMemoryLibrary];
  }
  try {
    const saved = localStorage.getItem(PLAN_KEY) || sessionStorage.getItem(PLAN_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    const user = loadUserData();
    const fromUser = (user as any)?.personalLibrary;
    const combined: SavedWorkout[] = [];
    const addIfNew = (item: SavedWorkout) => {
      const safeItem = sanitizeWorkout(item);
      if (!combined.some(c => c.title === safeItem.title)) combined.push(safeItem);
    };
    if (Array.isArray(parsed)) parsed.forEach(addIfNew);
    if (Array.isArray(fromUser)) fromUser.forEach(addIfNew);
    // Only overwrite the in-memory cache when storage calls are working
    inMemoryLibrary = combined;
    return combined;
  } catch (err) {
    console.warn('Failed to load saved workouts:', err);
    storageUnavailable = true;
    return [...inMemoryLibrary];
  }
};

export const persistSavedWorkouts = (list: SavedWorkout[]): SavedWorkout[] => {
  const sanitized = (list || []).map(sanitizeWorkout);
  const payload = JSON.stringify(sanitized);
  inMemoryLibrary = sanitized;
  try { localStorage.setItem(PLAN_KEY, payload); } catch { storageUnavailable = true; }
  try { sessionStorage.setItem(PLAN_KEY, payload); } catch { storageUnavailable = true; }
  try {
    const existingUser = loadUserData();
    if (existingUser) {
      const nextUser = { ...existingUser, personalLibrary: sanitized };
      saveUserData({ data: nextUser });
    }
  } catch (err) {
    console.warn('Failed to persist personal library to user profile:', err);
  }
  try { window.dispatchEvent(new CustomEvent(EVENT_KEY, { detail: sanitized })); } catch {}
  return sanitized;
};

export const subscribeSavedWorkouts = (onUpdate: (list: SavedWorkout[]) => void) => {
  const handle = () => onUpdate(loadSavedWorkouts());
  const handleEvent = (e: Event) => {
    const detailList = (e as CustomEvent)?.detail;
    if (Array.isArray(detailList)) {
      onUpdate(detailList.map(sanitizeWorkout));
    } else {
      handle();
    }
  };
  window.addEventListener('storage', handle);
  window.addEventListener(EVENT_KEY, handleEvent);
  return () => {
    window.removeEventListener('storage', handle);
    window.removeEventListener(EVENT_KEY, handleEvent);
  };
};

export const getSavedWorkoutsKey = () => PLAN_KEY;
