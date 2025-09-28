export interface User {
  id: string;
  email: string;
  username: string;
  password?: string;
  avatar?: string;
}
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
  type: 'strength' | 'cardio' | 'flexibility' | 'rest' | 'mixed';
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
