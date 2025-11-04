import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Play, Check, Clock, Target, Edit3, Plus, Settings, Save, X, Trash2, Dumbbell } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { WorkoutPlan, DayWorkout } from '../types';
import { UserData } from '../services/aiService';
import WorkoutModal from './WorkoutModal';
import './WorkoutCalendar.css';
import { generateWorkoutPlan, generateWorkoutForDay } from '../services/aiService';
import { loadQuestionnaireProgress, loadUserData, loadWorkoutPlan, saveWorkoutPlan } from '../services/localStorage';
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
  const [currentDate, setCurrentDate] = useState(new Date());
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

  useEffect(() => {
    if (workoutPlan && workoutPlan.dailyWorkouts.length > 0 && !isManualDateChange) {
      // Parse the start date as local date instead of UTC
      const [year, month, day] = workoutPlan.startDate.split('-').map(Number);
      setCurrentDate(new Date(year, month - 1, day));
    }
  }, [workoutPlan]);

  // On mount: if user signed-in, attempt to restore server-saved workout/assessment data
  useEffect(() => {
    let mounted = true;
    const tryRestore = async () => {
      try {
        // If parent already provided a plan, don't overwrite it with server data.
        if (workoutPlan && workoutPlan.dailyWorkouts && workoutPlan.dailyWorkouts.length > 0) return;
        // Respect cross-tab guard set on logout
        try { if (localStorage.getItem('fitbuddyaiai_no_auto_restore') || sessionStorage.getItem('fitbuddyaiai_no_auto_restore')) return; } catch {}
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

  useEffect(() => {}, []);

  useEffect(() => {
    if (workoutPlan) {
      // 1) Normalize any 'mixed' entries that are empty -> convert to explicit rest days
      let updatedWorkouts = workoutPlan.dailyWorkouts.map(workout => {
        if (workout.type === 'mixed' && (!workout.workouts || workout.workouts.length === 0) && getWorkoutDuration(workout) === '0 min') {
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

      if (JSON.stringify(updatedWorkouts) !== JSON.stringify(workoutPlan.dailyWorkouts)) {
        // Persist normalized plan immediately so UI reflects rest-days for empty/mixed or missing entries
        const normalizedPlan = { ...workoutPlan, dailyWorkouts: updatedWorkouts, totalDays: updatedWorkouts.length };
        onUpdatePlan(normalizedPlan);
  try { console.log('[WorkoutCalendar] Saving normalized plan to localStorage:', { totalDays: normalizedPlan.totalDays, dailyWorkoutsCount: normalizedPlan.dailyWorkouts.length }); saveWorkoutPlan(normalizedPlan); } catch (err) { console.warn('Failed to save normalized plan locally:', err); }
      }
    }
  }, [workoutPlan, onUpdatePlan]);

  if (!workoutPlan || !userData) {
    return (
      <div className="calendar-no-plan-container">
        <div className="calendar-no-plan-content fade-in-bounce">
          <div className="calendar-no-plan-icon-bg">
            <Dumbbell size={48} color="#fff" />
          </div>
          <h1 className="calendar-no-plan-title">No Plan</h1>
          <h2 className="calendar-no-plan-message">No Workout Plan Found</h2>
          <p className="calendar-no-plan-desc">Please complete the questionnaire first to generate your personalized workout plan.</p>
          <a className="calendar-no-plan-btn" href="/questionnaire">Go to Questionnaire</a>
        </div>
      </div>
    );
  }

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Calculate empty cells to align the first and last days of the month
  const leadingEmptyCells = Array(monthStart.getDay()).fill(null);
  const trailingEmptyCells = Array((7 - ((monthStart.getDay() + monthDays.length) % 7)) % 7).fill(null);

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

  const handleCompleteWorkout = (workoutDate: string) => {
    const updatedWorkouts = workoutPlan.dailyWorkouts.map(workout =>
      workout.date === workoutDate
        ? { ...workout, completed: !workout.completed }
        : workout
    );
    
    const updatedPlan = { ...workoutPlan, dailyWorkouts: updatedWorkouts };
    onUpdatePlan(updatedPlan);
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

  const getWorkoutTypeColor = (type: string) => {
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

  const completedWorkouts = workoutPlan.dailyWorkouts.filter(w => w.completed).length;
  const totalWorkouts = workoutPlan.dailyWorkouts.filter(w => w.type !== 'rest').length;
  const progressPercentage = totalWorkouts > 0 ? (completedWorkouts / totalWorkouts) * 100 : 0;

  // Calculate total workout time
  const getWorkoutDuration = (workout: DayWorkout): string => {
    if (workout.type === 'rest') return '0 min';
    
    let totalMinutes = 0;
    workout.workouts.forEach(exercise => {
      if (exercise.duration) {
        const durationMatch = exercise.duration.match(/(\d+)/);
        if (durationMatch) {
          totalMinutes += parseInt(durationMatch[1]);
        }
      }
    });
    
    return totalMinutes > 0 ? `${totalMinutes} min` : '30 min'; // Default if no duration specified
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
    const dateString = format(targetDate, 'yyyy-MM-dd');
    
    // Check if workout already exists for this date
    const existingWorkout = workoutPlan.dailyWorkouts.find(w => w.date === dateString);
    if (existingWorkout) {
      // Update existing workout to rest day
      const updatedWorkout = {
        ...existingWorkout,
        type: 'rest' as const,
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
      type: 'rest'
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
    if (!workoutPlan || !userData) return;
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
        const newDayRaw = await generateWorkoutForDay(userData, savedAnswersWithComments, savedQuestions, dateStr, typeForAI, others, []);

        // normalize similar to regenerate
        const normalizeDay = (day: any, targetDate: string) : DayWorkout => {
          const parsedDate = (day?.date || targetDate || '').toString();
          let dateStrLocal = parsedDate;
          try { if (parsedDate.includes('T')) dateStrLocal = format(new Date(parsedDate), 'yyyy-MM-dd'); } catch (err) { dateStrLocal = targetDate; }
          dateStrLocal = targetDate;
          const workoutsArr = Array.isArray(day?.workouts) ? day.workouts : (Array.isArray(day?.exercises) ? day.exercises : []);
          const altArr = Array.isArray(day?.alternativeWorkouts) ? day.alternativeWorkouts : (Array.isArray(day?.alternativeExercises) ? day.alternativeExercises : []);
          return {
            date: dateStrLocal,
            type: day?.type || 'mixed',
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
            completed: !!day?.completed,
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
    if (!workoutPlan || !userData) return;

    let targetDate: Date;
    let dateString: string;

    if (date) {
      // Parse the date as local time and increment by one day to avoid timezone issues
      targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
      dateString = format(targetDate, 'yyyy-MM-dd');

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
      ...(userData.preferences || []),
      ...(preferences?.muscleGroups || []),
      ...(preferences?.equipment || []),
      `Workout type: ${workoutType || 'mixed'}`,
      `Duration: ${preferences?.duration || '30 min'}`
    ];

    const userDataWithPreferences: UserData = {
      ...userData,
      preferences: preferencesArray
    };

    const generatedPlan = await generateWorkoutPlan(userDataWithPreferences, {}, []);

    const newWorkout: DayWorkout = {
      date: dateString,
      type: (workoutType || 'mixed') as 'strength' | 'cardio' | 'flexibility' | 'rest' | 'mixed',
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
    
    const updatedWorkouts = workoutPlan.dailyWorkouts.map(workout =>
      workout.date === updatedWorkout.date ? updatedWorkout : workout
    );
    
    const updatedPlan = { ...workoutPlan, dailyWorkouts: updatedWorkouts };
    onUpdatePlan(updatedPlan);
  };
  // Regenerate workout function
  const handleRegenerateWorkout = async (workout: DayWorkout) => {
    if (!workoutPlan || !userData) return;
    // close modal and set loading state
    setShowWorkoutModal(false);
    setLoadingDate(workout.date);
    setIsRegenerating(true);
    const progress = loadQuestionnaireProgress();
    const savedAnswers = progress?.answers || {};
    const savedQuestions = progress?.questionsList || [];
    try {
      // Build existing workouts array excluding target date
      const others = workoutPlan.dailyWorkouts.filter(d => d.date !== workout.date);
      // Request a single-day workout from Gemini AI
      const currentDayList = [...workout.workouts, ...workout.alternativeWorkouts];
      // eslint-disable-next-line no-console
      console.log('[AI] Sending generateWorkoutForDay request:', {
        username: userData?.username,
        date: workout.date,
        type: workout.type,
        othersCount: others.length,
        currentDayListLength: currentDayList.length
      });

      const newDay = await generateWorkoutForDay(
        userData,
        savedAnswers,
        savedQuestions,
        workout.date,
        workout.type,
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

        return {
          date: dateStr,
          type: day?.type || workout.type || 'mixed',
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
          completed: !!day?.completed,
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
    if (!workoutPlan || !userData || !selectedWorkoutDate) return;

    setLoadingDate(selectedWorkoutDate);

    const progress = loadQuestionnaireProgress();
    const savedAnswers = progress?.answers || {};
    const savedQuestions = progress?.questionsList || [];

    try {
      // Build existing workouts array excluding target date
      const others = workoutPlan.dailyWorkouts.filter(d => d.date !== selectedWorkoutDate);

      // Request a single-day workout from Gemini AI
      // eslint-disable-next-line no-console
      console.log('[AI] Sending generateWorkoutForDay request:', {
        username: userData?.username,
        date: selectedWorkoutDate,
        type: selectedWorkoutType,
        othersCount: others.length
      });

      const newDay = await generateWorkoutForDay(
        userData,
        savedAnswers,
        savedQuestions,
        selectedWorkoutDate,
        selectedWorkoutType,
        others,
        [] // No existing workouts for a new day
      );

      // eslint-disable-next-line no-console
      console.log('[AI] Received response for generateWorkoutForDay:', newDay);

      // Add the new day to the current plan
      const updatedDaily = [...workoutPlan.dailyWorkouts, newDay];
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
    } catch (error) {
      console.error('Error generating workout:', error);
      setLoadingDate(null);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, workout: DayWorkout) => {
    setDraggedWorkout(workout);
    setIsDragging(true);
    try { e.dataTransfer.effectAllowed = 'move'; } catch {}
  };

  const handleDragOver = (e: React.DragEvent, date: Date) => {
    e.preventDefault();
    try { e.dataTransfer.dropEffect = 'move'; } catch {}
    setDragOverDate(formatDate(date.toISOString()));
  };

  const handleDragLeave = () => {
    setDragOverDate(null);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setDraggedWorkout(null);
    setDragOverDate(null);
  };

  const handleDrop = (e: React.DragEvent, targetDate: Date) => {
    e.preventDefault();

    if (!draggedWorkout || !workoutPlan) {
      setIsDragging(false);
      return;
    }

    const targetDateString = formatDate(targetDate.toISOString());
    const sourceDateString = draggedWorkout.date;

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
      localStorage.setItem('fitbuddyaiai_no_auto_restore', '1');
      sessionStorage.setItem('fitbuddyaiai_no_auto_restore', '1');
      // keep the guard for 5 minutes so restores won't overwrite the user's manual clear
      setTimeout(() => {
        try { localStorage.removeItem('fitbuddyaiai_no_auto_restore'); } catch {}
        try { sessionStorage.removeItem('fitbuddyaiai_no_auto_restore'); } catch {}
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
        {/* Header */}
        <div className="calendar-header">
          <div className="user-info">
            <h1>Welcome back, {userData?.username?.trim() || 'User'}!</h1>
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
          {/* Leading empty cells */}
          {leadingEmptyCells.map((_, idx) => (
            <div key={`empty-start-${idx}`} className="calendar-day empty"></div>
          ))}
          {/* Calendar days */}
          {monthDays.map(date => {
            const workout = getWorkoutForDate(date);
            const dateString = format(date, 'yyyy-MM-dd');
            const isToday = isSameDay(date, new Date());
            const isDragOver = dragOverDate === dateString;
            const isLoading = loadingDate === dateString;
            const isJustUpdated = lastUpdatedDate === dateString;
            // render logging removed to reduce noise
            
            return (
              <div
                key={date.toISOString()}
                className={`calendar-day ${isToday ? 'today' : ''} ${workout ? 'has-workout' : ''} ${isDragOver ? 'drag-over' : ''}` +
                  (deleteMode ? ' delete-active' : '') +
                  (addMode ? ' add-active' : '') +
                  (isLoading ? ' loading' : '') +
                  (isJustUpdated ? ' just-updated' : '') +
                  (selectedForAdd.includes(dateString) ? ' selected' : '') +
                  (pendingRestAssignment ? ' rest-pending' : '') +
                  (selectedForDeletion.includes(dateString) ? ' delete-selected' : '')}
                onClick={() => handleDayClick(date)}
                onDragOver={(e) => handleDragOver(e, date)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, date)}
              >                
                  <span className="day-number">{format(date, 'd')}</span>
                  {workout ? (
                    <div
                      className={`workout-indicator ${getWorkoutTypeColor(workout.type)} ${workout.completed ? 'completed' : ''}`}
                      draggable={!showEditMenu}
                      onDragStart={(e) => handleDragStart(e, workout)}
                      onDragEnd={handleDragEnd}
                    >
                      {(isLoading || loadingDates.includes(dateString)) && (
                        <div className="loader-overlay inside-indicator">
                          <div className="loading-dumbbell small">
                            <Dumbbell size={28} color="#fff" />
                          </div>
                        </div>
                      )}
                      <div className="workout-content">
                      <span className="workout-type">
                        {workout.type === 'rest' ? 'Rest' : 
                         workout.type === 'strength' ? 'Strength' :
                         workout.type === 'cardio' ? 'Cardio' :
                         workout.type === 'flexibility' ? 'Flexibility' : 'Mixed'}
                      </span>
                      <span className="workout-duration">
                        {workout.totalTime
                          ? `⏱️ ${workout.totalTime}`
                          : `⏱️ ${getWorkoutDuration(workout)}`
                        }
                      </span>
                      {workout.completed && (
                        <Check size={14} className="check-icon" />
                      )}
                        {!workout.completed && workout.type !== 'rest' && (
                          <Play size={14} className="play-icon" />
                        )}
                      </div>
                    </div>
                  ) : (
                    // no workout exists: show loader if date is in loadingDates
                    loadingDates.includes(dateString) ? (
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
          {/* Trailing empty cells */}
          {trailingEmptyCells.map((_, idx) => (
            <div key={`empty-end-${idx}`} className="calendar-day empty"></div>
          ))}
        </div>

        {/* Legend */}
        <div className="calendar-legend">
          <h3>Workout Types</h3>
          <div className="legend-items">
            <div className="legend-item">
              <div className="legend-color strength"></div>
              <span>Strength Training</span>
            </div>
            <div className="legend-item">
              <div className="legend-color cardio"></div>
              <span>Cardio</span>
            </div>
            <div className="legend-item">
              <div className="legend-color flexibility"></div>
              <span>Flexibility</span>
            </div>
            <div className="legend-item">
              <div className="legend-color mixed"></div>
              <span>Mixed</span>
            </div>
            <div className="legend-item">
              <div className="legend-color rest"></div>
              <span>Rest Day</span>
            </div>
          </div>
        </div>
      </div>      {/* Workout Modal */}
      {showWorkoutModal && selectedDay && (
        <WorkoutModal
          workout={selectedDay}
          onClose={() => setShowWorkoutModal(false)}
          onComplete={() => handleCompleteWorkout(selectedDay.date)}
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
