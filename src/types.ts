export interface User {
  id: string;
  email: string;
  username: string;
  password?: string;
  avatar?: string;
  // Optional shop/profile fields
  energy?: number;
  maxEnergy?: number;
  streak?: number;
  token?: string;
  inventory?: any[];
}

export type WorkoutType =
  | 'strength'
  | 'cardio'
  | 'plyometrics'
  | 'powerlifting'
  | 'olympic'
  | 'stretching'
  | 'strongman'
  | 'rest'
  | 'flexibility'
  | 'mixed'
  | 'bodyweight'
  | 'dumbbell'
  | 'barbell'
  | 'kettlebell'
  | 'mobility'
  | 'hiit'
  | 'uncategorized';

export interface Exercise {
  name: string;
  sets?: number;
  reps?: string;
  duration?: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  muscleGroups: string[];
  equipment?: string[];
  scheduledTime?: string;
}

export interface DayWorkout {
  date: string;
  workouts: Exercise[];
  alternativeWorkouts: Exercise[];
  completed: boolean;
  totalTime?: string; // overall workout duration, e.g., '30 minutes'
  type: WorkoutType;
  // Optional multi-type support (first entry is treated as primary)
  types?: WorkoutType[];
  // Track which types within this day have been completed
  completedTypes?: WorkoutType[];
  // Flag days bridged by multiple streak savers
  streakSaverBridge?: boolean;
}

export interface WorkoutPlan {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  dailyWorkouts: DayWorkout[];
  totalDays: number;
  weeklyStructure: string[];
}

export interface UserPreferences {
  fitnessLevel: 'beginner' | 'intermediate' | 'advanced';
  goals: string[];
  timeAvailable: number; // minutes per day
  daysPerWeek: number;
  preferredWorkoutTypes: string[];
  equipment: string[];
  injuries?: string[];
  preferredTime: 'morning' | 'afternoon' | 'evening' | 'any';
}
