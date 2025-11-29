import { DayWorkout, WorkoutType } from '../types';

const normalizeTypeValue = (value: WorkoutType | string | null | undefined): WorkoutType | null => {
  if (!value) return null;
  const raw = value.toString().toLowerCase().trim();
  if (raw.includes('olympic')) return 'olympic';
  if (raw.includes('cardio')) return 'cardio';
  if (raw.includes('plyo')) return 'plyometrics';
  if (raw.includes('power')) return 'powerlifting';
  if (raw.includes('stretch') || raw.includes('flex') || raw.includes('mobility')) return 'stretching';
  if (raw.includes('strong')) return 'strongman';
  if (raw.includes('rest')) return 'rest';
  if (raw.includes('strength')) return 'strength';
  return raw as WorkoutType;
};

export const normalizeTypesExclusiveRest = (typesInput: (WorkoutType | string | null | undefined)[]): WorkoutType[] => {
  const filtered = (typesInput || [])
    .map(normalizeTypeValue)
    .filter(Boolean) as WorkoutType[];
  const unique = Array.from(new Set(filtered)) as WorkoutType[];
  if (unique.includes('rest') && unique.length > 1) {
    return ['rest'];
  }
  const filteredOutMixed = unique.filter((t) => t !== 'mixed');
  const normalized = filteredOutMixed.length > 0 ? filteredOutMixed : unique;
  if (normalized.length === 0) return ['strength'];
  return normalized.slice(0, 4) as WorkoutType[];
};

export const resolveWorkoutTypes = (workout: DayWorkout): WorkoutType[] => {
  const raw = (workout as any)?.types;
  const types = Array.isArray(raw) ? raw.filter(Boolean) : [];
  if (types.length === 0 && workout.type) types.push(workout.type);
  return normalizeTypesExclusiveRest(types as WorkoutType[]);
};

export const getPrimaryType = (workout: DayWorkout): WorkoutType => {
  const types = resolveWorkoutTypes(workout);
  return types[0] || 'mixed';
};

export const isWorkoutCompleteForStreak = (workout?: DayWorkout | null): boolean => {
  if (!workout) return false;
  const primary = getPrimaryType(workout);
  if (primary === 'rest') return false;
  const types = resolveWorkoutTypes(workout);
  if (types.length === 0) return !!workout.completed;
  const completedTypes = (workout.completedTypes || []).filter(t => types.includes(t));
  return completedTypes.length === types.length || !!workout.completed;
};
