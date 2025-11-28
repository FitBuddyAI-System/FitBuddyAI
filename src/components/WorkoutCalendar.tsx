import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Play, Check, Clock, Target, Edit3, Plus, Settings, Save, X, Trash2, Dumbbell, Flame } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { WorkoutPlan, DayWorkout, WorkoutType } from '../types';
import { UserData } from '../services/aiService';
import WorkoutModal from './WorkoutModal';
import './WorkoutCalendar.css';
import { generateWorkoutPlan, generateWorkoutForDay } from '../services/aiService';
import { loadQuestionnaireProgress, loadUserData, loadWorkoutPlan, saveUserData, saveWorkoutPlan } from '../services/localStorage';
import { restoreUserDataFromServer, backupUserDataToServer } from '../services/cloudBackupService';

interface WorkoutCalendarProps {
  workoutPlan: WorkoutPlan | null;
  userData: UserData | null;
  onUpdatePlan: (plan: WorkoutPlan) => void;
}

const WorkoutCalendar: React.FC<WorkoutCalendarProps> = ({ workoutPlan, userData, onUpdatePlan }) => {
  // Ref to throttle drag-based month navigation
  const lastDragNav = useRef<number>(0);
  // Ref to debounce the select-to-add toggle to avoid double-invocation
  const lastSelectToggleRef = useRef<number>(0);
  const initialStoredDate = (() => {
    try {
      const raw = sessionStorage.getItem('fitbuddyai_calendar_last_date');
      if (raw) {
        const parsed = new Date(raw);
        if (!Number.isNaN(parsed.getTime())) return parsed;
      }
    } catch {}
    return new Date();
  })();
  const initialStoredPlanId = (() => {
    try { return sessionStorage.getItem('fitbuddyai_last_plan_id'); } catch { return null; }
  })();
  const [currentDate, setCurrentDate] = useState(initialStoredDate);
  const [selectedDay, setSelectedDay] = useState<DayWorkout | null>(null);
  const [showWorkoutModal, setShowWorkoutModal] = useState(false);
  const [loadingDate, setLoadingDate] = useState<string | null>(null);
  const [showEditMenu, setShowEditMenu] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<DayWorkout | null>(null);
  const [isEditing, setIsEditing] = useState(false);  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showWorkoutDatePicker, setShowWorkoutDatePicker] = useState(false);
  // Add add mode state
  const [addMode, setAddMode] = useState(false);
  const [selectedForAdd, setSelectedForAdd] = useState<string[]>([]);
  const [showBatchAddPanel, setShowBatchAddPanel] = useState(false);
  const [batchTypes, setBatchTypes] = useState<string[]>(['strength']);
  const [batchComments, setBatchComments] = useState('');
  const [loadingDates, setLoadingDates] = useState<string[]>([]);
  const [selectedAddDate, setSelectedAddDate] = useState<string>('');
  // When true, the next calendar day click will assign a rest day and then clear this flag
  const [pendingRestAssignment, setPendingRestAssignment] = useState(false);
  const [selectedWorkoutDate, setSelectedWorkoutDate] = useState<string>('');const [draggedWorkout, setDraggedWorkout] = useState<DayWorkout | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedLegendType, setDraggedLegendType] = useState<string | null>(null);
  const [isLegendDropTarget, setIsLegendDropTarget] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [lastUpdatedDate, setLastUpdatedDate] = useState<string | null>(null);
  const [isManualDateChange, setIsManualDateChange] = useState(false);
  const [selectedWorkoutType, setSelectedWorkoutType] = useState('strength');
  const [workoutPreferences, setWorkoutPreferences] = useState({
    duration: '30 min',
    muscleGroups: [],
    equipment: []
  });
  // Add delete mode state
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedForDeletion, setSelectedForDeletion] = useState<string[]>([]);
  const previewPlanSeededRef = useRef(false);
  const lastPlanIdRef = useRef<string | null>(initialStoredPlanId);
  const guestUserData: UserData = {
    username: 'Guest',
    age: 28,
    fitnessLevel: 'beginner',
    goals: ['Get active'],
    timeAvailable: 30,
    equipment: [],
    preferences: ['Preview mode user'],
    exerciseFormat: 'bodyweight',
    daysPerWeek: '3'
  };
  const effectiveUserData: UserData = userData || guestUserData;
  const isGuestUser = !userData;

  useEffect(() => {
    if (workoutPlan || previewPlanSeededRef.current) return;
    // If a saved plan exists (or the user is signed in), do NOT seed the preview
    try {
      const storedPlan = loadWorkoutPlan();
      if (storedPlan && Array.isArray(storedPlan.dailyWorkouts) && storedPlan.dailyWorkouts.length > 0) {
        onUpdatePlan(storedPlan);
        return;
      }
      const storedUser = loadUserData();
      if (storedUser?.id) return;
    } catch (err) {
      console.warn('Preview seed guard failed to read storage:', err);
    }
    const today = new Date();
    const start = format(today, 'yyyy-MM-dd');
    const endDateObj = new Date(today.getTime() + 6 * 24 * 60 * 60 * 1000);
    const end = format(endDateObj, 'yyyy-MM-dd');
    const previewDays: DayWorkout[] = Array.from({ length: 7 }).map((_, idx) => {
      const date = new Date(today.getTime() + idx * 24 * 60 * 60 * 1000);
      const dateStr = format(date, 'yyyy-MM-dd');
      const type = idx % 3 === 0 ? 'strength' : idx % 3 === 1 ? 'cardio' : 'rest';
      const isRest = type === 'rest';
      return {
        date: dateStr,
        type: type as DayWorkout['type'],
        completed: false,
        totalTime: isRest ? '0 min' : '30 min',
        workouts: isRest
          ? [{
              name: 'Rest Day',
              description: 'Take a breather before your next session.',
              difficulty: 'beginner',
              duration: '0 min',
              reps: '',
              muscleGroups: [],
              equipment: []
            }]
          : [{
              name: idx % 3 === 0 ? 'Bodyweight Circuit' : 'Tempo Walk',
              description: idx % 3 === 0
                ? 'Squats, pushups, and lunges to warm up your whole body.'
                : 'Light cardio to keep you moving.',
              difficulty: 'beginner',
              duration: '30 minutes',
              reps: idx % 3 === 0 ? '3 rounds' : '20 min',
              muscleGroups: idx % 3 === 0 ? ['full body'] : ['cardio'],
              equipment: idx % 3 === 0 ? [] : ['sneakers']
            }],
        alternativeWorkouts: []
      };
    });
    const previewPlan: WorkoutPlan = {
      id: 'preview-plan',
      name: 'Preview Plan',
      description: 'Preview the schedule builder. Complete the questionnaire to personalize your plan.',
      startDate: start,
      endDate: end,
      totalDays: previewDays.length,
      weeklyStructure: ['Strength', 'Cardio', 'Rest', 'Strength', 'Cardio', 'Rest', 'Mixed'],
      dailyWorkouts: previewDays
    };
    previewPlanSeededRef.current = true;
    onUpdatePlan(previewPlan);
  }, [workoutPlan, onUpdatePlan]);

  useEffect(() => {
    if (!workoutPlan || workoutPlan.dailyWorkouts.length === 0) return;
    const planId = workoutPlan.id || 'plan';
    const isNewPlan = lastPlanIdRef.current !== planId;
    // Only auto-jump on first load of a new plan; keep user's month when editing
    if (isManualDateChange || !isNewPlan) {
      lastPlanIdRef.current = planId;
      try { sessionStorage.setItem('fitbuddyai_last_plan_id', planId); } catch {}
      return;
    }
    // Parse the start date as local date instead of UTC, but guard against missing/malformed startDate
    try {
      if (workoutPlan.startDate && typeof workoutPlan.startDate === 'string' && workoutPlan.startDate.includes('-')) {
        const parts = workoutPlan.startDate.split('-').map(Number);
        if (parts.length === 3 && !parts.some(p => Number.isNaN(p))) {
          const [year, month, day] = parts;
          setCurrentDate(new Date(year, month - 1, day));
          lastPlanIdRef.current = planId;
          try { sessionStorage.setItem('fitbuddyai_last_plan_id', planId); } catch {}
          return;
        }
      }
      // Fallback: use the first day in the plan if available
      const first = workoutPlan.dailyWorkouts[0];
      if (first && first.date && typeof first.date === 'string' && first.date.includes('-')) {
        const p = first.date.split('-').map(Number);
        if (p.length === 3 && !p.some(x => Number.isNaN(x))) {
          setCurrentDate(new Date(p[0], p[1] - 1, p[2]));
          lastPlanIdRef.current = planId;
          try { sessionStorage.setItem('fitbuddyai_last_plan_id', planId); } catch {}
          return;
        }
      }
      // Last resort: keep today's date (already set by useState)
    } catch (err) {
      console.warn('Failed to parse workoutPlan start date, using current date:', err);
    }
    lastPlanIdRef.current = planId;
    try { sessionStorage.setItem('fitbuddyai_last_plan_id', planId); } catch {}
  }, [workoutPlan, isManualDateChange]);

  // Persist the last viewed calendar month so remounts don't reset the view
  useEffect(() => {
    try { sessionStorage.setItem('fitbuddyai_calendar_last_date', currentDate.toISOString()); } catch {}
  }, [currentDate]);

  // On mount: if user signed-in, attempt to restore server-saved workout/assessment data
  useEffect(() => {
    let mounted = true;
    const tryRestore = async () => {
      try {
        // If parent already provided a plan, don't overwrite it with server data.
        if (workoutPlan && workoutPlan.dailyWorkouts && workoutPlan.dailyWorkouts.length > 0) return;
        // Respect cross-tab guard set on logout
        try { if (localStorage.getItem('fitbuddyai_no_auto_restore') || sessionStorage.getItem('fitbuddyai_no_auto_restore')) return; } catch {}
        const user = loadUserData();
        if (!user || !user.id) return;
        await restoreUserDataFromServer(user.id);
        if (!mounted) return;
        // If server restore populated a workout plan in localStorage, load it and push to parent via onUpdatePlan
        const localPlan = loadWorkoutPlan();
        if (localPlan) {
          onUpdatePlan(localPlan);
        }
      } catch (err) {
        console.warn('Failed to restore server data in WorkoutCalendar:', err);
      }
    };

  // (rickroll assignment moved below after restWorkout creation)
    tryRestore();
    return () => { mounted = false; };
  }, [onUpdatePlan]);

  useEffect(() => {
    // no-op: kept for potential future side-effects when workoutPlan changes
  }, [workoutPlan]);

  // Persist multi-type days to user profile for history/backup
  useEffect(() => {
    if (!workoutPlan) return;
    try {
      const existingUser = loadUserData();
      if (!existingUser) return;
      const nextUser = { ...existingUser, workouts: workoutPlan.dailyWorkouts };
      saveUserData({ data: nextUser });
    } catch (err) {
      console.warn('Failed to persist multi-type workouts to profile:', err);
    }
  }, [workoutPlan]);

  useEffect(() => {
    if (!workoutPlan) return;
    rewardCompletedPastDays(workoutPlan.dailyWorkouts);
  }, [workoutPlan]);

  useEffect(() => {}, []);

  // Apply widths to progress-fill elements based on their `data-progress` attribute.
  // This avoids inline JSX styles which some tooling warns about.
  useEffect(() => {
    const update = () => {
      try {
        document.querySelectorAll('.progress-fill[data-progress]').forEach(el => {
          const v = el.getAttribute('data-progress');
          if (v) (el as HTMLElement).style.width = v;
        });
      } catch (e) {
        // ignore
      }
    };
    update();
    // Also update on DOM mutations (helpful when calendar cells rerender)
    const mo = new MutationObserver(update);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [workoutPlan, selectedDay, currentDate, loadingDates]);

  useEffect(() => {
    if (workoutPlan) {
      // 1) Normalize any 'mixed' entries that are empty -> convert to explicit rest days
      let updatedWorkouts = workoutPlan.dailyWorkouts.map(workout => {
        const hasNoExercises = !workout.workouts || workout.workouts.length === 0;
        const hasNoTime = !workout.totalTime || workout.totalTime.toString().trim().startsWith('0');
        if ((workout.type as string) === 'mixed' && hasNoExercises && hasNoTime) {
          const rest = {
            ...workout,
            type: 'rest' as const,
            workouts: [{
              name: 'Rest Day',
              description: 'Take a well-deserved break and let your body recover.',
              duration: '0 min',
              difficulty: 'beginner' as const,
              muscleGroups: []
            }],
            alternativeWorkouts: []
          } as any;
          // 1 in 1,000,000 chance to mark as a special rickroll rest day
          if (Math.random() < 1 / 1000000) rest.isRickroll = true;
          return rest;
        }
        return workout;
      });

      // 2) If the plan defines a weeklyStructure, ensure missing 'Rest' days are present
      try {
        const pattern = Array.isArray(workoutPlan.weeklyStructure) ? workoutPlan.weeklyStructure : [];
        const totalDays = typeof workoutPlan.totalDays === 'number' && workoutPlan.totalDays > 0
          ? workoutPlan.totalDays
          : (workoutPlan.dailyWorkouts ? workoutPlan.dailyWorkouts.length : 0);

        if (workoutPlan.startDate && totalDays > 0 && pattern.length === 7) {
          const startParts = workoutPlan.startDate.split('-').map(Number);
          if (startParts.length === 3) {
            const start = new Date(startParts[0], startParts[1] - 1, startParts[2]);
            // build a set of existing dates for quick lookup
            const existingDates = new Set((updatedWorkouts || []).map(w => w.date));

            for (let i = 0; i < totalDays; i++) {
              const d = new Date(start.getTime());
              d.setDate(start.getDate() + i);
              const dateStr = format(d, 'yyyy-MM-dd');
              const patternIndex = i % 7;
              const slot = (pattern[patternIndex] || '').toString().toLowerCase();
              if (slot.includes('rest')) {
                // if there's no existing entry for this date, insert a Rest Day
                if (!existingDates.has(dateStr)) {
                  const restWorkout = {
                    date: dateStr,
                    workouts: [{
                      name: 'Rest Day',
                      description: 'Take a well-deserved break and let your body recover.',
                      duration: '0 min',
                      difficulty: 'beginner',
                      muscleGroups: []
                    }],
                    alternativeWorkouts: [],
                    completed: false,
                    type: 'rest'
                  } as any;
                  // 1 in 1,000,000 chance to convert this rest day into a rickroll rest day
                  if (Math.random() < 1 / 1000000) restWorkout.isRickroll = true;
                  updatedWorkouts = [...updatedWorkouts, restWorkout];
                  existingDates.add(dateStr);
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn('Failed to populate missing rest days from weeklyStructure:', err);
      }

      // Enforce that Rest days never mix with other categories
      updatedWorkouts = updatedWorkouts.map(workout => {
        const normalizedTypes = resolveWorkoutTypes(workout);
        const normalizedCompletedTypes = Array.isArray(workout.completedTypes)
          ? (workout.completedTypes as WorkoutType[]).filter((t: WorkoutType) => normalizedTypes.includes(t))
          : [];
        return {
          ...workout,
          type: (normalizedTypes[0] || workout.type || 'mixed') as WorkoutType,
          types: normalizedTypes,
          completedTypes: normalizedCompletedTypes,
          completed: normalizedTypes.length > 0 ? normalizedCompletedTypes.length === normalizedTypes.length : !!workout.completed
        };
      });

      if (JSON.stringify(updatedWorkouts) !== JSON.stringify(workoutPlan.dailyWorkouts)) {
        // Persist normalized plan immediately so UI reflects rest-days for empty/mixed or missing entries
        const normalizedPlan = { ...workoutPlan, dailyWorkouts: updatedWorkouts, totalDays: updatedWorkouts.length };
        onUpdatePlan(normalizedPlan);
  try { console.log('[WorkoutCalendar] Saving normalized plan to localStorage:', { totalDays: normalizedPlan.totalDays, dailyWorkoutsCount: normalizedPlan.dailyWorkouts.length }); saveWorkoutPlan(normalizedPlan); } catch (err) { console.warn('Failed to save normalized plan locally:', err); }
      }
    }
  }, [workoutPlan, onUpdatePlan]);

  const displayName = (userData?.username?.trim()) || effectiveUserData.username || effectiveUserData.name || 'Guest';

  if (!workoutPlan) {
    return (
      <div className="calendar-page">
        <div className="calendar-container">
          <div className="calendar-preview-callout fade-in-bounce">
            <div className="calendar-no-plan-icon-bg">
              <Dumbbell size={48} color="#fff" />
            </div>
            <h2 className="calendar-no-plan-message">Building a preview schedule...</h2>
            <p className="calendar-no-plan-desc">Hang tight — a starter calendar will load so you can explore the schedule builder before filling the questionnaire.</p>
            <a className="calendar-no-plan-btn" href="/questionnaire">Start questionnaire</a>
          </div>
        </div>
      </div>
    );
  }

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const legendCategories: Array<{ type: WorkoutType; label: string; colorClass: string; title: string }> = [
    { type: 'strength', label: 'Strength Training', colorClass: 'strength', title: 'Drag onto a date to generate a strength workout' },
    { type: 'cardio', label: 'Cardio', colorClass: 'cardio', title: 'Drag onto a date to generate a cardio workout' },
    { type: 'plyometrics', label: 'Plyometrics', colorClass: 'plyometrics', title: 'Drag onto a date to generate a plyometrics workout' },
    { type: 'powerlifting', label: 'Powerlifting', colorClass: 'powerlifting', title: 'Drag onto a date to generate a powerlifting workout' },
    { type: 'stretching', label: 'Stretching', colorClass: 'stretching', title: 'Drag onto a date to generate a stretching session' },
    { type: 'strongman', label: 'Strongman', colorClass: 'strongman', title: 'Drag onto a date to generate a strongman workout' },
    { type: 'rest', label: 'Rest Day', colorClass: 'rest', title: 'Drag onto a date to add a rest day' },
  ];

  // Determine the weekday index for the first day of the month (0 = Sun .. 6 = Sat)
  const monthStartIndex = monthStart.getDay();

  const normalizeTypesExclusiveRest = (typesInput: (WorkoutType | string | null | undefined)[]): WorkoutType[] => {
    const filtered = (typesInput || []).filter(Boolean) as WorkoutType[];
    const unique = Array.from(new Set(filtered)) as WorkoutType[];
    if (unique.includes('rest') && unique.length > 1) {
      return ['rest'];
    }
    return unique.slice(0, 4) as WorkoutType[];
  };

  const mergeTypesWithRestGuard = (existingTypes: WorkoutType[], incomingType: WorkoutType): WorkoutType[] => {
    const normalizedExisting = normalizeTypesExclusiveRest(existingTypes);
    if (normalizedExisting.includes('rest')) return ['rest'];
    if (incomingType === 'rest') return ['rest'];
    return normalizeTypesExclusiveRest([...normalizedExisting, incomingType]);
  };

  const formatDate = (dateInput: string | Date) => {
    let date;
    if (typeof dateInput === 'string') {
      if (dateInput.includes('T')) {
        // Handle ISO string
        date = new Date(dateInput);
      } else {
        // Handle YYYY-MM-DD string
        const [year, month, day] = dateInput.split('-').map(Number);
        date = new Date(year, month - 1, day);
      }
    } else {
      date = dateInput;
    }

    if (isNaN(date.getTime())) {
      throw new RangeError('Invalid time value');
    }

    return format(date, 'yyyy-MM-dd');
  };

  // Normalize per-day types to an array (max 4, de-duped) for rendering and logic
  const resolveWorkoutTypes = (workout: DayWorkout): WorkoutType[] => {
    const raw = (workout as any)?.types;
    const types = Array.isArray(raw) ? raw.filter(Boolean) : [];
    if (types.length === 0 && workout.type) types.push(workout.type);
    return normalizeTypesExclusiveRest(types as WorkoutType[]);
  };

  const getPrimaryType = (workout: DayWorkout): WorkoutType => {
    const types = resolveWorkoutTypes(workout);
    return types[0] || 'mixed';
  };

  // Normalize to midnight and check if the target date has already passed
  const isDateInPast = (date: Date) => {
    const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return normalized < today;
  };

  const isDateToday = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return normalized.getTime() === today.getTime();
  };

  const getWorkoutForDate = (date: Date): DayWorkout | null => {
  const dateString = formatDate(date.toISOString());
  const workout = workoutPlan.dailyWorkouts.find(workout => workout.date === dateString) || null;
  return workout;
  };  const handleDayClick = (date: Date) => {
     const dateString = format(date, 'yyyy-MM-dd');
    // If in add/select mode, toggle selection instead of opening modal
    if (addMode) {
      setSelectedForAdd(prev => prev.includes(dateString) ? prev.filter(d => d !== dateString) : [...prev, dateString]);
      return;
    }
    // If user chose the one-click "Add Rest Day" flow, assign rest and exit
    if (pendingRestAssignment) {
      // ignore if the cell is currently loading or during drag
      if (loadingDate === dateString || isDragging) return;
  // subtract one day from the clicked date (handles month/year rollover)
  const adjusted = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1);
      handleAddRestDay(adjusted);
      setPendingRestAssignment(false);
      setLastUpdatedDate(dateString);
      return;
    }

    // Block clicks on loading day or during drag
    if (loadingDate === dateString || isDragging) return;

    if (deleteMode) {
      // Toggle selection for deletion (multi-select)
      setSelectedForDeletion(prev => prev.includes(dateString) ? prev.filter(d => d !== dateString) : [...prev, dateString]);
      return;
    }
    
    const workout = getWorkoutForDate(date);
    
    // If in edit mode and workout exists, edit it
    if (showEditMenu && workout) {
      handleEditWorkout(workout);
      return;
    }
      // If in edit mode and no workout, add a rest day (user clicks a cell inside the edit menu)
      if (showEditMenu && !workout) {
    const adjusted = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1);
    handleAddRestDay(adjusted);
        return;
      }
    
    // Normal mode - show workout modal
    if (workout) {
      setSelectedDay(workout);
      setShowWorkoutModal(true);
    }
  };

  const handleCompleteWorkout = (workoutDate: string, type?: WorkoutType) => {
    const [y, m, d] = workoutDate.split('-').map(Number);
    const target = new Date(y, m - 1, d);
    if (!isDateToday(target)) {
      alert('You can only complete or undo today\'s workout.');
      return;
    }
    const updatedWorkouts = workoutPlan.dailyWorkouts.map(workout => {
      if (workout.date !== workoutDate) return workout;

      const types = resolveWorkoutTypes(workout);
      const targetType = type || types[0] || workout.type;
      const currentCompleted = Array.isArray(workout.completedTypes) ? workout.completedTypes : (workout.completed ? types : []);
      let nextCompleted = currentCompleted;

      if (targetType) {
        if (currentCompleted.includes(targetType)) {
          nextCompleted = currentCompleted.filter(t => t !== targetType);
        } else {
          nextCompleted = [...currentCompleted, targetType];
        }
      }

      // only keep types that still exist
      nextCompleted = nextCompleted.filter(t => types.includes(t));
      const isAllComplete = types.length > 0
        ? nextCompleted.length === types.length
        : !workout.completed;

      return {
        ...workout,
        completed: isAllComplete,
        completedTypes: types.length > 0 ? nextCompleted : []
      };
    });

    const updatedPlan = { ...workoutPlan, dailyWorkouts: updatedWorkouts };
    onUpdatePlan(updatedPlan);
    updateStreakCounter(updatedWorkouts);
    const refreshedDay = updatedWorkouts.find(w => w.date === workoutDate);
    if (refreshedDay) setSelectedDay(refreshedDay);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    // Mark this as a manual change so incoming plan updates don't jump the view
    setIsManualDateChange(true);
    setCurrentDate(newDate);
    // Reset manual flag after a short grace period so plan-driven sync can resume
    window.setTimeout(() => setIsManualDateChange(false), 2000);
  };

  const getWorkoutTypeColor = (type: WorkoutType | string | undefined) => {
    switch (type) {
      case 'strength':
        return 'strength';
      case 'cardio':
        return 'cardio';
      case 'flexibility':
        return 'flexibility';
      case 'rest':
        return 'rest';
      case 'mixed':
        return 'mixed';
      default:
        return 'mixed';
    }
  };

  const getWorkoutTypeLabel = (types: WorkoutType[]) => {
    const formatSingle = (type: WorkoutType) => {
      switch (type) {
        case 'strength': return 'Strength';
        case 'cardio': return 'Cardio';
        case 'flexibility': return 'Flexibility';
        case 'rest': return 'Rest';
        default: return 'Mixed';
      }
    };
    if (!types || types.length === 0) return 'Mixed';
    if (types.length > 1) return types.map(formatSingle).join(' / ');
    return formatSingle(types[0]);
  };

  const completedWorkouts = workoutPlan.dailyWorkouts.filter(w => w.completed && getPrimaryType(w) !== 'rest').length;
  const totalWorkouts = workoutPlan.dailyWorkouts.filter(w => getPrimaryType(w) !== 'rest').length;
  const progressPercentage = totalWorkouts > 0 ? (completedWorkouts / totalWorkouts) * 100 : 0;

  // Calculate total workout time by summing individual workout durations
  const getWorkoutDuration = (workout: DayWorkout): string => {
    const formatMinutes = (mins: number) => {
      if (mins >= 60) {
        const hours = Math.floor(mins / 60);
        const remaining = mins % 60;
        return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
      }
      return `${mins} min`;
    };

    const parseDurationToMinutes = (value?: string) => {
      if (!value) return 0;
      const lower = value.toString().toLowerCase().trim();

      // Handle HH:MM style strings
      const clockMatch = lower.match(/^(\d{1,2}):(\d{2})$/);
      if (clockMatch) {
        const hrs = parseInt(clockMatch[1], 10);
        const mins = parseInt(clockMatch[2], 10);
        return (Number.isNaN(hrs) ? 0 : hrs * 60) + (Number.isNaN(mins) ? 0 : mins);
      }

      let minutes = 0;
      const hourMatch = lower.match(/(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours)/);
      if (hourMatch) minutes += parseFloat(hourMatch[1]) * 60;

      const minuteMatch = lower.match(/(\d+(?:\.\d+)?)\s*(m|min|mins|minute|minutes)\b/);
      if (minuteMatch) minutes += parseFloat(minuteMatch[1]);

      const secondMatch = lower.match(/(\d+(?:\.\d+)?)\s*(s|sec|secs|second|seconds)\b/);
      if (secondMatch) minutes += parseFloat(secondMatch[1]) / 60;

      if (minutes === 0) {
        const fallbackNumber = parseFloat((lower.match(/(\d+(?:\.\d+)?)/) || [])[1] || '');
        if (!Number.isNaN(fallbackNumber)) minutes = fallbackNumber; // assume minutes if unit is missing
      }

      return Math.round(minutes);
    };

    if (getPrimaryType(workout) === 'rest') return '0 min';

    const totalMinutes = (workout.workouts || []).reduce((sum, exercise) => {
      const exerciseDuration = (exercise as any)?.duration || (exercise as any)?.totalTime;
      return sum + parseDurationToMinutes(exerciseDuration);
    }, 0);

    const fallbackMinutes = parseDurationToMinutes(workout.totalTime);
    const typeCount = resolveWorkoutTypes(workout).length || (workout.type ? 1 : 0);
    const safeTypeCount = Math.max(1, typeCount);

    // If we have explicit exercise durations, use them — but scale up when it's clearly per-type not aggregated
    if (totalMinutes > 0) {
      const likelyPerType = safeTypeCount > 1 && totalMinutes <= 45;
      const adjusted = likelyPerType ? totalMinutes * safeTypeCount : totalMinutes;
      return formatMinutes(adjusted);
    }

    if (fallbackMinutes > 0) {
      // Treat fallback as per-type duration when multiple types exist to avoid under-reporting
      const adjusted = fallbackMinutes * safeTypeCount;
      return formatMinutes(adjusted);
    }

    // Default: assume 30 minutes per type if no explicit durations are present
    const defaultMinutes = 30 * safeTypeCount;
    return formatMinutes(defaultMinutes);
  };

  const isWorkoutCompleteForStreak = (workout?: DayWorkout | null): boolean => {
    if (!workout) return false;
    const primary = getPrimaryType(workout);
    if (primary === 'rest') return false;
    const types = resolveWorkoutTypes(workout);
    if (types.length === 0) return !!workout.completed;
    const completedTypes = (workout.completedTypes || []).filter(t => types.includes(t));
    return completedTypes.length === types.length || !!workout.completed;
  };

  const computeStreak = (dailyWorkouts: DayWorkout[], targetDate?: Date): number => {
    const target = targetDate ? new Date(targetDate) : new Date();
    target.setHours(0, 0, 0, 0);
    const formatDay = (d: Date) => format(d, 'yyyy-MM-dd');
    const workoutMap = new Map(dailyWorkouts.map(w => [w.date, w]));
    const dayWorkout = workoutMap.get(formatDay(target));
    if (!isWorkoutCompleteForStreak(dayWorkout)) return 0;

    let streak = 1;
    for (let offset = 1; offset < 365; offset++) {
      const prev = new Date(target);
      prev.setDate(target.getDate() - offset);
      const prevKey = formatDay(prev);
      const prevWorkout = workoutMap.get(prevKey);
      if (!isWorkoutCompleteForStreak(prevWorkout)) break;
      streak += 1;
    }
    return streak;
  };

  const updateStreakCounter = (dailyWorkouts: DayWorkout[]) => {
    try {
      const streak = computeStreak(dailyWorkouts);
      const existingUser = loadUserData();
      if (!existingUser) return;
      const nextUser = { ...existingUser, streak };
      saveUserData({ data: nextUser });
      // Broadcast to any listeners that streak changed
      try {
        const ev = new CustomEvent('fitbuddyai-streak-updated', { detail: { streak } });
        window.dispatchEvent(ev);
      } catch {}
    } catch (err) {
      console.warn('Failed to update streak:', err);
    }
  };

  const rewardCompletedPastDays = (dailyWorkouts: DayWorkout[]) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let rewardedCount = 0;

      const updated = dailyWorkouts.map(w => {
        if (!isWorkoutCompleteForStreak(w)) return w;
        const [y, m, d] = w.date.split('-').map(Number);
        const dayDate = new Date(y, (m || 1) - 1, d || 1);
        if (dayDate >= today) return w;
        if ((w as any).energyRewarded) return w;
        rewardedCount += 1;
        return { ...w, energyRewarded: true } as DayWorkout;
      });

      if (rewardedCount === 0) return dailyWorkouts;

      const existingUser = loadUserData();
      if (existingUser) {
        const nextUser = {
          ...existingUser,
          energy: (existingUser.energy ?? 0) + rewardedCount * 250
        };
        saveUserData({ data: nextUser });
        window.dispatchEvent(new Event('storage'));
      }

      const updatedPlan = { ...(workoutPlan as any), dailyWorkouts: updated, totalDays: updated.length };
      onUpdatePlan(updatedPlan);
      try { saveWorkoutPlan(updatedPlan); } catch {}
      return updated;
    } catch (err) {
      console.warn('Failed to reward completed past days:', err);
      return dailyWorkouts;
    }
  };

  // Editing functions
  const handleEditWorkout = (workout: DayWorkout) => {
    setEditingWorkout({ ...workout });
    setIsEditing(true);
    setShowEditMenu(true);
  };

  const handleSaveWorkout = () => {
    if (!editingWorkout || !workoutPlan) return;
    
    const updatedWorkouts = workoutPlan.dailyWorkouts.map(workout => 
      workout.date === editingWorkout.date ? editingWorkout : workout
    );
    
    const updatedPlan = {
      ...workoutPlan,
      dailyWorkouts: updatedWorkouts
    };
    
    onUpdatePlan(updatedPlan);
    setIsEditing(false);
    setShowEditMenu(false);
    setEditingWorkout(null);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setShowEditMenu(false);
    setEditingWorkout(null);
  };
  const handleAddRestDay = (date?: Date) => {
    if (!workoutPlan) return;
    // Add one day to user-provided date to align with expected day
    let targetDate: Date;
    if (date) {
      targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
    } else {
      targetDate = new Date();
    }
    if (isDateInPast(targetDate)) {
      alert('You cannot add or change workouts on past dates.');
      return;
    }
    const dateString = format(targetDate, 'yyyy-MM-dd');
    
    // Check if workout already exists for this date
    const existingWorkout = workoutPlan.dailyWorkouts.find(w => w.date === dateString);
    if (existingWorkout) {
      // Update existing workout to rest day
      const updatedWorkout = {
        ...existingWorkout,
        type: 'rest' as const,
        types: ['rest'] as WorkoutType[],
        workouts: [
          {
            name: 'Rest Day',
            description: 'Take a well-deserved break and let your body recover.',
            duration: '0 min',
            difficulty: 'beginner' as const,
            muscleGroups: []
          }
        ],
        alternativeWorkouts: []
      };
      handleUpdateWorkout(updatedWorkout);
      return;
    }

    const restWorkout: DayWorkout = {
      date: dateString,
      workouts: [
        {
          name: 'Rest Day',
          description: 'Take a well-deserved break and let your body recover.',
          duration: '0 min',
          difficulty: 'beginner',
          muscleGroups: []
        }
      ],
      alternativeWorkouts: [],
      completed: false,
      type: 'rest',
      types: ['rest']
    };

    const updatedWorkouts = [...(workoutPlan?.dailyWorkouts || []), restWorkout];
  // 1 in 1,000,000 chance to mark this user-added rest day as the special rickroll rest day
  if (Math.random() < 1 / 1000000) (restWorkout as any).isRickroll = true;
    const updatedPlan = {
      ...workoutPlan,
      dailyWorkouts: updatedWorkouts
    };

    onUpdatePlan(updatedPlan);
  };
  const handleAddRestDayWithPicker = () => {
    if (selectedAddDate) {
      handleAddRestDay(new Date(selectedAddDate));
      setSelectedAddDate('');
      setShowDatePicker(false);
    } else {
      setShowDatePicker(true);
    }
  };

  const handleAddWorkoutDayWithPicker = () => {
    if (selectedWorkoutDate) {
      handleAddWorkoutDay(
        new Date(selectedWorkoutDate),
        selectedWorkoutType as 'strength' | 'cardio' | 'flexibility' | 'rest' | 'mixed',
        workoutPreferences
      );
      setSelectedWorkoutDate('');
      setShowWorkoutDatePicker(false);
    } else {
      setShowWorkoutDatePicker(true);
    }
  };

  // Toggle handler for 'Select to Add' quick action
  const handleSelectToAddToggle = () => {
    const now = Date.now();
    // ignore rapid repeated calls (e.g., accidental double event)
    if (now - lastSelectToggleRef.current < 350) {
      console.debug('[WorkoutCalendar] handleSelectToAddToggle ignored - rapid duplicate');
      return;
    }
    lastSelectToggleRef.current = now;
    console.debug('[WorkoutCalendar] handleSelectToAddToggle called', { addMode, showBatchAddPanel, selectedForAddLength: selectedForAdd.length });

    if (!addMode) {
      // enter selection mode
      setAddMode(true);
      setDeleteMode(false);
      setSelectedForAdd([]);
      setShowBatchAddPanel(false);
      // ensure the edit menu (sidebar) is open so selection UI is visible
      setShowEditMenu(true);
    } else {
      // exit selection mode without opening the batch panel
      console.debug('[WorkoutCalendar] exiting selection mode');
      setAddMode(false);
      setSelectedForAdd([]);
      setShowBatchAddPanel(false);
      setShowEditMenu(true);
    }
  };

  // Explicit confirm action to open the batch add panel
  const handleConfirmSelection = () => {
    console.debug('[WorkoutCalendar] handleConfirmSelection', { selectedForAddLength: selectedForAdd.length });
    if (selectedForAdd.length === 0) {
      alert('Please select at least one date before confirming.');
      return;
    }
    setAddMode(false);
    setShowBatchAddPanel(true);
    setShowEditMenu(true);
  };

  // Batch generate handler for selected dates
  const handleBatchGenerate = async () => {
    if (!workoutPlan) return;
    if (selectedForAdd.length === 0) {
      alert('Please select at least one date.');
      return;
    }

  // close the panel immediately and show loaders on selected dates
  setShowBatchAddPanel(false);
  // close the sidebar so user sees calendar while generation runs
  setShowEditMenu(false);
  setAddMode(false);
  setLoadingDates([...selectedForAdd]);
    const progress = loadQuestionnaireProgress();
    const savedAnswers = progress?.answers || {};
    const savedQuestions = progress?.questionsList || [];

    let updatedDaily = [...workoutPlan.dailyWorkouts];

  for (const dateStr of selectedForAdd) {
      // skip if already exists
      if (updatedDaily.some(d => d.date === dateStr)) {
        console.warn('Skipping existing date during batch add:', dateStr);
        continue;
      }

      try {
        // use first selected type when sending to AI; pass comments in savedAnswers.comments
        const typeForAI = (batchTypes && batchTypes.length > 0) ? batchTypes.join(',') : 'mixed';
        const savedAnswersWithComments = { ...savedAnswers, batchComments };
        const others = updatedDaily.filter(d => d.date !== dateStr);
        const newDayRaw = await generateWorkoutForDay(effectiveUserData, savedAnswersWithComments, savedQuestions, dateStr, typeForAI, others, []);

        // normalize similar to regenerate
        const normalizeDay = (day: any, targetDate: string) : DayWorkout => {
          const parsedDate = (day?.date || targetDate || '').toString();
          let dateStrLocal = parsedDate;
          try { if (parsedDate.includes('T')) dateStrLocal = format(new Date(parsedDate), 'yyyy-MM-dd'); } catch (err) { dateStrLocal = targetDate; }
          dateStrLocal = targetDate;
          const normalizedTypes = normalizeTypesExclusiveRest(
            Array.isArray(day?.types) && day?.types.length
              ? day.types.slice(0, 4)
              : [((day?.type || 'mixed') as WorkoutType)]
          );
          const workoutsArr = Array.isArray(day?.workouts) ? day.workouts : (Array.isArray(day?.exercises) ? day.exercises : []);
          const altArr = Array.isArray(day?.alternativeWorkouts) ? day.alternativeWorkouts : (Array.isArray(day?.alternativeExercises) ? day.alternativeExercises : []);
          return {
            date: dateStrLocal,
            type: (normalizedTypes[0] || 'mixed') as WorkoutType,
            types: normalizedTypes as WorkoutType[],
            workouts: workoutsArr.map((w: any) => ({
              name: w?.name || w?.exercise || 'Exercise',
              description: w?.description || w?.instructions || '',
              difficulty: w?.difficulty || 'beginner',
              duration: w?.duration || (w?.durationSeconds ? `${w.durationSeconds} sec` : ''),
              reps: w?.reps ?? '',
              muscleGroups: Array.isArray(w?.muscleGroups) ? w.muscleGroups : (w?.muscleGroups ? [w.muscleGroups] : []),
              equipment: Array.isArray(w?.equipment) ? w.equipment : (w?.equipment ? [w.equipment] : []),
              sets: typeof w?.sets === 'number' ? w.sets : undefined,
              rest: w?.rest || undefined
            })),
            alternativeWorkouts: altArr.map((w: any) => ({
              name: w?.name || w?.exercise || 'Alt Exercise',
              description: w?.description || w?.instructions || '',
              difficulty: w?.difficulty || 'beginner',
              duration: w?.duration || (w?.durationSeconds ? `${w.durationSeconds} sec` : ''),
              reps: w?.reps ?? '',
              muscleGroups: Array.isArray(w?.muscleGroups) ? w.muscleGroups : (w?.muscleGroups ? [w.muscleGroups] : []),
              equipment: Array.isArray(w?.equipment) ? w.equipment : (w?.equipment ? [w.equipment] : []),
              sets: typeof w?.sets === 'number' ? w.sets : undefined,
              rest: w?.rest || undefined
            })),
            totalTime: day?.totalTime || ''
          } as DayWorkout;
        };

        const normalized = normalizeDay(newDayRaw, dateStr);
        updatedDaily = [...updatedDaily, normalized];
      } catch (err) {
        console.error('Batch generate error for date', dateStr, err);
      }
    }

    const updatedPlan = { ...workoutPlan, dailyWorkouts: updatedDaily, totalDays: updatedDaily.length };
    onUpdatePlan(updatedPlan);
  try { console.log('[WorkoutCalendar] Saving batch-generated plan to localStorage:', { totalDays: updatedPlan.totalDays, dailyWorkoutsCount: updatedPlan.dailyWorkouts.length }); saveWorkoutPlan(updatedPlan); } catch (err) { console.warn('Failed to save batch-generated plan locally:', err); }

  // clear loading states and selection when done
  setLoadingDates([]);
  setSelectedForAdd([]);
  };
  const handleAddWorkoutDay = async (date?: Date, workoutType?: 'strength' | 'cardio' | 'flexibility' | 'rest' | 'mixed', preferences?: any) => {
    if (!workoutPlan) return;

    let targetDate: Date;
    let dateString: string;

    if (date) {
      // Parse the date as local time and increment by one day to avoid timezone issues
      targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
      dateString = format(targetDate, 'yyyy-MM-dd');

      const today = new Date();
      today.setHours(0,0,0,0);
      if (targetDate < today) {
        alert('You cannot add workouts to a past date.');
        return;
      }

      const existingWorkout = workoutPlan.dailyWorkouts.find(w => w.date === dateString);
      if (existingWorkout) {
        return;
      }
    } else {
      const lastDate = workoutPlan.dailyWorkouts.length > 0 
        ? new Date(Math.max(...workoutPlan.dailyWorkouts.map(w => new Date(w.date).getTime())))
        : new Date(workoutPlan.startDate);

      targetDate = new Date(lastDate.getTime() + 24 * 60 * 60 * 1000);
      dateString = format(targetDate, 'yyyy-MM-dd');
    }

    // Convert preferences to an array of strings
    const preferencesArray = [
      ...(effectiveUserData.preferences || []),
      ...(preferences?.muscleGroups || []),
      ...(preferences?.equipment || []),
      `Workout type: ${workoutType || 'mixed'}`,
      `Duration: ${preferences?.duration || '30 min'}`
    ];

    const userDataWithPreferences: UserData = {
      ...effectiveUserData,
      preferences: preferencesArray
    };

    const generatedPlan = await generateWorkoutPlan(userDataWithPreferences, {}, []);

    const normalizedTypes = normalizeTypesExclusiveRest([((workoutType || 'mixed') as WorkoutType)]);
    const newWorkout: DayWorkout = {
      date: dateString,
      type: (normalizedTypes[0] || 'mixed') as 'strength' | 'cardio' | 'flexibility' | 'rest' | 'mixed',
      types: normalizedTypes,
      workouts: generatedPlan.dailyWorkouts[0]?.workouts || [],
      alternativeWorkouts: [],
      completed: false
    };

    const updatedWorkouts = [...workoutPlan.dailyWorkouts, newWorkout];
    const updatedPlan: WorkoutPlan = {
      ...workoutPlan,
      dailyWorkouts: updatedWorkouts,
      totalDays: updatedWorkouts.length
    };

    onUpdatePlan(updatedPlan);
  };

  // Update workout function
  const handleUpdateWorkout = (updatedWorkout: DayWorkout) => {
    if (!workoutPlan) return;
    try {
      const [y, m, d] = updatedWorkout.date.split('-').map(Number);
      const target = new Date(y, m - 1, d);
      if (isDateInPast(target)) {
        alert('You cannot change workouts on past dates.');
        return;
      }
    } catch {/* ignore parse errors */}

    const normalizedTypes = resolveWorkoutTypes(updatedWorkout);
    const normalizedCompletedTypes = (updatedWorkout.completedTypes || []).filter(t => normalizedTypes.includes(t));
    const allComplete = normalizedTypes.length > 0 ? normalizedCompletedTypes.length === normalizedTypes.length : updatedWorkout.completed;

    // If all exercises were removed, drop the day entirely so it can be re-added later
    const hasWorkouts = Array.isArray(updatedWorkout.workouts) && updatedWorkout.workouts.length > 0;
    const hasAlternatives = Array.isArray(updatedWorkout.alternativeWorkouts) && updatedWorkout.alternativeWorkouts.length > 0;
    if (!hasWorkouts && !hasAlternatives) {
      const prunedDaily = workoutPlan.dailyWorkouts.filter(w => w.date !== updatedWorkout.date);
      const prunedPlan = { ...workoutPlan, dailyWorkouts: prunedDaily, totalDays: prunedDaily.length };
      onUpdatePlan(prunedPlan);
      try { saveWorkoutPlan(prunedPlan); } catch (err) { console.warn('Failed to persist plan after deleting empty day:', err); }
      return;
    }

    const normalizedWorkout: DayWorkout = {
      ...updatedWorkout,
      type: (normalizedTypes[0] || updatedWorkout.type || 'mixed') as WorkoutType,
      types: normalizedTypes,
      completedTypes: normalizedCompletedTypes,
      completed: allComplete
    };
    
    const updatedWorkouts = workoutPlan.dailyWorkouts.map(workout =>
      workout.date === updatedWorkout.date ? normalizedWorkout : workout
    );
    
    const updatedPlan = { ...workoutPlan, dailyWorkouts: updatedWorkouts };
    onUpdatePlan(updatedPlan);
  };
  // Regenerate workout function
  const handleRegenerateWorkout = async (workout: DayWorkout) => {
    if (!workoutPlan) return;
    const [y, m, d] = workout.date.split('-').map(Number);
    const targetDate = new Date(y, m - 1, d);
    if (isDateInPast(targetDate)) {
      alert('You cannot change workouts on past dates.');
      return;
    }
    // close modal and set loading state
    setShowWorkoutModal(false);
    setLoadingDate(workout.date);
    setIsRegenerating(true);
    const progress = loadQuestionnaireProgress();
    const savedAnswers = progress?.answers || {};
    const savedQuestions = progress?.questionsList || [];
    try {
      const primaryType = getPrimaryType(workout);
      // Build existing workouts array excluding target date
      const others = workoutPlan.dailyWorkouts.filter(d => d.date !== workout.date);
      // Request a single-day workout from Gemini AI
      const currentDayList = [...workout.workouts, ...workout.alternativeWorkouts];
      // eslint-disable-next-line no-console
      console.log('[AI] Sending generateWorkoutForDay request:', {
        username: effectiveUserData?.username,
        date: workout.date,
        type: primaryType,
        othersCount: others.length,
        currentDayListLength: currentDayList.length
      });

      const newDay = await generateWorkoutForDay(
        effectiveUserData,
        savedAnswers,
        savedQuestions,
        workout.date,
        primaryType,
        others,
        currentDayList
      );

      // eslint-disable-next-line no-console
      console.log('[AI] Received response for generateWorkoutForDay:', newDay);

      // Normalize AI response to match app DayWorkout shape and ensure the date matches the target
      const normalizeDay = (day: any): DayWorkout => {
        const parsedDate = (day?.date || workout.date || '').toString();
        // If AI returned an ISO with time, convert to yyyy-MM-dd
        let dateStr = parsedDate;
        try {
          if (parsedDate.includes('T')) {
            dateStr = format(new Date(parsedDate), 'yyyy-MM-dd');
          }
        } catch (err) {
          dateStr = workout.date; // fallback
        }

        // Force the date to the original target date to avoid lookup mismatches
        dateStr = workout.date;

        const workoutsArr = Array.isArray(day?.workouts) ? day.workouts : (Array.isArray(day?.exercises) ? day.exercises : []);
        const altArr = Array.isArray(day?.alternativeWorkouts) ? day.alternativeWorkouts : (Array.isArray(day?.alternativeExercises) ? day.alternativeExercises : []);

        const rawTypes = Array.isArray((day as any)?.types) && (day as any)?.types.length
          ? (day as any).types.slice(0, 4)
          : resolveWorkoutTypes(workout);
        const normalizedTypes = normalizeTypesExclusiveRest(rawTypes as WorkoutType[]);

        return {
          date: dateStr,
          type: (normalizedTypes[0] || day?.type || workout.type || 'mixed') as WorkoutType,
          types: normalizedTypes as WorkoutType[],
          completedTypes: Array.isArray(day?.completedTypes)
            ? (day.completedTypes as WorkoutType[]).filter((t: WorkoutType) => normalizedTypes.includes(t))
            : [],
          completed: normalizedTypes.length > 0
            ? Array.isArray(day?.completedTypes) && (day.completedTypes as WorkoutType[]).filter((t: WorkoutType) => normalizedTypes.includes(t)).length === normalizedTypes.length
            : !!day?.completed,
          workouts: workoutsArr.map((w: any) => ({
            name: w?.name || w?.exercise || 'Exercise',
            description: w?.description || w?.instructions || '',
            difficulty: w?.difficulty || 'beginner',
            duration: w?.duration || (w?.durationSeconds ? `${w.durationSeconds} sec` : ''),
            reps: w?.reps ?? '',
            muscleGroups: Array.isArray(w?.muscleGroups) ? w.muscleGroups : (w?.muscleGroups ? [w.muscleGroups] : []),
            equipment: Array.isArray(w?.equipment) ? w.equipment : (w?.equipment ? [w.equipment] : []),
            sets: typeof w?.sets === 'number' ? w.sets : undefined,
            rest: w?.rest || undefined
          })),
          alternativeWorkouts: altArr.map((w: any) => ({
            name: w?.name || w?.exercise || 'Alt Exercise',
            description: w?.description || w?.instructions || '',
            difficulty: w?.difficulty || 'beginner',
            duration: w?.duration || (w?.durationSeconds ? `${w.durationSeconds} sec` : ''),
            reps: w?.reps ?? '',
            muscleGroups: Array.isArray(w?.muscleGroups) ? w.muscleGroups : (w?.muscleGroups ? [w.muscleGroups] : []),
            equipment: Array.isArray(w?.equipment) ? w.equipment : (w?.equipment ? [w.equipment] : []),
            sets: typeof w?.sets === 'number' ? w.sets : undefined,
            rest: w?.rest || undefined
          })),
          totalTime: day?.totalTime || ''
        } as DayWorkout;
      };

      const normalized = normalizeDay(newDay);
      // eslint-disable-next-line no-console
      console.log('[REGenerate] Normalized regenerated day:', normalized);

      // Replace only the specific day in current plan with the normalized day
      const updatedDaily = workoutPlan.dailyWorkouts.map(d => d.date === workout.date ? normalized : d);
      const updatedPlan = { ...workoutPlan, dailyWorkouts: updatedDaily };
      onUpdatePlan(updatedPlan);
      // Persist immediately to localStorage to avoid race with server restore
      try { console.log('[WorkoutCalendar] Saving regenerated plan to localStorage:', { dailyWorkoutsCount: updatedPlan.dailyWorkouts.length }); saveWorkoutPlan(updatedPlan); // eslint-disable-next-line no-console
        console.log('[REGenerate] saved regenerated plan to localStorage'); } catch (err) { console.warn('Failed to save regenerated plan locally:', err); }
      // Re-open modal with the normalized day so user sees the updated content immediately
      setSelectedDay(normalized);
      setShowWorkoutModal(true);
      // Mark this date as recently updated so calendar visually highlights it
      setLastUpdatedDate(normalized.date);
      window.setTimeout(() => setLastUpdatedDate(null), 2000);
      setLoadingDate(null);
      setIsRegenerating(false);
    } catch (error) {
      console.error('Error regenerating single-day workout with AI:', error);
      setLoadingDate(null);
      setIsRegenerating(false);
    }
  };

  const handleGenerateWorkout = async () => {
    if (!workoutPlan || !selectedWorkoutDate) return;

    setLoadingDate(selectedWorkoutDate);
    setLoadingDates(prev => Array.from(new Set([...prev, selectedWorkoutDate])));

    // block adding/generating on past dates
    const selected = new Date(selectedWorkoutDate);
    const today = new Date();
    today.setHours(0,0,0,0);
    if (selected < today) {
      alert('You cannot add workouts to a past date.');
      setLoadingDate(null);
      return;
    }

    const progress = loadQuestionnaireProgress();
    const savedAnswers = progress?.answers || {};
    const savedQuestions = progress?.questionsList || [];

    try {
      // Build existing workouts array excluding target date
      const others = workoutPlan.dailyWorkouts.filter(d => d.date !== selectedWorkoutDate);

      // Request a single-day workout from Gemini AI
      // eslint-disable-next-line no-console
      console.log('[AI] Sending generateWorkoutForDay request:', {
        username: effectiveUserData?.username,
        date: selectedWorkoutDate,
        type: selectedWorkoutType,
        othersCount: others.length
      });

      const newDay = await generateWorkoutForDay(
        effectiveUserData,
        savedAnswers,
        savedQuestions,
        selectedWorkoutDate,
        selectedWorkoutType,
        others,
        [] // No existing workouts for a new day
      );

      const normalizedTypes = normalizeTypesExclusiveRest(
        Array.isArray((newDay as any)?.types) && (newDay as any)?.types.length
          ? (newDay as any).types.slice(0, 4)
          : [selectedWorkoutType]
      );
      const normalizedNewDay: DayWorkout = {
        ...(newDay as any),
        type: ((normalizedTypes[0] || selectedWorkoutType) as WorkoutType),
        types: normalizedTypes as WorkoutType[],
        completedTypes: []
      };

      // eslint-disable-next-line no-console
      console.log('[AI] Received response for generateWorkoutForDay:', newDay);

      // Add the new day to the current plan
      const updatedDaily = [...workoutPlan.dailyWorkouts, normalizedNewDay];
      const updatedPlan = { ...workoutPlan, dailyWorkouts: updatedDaily };
      onUpdatePlan(updatedPlan);
      try { saveWorkoutPlan(updatedPlan); } catch (err) { console.warn('Failed to save generated day locally:', err); }

      // eslint-disable-next-line no-console
      console.log('[Calendar] Updated plan after generation:', {
        totalDays: updatedPlan.totalDays || updatedPlan.dailyWorkouts.length,
        dailyWorkoutsCount: updatedPlan.dailyWorkouts.length,
        addedDate: selectedWorkoutDate,
        addedDay: newDay
      });

      setLoadingDate(null);
      setLoadingDates(prev => prev.filter(d => d !== selectedWorkoutDate));
    } catch (error) {
      console.error('Error generating workout:', error);
      setLoadingDate(null);
      setLoadingDates(prev => prev.filter(d => d !== selectedWorkoutDate));
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, workout: DayWorkout) => {
    setDraggedWorkout(workout);
    setIsDragging(true);
    try { e.dataTransfer.effectAllowed = 'move'; } catch {}
  };

  const handleLegendDragStart = (e: React.DragEvent, type: DayWorkout['type']) => {
    setDraggedLegendType(type);
    setIsDragging(true);
    try {
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('text/calendar-type', type);
    } catch {}
  };

  const handleLegendDragEnd = () => {
    setDraggedLegendType(null);
    setIsDragging(false);
    setDragOverDate(null);
    setIsLegendDropTarget(false);
  };

  const handleDragOver = (e: React.DragEvent, date: Date) => {
    const isLegend = draggedLegendType || e.dataTransfer.getData('text/calendar-type');
    // Only allow legend drops on today or future dates
    if (isLegend && isDateInPast(date)) {
      setDragOverDate(null);
      return;
    }

    e.preventDefault();
    try { e.dataTransfer.dropEffect = isLegend ? 'copy' : 'move'; } catch {}
    setDragOverDate(formatDate(date.toISOString()));
  };

  const handleDragLeave = () => {
    setDragOverDate(null);
  };

  const handleLegendDragOver = (e: React.DragEvent) => {
    if (!draggedWorkout || draggedLegendType) return;
    e.preventDefault();
    try { e.dataTransfer.dropEffect = 'move'; } catch {}
    setIsLegendDropTarget(true);
  };

  const handleLegendDragLeave = () => {
    setIsLegendDropTarget(false);
  };

  const handleLegendDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const removeTypePayload = e.dataTransfer.getData('text/fba-remove-type');
    if (!workoutPlan || (!draggedWorkout && !removeTypePayload) || draggedLegendType) {
      handleLegendDragLeave();
      handleDragEnd();
      return;
    }

    // If we're removing a single type from a multi-type day
    if (removeTypePayload) {
      try {
        const parsed = JSON.parse(removeTypePayload);
        const { date, type } = parsed || {};
        if (!date || !type) throw new Error('Invalid payload');

        const updatedDaily = workoutPlan.dailyWorkouts.map(w => {
          if (w.date !== date) return w;
          const remainingTypes = resolveWorkoutTypes(w).filter(t => t !== type);
          const remainingCompleted = (w.completedTypes || []).filter(t => t !== type);
          if (remainingTypes.length === 0) return null as any;
          return {
            ...w,
            types: remainingTypes,
            type: remainingTypes[0],
            completedTypes: remainingCompleted,
            completed: remainingCompleted.length === remainingTypes.length && remainingTypes.length > 0
          };
        }).filter(Boolean) as DayWorkout[];

        const updatedPlan = { ...workoutPlan, dailyWorkouts: updatedDaily, totalDays: updatedDaily.length };
        onUpdatePlan(updatedPlan);
        try { saveWorkoutPlan(updatedPlan); } catch (err) { console.warn('Failed to save plan after type removal:', err); }
      } catch (err) {
        console.warn('Failed to process type removal drop:', err);
      }
      handleLegendDragLeave();
      handleDragEnd();
      return;
    }

    if (!draggedWorkout) {
      handleLegendDragLeave();
      handleDragEnd();
      return;
    }
    const updatedDaily = workoutPlan.dailyWorkouts.filter(w => w.date !== draggedWorkout.date);
    const updatedPlan = { ...workoutPlan, dailyWorkouts: updatedDaily, totalDays: updatedDaily.length };
    onUpdatePlan(updatedPlan);
    try { saveWorkoutPlan(updatedPlan); } catch (err) { console.warn('Failed to save plan after legend drop delete:', err); }

    handleLegendDragLeave();
    handleDragEnd();
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setDraggedWorkout(null);
    setDraggedLegendType(null);
    setDragOverDate(null);
  };
  const handleDrop = async (e: React.DragEvent, targetDate: Date) => {
    e.preventDefault();

    if (!workoutPlan) {
      setIsDragging(false);
      setDraggedLegendType(null);
      return;
    }

    const targetDateString = formatDate(targetDate.toISOString());
    const legendType = draggedLegendType || e.dataTransfer.getData('text/calendar-type');

    // Block adding brand-new days on past dates
    if (legendType && isDateInPast(targetDate)) {
      alert('You can only add workouts to today or a future date.');
      setIsDragging(false);
      setDraggedLegendType(null);
      setDragOverDate(null);
      return;
    }

    // Block moving anything into or out of past dates
    const targetDateObj = new Date(targetDateString + 'T00:00:00');
    // ensure sourceDateString is available for later comparisons (declared outside the draggedWorkout block)
    const sourceDateString = draggedWorkout ? draggedWorkout.date : '';

    if (draggedWorkout) {
      const [sy, sm, sd] = sourceDateString.split('-').map(Number);
      const sourceDate = new Date(sy, sm - 1, sd);
      if (isDateInPast(sourceDate) || isDateInPast(targetDateObj)) {
        alert('You cannot move workouts on past dates.');
        setIsDragging(false);
        setDraggedWorkout(null);
        setDraggedLegendType(null);
        setDragOverDate(null);
        return;
      }
    }

    // If dragging a legend category, generate a new day for that type
    if (legendType) {
      const typeForAI = legendType as DayWorkout['type'];
      const existingTarget = workoutPlan.dailyWorkouts.find(d => d.date === targetDateString);
        // If a workout already exists on this date, just append the type (up to 4) instead of replacing the day
        if (existingTarget) {
          const mergedTypes = mergeTypesWithRestGuard(resolveWorkoutTypes(existingTarget), typeForAI as WorkoutType);
          const mergedCompletedTypes = (existingTarget.completedTypes || []).filter(t => mergedTypes.includes(t));
          const merged: DayWorkout = {
            ...existingTarget,
            types: mergedTypes,
            type: (mergedTypes[0] || existingTarget.type || typeForAI) as WorkoutType,
            completedTypes: mergedCompletedTypes,
            completed: mergedCompletedTypes.length === mergedTypes.length && mergedTypes.length > 0
          };
        const mergedDaily = workoutPlan.dailyWorkouts.map(d => d.date === targetDateString ? merged : d);
        const updatedPlan = { ...workoutPlan, dailyWorkouts: mergedDaily };
        onUpdatePlan(updatedPlan);
        try { saveWorkoutPlan(updatedPlan); } catch (err) { console.warn('Failed to save merged multi-type day locally:', err); }
        setLastUpdatedDate(targetDateString);
        window.setTimeout(() => setLastUpdatedDate(null), 2000);
        setDraggedLegendType(null);
        setIsDragging(false);
        setDragOverDate(null);
        return;
      }

      setLoadingDate(targetDateString);
      setLoadingDates(prev => Array.from(new Set([...prev, targetDateString])));
      const progress = loadQuestionnaireProgress();
      const savedAnswers = progress?.answers || {};
      const savedQuestions = progress?.questionsList || [];

      try {
        const others = workoutPlan.dailyWorkouts.filter(d => d.date !== targetDateString);
        const newDayRaw = await generateWorkoutForDay(
          effectiveUserData,
          savedAnswers,
          savedQuestions,
          targetDateString,
          typeForAI,
          others,
          []
        );

        const normalizedTypes = normalizeTypesExclusiveRest(
          Array.isArray((newDayRaw as any)?.types) && (newDayRaw as any)?.types.length
            ? (newDayRaw as any).types.slice(0, 4)
            : [typeForAI]
        );
        const normalizedDay: DayWorkout = {
          date: targetDateString,
          type: ((normalizedTypes[0] || (newDayRaw as any)?.type || typeForAI) as WorkoutType),
          types: normalizedTypes as WorkoutType[],
          completedTypes: [],
          completed: !!(newDayRaw as any)?.completed,
          totalTime: (newDayRaw as any)?.totalTime || '',
          workouts: Array.isArray((newDayRaw as any)?.workouts) ? (newDayRaw as any).workouts : [],
          alternativeWorkouts: Array.isArray((newDayRaw as any)?.alternativeWorkouts) ? (newDayRaw as any).alternativeWorkouts : []
        };

        // replace or add, keep plan ordered
        const withoutTarget = workoutPlan.dailyWorkouts.filter(d => d.date !== targetDateString);
        const nextDaily = [...withoutTarget, normalizedDay].sort((a, b) => a.date.localeCompare(b.date));
        const updatedPlan = { ...workoutPlan, dailyWorkouts: nextDaily, totalDays: nextDaily.length };
        onUpdatePlan(updatedPlan);
        try { saveWorkoutPlan(updatedPlan); } catch (err) { console.warn('Failed to save generated day locally:', err); }
        setLastUpdatedDate(targetDateString);
        window.setTimeout(() => setLastUpdatedDate(null), 2000);
      } catch (err) {
        console.error('Drag-generate error for', targetDateString, err);
      } finally {
        setLoadingDate(null);
        setLoadingDates(prev => prev.filter(d => d !== targetDateString));
        setDraggedLegendType(null);
        setIsDragging(false);
        setDragOverDate(null);
      }
      return;
    }

    if (!draggedWorkout) {
      setIsDragging(false);
      setDragOverDate(null);
      return;
    }

    if (targetDateString === sourceDateString) {
      setDraggedWorkout(null);
      setDragOverDate(null);
      setIsDragging(false);
      return;
    }

    const targetWorkout = workoutPlan.dailyWorkouts.find(w => w.date === targetDateString);
    let updatedWorkouts = [...workoutPlan.dailyWorkouts];

    if (targetWorkout) {
      updatedWorkouts = updatedWorkouts.map(workout => {
        if (workout.date === sourceDateString) {
          return { ...targetWorkout, date: sourceDateString };
        } else if (workout.date === targetDateString) {
          return { ...draggedWorkout, date: targetDateString };
        }
        return workout;
      });
    } else {
      updatedWorkouts = updatedWorkouts.map(workout => 
        workout.date === sourceDateString 
          ? { ...workout, date: targetDateString }
          : workout
      );
    }

    // Mark this as a manual date change BEFORE updating the parent plan so effect hooks
    // that react to workoutPlan won't override the user's current month selection.
    setIsManualDateChange(true);
    // Keep the calendar on the current month the user is viewing
    setCurrentDate(currentDate);

    const updatedPlan = { ...workoutPlan, dailyWorkouts: updatedWorkouts };
    onUpdatePlan(updatedPlan);

    // Reset manual flag shortly after so future plan loads can sync normally
    window.setTimeout(() => setIsManualDateChange(false), 2000);

    setDraggedWorkout(null);
    setDragOverDate(null);
    setIsDragging(false);
  };

  const handleWorkoutPreferenceChange = (key: string, value: any) => {
    setWorkoutPreferences(prev => ({ ...prev, [key]: value }));
  };

  const handleClearCalendar = async () => {
    if (!workoutPlan) return;
    // Collect all current dates (useful if we want to reuse deletion flow/UI)
    const allDates = workoutPlan.dailyWorkouts.map(w => w.date);
    setSelectedForDeletion(allDates);

    const clearedPlan = {
      ...workoutPlan,
      dailyWorkouts: []
    };

    // Set a stronger guard to prevent immediate server/local restore from repopulating
    try {
      localStorage.setItem('fitbuddyai_no_auto_restore', '1');
      sessionStorage.setItem('fitbuddyai_no_auto_restore', '1');
      // keep the guard for 5 minutes so restores won't overwrite the user's manual clear
      setTimeout(() => {
        try { localStorage.removeItem('fitbuddyai_no_auto_restore'); } catch {}
        try { sessionStorage.removeItem('fitbuddyai_no_auto_restore'); } catch {}
      }, 300000);
    } catch (err) {
      console.warn('Failed to set no-auto-restore guard:', err);
    }

    // Persist cleared plan and update UI
    onUpdatePlan(clearedPlan);
    try { saveWorkoutPlan(clearedPlan); } catch (err) { console.warn('Failed to persist cleared plan:', err); }

    // If user is signed in, also overwrite their server backup immediately
    try {
      const { loadUserData } = await import('../services/localStorage');
      const parsed = loadUserData();
      const userId = parsed?.id;
      if (userId) {
        // backup should run async but we don't block UI
        backupUserDataToServer(userId).catch(() => {});
      }
    } catch (err) { /* ignore */ }

    setShowEditMenu(false);
    setDeleteMode(false);
    alert('Calendar has been cleared!');
  };


  // Confirm and cancel handlers for delete-mode multi-select
  const handleConfirmDeletion = () => {
    if (!workoutPlan) return;
    if (selectedForDeletion.length === 0) {
      alert('Please select at least one date to delete.');
      return;
    }
    const updated = workoutPlan.dailyWorkouts.filter(w => !selectedForDeletion.includes(w.date));
    onUpdatePlan({ ...workoutPlan, dailyWorkouts: updated });
    setSelectedForDeletion([]);
    setDeleteMode(false);
    setShowEditMenu(false);
  };

  const handleCancelDeletion = () => {
    setSelectedForDeletion([]);
    setDeleteMode(false);
  };

  return (
    <div className="calendar-page">
      <div className="calendar-container">
        {isGuestUser && (
          <div className="calendar-preview-banner">
            <div className="banner-text">
              <strong>Preview mode:</strong> Explore the scheduler now. Complete the questionnaire to let the AI personalize your plan.
            </div>
            <a className="calendar-no-plan-btn" href="/questionnaire">Complete questionnaire</a>
          </div>
        )}
        {/* Header */}
        <div className="calendar-header">
          <div className="user-info">
            <h1>Welcome back, {displayName}!</h1>
            <p>{workoutPlan.description}</p>
          </div>
          
          <div className="progress-stats">
            <div className="stat-card">
              <Target size={24} />
              <div className="stat-content">
                <span className="stat-number">{completedWorkouts}</span>
                <span className="stat-label">Completed</span>
              </div>
            </div>
            <div className="stat-card">
              <Clock size={24} />
              <div className="stat-content">
                <span className="stat-number">{totalWorkouts - completedWorkouts}</span>
                <span className="stat-label">Remaining</span>
              </div>
            </div>
            <div className="progress-circle">
              <svg viewBox="0 0 36 36" className="circular-chart">
                <path
                  className="circle-bg"
                  d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="circle"
                  strokeDasharray={`${progressPercentage}, 100`}
                  d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <text x="18" y="20.35" className="percentage">{Math.round(progressPercentage)}%</text>
              </svg>
            </div>
          </div>
        </div>

        <div className="calendar-layout">
          <aside
            className={`calendar-legend${isLegendDropTarget ? ' drop-target' : ''}`}
            onDragOver={handleLegendDragOver}
            onDrop={handleLegendDrop}
            onDragLeave={handleLegendDragLeave}
          >
            <h3>Workout Types</h3>
            <div className="legend-items">
              {legendCategories.map(item => (
                <div
                  key={item.type}
                  className="legend-item"
                  draggable
                  onDragStart={(e) => handleLegendDragStart(e, item.type)}
                  onDragEnd={handleLegendDragEnd}
                  title={item.title}
                >
                  <div className={`legend-color ${item.colorClass}`}></div>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </aside>

          <div className="calendar-main">
        {/* Calendar Navigation */}
        <div className="calendar-nav">
          <button
            className="nav-button"
            onClick={() => navigateMonth('prev')}
            onDragEnter={() => {
              const now = Date.now();
              if (now - lastDragNav.current >= 1000) {
                navigateMonth('prev');
                lastDragNav.current = now;
              }
            }}
            aria-label="Previous month"
          >
            <ChevronLeft size={20} />
          </button>

          <h2 className="month-year">{format(currentDate, 'MMMM yyyy')}</h2>

          <button
            className="nav-button"
            onClick={() => navigateMonth('next')}
            onDragEnter={() => {
              const now = Date.now();
              if (now - lastDragNav.current >= 1000) {
                navigateMonth('next');
                lastDragNav.current = now;
              }
            }}
            aria-label="Next month"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="calendar-grid">
          {/* Day headers */}
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="day-header">
              {day}
            </div>
          ))}
          {/* Calendar days (first day is positioned via start-N class, no placeholder cells needed) */}
          {monthDays.map((date, idx) => {
            const workout = getWorkoutForDate(date);
            const dateString = format(date, 'yyyy-MM-dd');
            const isToday = isSameDay(date, new Date());
            const isDragOver = dragOverDate === dateString;
            const isLoading = loadingDate === dateString;
            const isJustUpdated = lastUpdatedDate === dateString;
            const typeList = workout ? resolveWorkoutTypes(workout) : [];
            const primaryType = workout ? getPrimaryType(workout) : undefined;
            const isMultiType = typeList.length > 1;
            const isPastDay = isDateInPast(date);
            const completedTypes = workout?.completedTypes || [];
            const completedCount = typeList.length > 0
              ? (completedTypes.filter(t => typeList.includes(t)).length || (workout?.completed ? typeList.length : 0))
              : (workout?.completed ? 1 : 0);
            const completionPercent = typeList.length > 0
              ? Math.min(100, (completedCount / typeList.length) * 100)
              : (workout?.completed ? 100 : 0);
            // render logging removed to reduce noise
            const totalDurationLabel = workout ? getWorkoutDuration(workout) : null;
            const isStreakCompleteDay = workout ? isWorkoutCompleteForStreak(workout) : false;
            const cellStreak = isStreakCompleteDay ? computeStreak(workoutPlan.dailyWorkouts, date) : 0;
            
            const firstStartClass = idx === 0 ? ` start-${monthStartIndex + 1}` : '';

            return (
              <div
                key={date.toISOString()}
                className={`calendar-day${firstStartClass} ${isToday ? ' today' : ''} ${workout ? ' has-workout' : ''} ${isDragOver ? ' drag-over' : ''}` +
                  (deleteMode ? ' delete-active' : '') +
                  (addMode ? ' add-active' : '') +
                  (isLoading ? ' loading' : '') +
                  (isJustUpdated ? ' just-updated' : '') +
                  (selectedForAdd.includes(dateString) ? ' selected' : '') +
                  (pendingRestAssignment ? ' rest-pending' : '') +
                  (selectedForDeletion.includes(dateString) ? ' delete-selected' : '') +
                  (isStreakCompleteDay ? ' streak-complete' : '')}
                onClick={() => handleDayClick(date)}
                onDragOver={(e) => handleDragOver(e, date)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, date)}
              >                
                  <span className="day-number">{format(date, 'd')}</span>
                  {totalDurationLabel && (
                    <span className="day-total-time">⏱️ {totalDurationLabel}</span>
                  )}
                  {isStreakCompleteDay && (
                    <div className="streak-card">
                      <div className="streak-icon">
                        <Flame size={32} />
                      </div>
                      <div className="streak-number">{cellStreak}</div>
                      <div className="streak-label">Day Streak</div>
                    </div>
                  )}
                  {!isStreakCompleteDay && workout ? (
                    <div
                      className={`workout-indicator ${isMultiType ? 'multi' : getWorkoutTypeColor(primaryType)} ${workout.completed ? 'completed' : ''}`}
                      draggable={!showEditMenu && !isPastDay}
                      onDragStart={(e) => handleDragStart(e, workout)}
                      onDragEnd={handleDragEnd}
                    >
                      <div className="workout-progress-bar" aria-label="Workout progress">
                        <div
                          className="progress-fill"
                          data-progress={`${completionPercent}%`}
                        ></div>
                      </div>
                      {isMultiType && typeList.length > 1 && (
                        <div className="workout-segments" data-count={typeList.length}>
                          {typeList.map((t) => (
                            <span
                              key={t}
                              className={`segment ${getWorkoutTypeColor(t)}`}
                              draggable={!showEditMenu && !isPastDay}
                              onDragStart={(e) => {
                                try {
                                  e.dataTransfer.setData('text/fba-remove-type', JSON.stringify({ date: workout.date, type: t }));
                                  e.dataTransfer.effectAllowed = 'move';
                                } catch {}
                                setIsDragging(true);
                              }}
                            ></span>
                          ))}
                        </div>
                      )}
                      {(isLoading || loadingDates.includes(dateString)) && (
                        <div className="loader-overlay inside-indicator">
                          <div className="loading-dumbbell small">
                            <Dumbbell size={28} color="#fff" />
                          </div>
                        </div>
                      )}
                      <div className="workout-content">
                      <span className="workout-type">
                        {getWorkoutTypeLabel(typeList as WorkoutType[])}
                      </span>
                      <span className="workout-duration">
                        {`⏱️ ${getWorkoutDuration(workout)}`}
                      </span>
                      {isPastDay && (
                        <span className="workout-locked">
                          {completionPercent === 100 ? 'Done (locked)' : 'Incomplete (locked)'}
                        </span>
                      )}
                      {workout.completed && (
                        <Check size={14} className="check-icon" />
                      )}
                        {!workout.completed && primaryType !== 'rest' && (
                          <Play size={14} className="play-icon" />
                        )}
                      </div>
                    </div>
                  ) : (
                    !isStreakCompleteDay && loadingDates.includes(dateString) ? (
                      <div className="loader-overlay inside-indicator">
                        <div className="loading-dumbbell small">
                            <Dumbbell size={28} color="#fff" />
                          </div>
                      </div>
                    ) : null
                  )}
              </div>
            );
          })}
          {/* trailing empty cells are no longer necessary because grid placement uses start-N classes */}
        </div>

          </div>
        </div>
      </div>      {/* Workout Modal */}
      {showWorkoutModal && selectedDay && (
        <WorkoutModal
          workout={selectedDay}
          onClose={() => setShowWorkoutModal(false)}
          onComplete={(type) => handleCompleteWorkout(selectedDay.date, type)}
          onRegenerateWorkout={() => handleRegenerateWorkout(selectedDay)}
          isRegenerating={isRegenerating}
          onUpdateWorkout={handleUpdateWorkout}
        />
      )}

      {/* Floating Edit Button */}
      <button
        className={`edit-fab ${showEditMenu ? 'active' : ''}`}
        onClick={() => setShowEditMenu(!showEditMenu)}
        aria-label="Edit workouts"
      >
        {showEditMenu ? <X size={24} /> : <Edit3 size={24} />}
      </button>

      {/* Edit Menu */}
      <div className={`edit-menu ${showEditMenu ? 'open' : ''}`}>
        <div className="edit-menu-header">
          <h3>Workout Editor</h3>
          <p>Customize your workout plan</p>
        </div>
        
        <div className="edit-menu-content">          <div className="edit-section">
            <h4><Settings size={16} /> Quick Actions</h4>            <div className="edit-actions">              
              <button
                className="edit-action-btn"
                onClick={handleSelectToAddToggle}
              >
                <Plus size={16} />
                {addMode ? 'Selecting...' : 'Select to Add'}
              </button>
              {addMode && (
                <button className="edit-action-btn confirm-btn" onClick={handleConfirmSelection}>
                  <Save size={16} /> Confirm
                </button>
              )}
              {showBatchAddPanel && (
                <div className="batch-add-panel">
                  <h4>Batch Add Workouts ({selectedForAdd.length} selected)</h4>
                  <label>Choose workout types (multi-select):</label>
                  <div className="batch-types">
                    {['strength','cardio','flexibility','mixed','rest'].map(t => (
                      <label key={t} className={`batch-type ${batchTypes.includes(t) ? 'selected' : ''}`}>
                        <input type="checkbox" checked={batchTypes.includes(t)} onChange={(e) => {
                          setBatchTypes(prev => e.target.checked ? [...prev, t] : prev.filter(x => x !== t));
                        }} />
                        {t}
                      </label>
                    ))}
                  </div>
                  <label>Comments (optional):</label>
                  <textarea aria-label="Batch comments" value={batchComments} onChange={(e) => setBatchComments(e.target.value)} />
                  <div className="batch-actions">
                    <button className="save-btn" onClick={handleBatchGenerate} disabled={selectedForAdd.length === 0}>Generate</button>
                    <button className="cancel-btn" onClick={() => { setShowBatchAddPanel(false); setSelectedForAdd([]); }}>Cancel</button>
                  </div>
                </div>
              )}
              <button className="edit-action-btn" onClick={() => {
                  // Enter one-click rest assignment mode: close sidebar and wait for user to click a calendar day
                  setPendingRestAssignment(true);
                  setShowEditMenu(false);
                  setShowDatePicker(false);
                }}
                title="Click a calendar day to assign a Rest Day"
              >
                <Calendar size={16} />
                {pendingRestAssignment ? 'Click a day to add Rest' : 'Add Rest Day'}
              </button>
              <button
                className="edit-action-btn"
                onClick={() => {
                  setDeleteMode(prev => {
                    const next = !prev;
                    if (next) setAddMode(false);
                    return next;
                  });
                }}
              >
                <Trash2 size={16} /> {deleteMode ? 'Stop Delete' : 'Delete Days'}
              </button>
              {deleteMode && (
                <div className="delete-action-row">
                  <button className="confirm-btn" onClick={handleConfirmDeletion} disabled={selectedForDeletion.length === 0}>
                    <Trash2 size={16} /> Delete {selectedForDeletion.length > 0 ? `(${selectedForDeletion.length})` : ''}
                  </button>
                  <button className="cancel-btn" onClick={handleCancelDeletion}>Cancel</button>
                </div>
              )}
              <button 
                className="edit-action-btn clear-calendar-btn" 
                onClick={handleClearCalendar}
              >
                <Trash2 size={16} />
                Clear Calendar
              </button>
            </div>
              {showDatePicker && (
              <div className="date-picker-section">
                <label htmlFor="rest-date">Select date for rest day:</label>
                <input
                  id="rest-date"
                  type="date"
                  value={selectedAddDate}
                  onChange={(e) => setSelectedAddDate(e.target.value)}
                  className="date-input"
                />
                <div className="date-picker-actions">
                  <button 
                    className="save-btn"
                    onClick={handleAddRestDayWithPicker}
                    disabled={!selectedAddDate}
                  >
                    Add Rest Day
                  </button>
                  <button 
                    className="cancel-btn"
                    onClick={() => {
                      setShowDatePicker(false);
                      setSelectedAddDate('');
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {showWorkoutDatePicker && (
              <div className="date-picker-section">
                <label htmlFor="workout-date">Select date for workout day:</label>
                <input
                  id="workout-date"
                  type="date"
                  value={selectedWorkoutDate}
                  onChange={(e) => setSelectedWorkoutDate(e.target.value)}
                  className="date-input"
                />
                <label htmlFor="workout-type">Select workout type:</label>
                <select
                  id="workout-type"
                  value={selectedWorkoutType}
                  onChange={(e) => setSelectedWorkoutType(e.target.value)}
                >
                  <option value="strength">Strength</option>
                  <option value="cardio">Cardio</option>
                  <option value="flexibility">Flexibility</option>
                  <option value="mixed">Mixed</option>
                </select>

                <label htmlFor="workout-duration">Duration:</label>
                <input
                  id="workout-duration"
                  type="text"
                  value={workoutPreferences.duration}
                  onChange={(e) => handleWorkoutPreferenceChange('duration', e.target.value)}
                />

                <label htmlFor="muscle-groups">Muscle Groups:</label>
                <input
                  id="muscle-groups"
                  type="text"
                  placeholder="e.g., Legs, Arms"
                  onChange={(e) => handleWorkoutPreferenceChange('muscleGroups', e.target.value.split(',').map(s => s.trim()))}
                />

                <label htmlFor="equipment">Equipment:</label>
                <input
                  id="equipment"
                  type="text"
                  placeholder="e.g., Dumbbells, Mat"
                  onChange={(e) => handleWorkoutPreferenceChange('equipment', e.target.value.split(',').map(s => s.trim()))}
                />

                <div className="date-picker-actions">
                  <button 
                    className="save-btn"
                    onClick={handleAddWorkoutDayWithPicker}
                    disabled={!selectedWorkoutDate}
                  >
                    Add Workout Day
                  </button>
                  <button 
                    className="cancel-btn"
                    onClick={() => {
                      setShowWorkoutDatePicker(false);
                      setSelectedWorkoutDate('');
                    }}
                  >
                    Cancel
                  </button>
                </div>
                {selectedWorkoutDate && workoutPlan?.dailyWorkouts.find(w => w.date === selectedWorkoutDate) && (
                  <div className="error-message">
                    This date already has a workout. Please select a different date.
                  </div>
                )}
              </div>
            )}
          </div>

          {isEditing && editingWorkout && (
            <div className="edit-section">
              <h4><Edit3 size={16} /> Editing {(() => {
                const [year, month, day] = editingWorkout.date.split('-').map(Number);
                return format(new Date(year, month - 1, day), 'MMM d');
              })()}</h4>
              <div className="workout-edit-form">
                <label>
                  Workout Type:
                  <select 
                    value={editingWorkout.type} 
                    onChange={(e) => setEditingWorkout({
                      ...editingWorkout, 
                      type: e.target.value as any
                    })}
                  >
                    <option value="strength">Strength</option>
                    <option value="cardio">Cardio</option>
                    <option value="flexibility">Flexibility</option>
                    <option value="mixed">Mixed</option>
                    <option value="rest">Rest</option>
                  </select>
                </label>
                
                <div className="edit-actions">
                  <button className="save-btn" onClick={handleSaveWorkout}>
                    <Save size={16} />
                    Save Changes
                  </button>
                  <button className="cancel-btn" onClick={handleCancelEdit}>
                    <X size={16} />
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="edit-section">
            <h4>Tips</h4>
            <ul className="edit-tips">
              <li>Click on any day to view and edit workouts</li>
              <li>Use quick actions to add new workout or rest days</li>
              <li>Changes are saved automatically to your plan</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Edit Menu Overlay */}
      {showEditMenu && (
        <div 
          className="edit-menu-overlay" 
          onClick={() => setShowEditMenu(false)}
        />
      )}

      {/* Workout Popup: render inside edit menu content to ensure containment */}
      <div className={`edit-menu-popup-root`} aria-hidden={!showEditMenu}>
        {showEditMenu && addMode && (
          <div className="workout-popup">
            <h3>Workout Details</h3>
            <label htmlFor="workout-type">Workout Type:</label>
            <select
              id="workout-type"
              value={selectedWorkoutType}
              onChange={(e) => setSelectedWorkoutType(e.target.value)}
            >
              <option value="strength">Strength</option>
              <option value="cardio">Cardio</option>
              <option value="flexibility">Flexibility</option>
              <option value="mixed">Mixed</option>
            </select>

            <label htmlFor="workout-duration">Duration:</label>
            <input
              id="workout-duration"
              type="text"
              value={workoutPreferences.duration}
              onChange={(e) => handleWorkoutPreferenceChange('duration', e.target.value)}
            />

            <label htmlFor="muscle-groups">Muscle Groups:</label>
            <input
              id="muscle-groups"
              type="text"
              placeholder="e.g., Legs, Arms"
              onChange={(e) => handleWorkoutPreferenceChange('muscleGroups', e.target.value.split(',').map((s) => s.trim()))}
            />

            <label htmlFor="equipment">Equipment:</label>
            <input
              id="equipment"
              type="text"
              placeholder="e.g., Dumbbells, Mat"
              onChange={(e) => handleWorkoutPreferenceChange('equipment', e.target.value.split(',').map((s) => s.trim()))}
            />

            <div className="workout-popup-actions">
              <button className="save-btn" onClick={handleGenerateWorkout}>Generate Workout</button>
              <button className="cancel-btn" onClick={() => setAddMode(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkoutCalendar;
