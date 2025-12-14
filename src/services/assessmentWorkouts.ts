import { loadSavedNames, persistSavedNames } from '../utils/savedNames';
import { getAllWorkouts, mapLevel, Workout } from './workoutLibrary';

const normalizeTermArray = (input: any): string[] => {
  if (Array.isArray(input)) {
    return input.map((value) => String(value || '').toLowerCase()).filter(Boolean);
  }
  if (typeof input === 'string') {
    return input.split(/[,/]/).map((part) => part.trim().toLowerCase()).filter(Boolean);
  }
  return [];
};

const CATEGORY_KEYWORDS: Array<{ key: string; keywords: string[] }> = [
  { key: 'strength', keywords: ['strength', 'muscle', 'hypertrophy', 'lean muscle', 'resistance', 'tone'] },
  { key: 'stretching', keywords: ['stretch', 'flexibility', 'flex', 'mobility', 'range of motion', 'warm-up', 'cooldown', 'recovery'] },
  { key: 'cardio', keywords: ['cardio', 'endurance', 'run', 'cycling', 'bike', 'aerobic', 'row', 'hiit', 'metcon', 'heart'] },
  { key: 'powerlifting', keywords: ['powerlifting', 'deadlift', 'bench', 'squat', 'max'] },
  { key: 'olympic-weightlifting', keywords: ['olympic', 'snatch', 'clean', 'jerk'] },
  { key: 'plyometrics', keywords: ['plyometric', 'plyo', 'jump', 'explosive', 'bounding'] },
  { key: 'strongman', keywords: ['strongman', 'yoke', 'atlas', 'farmers', 'log press', 'tire flip'] }
];

const categoriseGoal = (goalText: string) => {
  if (goalText.includes('strength') || goalText.includes('muscle')) return 'strength';
  if (goalText.includes('stretch') || goalText.includes('flex') || goalText.includes('mobility')) return 'stretching';
  if (goalText.includes('cardio') || goalText.includes('endurance')) return 'cardio';
  if (goalText.includes('power')) return 'powerlifting';
  return '';
};

const flattenAssessmentValues = (value: any): string[] => {
  if (!value) return [];
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.map((v) => String(v || '')).filter(Boolean);
  return [];
};

const collectAssessmentText = (assessment: any): string[] => {
  if (!assessment) return [];
  const fields = [
    assessment.goal,
    assessment.primaryGoal,
    assessment.motivation,
    assessment.specificGoals,
    assessment.goals,
    assessment.preferences,
    assessment.focusAreas,
    assessment.focus,
    assessment.exerciseFormat,
    assessment.preferredWorkoutTypes,
    assessment.dislikes,
    assessment.concerns
  ];
  return fields.flatMap(flattenAssessmentValues).map((value) => value.toLowerCase().trim()).filter(Boolean);
};

const deriveCategoryKeys = (assessment: any): string[] => {
  const terms = collectAssessmentText(assessment);
  const found = new Set<string>();
  terms.forEach((term) => {
    CATEGORY_KEYWORDS.forEach(({ key, keywords }) => {
      keywords.forEach((keyword) => {
        if (term.includes(keyword)) {
          found.add(key);
        }
      });
    });
  });
  const fallbackGoal = categoriseGoal(String(assessment?.goal || assessment?.primaryGoal || assessment?.motivation || '').toLowerCase());
  if (fallbackGoal) found.add(fallbackGoal);
  return Array.from(found);
};

const DIFFICULTY_RANKS: Record<string, number> = {
  easy: 0,
  medium: 1,
  hard: 2,
  varies: 1
};

const getDifficultyRank = (value?: string | null): number => {
  if (!value) return DIFFICULTY_RANKS.varies;
  const normalized = value.toString().trim().toLowerCase();
  if (normalized.includes('easy') || normalized.includes('beginner')) return DIFFICULTY_RANKS.easy;
  if (normalized.includes('medium') || normalized.includes('intermediate')) return DIFFICULTY_RANKS.medium;
  if (normalized.includes('hard') || normalized.includes('advanced')) return DIFFICULTY_RANKS.hard;
  return DIFFICULTY_RANKS[normalized] ?? DIFFICULTY_RANKS.varies;
};

const getAssessmentDifficultyThreshold = (assessment: any): number => {
  if (!assessment) return DIFFICULTY_RANKS.hard;
  const candidates = [
    assessment.fitnessLevel,
    assessment.level,
    assessment.experience,
    assessment.experienceLevel
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const normalized = candidate.toString().split(/[-–]/)[0].trim().toLowerCase();
    if (normalized.includes('beginner')) return DIFFICULTY_RANKS.easy;
    if (normalized.includes('intermediate')) return DIFFICULTY_RANKS.medium;
    if (normalized.includes('advanced')) return DIFFICULTY_RANKS.hard;
  }
  return DIFFICULTY_RANKS.hard;
};

export const pickWorkoutsFromAssessment = (assessment: any, limit = 20): Workout[] => {
  if (!assessment) return [];
  const workouts = getAllWorkouts();
  const goalCategoryKeys = deriveCategoryKeys(assessment);
  const focusTerms = normalizeTermArray(
    assessment.focusAreas ||
    assessment.targetMuscles ||
    assessment.primaryMuscles ||
    assessment.focus ||
    assessment.preferences ||
    ''
  );
  const difficultyThreshold = getAssessmentDifficultyThreshold(assessment);
  const allowedWorkouts = workouts.filter((workout) => getDifficultyRank(workout.difficultyKey) <= difficultyThreshold);
  if (!allowedWorkouts.length) return [];
  const scored = allowedWorkouts.map((workout) => {
    let score = 0;
    if (goalCategoryKeys.length) {
      goalCategoryKeys.forEach((categoryKey) => {
        if (categoryKey && workout.categoryKey === categoryKey) {
          score += 3;
        }
      });
    }
    if (focusTerms.length) {
      const muscles = [...(workout.primaryMuscles || []), ...(workout.secondaryMuscles || [])].map((muscle) => (muscle || '').toLowerCase());
      focusTerms.forEach((term) => {
        if (muscles.some((muscle) => muscle.includes(term))) {
          score += 2;
        }
      });
    }
    const assessLevel = assessment.level || assessment.experience || assessment.experienceLevel || assessment.fitnessLevel;
    if (assessLevel) {
      const assessKey = mapLevel(assessLevel).toLowerCase();
      if (assessKey && workout.difficultyKey === assessKey) {
        score += 1;
      }
    }
    return { workout, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const selected: Workout[] = [];
  const addedTitles = new Set<string>();
  const addWorkout = (item: Workout): boolean => {
    if (!item || !item.title) return false;
    if (addedTitles.has(item.title)) return false;
    if (selected.length >= limit) return true;
    addedTitles.add(item.title);
    selected.push(item);
    return selected.length >= limit;
  };

  const addFromEntries = (entries: Array<{ workout: Workout; score: number }>, maxForCategory = Infinity) => {
    let addedForCategory = 0;
    for (const entry of entries) {
      if (addedForCategory >= maxForCategory) break;
      if (addWorkout(entry.workout)) {
        return true;
      }
      addedForCategory += 1;
    }
    return false;
  };

  if (goalCategoryKeys.length) {
    const perCategoryQuota = Math.max(1, Math.floor(limit / goalCategoryKeys.length));
    for (const categoryKey of goalCategoryKeys) {
      const matches = scored.filter((entry) => entry.workout.categoryKey === categoryKey);
      if (matches.length && addFromEntries(matches, perCategoryQuota)) {
        break;
      }
    }
  }
  if (selected.length < limit) {
    addFromEntries(scored);
  }

  const finalSelection = selected.length
    ? selected.slice(0, limit)
    : allowedWorkouts.slice(0, Math.min(limit, allowedWorkouts.length));
  return finalSelection;
};

export const autoSaveWorkoutsFromAssessment = (assessment: any) => {
  const picks = pickWorkoutsFromAssessment(assessment, 20);
  if (!Array.isArray(picks) || !picks.length) {
    return { added: 0, picks: [] };
  }
  if (typeof window === 'undefined') {
    return {
      added: 0,
      picks: picks.map((p) => p.title).filter(Boolean)
    };
  }

  const existing = loadSavedNames();
  const updated = [...existing];
  let added = 0;
  picks.forEach((workout) => {
    const title = workout.title;
    if (!title) return;
    if (!updated.includes(title)) {
      updated.push(title);
      added += 1;
    }
  });
  if (added > 0) {
    persistSavedNames(updated);
  }
  return {
    added,
    picks: picks.map((p) => p.title).filter(Boolean)
  };
};
