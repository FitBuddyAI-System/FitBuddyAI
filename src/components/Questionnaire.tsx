import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, User, Target, Clock, Dumbbell, Heart, Calendar, RefreshCw, Star } from 'lucide-react';
import { UserData } from '../services/aiService';
import { WorkoutPlan, DayWorkout } from '../types';
import { generateWorkoutPlan, getAIResponse } from '../services/aiService';
import { 
  saveQuestionnaireProgress, 
  loadQuestionnaireProgress, 
  clearQuestionnaireProgress,
  saveAssessmentData,
  loadAssessmentData,
  loadUserData,
  loadWorkoutPlan
} from '../services/localStorage';
import { restoreUserDataFromServer } from '../services/cloudBackupService';
import './Questionnaire.css';
import BackgroundDots from './BackgroundDots';

// Webhook URL for Google Sheets integration
const SHEET_WEBHOOK_URL = 'https://corsproxy.io/?key=7cf03de1&url=https://script.google.com/macros/s/AKfycbwFDdT0QVaP2jY8t4N0048PfQW_rYxB4noFaG-nExO9MZ5h3DCuNLUPNg3-qntT01tg/exec?gid=0';

interface QuestionnaireProps {
  onComplete: (userData: UserData, workoutPlan: WorkoutPlan) => void;
}

// Defined the 'Question' type directly in this file
interface Question {
    id: string;
    title: string;
    subtitle: string;
    type: 'single' | 'multiple' | 'text' | 'number' | 'slider' | 'textarea' | 'rating';
    options?: string[];
    min?: number;
    max?: number;
    step?: number;
    aiGenerated?: boolean;
    icon?: React.ReactNode;
    iconType?: string;
}

const questions: Question[] = [
  {
    id: 'age',
    title: "How old are you?",
    subtitle: "This helps us create age-appropriate workouts",
    type: 'number',
    min: 13,
    max: 100,
    icon: <Calendar size={32} />
  },
  {
    id: 'fitnessLevel',
    title: "What's your current fitness level?",
    subtitle: "Be honest - we'll adjust everything to match your abilities",
    type: 'single',
    options: ['Beginner - Just starting out', 'Intermediate - I work out sometimes', 'Advanced - I exercise regularly'],
    icon: <Dumbbell size={32} />
  },
  {
    id: 'fitnessBackground',
    title: "Tell us about your fitness journey so far",
    subtitle: "Share any previous experience, challenges, or what's worked for you before",
    type: 'textarea',
    icon: <Heart size={32} />
  },
  {
    id: 'motivation',
    title: "What motivates you to start this fitness journey?",
    subtitle: "Understanding your 'why' helps us keep you motivated",
    type: 'textarea',
    icon: <Target size={32} />
  },  {
    id: 'goals',
    title: "What are your fitness goals?",
    subtitle: "Select all that apply - we'll create a plan that covers everything",
    type: 'multiple',
    options: [
      'Lose weight',
      'Build muscle',
      'Improve endurance',
      'Increase flexibility',
      'General health',
      'Sport-specific training',
      'Stress relief',
      'Better sleep',
      'Improve posture',
      'Boost confidence',
      'Other'
    ],
    icon: <Target size={32} />
  },
  {
    id: 'specificGoals',
    title: "Can you be more specific about your main goal?",
    subtitle: "For example: 'Lose 20 pounds for my wedding' or 'Run a 5K without stopping'",
    type: 'textarea',
    icon: <Target size={32} />
  },  {
    id: 'timeAvailable',
    title: "How much time can you dedicate daily?",
    subtitle: "We'll make sure every minute counts",
    type: 'slider',
    min: 15,
    max: 120,
    step: 15,
    icon: <Clock size={32} />
  },  {
    id: 'startDate',
    title: "When would you like to start your workout plan?",
    subtitle: "Please enter your preferred start date (YYYY-MM-DD)",
    type: 'text',
    icon: <Calendar size={32} />
  },
  {
    id: 'exerciseFormat',
    title: "How do you prefer to track your workouts?",
    subtitle: "When the calendar is generated, each exercise will show either a reps target or a duration based on this choice.",
    type: 'single',
    options: [
      'Time-based (e.g., each move includes 30 seconds or 2 minutes)',
      'Rep-based (e.g., each move lists 8–12 reps)',
      'Mixed - both time and reps',
      'Other'
    ],
    icon: <Clock size={32} />
  },
  {
    id: 'planDuration',
    title: "How long do you want your workout plan to be?",
    subtitle: "We can create plans of different lengths to match your goals and commitment level",
    type: 'single',
  options: ['1 week (Mini)', '2 weeks (Quick start)', '1 month (Standard)', '6 weeks (Build habits)', '3 months (Transformation)', '6 months (Lifestyle change)'],
    icon: <Calendar size={32} />
  },{
    id: 'daysPerWeek',
    title: "How many days per week do you want to work out?",
    subtitle: "We'll plan rest days to help you recover",
    type: 'single',
    options: ['3 days', '4 days', '5 days', '6 days', '7 days', 'Other'],
    icon: <Calendar size={32} />
  },  {
    id: 'preferredTime',
    title: "When do you prefer to work out?",
    subtitle: "We can tailor workouts to your energy levels throughout the day",
    type: 'single',
    options: ['Early morning (5-8 AM)', 'Morning (8-11 AM)', 'Lunch time (11 AM-2 PM)', 'Afternoon (2-5 PM)', 'Evening (5-8 PM)', 'Night (8-11 PM)', 'Varies/Flexible', 'Other'],
    icon: <Clock size={32} />
  },
  {
    id: 'energyLevels',
    title: "How would you rate your current energy levels?",
    subtitle: "This helps us design workouts that match your vitality",
    type: 'rating',
    min: 1,
    max: 10,
    icon: <Heart size={32} />
  },  {
    id: 'preferences',
    title: "What types of workouts do you enjoy?",
    subtitle: "Let's make fitness fun for you",
    type: 'multiple',
    options: [
      'Strength Training',
      'Cardio',
      'Plyometrics',
      'Powerlifting',
      'Olympic Weightlifting',
      'Stretching',
      'Strongman',
      'Rest Day'
    ],
    icon: <Heart size={32} />
  },
  {
    id: 'dislikes',
    title: "Are there any exercises you want to avoid?",
    subtitle: "We'll make sure to exclude anything you don't enjoy or can't do",
    type: 'textarea',
    icon: <Heart size={32} />
  },
  {
    id: 'injuries',
    title: "Do you have any injuries or physical limitations?",
    subtitle: "This helps us create safe workouts tailored to your needs",
    type: 'textarea',
    icon: <Heart size={32} />
  },
  {
    id: 'equipment',
    title: "What equipment do you have access to?",
    subtitle: "List every item you actually have; the AI will only recommend workouts that require the selected equipment",
    type: 'multiple',    options: [
      'No equipment (bodyweight only)',
      'Dumbbells',
      'Resistance bands',
      'Yoga mat',
      'Pull-up bar',
      'Gym membership',
      'Treadmill/bike',
      'Kettlebells',
      'Barbell',
      'Medicine ball',
      'Foam roller',
      'Suspension trainer (TRX)',
      'Other'
    ],
    icon: <Dumbbell size={32} />
  },
  {
    id: 'budget',
    title: "Are you interested in additional fitness resources?",
    subtitle: "We can suggest equipment or services within your budget",
    type: 'single',
    options: [
      'No budget for additional equipment',
      'Small budget ($0-50)',
      'Medium budget ($50-200)',
      'Higher budget ($200+)',
      'Already have everything I need'
    ],
    icon: <Target size={32} />
  },
  {
    id: 'lifestyle',
    title: "How would you describe your lifestyle?",
    subtitle: "This helps us understand how to fit fitness into your routine",
    type: 'single',
    options: [
      'Very sedentary (desk job, little movement)',
      'Mostly sedentary with some walking',
      'Moderately active (some daily movement)',
      'Active (regular movement throughout day)',
      'Very active (physical job or lots of movement)'
    ],
    icon: <User size={32} />
  },
  {
    id: 'sleepQuality',
    title: "How well do you sleep?",
    subtitle: "Sleep affects recovery and workout performance",
    type: 'rating',
    min: 1,
    max: 10,
    icon: <Heart size={32} />
  },
  {
    id: 'stressLevel',
    title: "What's your current stress level?",
    subtitle: "We can include stress-relief exercises in your plan",
    type: 'rating',
    min: 1,
    max: 10,
    icon: <Heart size={32} />
  },
  {
    id: 'socialPreference',
    title: "Do you prefer working out alone or with others?",
    subtitle: "This helps us suggest the right type of workout environment",
    type: 'single',
    options: [
      'Definitely alone',
      'Mostly alone',
      'No preference',
      'Mostly with others',
      'Definitely with others'
    ],
    icon: <User size={32} />
  },
  {
    id: 'progressTracking',
    title: "How do you like to track your progress?",
    subtitle: "We can suggest the best methods for you",
    type: 'multiple',    options: [
      'Weight/measurements',
      'Progress photos',
      'Workout logs',
      'Fitness apps',
      'Wearable devices',
      'How I feel',
      'Performance improvements',
      "I don't like tracking",
      'Other'
    ],
    icon: <Target size={32} />
  },
  {
    id: 'concerns',
    title: "Any questions, concerns, or special requests?",
    subtitle: "Share anything else that would help us create the perfect plan for you - dietary restrictions, work schedule, family commitments, past injuries, fears, or anything else on your mind",
    type: 'textarea',
    icon: <Heart size={32} />
  }
];

// Default follow-up questions used when AI-generated ones fail or return invalid data.
const DEFAULT_FOLLOW_UP_QUESTIONS: Question[] = [
  {
    id: 'ai_followup_challenges',
    title: 'Which barriers could make sticking to a plan difficult?',
    subtitle: 'Select all that apply so we can help you sidestep them.',
    type: 'multiple',
    options: [
      'Time constraints',
      'Low energy',
      'Motivation dips',
      'Limited equipment',
      'Recovery needs',
      'Injuries or pain',
      'Other'
    ],
    iconType: 'Heart',
    aiGenerated: true
  },
  {
    id: 'ai_followup_focus',
    title: 'What should we prioritize next for you?',
    subtitle: 'Share a single focus area that feels most important right now.',
    type: 'textarea',
    iconType: 'Target',
    aiGenerated: true
  },
  {
    id: 'ai_followup_support',
    title: 'How much accountability would keep you on track?',
    subtitle: 'Higher values mean more check-ins or nudges from the coach.',
    type: 'slider',
    min: 0,
    max: 10,
    step: 1,
    iconType: 'Clock',
    aiGenerated: true
  },
  {
    id: 'ai_followup_energy_peak',
    title: 'When do you normally feel most energized?',
    subtitle: 'We can tailor workouts around your natural highs.',
    type: 'single',
    options: ['Early morning (5-8 AM)', 'Late morning (8-11 AM)', 'Lunch hour', 'Afternoon', 'Evening', 'Flex schedule'],
    iconType: 'Calendar',
    aiGenerated: true
  },
  {
    id: 'ai_followup_recovery',
    title: 'How are you handling recovery these days?',
    subtitle: 'Rate your current recovery ability from 1 (tough) to 10 (excellent).',
    type: 'rating',
    min: 1,
    max: 10,
    iconType: 'Star',
    aiGenerated: true
  }
];

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const toIsoDateString = (date: Date): string => {
  const padded = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${padded(date.getMonth() + 1)}-${padded(date.getDate())}`;
};

const normalizeToIsoDate = (value?: string | Date | null): string => {
  if (!value) return '';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    return toIsoDateString(value);
  }
  const text = String(value).trim();
  if (!text) return '';
  const [firstSegment] = text.split('T');
  if (ISO_DATE_RE.test(firstSegment)) return firstSegment;
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return toIsoDateString(parsed);
  return '';
};

const shouldPreservePriorDay = (day: DayWorkout, cutoffIso: string): boolean => {
  const dayIso = normalizeToIsoDate(day.date);
  if (!dayIso) return false;
  if (day.completed) return true;
  return dayIso <= cutoffIso;
};

const mergeRegeneratedPlanWithHistory = (plan: WorkoutPlan): WorkoutPlan => {
  const storedPlan = loadWorkoutPlan() as WorkoutPlan | null;
  if (!storedPlan?.dailyWorkouts?.length) return plan;
  const cutoffIso = normalizeToIsoDate(new Date());
  if (!cutoffIso) return plan;
  const priorDays = storedPlan.dailyWorkouts
    .map((day) => {
      if (!day) return null;
      const iso = normalizeToIsoDate(day.date);
      if (!iso) return null;
      return { ...day, date: iso } as DayWorkout;
    })
    .filter((day): day is DayWorkout => Boolean(day));
  if (!priorDays.length) return plan;

  const priorMap = new Map<string, DayWorkout>();
  priorDays.forEach((day) => {
    if (day.date) priorMap.set(day.date, day);
  });

  const normalizedNewDays = plan.dailyWorkouts.map((day) => {
    const isoDate = normalizeToIsoDate(day.date) || day.date;
    const normalizedDay = { ...day, date: isoDate };
    const prior = isoDate ? priorMap.get(isoDate) : undefined;
    if (prior && shouldPreservePriorDay(prior, cutoffIso)) {
      return { ...prior };
    }
    return normalizedDay;
  });

  const newDates = new Set(normalizedNewDays.map((day) => day.date));
  const extraDays = priorDays
    .filter((day) => !!day.date && !newDates.has(day.date))
    .map((day) => ({ ...day }));

  const combined = [...normalizedNewDays, ...extraDays];
  const uniqueByDate = new Map<string, DayWorkout>();
  combined.forEach((day) => {
    if (!day?.date) return;
    if (!uniqueByDate.has(day.date)) {
      uniqueByDate.set(day.date, day);
    }
  });

  const sortedDays = Array.from(uniqueByDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  if (!sortedDays.length) return plan;

  const startDate = sortedDays[0].date || plan.startDate;
  const endDate = sortedDays[sortedDays.length - 1].date || plan.endDate;

  return {
    ...plan,
    startDate,
    endDate,
    totalDays: sortedDays.length,
    dailyWorkouts: sortedDays
  };
};

const MenuScreen: React.FC<{ onRegenerate: () => void; onEditResponses: () => void; onGoToCalendar: () => void }> = ({ onRegenerate, onEditResponses, onGoToCalendar }) => {

  return (
    <div className="menu-screen">
      <div className="menu-container menu-container--hero">
        <div className="menu-hero">
          <div className="menu-hero-icon">
            <Dumbbell size={48} />
          </div>
          <h1 className="menu-header">Assessment Complete</h1>
          <p className="menu-subtitle">Nice work — we've saved your answers and can generate a refreshed plan anytime.</p>
        </div>

        <div className="menu-actions">
          <button className="btn btn-primary menu-btn menu-btn--large" onClick={() => onRegenerate()}>
            <RefreshCw size={18} />
            <span>Regenerate Plan</span>
          </button>

          <button className="btn btn-outline menu-btn menu-btn--large menu-btn--alt" onClick={() => onGoToCalendar()}>
            <Calendar size={18} />
            <span>Go to Calendar</span>
          </button>

          <button className="btn btn-outline menu-btn menu-btn--alt" onClick={() => onEditResponses()}>
            <User size={18} />
            <span>Edit Responses</span>
          </button>
        </div>

        <div className="menu-footer">
          <small className="menu-note">Tip: Regenerating will create a fresh plan based on your current answers — your previous plan is saved in your profile.</small>
        </div>
      </div>
    </div>
  );
};

// Loading UI is centralized at the /loading route. Component-local loading UI removed.

const FollowUpLoadingScreen: React.FC = () => (
  <div className="questionnaire-page">
    <div className="questionnaire-container">
      <div className="followup-loading-content">
        <div className="spinner"></div>
        <h2 className="loading-title">Generating Follow-Up Questions</h2>
        <p className="loading-subtitle">Hang tight while we personalize your questionnaire...</p>
        <p className="ai-disclaimer">Disclaimer: These follow-up questions are AI-generated and may not be perfect.</p>
      </div>
    </div>
  </div>
);

const ErrorScreen: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <div className="questionnaire-page">
    <div className="questionnaire-container error-screen">
      <div className="error-content">
        <h2 className="error-title">Oops! Something went wrong.</h2>
        <p className="error-message">We couldn't generate your plan. Please try again.</p>
        <button className="btn error-btn" onClick={onRetry}>Retry</button>
      </div>
    </div>
  </div>
);

const Questionnaire: React.FC<QuestionnaireProps> = ({ onComplete }) => {
  // Google Sheets webhook sender
  const sendToSheet = async (answersObj: Record<string, any>, questionsList: Question[]) => {
    try {
      console.log('Preparing data to send to Google Sheet webhook...');
      const rows = Object.entries(answersObj).map(([id, answer], idx) => {
        const q = questionsList.find(q => q.id === id);
        return {
          questionOrder: idx + 1,
          questionType: q?.aiGenerated ? 'AI' : 'Base',
          question: q?.title || id,
          answer: Array.isArray(answer) ? answer.join('; ') : String(answer)
        };
      });
      const payload = { timestamp: new Date().toISOString(), rows };
      console.log('Sending POST request to Google Sheet webhook with payload:', payload);
      const response = await fetch(SHEET_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(`Failed with status ${response.status}`);
      }
      console.log('Data successfully sent to Google Sheet:', await response.json());
    } catch (err) {
      console.error('Failed to send to Google Sheet:', err);
    }
  };

  // component state
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});
  const [allQuestions, setAllQuestions] = useState<Question[]>(questions);
  const [followUpGenerated, setFollowUpGenerated] = useState(false);
  const [hasRestoredProgress, setHasRestoredProgress] = useState(false);
  // Number of AI-generated questions appended during generation
  const AI_GENERATED_COUNT = 5;
  const [isCompleted, setIsCompleted] = useState(false);
  const [showCompletionOptions, setShowCompletionOptions] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  // isLoading removed — use the global /loading route instead
  const [isFollowUpLoading, setIsFollowUpLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [justReturnedFromHidden, setJustReturnedFromHidden] = useState(false);

  // Guard against accidental navigation to /loading when the user switches tabs and returns.
  React.useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        // Mark that the user just returned; next automatic navigation to loading should be skipped once
        setJustReturnedFromHidden(true);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const safeNavigateToLoading = (force = false) => {
    if (justReturnedFromHidden && !force) {
      // Clear the flag and skip this automatic navigation; user can trigger it again with an explicit action
      setJustReturnedFromHidden(false);
      console.log('Skipped automatic navigation to /loading due to recent tab return');
      return;
    }
    navigate('/loading');
  };
  // Prevent double submissions when generating the final plan
  const [isPlanGenerating, setIsPlanGenerating] = useState(false);
  const question = allQuestions[currentQuestion];
  // Use the base `questions` array length as the canonical base count. allQuestions may include
  // appended AI-generated questions after generation; adding AI_GENERATED_COUNT to allQuestions
  // would double-count. Always show baseQuestions + AI_GENERATED_COUNT (24 + 5 = 29).
  const effectiveTotalQuestions = questions.length + AI_GENERATED_COUNT;
  const progress = ((currentQuestion + 1) / effectiveTotalQuestions) * 100;

  // On mount: if the user is signed in, attempt to restore server-saved data
  useEffect(() => {
    let mounted = true;
  const tryRestore = async () => {
      try {
        // If local progress or plan already exists, skip restoring from server to avoid overwriting
        try { if (localStorage.getItem('fitbuddyai_no_auto_restore') || sessionStorage.getItem('fitbuddyai_no_auto_restore')) return; } catch {}
        const existingProgress = loadQuestionnaireProgress();
        const existingPlan = loadWorkoutPlan();
        if (existingProgress || existingPlan) return;
        const user = loadUserData();
        if (!user || !user.id) return;
        // Restore server-stored keys into localStorage
        await restoreUserDataFromServer(user.id);
        if (!mounted) return;
        // Load assessment and questionnaire progress from localStorage (if any)
        const assessment = loadAssessmentData();
        if (assessment) {
          // Merge assessment answers into current answers state
          setAnswers(prev => ({ ...(prev || {}), ...(assessment || {}) }));
        }
        const restoredProgress = loadQuestionnaireProgress();
        if (restoredProgress) {
          setAllQuestions(restoredProgress.questionsList || allQuestions);
          setAnswers(restoredProgress.answers || {});
          setCustomInputs(restoredProgress.customInputs || {});
          setCurrentQuestion(restoredProgress.currentQuestion || 0);
          setHasRestoredProgress(true);
          if (restoredProgress.completed) {
            setIsCompleted(true);
            setShowCompletionOptions(true);
          }
        }
        // Also set userData in component from saved user if present
        setUserData(user as UserData);
      } catch (err) {
        console.warn('Failed to restore server data in Questionnaire:', err);
      }
    };
    tryRestore();
    return () => { mounted = false; };
  }, []);
  
  // Set CSS variable for progress bar
  const progressBarRef = React.useRef<HTMLDivElement>(null);
  
  React.useEffect(() => {
    if (progressBarRef.current) {
      progressBarRef.current.style.setProperty('--progress-width', `${progress}%`);
    }
  }, [progress]);
  // Load saved progress on component mount
  useEffect(() => {
    const savedProgress = loadQuestionnaireProgress();
    if (!savedProgress) return;
    // Restore AI-generated questions (without React icons) then attach icons
    if (savedProgress.questionsList) {
      const restoredQs = savedProgress.questionsList.map((q: any) => ({
        ...q,
        icon: getIconFromType(q.iconType || ''),
      }));
      setAllQuestions(restoredQs);
      if (restoredQs.length > questions.length) {
        setFollowUpGenerated(true);
      }
    }
    if (savedProgress.completed) {
      setIsCompleted(true);
      setShowCompletionOptions(true);
      setAnswers(savedProgress.answers);
      return;
    }
  setCurrentQuestion(savedProgress.currentQuestion);
  setAnswers(savedProgress.answers);
  setCustomInputs(savedProgress.customInputs || {});
    setHasRestoredProgress(true);
  }, []);
  // Save progress whenever answers or current question changes
  useEffect(() => {
    if (hasRestoredProgress || Object.keys(answers).length > 0) {
      // Strip React icons before saving
      const rawQs = allQuestions.map(({ icon, ...rest }) => rest);
      saveQuestionnaireProgress({
        currentQuestion,
        answers,
        customInputs,
        completed: isCompleted,
        timestamp: Date.now(),
        userData,
        questionsList: rawQs
      });
    }
  }, [currentQuestion, answers, customInputs, hasRestoredProgress, isCompleted, allQuestions]);

  // Update follow-up generation trigger: after 23 answers
  const shouldGenerateFollowUp = Object.keys(answers).length >= 23 && !followUpGenerated;

  const appendGeneratedFollowUps = (incoming: Question[]): boolean => {
    if (!incoming || incoming.length === 0) {
      console.warn('[AI-FOLLOWUP] No follow-up questions available to append.');
      return false;
    }
    const questionsWithIcons = incoming.map((q) => ({
      ...q,
      aiGenerated: true,
      icon: q.icon || getIconFromType(q.iconType || '')
    }));
    setAllQuestions((prev) => {
      const updated = [...prev, ...questionsWithIcons];
      console.log('[AI-FOLLOWUP] allQuestions after append:', updated);
      setTimeout(() => {
        try {
          if (currentQuestion === questions.length - 1) {
            setCurrentQuestion(questions.length);
          }
        } catch (e) {
          // ignore
        }
      }, 0);
      return updated;
    });
    setFollowUpGenerated(true);
    console.log('[AI-FOLLOWUP] Follow-up questions appended and flag set.');
    return true;
  };

  // Helper to map iconType string to an icon component
  const getIconFromType = (type: string): React.ReactNode => {
    switch (type) {
      case 'Target':
      case 'target':
        return <Target size={32} />;
      case 'Clock':
      case 'clock':
        return <Clock size={32} />;
      case 'Dumbbell':
      case 'dumbbell':
      case 'equipment':
        return <Dumbbell size={32} />;
      case 'Heart':
      case 'heart':
      case 'heartRate':
        return <Heart size={32} />;
      case 'Calendar':
      case 'calendar':
        return <Calendar size={32} />;
      case 'User':
      case 'user':
        return <User size={32} />;
      case 'Star':
      case 'star':
        return <Star size={32} />;
      default:
        return <Target size={32} />;
    }
  };

  // Async follow-up questions handler
  const handleGenerateFollowUpQuestions = async (force = false): Promise<boolean> => {
     if (!force && Object.keys(answers).length < 23) {
       console.log('[AI-FOLLOWUP] Not enough answers for follow-up. answers.length:', Object.keys(answers).length);
       return false;
     }
     setIsFollowUpLoading(true);
     setError(null);

    let followUpCandidates: Question[] | null = null;
    try {
      // Prepare answers for context: replace 'Other' with customInputs where applicable
      const processedAnswers: Record<string, any> = { ...answers };
      Object.keys(customInputs).forEach(questionId => {
        if (customInputs[questionId]) {
          const answer = processedAnswers[questionId];
          if (typeof answer === 'string' && answer === 'Other') {
            processedAnswers[questionId] = customInputs[questionId];
          } else if (Array.isArray(answer) && answer.includes('Other')) {
            const newAnswers = answer.filter((a: string) => a !== 'Other');
            newAnswers.push(customInputs[questionId]);
            processedAnswers[questionId] = newAnswers;
          }
        }
      });
      // Assemble previous questions and processed answers for context
  // Use the component-local loading state (isFollowUpLoading) instead of navigating away
      const context = {
        questions: allQuestions.slice(0, 23).map(q => ({ id: q.id, title: q.title })),
        answers: processedAnswers
      };
      // Build prompt instructing AI to return exactly 5 JSON-only follow-up questions
      const prompt = `Based on the following user questions and responses, generate exactly 5 additional follow-up questions in JSON array format. Only return valid JSON; no extra text. Each object should have id, title, subtitle, type (single, multiple, textarea (for written responses), rating, slider, number), options, iconType, aiGenerated:true. Context: ${JSON.stringify(context)}`;
      console.log('[AI-FOLLOWUP] Prompt:', prompt);
      const aiResponse = await getAIResponse({ prompt });
      console.log('[AI-FOLLOWUP] Received AI response:', aiResponse);
      if (Array.isArray(aiResponse) && aiResponse.length > 0) {
        followUpCandidates = aiResponse;
      } else {
        console.warn('[AI-FOLLOWUP] AI response is not an array:', aiResponse);
      }
    } catch (err) {
      console.error('[AI-FOLLOWUP] Error fetching follow-up questions:', err);
    } finally {
      setIsFollowUpLoading(false);
      console.log('[AI-FOLLOWUP] Done loading follow-up questions.');
    }

    if (!followUpCandidates || followUpCandidates.length === 0) {
      console.warn('[AI-FOLLOWUP] Falling back to default follow-up questions.');
      followUpCandidates = DEFAULT_FOLLOW_UP_QUESTIONS;
    }

    return appendGeneratedFollowUps(followUpCandidates);
  };

  // Use effect to trigger follow-up generation
  useEffect(() => {
    if (shouldGenerateFollowUp) handleGenerateFollowUpQuestions();
  }, [shouldGenerateFollowUp]);

  const handleAnswer = (value: any) => {
    if (question.id === 'startDate') {
      const todayStr = new Date().toISOString().split('T')[0];
      if (value && value < todayStr) {
        setDateError('Start date cannot be in the past');
      } else {
        setDateError(null);
      }
    }
    setAnswers(prev => ({ ...prev, [question.id]: value }));
  };
  
  const handleNext = async () => {
    console.log('[NAV] handleNext called. currentQuestion:', currentQuestion, 'allQuestions.length:', allQuestions.length);
    if (currentQuestion < allQuestions.length - 1) {
      // If we're at the 22nd question (index 22), next is 23rd (index 23, last base question)
      if (currentQuestion === 22) {
        console.log('[NAV] About to answer 23rd question. Next click will trigger AI follow-up logic.');
      }
      setCurrentQuestion(prev => {
        const next = prev + 1;
        console.log('[NAV] Advancing to question index:', next);
        return next;
      });
    } else {
      // If follow-ups haven't been generated yet but we're on the last base question,
      // always attempt to generate follow-ups and advance into them instead of
      // immediately generating the final plan.
      if (!followUpGenerated && currentQuestion === questions.length - 1) {
        console.log('[NAV] At last base question; generating follow-ups instead of final plan.');
  const ok = await handleGenerateFollowUpQuestions(true);
        if (ok) {
          setCurrentQuestion(questions.length); // move to first generated question
        } else {
          // Generation failed: advance to next index without generating plan
          setCurrentQuestion(prev => Math.min(allQuestions.length - 1, prev + 1));
        }
        return;
      }

      // Force navigation when user explicitly triggers final generation and prevent double clicks
      if (isPlanGenerating) {
        console.log('[PLAN] Generation already in progress, ignoring duplicate request');
        return;
      }
      setIsPlanGenerating(true);
      safeNavigateToLoading(true);
  setError(null);
  // Use the global loading route instead of the component-local LoadingScreen
  // navigate to loading but guarded against accidental tab-focus redirects
  // safeNavigateToLoading will skip the navigation if the user just returned to the tab
  // and will clear the 'just returned' flag.
  // Call it instead of navigate('/loading') to avoid unexpected redirects.
  // Note: safeNavigateToLoading already calls navigate('/loading') when allowed.
  // We call it here and not call navigate('/loading') directly.
  // (kept for clarity)
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  safeNavigateToLoading();
  try {
        // Send answers to Google Sheet before plan generation (fire-and-forget)
        // We don't await this because webhook failures should not block plan generation.
        // sendToSheet already logs errors internally.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        sendToSheet(answers, allQuestions);
         // Process answers to include custom inputs for "Other" options
         const processedAnswers = { ...answers };
        
        // Add custom inputs to the relevant answers
        Object.keys(customInputs).forEach(questionId => {
          if (customInputs[questionId]) {
            const answer = processedAnswers[questionId];
            if (typeof answer === 'string' && answer === 'Other') {
              processedAnswers[questionId] = customInputs[questionId];
            } else if (Array.isArray(answer) && answer.includes('Other')) {
              const newAnswers = answer.filter(a => a !== 'Other');
              newAnswers.push(customInputs[questionId]);
              processedAnswers[questionId] = newAnswers;
            }
          }
        });
        const userData: UserData = {
          username: processedAnswers.username || '',
          age: processedAnswers.age,
          fitnessLevel: processedAnswers.fitnessLevel?.split(' -')[0].toLowerCase(),
          fitnessBackground: processedAnswers.fitnessBackground,
          motivation: processedAnswers.motivation,
          goals: processedAnswers.goals || [],
          specificGoals: processedAnswers.specificGoals,
          timeAvailable: processedAnswers.timeAvailable,
          exerciseFormat: processedAnswers.exerciseFormat,
          planDuration: processedAnswers.planDuration,
          daysPerWeek: processedAnswers.daysPerWeek,
          preferredTime: processedAnswers.preferredTime,
          energyLevels: processedAnswers.energyLevels,
          preferences: processedAnswers.preferences || [],
          dislikes: processedAnswers.dislikes,
          injuries: processedAnswers.injuries,
          equipment: processedAnswers.equipment || [],
          budget: processedAnswers.budget,
          lifestyle: processedAnswers.lifestyle,
          sleepQuality: processedAnswers.sleepQuality,
          stressLevel: processedAnswers.stressLevel,
          socialPreference: processedAnswers.socialPreference,
          progressTracking: processedAnswers.progressTracking,
          concerns: processedAnswers.concerns
        };
      setUserData(userData);

        // Retry logic: attempt to generate workout plan up to 3 times
        let workoutPlan!: WorkoutPlan; // definite assignment after retries
        const maxRetries = 2;
        for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
          try {
            console.log(`[PLAN] Generating workout plan, attempt ${attempt}`);
            // If user requested more than 1 week, generate the plan one week at a time to avoid token limits
            const durationLabel = (processedAnswers.planDuration || '').toString().toLowerCase();
            // Helper to parse weeks from label (e.g., '1 week', '2 weeks', '1 month' approximated as 4 weeks, etc.)
            const parseWeeks = (label: string) => {
              if (label.includes('1 week')) return 1;
              if (label.includes('2 week')) return 2;
              if (label.includes('6 week')) return 6;
              if (label.includes('1 month')) return 4;
              if (label.includes('3 month')) return 12;
              if (label.includes('6 month')) return 24;
              return 2; // default
            };

            const weeks = parseWeeks(durationLabel);
            if (weeks <= 1) {
              workoutPlan = await generateWorkoutPlan(userData, processedAnswers, allQuestions);
            } else {
              // Generate week-by-week and concatenate dailyWorkouts
              const start = processedAnswers.startDate || new Date().toISOString().split('T')[0];
              const allWeeks: any[] = [];
              let currentStart = new Date(start);
              for (let w = 0; w < weeks; w++) {
                const answersForWeek = { ...processedAnswers, startDate: currentStart.toISOString().split('T')[0], planDuration: '1 week (part)' };
                try {
                  const weekPlan = await generateWorkoutPlan(userData, answersForWeek, allQuestions);
                  // Normalize weekPlan.dailyWorkouts dates if needed to ensure continuity
                  allWeeks.push(weekPlan);
                  // advance by 7 days
                  currentStart.setDate(currentStart.getDate() + 7);
                } catch (err) {
                  console.warn('Week generation failed for week', w, err);
                  throw err;
                }
              }
              // Merge weekly plans into one plan
              const mergedDaily: any[] = [];
              let finalName = '';
              let finalDesc = '';
              let finalStart = '';
              let finalEnd = '';
              let finalWeeklyStructure: any[] = [];
              allWeeks.forEach((p) => {
                if (!finalStart) finalStart = p.startDate;
                finalEnd = p.endDate || finalEnd;
                finalName = finalName || p.name;
                finalDesc = finalDesc || p.description;
                if (Array.isArray(p.weeklyStructure) && finalWeeklyStructure.length === 0) finalWeeklyStructure = p.weeklyStructure;
                if (Array.isArray(p.dailyWorkouts)) mergedDaily.push(...p.dailyWorkouts);
              });
              workoutPlan = {
                id: `merged-plan-${Date.now()}`,
                name: finalName || `${userData.username || 'User'}'s Plan`,
                description: finalDesc || 'Merged weekly plan',
                startDate: finalStart || start,
                endDate: finalEnd || mergedDaily[mergedDaily.length - 1]?.date || start,
                totalDays: mergedDaily.length,
                weeklyStructure: finalWeeklyStructure,
                dailyWorkouts: mergedDaily
              } as any;
            }
            console.log(`[PLAN] Workout plan generated on attempt ${attempt}`);
            break;
          } catch (err) {
            console.error(`[PLAN] Attempt ${attempt} failed:`, err);
            if (attempt === maxRetries + 1) {
              setError('Failed to generate workout plan. Please try again.');
            }
          }
        }
      if (workoutPlan) {
        console.log('[PLAN] Plan complete, calling onComplete.');
        // Mark questionnaire as completed and persist progress so the "already filled out" state is saved
        setIsCompleted(true);
        setShowCompletionOptions(true);
        try {
          const rawQs = allQuestions.map(({ icon, ...rest }) => rest);
          saveQuestionnaireProgress({
            currentQuestion,
            answers,
            customInputs,
            completed: true,
            timestamp: Date.now(),
            userData,
            questionsList: rawQs
          });
        } catch (err) {
          console.warn('Failed to save completed questionnaire progress:', err);
        }
        // If the user is signed in, merge their saved account fields (id, username, avatar, etc.)
        // into the generated assessment userData so the rest of the app (Header, Profile)
        // has the full account record available immediately after generation.
        try {
          const signedIn = loadUserData();
          // If there is a real signed-in account, merge so account fields override generated values.
          if (signedIn) {
            const finalUser = { ...userData, ...signedIn };
            onComplete(finalUser, workoutPlan);
            } else {
            // No signed-in account: ensure generated userData cannot masquerade as a real account
            const { id, token, access_token, jwt, sub, ...sanitized } = (userData as any) || {};
            onComplete(sanitized, workoutPlan);
          }
        } catch (err) {
    // Fallback: sanitize generated data to avoid accidental sign-in state
    const { id, token, access_token, jwt, sub, ...sanitized } = (userData as any) || {};
    onComplete(sanitized, workoutPlan);
        }
      }
    } catch (err) {
      console.error('[PLAN] Error generating plan:', err);
      setError('Failed to generate workout plan. Please try again.');
    } finally {
      console.log('[PLAN] Done loading plan.');
      setIsPlanGenerating(false);
    }
  }
};
  // Allow user to finish questionnaire early and generate plan with current answers

  const handleBack = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1);
    } else {
      navigate('/');
    }
  };
  const canProceed = () => {
    const answer = answers[question.id];
    if (question.type === 'multiple') {
      return answer && answer.length > 0;
    }
    if (question.type === 'textarea') {
      return answer && answer.trim().length > 0;
    }
    if (question.type === 'rating') {
      return answer !== undefined && answer > 0;
    }
    return answer !== undefined && answer !== '';
  };

  // Handle continue or skip clicks with correct behavior at the end of base questions
  const handleContinueOrSkip = async () => {
    // If the current question has an answer, proceed normally
    if (canProceed()) {
      handleNext();
      return;
    }

    // If we're on the last base question and follow-ups aren't generated yet,
    // trigger AI follow-up generation (if threshold met) and then advance.
    const isOnLastBaseQuestion = currentQuestion === questions.length - 1;
    // If we're on the last base question and follow-ups aren't generated yet,
    // always attempt to generate follow-ups when the user clicks Continue/Skip.
    if (isOnLastBaseQuestion && !followUpGenerated) {
      await handleGenerateFollowUpQuestions(true);
      // After generation, advance to the first generated question (if any)
      setCurrentQuestion(prev => Math.min(allQuestions.length - 1, prev + 1));
      return;
    }

    // Only treat this as the final question when we've actually reached the
    // effective total (base + AI) OR follow-ups were generated and
    // the user is at the end of the expanded `allQuestions` list.
    const isAtAbsoluteLastQuestion = currentQuestion === (effectiveTotalQuestions - 1);
    const isAtEndOfGenerated = followUpGenerated && currentQuestion === allQuestions.length - 1;
    if (isAtAbsoluteLastQuestion || isAtEndOfGenerated) {
      handleNext();
      return;
    }

    // Default skip: advance to next available question
    setCurrentQuestion(prev => Math.min(allQuestions.length - 1, prev + 1));
  };
  const renderQuestionInput = () => {
    const answer = answers[question.id];

    switch (question.type) {
      case 'text':
        if (question.id === 'startDate') {
          const todayStr = new Date().toISOString().split('T')[0];
          return (
            <>
              <div className="start-date-actions">
                <input
                  type="date"
                  className="input question-input"
                  min={todayStr}
                  value={answer || ''}
                  onChange={(e) => handleAnswer(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !dateError && canProceed() && handleNext()}
                  aria-label={question.title}
                />
                <button
                  type="button"
                  className="start-today-btn"
                  onClick={() => handleAnswer(todayStr)}
                >
                  Start Today!
                </button>
              </div>
              {dateError && <div className="error-message" role="alert">{dateError}</div>}
            </>
          );
        }
        return (
          <input
            type="text"
            className="input question-input"
            placeholder="Enter your name"
            value={answer || ''}
            onChange={(e) => handleAnswer(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && canProceed() && handleNext()}
            aria-label={question.title}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            className="input question-input"
            placeholder="Enter your age"
            min={question.min}
            max={question.max}
            value={answer || ''}
            onChange={(e) => handleAnswer(parseInt(e.target.value))}
            onKeyDown={(e) => e.key === 'Enter' && canProceed() && handleNext()}
            aria-label={question.title}
          />
        );

      case 'textarea':
        return (
          <textarea
            className="input question-textarea"
            placeholder="Share your thoughts..."
            rows={4}
            value={answer || ''}
            onChange={(e) => handleAnswer(e.target.value)}
            aria-label={question.title}
          />
        );

      case 'rating':
        return (
          <div className="rating-container">
            <div className="rating-scale">
              {Array.from({ length: question.max || 10 }, (_, i) => i + 1).map((rating) => (
                <button
                  key={rating}
                  className={`rating-button ${answer === rating ? 'selected' : ''}`}
                  onClick={() => handleAnswer(rating)}
                  aria-label={`Rating ${rating}`}
                >
                  {rating}
                </button>
              ))}
            </div>
            <div className="rating-labels">
              <span>{question.id === 'stressLevel' ? 'Low Stress Levels' : 'Poor'}</span>
              <span>{question.id === 'stressLevel' ? 'High Stress Levels' : 'Excellent'}</span>
            </div>
            {answer && (
              <div className="rating-value">
                You rated: {answer}/10
              </div>
            )}
          </div>
        );

      case 'slider':
        return (
          <div className="slider-container">
            <input
              type="range"
              className="slider"
              min={question.min}
              max={question.max}
              step={question.step}
              value={answer || question.min}
              onChange={(e) => handleAnswer(parseInt(e.target.value))}
              aria-label={question.title}
            />
            <div className="slider-value">
              {answer || question.min} minutes
            </div>
          </div>
        );      case 'single':
        return (
          <div className="options-container">
            <div className="options-grid">
              {question.options?.map((option, index) => (
                <button
                  key={index}
                  className={`option-button ${answer === option ? 'selected' : ''}`}
                  onClick={() => handleAnswer(option)}
                  aria-label={option}
                >
                  {option}
                </button>
              ))}
            </div>
            {answer === 'Other' && (
              <div className="custom-input-container">
                <input
                  type="text"
                  className="input custom-input"
                  placeholder="Please specify..."
                  value={customInputs[question.id] || ''}
                  onChange={(e) => setCustomInputs(prev => ({ ...prev, [question.id]: e.target.value }))}
                />
              </div>
            )}
          </div>
        );case 'multiple':
        return (
          <div className="options-container">
            <div className="options-grid">
              {question.options?.map((option, index) => (
                <button
                  key={index}
                  className={`option-button ${answer && answer.includes(option) ? 'selected' : ''}`}
                  onClick={() => {
                    const currentAnswers = answer || [];
                    const newAnswers = currentAnswers.includes(option)
                      ? currentAnswers.filter((a: string) => a !== option)
                      : [...currentAnswers, option];
                    handleAnswer(newAnswers);
                  }}
                  aria-label={option}
                >
                  {option}
                </button>
              ))}
            </div>
            {answer && answer.includes('Other') && (
              <div className="custom-input-container">
                <input
                  type="text"
                  className="input custom-input"
                  placeholder="Please specify..."
                  value={customInputs[question.id] || ''}
                  onChange={(e) => setCustomInputs(prev => ({ ...prev, [question.id]: e.target.value }))}
                />
              </div>
            )}
          </div>
        );

      default:
        return (
          <input
            type="text"
            className="input question-input"
            placeholder="Enter your response"
            value={answer || ''}
            onChange={(e) => handleAnswer(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && canProceed() && handleNext()}
            aria-label={question.title}
          />
        );
    }
  };
  // Function to restart questionnaire
  const handleRestart = () => {
    clearQuestionnaireProgress();
    setCurrentQuestion(0);
    setAnswers({});
    setCustomInputs({});
    setIsCompleted(false);
    setShowCompletionOptions(false);
  };

  const handleEditResponses = () => {
    console.log('Edit Responses button clicked');
    setShowCompletionOptions(false);
    setIsCompleted(false);
    setCurrentQuestion(0); // Navigate back to the first question
    setIsMenuVisible(false); // Hide the menu screen

    const savedProgress = loadQuestionnaireProgress();
    if (savedProgress?.answers) {
      setAnswers(savedProgress.answers); // Auto-populate previous answers
      console.log('Previous answers loaded into state:', savedProgress.answers);
    } else {
      console.warn('No previous answers found to populate.');
    }

    console.log('Questionnaire reset to allow editing of responses');
  };

  const handleGoToCalendar = () => {
    navigate('/calendar');
  };

  // Menu screen for completed questionnaire
  const [isMenuVisible, setIsMenuVisible] = useState(false);

  // Restore saved data for regeneration/editing
  useEffect(() => {
    const savedProgress = loadQuestionnaireProgress();
    console.log('Loaded questionnaire progress:', savedProgress);
    if (savedProgress?.completed) {
      setIsMenuVisible(true);
      // Restore userData for regeneration
      if (savedProgress.userData) {
        setUserData(savedProgress.userData);
        console.log('Restored userData:', savedProgress.userData);
      }
      // Restore answers
      if (savedProgress.answers) {
        setAnswers(savedProgress.answers);
        console.log('Restored answers:', savedProgress.answers);
      }
      // Restore custom inputs
      if (savedProgress.customInputs) {
        setCustomInputs(savedProgress.customInputs);
        console.log('Restored customInputs:', savedProgress.customInputs);
      }
      // Restore full question list including AI-generated
      if (savedProgress.questionsList) {
        const restoredQs = savedProgress.questionsList.map((q: any) => ({
          ...q,
          icon: getIconFromType(q.iconType || ''),
        }));
        setAllQuestions(restoredQs);
        console.log('Restored questionsList:', restoredQs);
      }
    } else {
      console.warn('No completed progress found in local storage.');
    }
  }, []);

  const handleRegenerate = async () => {
    console.log('handleRegenerate invoked');
    console.log('State before regeneration – userData:', userData, 'answers:', answers, 'allQuestions length:', allQuestions.length);
    // Ensure we have the latest saved progress if state is empty
    let currentUser = userData;
    let currentAnswers = answers;
    let currentQs = allQuestions;
    if (!currentUser) {
      console.log('No userData in state, attempting to load from localStorage');
      const saved = loadQuestionnaireProgress();
      console.log('loadQuestionnaireProgress returned:', saved);
      if (saved?.userData) {
        console.log('Found saved.userData:', saved.userData);
        currentUser = saved.userData;
        currentAnswers = saved.answers;
        setAnswers(currentAnswers);
        console.log('State after restoring answers:', currentAnswers);
        if (saved.customInputs) setCustomInputs(saved.customInputs);
        if (saved.questionsList) {
          console.log('Restoring questionsList of length:', saved.questionsList.length);
          const restored = saved.questionsList.map((q: any) => ({
            ...q,
            icon: getIconFromType(q.iconType || ''),
          }));
          setAllQuestions(restored);
          console.log('State after restoring allQuestions length:', restored.length);
          currentQs = restored;
        }
        setUserData(currentUser as UserData);
        console.log('State after restoring userData:', currentUser);
        console.log('Regenerate: restored state from localStorage', saved);
      }
      else {
  // Fallback to loadAssessmentData if no userData stored in progress
  const fallbackUser = loadAssessmentData();
  console.log('loadAssessmentData returned:', fallbackUser);
        if (fallbackUser) {
          currentUser = fallbackUser;
          setUserData(currentUser as UserData);
        }
      }
    }
    // If still no userData, but answers exist, reconstruct userData from answers
  if (!currentUser && currentAnswers) {
      console.log('Reconstructing userData from currentAnswers');
      const reconstructed: UserData = {
        username: currentAnswers.username || '',
        age: currentAnswers.age,
        fitnessLevel: typeof currentAnswers.fitnessLevel === 'string'
          ? currentAnswers.fitnessLevel.split(' -')[0].toLowerCase()
          : '',
        fitnessBackground: currentAnswers.fitnessBackground,
        motivation: currentAnswers.motivation,
        goals: currentAnswers.goals || [],
        specificGoals: currentAnswers.specificGoals,
        timeAvailable: currentAnswers.timeAvailable,
        exerciseFormat: currentAnswers.exerciseFormat,
        planDuration: currentAnswers.planDuration,
        daysPerWeek: currentAnswers.daysPerWeek,
        preferredTime: currentAnswers.preferredTime,
        energyLevels: currentAnswers.energyLevels,
        preferences: currentAnswers.preferences || [],
        dislikes: currentAnswers.dislikes,
        injuries: currentAnswers.injuries,
        equipment: currentAnswers.equipment || [],
        budget: currentAnswers.budget,
        lifestyle: currentAnswers.lifestyle,
        sleepQuality: currentAnswers.sleepQuality,
        stressLevel: currentAnswers.stressLevel,
        socialPreference: currentAnswers.socialPreference,
        progressTracking: currentAnswers.progressTracking,
        concerns: currentAnswers.concerns
      } as any;
      currentUser = reconstructed;
      setUserData(currentUser);
      console.log('Reconstructed userData:', reconstructed);
      // Persist for future uses
  saveAssessmentData(currentUser);
    }
    console.log('After restoration – currentUser:', currentUser);
    if (!currentUser) {
      console.warn('No userData available to regenerate plan. Exiting handleRegenerate');
      return;
    }
  console.log('Regenerate Plan clicked with userData:', currentUser);
  setError(null);
    try {
  safeNavigateToLoading();
      // When regenerating from MenuScreen we should also support week-by-week generation for long durations
      const durationLabel2 = (currentAnswers.planDuration || '').toString().toLowerCase();
      const parseWeeks2 = (label: string) => {
        if (label.includes('1 week')) return 1;
        if (label.includes('2 week')) return 2;
        if (label.includes('6 week')) return 6;
        if (label.includes('1 month')) return 4;
        if (label.includes('3 month')) return 12;
        if (label.includes('6 month')) return 24;
        return 2;
      };
      const weeks2 = parseWeeks2(durationLabel2);
      let newPlan: any;
      if (weeks2 <= 1) {
        newPlan = await generateWorkoutPlan(currentUser as UserData, currentAnswers, currentQs);
      } else {
        const start2 = currentAnswers.startDate || new Date().toISOString().split('T')[0];
        const chunks: any[] = [];
        let cs = new Date(start2);
        for (let w = 0; w < weeks2; w++) {
          const answersForWeek = { ...currentAnswers, startDate: cs.toISOString().split('T')[0], planDuration: '1 week (part)'};
          const weekPlan = await generateWorkoutPlan(currentUser as UserData, answersForWeek, currentQs);
          chunks.push(weekPlan);
          cs.setDate(cs.getDate() + 7);
        }
        const merged: any[] = [];
        chunks.forEach(c => { if (Array.isArray(c.dailyWorkouts)) merged.push(...c.dailyWorkouts); });
        newPlan = { id: `merged-plan-${Date.now()}`, name: chunks[0]?.name || 'Merged Plan', description: chunks[0]?.description || '', startDate: chunks[0]?.startDate || start2, endDate: chunks[chunks.length - 1]?.endDate || merged[merged.length - 1]?.date || start2, totalDays: merged.length, weeklyStructure: chunks[0]?.weeklyStructure || [], dailyWorkouts: merged };
      }
      console.log('New plan generated:', newPlan);
      const mergedPlan = mergeRegeneratedPlanWithHistory(newPlan);
      console.log('Regenerated plan after preserving prior exercises:', mergedPlan.dailyWorkouts.length, 'days');
      // Persist completed state
      setIsCompleted(true);
      setShowCompletionOptions(true);
      try {
        const rawQs = currentQs.map(({ icon, ...rest }) => rest);
        saveQuestionnaireProgress({
          currentQuestion: 0,
          answers: currentAnswers,
          customInputs: {},
          completed: true,
          timestamp: Date.now(),
          userData: currentUser,
          questionsList: rawQs
        });
      } catch (err) {
        console.warn('Failed to save completed progress on regenerate:', err);
      }
      // currentUser should already include account fields; still attempt to merge
          try {
            const signedIn = loadUserData();
            // Ensure saved account record takes precedence over questionnaire-generated values
            if (signedIn) {
              const finalUser = { ...(currentUser as any), ...signedIn };
              onComplete(finalUser, mergedPlan);
            } else {
              const { id, token, access_token, jwt, sub, ...sanitized } = (currentUser as any) || {};
              onComplete(sanitized as UserData, mergedPlan);
            }
          } catch (err) {
            const { id, token, access_token, jwt, sub, ...sanitized } = (currentUser as any) || {};
            onComplete(sanitized as UserData, mergedPlan);
          }
      navigate('/calendar');
    } catch (err) {
      console.error('Error regenerating plan:', err);
      setError('Failed to generate a new plan. Please try again.');
    } finally {
      // no local loading state to clear; global /loading route handles UI
    }
  };

  // Call this function when the questionnaire is completed
  useEffect(() => {
    if (isCompleted && !followUpGenerated) {
        handleGenerateFollowUpQuestions();
    }
}, [isCompleted, followUpGenerated]);

  if (isFollowUpLoading) {
    return <FollowUpLoadingScreen />;
  }

  // NOTE: initial generation now uses the global /loading route. Do not render
  // the component-local LoadingScreen here to avoid flashing the old screen.

  if (error) {
    return <ErrorScreen onRetry={handleRegenerate} />;
  }

  if (isMenuVisible) {
    return <MenuScreen onRegenerate={handleRegenerate} onEditResponses={handleEditResponses} onGoToCalendar={handleGoToCalendar} />;
  }

  if (isCompleted && showCompletionOptions) {
    return (
      <div className="completion-screen">
        <h2>Questionnaire Completed</h2>
        <p>Your responses have been saved. What would you like to do?</p>
        <button className="btn" onClick={handleEditResponses}>Edit Responses</button>
        <button className="btn btn-secondary" onClick={handleRestart}>Start Over</button>
      </div>
    );
  }

  return (
    <div className="questionnaire-page">
      <BackgroundDots />
      <div className="questionnaire-container">
        {/* Header */}
        <div className="questionnaire-header">          <button className="back-button" onClick={handleBack} aria-label="Go back to previous question">
            <ChevronLeft size={24} />
          </button>          <div className="progress-container" ref={progressBarRef}>
            <div className="progress-bar">
              <div className="progress-fill"></div>
            </div>
            <span className="progress-text">{currentQuestion + 1} of {effectiveTotalQuestions}</span>
          </div>        </div>

        {/* Progress Restoration Notification */}
        {hasRestoredProgress && currentQuestion === 0 && (
          <div className="restoration-notification">
            <div className="notification-content">
              <RefreshCw size={20} />
              <span>Your previous progress has been restored!</span>
              <button className="restart-button" onClick={handleRestart}>
                Start Fresh
              </button>
            </div>
          </div>
        )}

        {/* Question */}<div className="question-container card fade-in-up">
          <div className="question-icon">
            {question.icon}
          </div>
          {question.aiGenerated && (
            <div className="ai-badge">
              ✨ AI Personalized Question
            </div>
          )}
          <h2 className="question-title">{question.title}</h2>
          <p className="question-subtitle">{question.subtitle}</p>
          
          <div className="question-input-container">
            {renderQuestionInput()}
          </div>
        </div>        {/* Navigation */}
        <div className="questionnaire-navigation">
          <button
            className={`btn btn-secondary ${currentQuestion === 0 ? 'disabled' : ''}`}
            onClick={() => setCurrentQuestion(prev => Math.max(0, prev - 1))}
            disabled={currentQuestion === 0}
          >
            <ChevronLeft size={20} />
            Previous
          </button>
          {(() => {
            const isFinalButton = currentQuestion === effectiveTotalQuestions - 1 || (followUpGenerated && currentQuestion === allQuestions.length - 1);
            return (
              <button
                className={`btn ${canProceed() ? 'btn-primary' : 'btn-secondary'} continue-skip-btn${!canProceed() ? ' fake-disabled' : ''}`}
                onClick={() => {
                  if (isPlanGenerating) return;
                  if (isFinalButton) { handleNext(); } else { handleContinueOrSkip(); }
                }}
                tabIndex={0}
                aria-disabled={!canProceed() || isPlanGenerating}
                disabled={isPlanGenerating}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (isPlanGenerating) return;
                    if (isFinalButton) handleNext(); else handleContinueOrSkip();
                  }
                }}
              >
                <span className="continue-text">
                  {isFinalButton ? (isPlanGenerating ? 'Generating…' : 'Generate My Plan') : 'Continue'}
                </span>
                {!canProceed() && (
                  <span className="skip-inline-btn">Skip</span>
                )}
              </button>
            );
          })()}
        </div>
      </div>
    </div>
  );
};

export default Questionnaire;
