// Removed incorrect import of UserData from '../App'. Use the local UserData interface below.
import { WorkoutPlan } from '../types';

// API endpoint and key for Gemini via REST call
// Prefer server-side env (process.env.GEMINI_API_KEY) — set this in Vercel or
// in your local environment for server processes. We intentionally do NOT
// read any `VITE_` prefixed env here to avoid exposing secrets to the client.
// Accept multiple env var names so the client can use a key provided via Vite/Next public prefixes when needed.
const GEMINI_API_KEY =
  (typeof process !== 'undefined' && (process as any).env && (
    (process as any).env.GEMINI_API_KEY ||
    (process as any).env.VITE_GEMINI_API_KEY ||
    (process as any).env.NEXT_PUBLIC_GEMINI_API_KEY
  )) || '';

// Build the Gemini REST URL when an API key is present. If no key is available
// (for example when client code shouldn't have a secret), callers should use
// the local server endpoint (`/api/ai/generate`) instead.
// If an API key is not available in the environment, route requests to the
// local server endpoint which should handle calling the Gemini API.
const GEMINI_URL = GEMINI_API_KEY
  ? `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`
  : '/api/ai/generate';

// Helper: extract a JSON block from AI text. Handles fenced ```json``` blocks,
// top-level {...} or [...] blocks, and falls back to stripping code fences.
const extractJSONBlock = (raw: string): string | null => {
  if (!raw || typeof raw !== 'string') return null;
  // Prefer fenced blocks like ```json
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch && fenceMatch[1]) return fenceMatch[1].trim();

  // Try to find a top-level JSON object or array by indexes (first open, last close)
  const firstObj = raw.indexOf('{');
  const lastObj = raw.lastIndexOf('}');
  const firstArr = raw.indexOf('[');
  const lastArr = raw.lastIndexOf(']');
  if (firstObj !== -1 && lastObj !== -1 && lastObj > firstObj) {
    return raw.slice(firstObj, lastObj + 1).trim();
  }
  if (firstArr !== -1 && lastArr !== -1 && lastArr > firstArr) {
    return raw.slice(firstArr, lastArr + 1).trim();
  }

  // Last resort: strip common code-fence markers and return what remains.
  const stripped = raw.replace(/```[a-zA-Z]*\s*/g, '').replace(/```/g, '').trim();
  return stripped || null;
};

const normalizeEquipmentValue = (value?: string | null): string => {
  if (!value) return '';
  return value.toString().trim().replace(/\s+/g, ' ').toLowerCase();
};

const buildEquipmentContext = (equipmentList: string[] = []) => {
  const cleaned = Array.from(new Set(
    (equipmentList || [])
      .map(item => item?.toString().trim().replace(/\s+/g, ' '))
      .filter(Boolean)
  ));
  const allowedSet = new Set<string>();
  cleaned.forEach(item => {
    const normalized = normalizeEquipmentValue(item);
    if (normalized) allowedSet.add(normalized);
  });
  allowedSet.add('bodyweight');
  allowedSet.add('no equipment');
  if (allowedSet.has('no equipment (bodyweight only)')) {
    allowedSet.add('bodyweight');
  }
  return { cleaned, allowedSet };
};

// Deterministic fallback plan used when the AI response is empty or non-JSON.
const buildFallbackPlan = (userData: UserData, answers: Record<string, any>): WorkoutPlan => {
  const start = answers.startDate || new Date().toISOString().split('T')[0];
  const startDate = new Date(start);
  const pattern: Array<'strength' | 'cardio' | 'flexibility' | 'rest' | 'mixed'> = [
    'strength',
    'cardio',
    'strength',
    'flexibility',
    'mixed',
    'cardio',
    'rest'
  ];
  const dailyWorkouts = pattern.map((type, idx) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + idx);
    const dateStr = d.toISOString().split('T')[0];
    const baseWorkout = {
      name: type === 'rest' ? 'Rest Day' : type === 'cardio' ? 'Intervals' : 'Bodyweight Circuit',
      description: type === 'rest'
        ? 'Recovery and light movement.'
        : 'A simple session you can do anywhere.',
      difficulty: 'beginner' as 'beginner',
      duration: type === 'rest' ? '0 min' : '30 minutes',
      reps: type === 'rest' ? '' : '3 rounds',
      muscleGroups: type === 'cardio' ? ['cardio'] : ['full body'],
      equipment: []
    };
    return {
      date: dateStr,
      type,
      completed: false,
      totalTime: type === 'rest' ? '0 minutes' : '30 minutes',
      workouts: [baseWorkout],
      alternativeWorkouts: []
    };
  });

  return {
    id: `fallback-plan-${Date.now()}`,
    name: `${userData.username || userData.name || 'Your'} Plan`,
    description: 'Starter plan fallback',
    startDate: startDate.toISOString().split('T')[0],
    endDate: new Date(startDate.getTime() + (dailyWorkouts.length - 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    totalDays: dailyWorkouts.length,
    weeklyStructure: pattern.map(t => `${t[0].toUpperCase()}${t.slice(1)} Day`),
    dailyWorkouts
  };
};

export const generateWorkoutPlan = async (
  userData: UserData,
  answers: Record<string, any>,
  questionsList: { id: string; title: string; subtitle: string; type: string; options?: string[] }[]
): Promise<WorkoutPlan> => {
  // build initial prompt
  const today = new Date().toISOString().split('T')[0];
  const preferredStart = answers.startDate || today;
  // JSON schema for full WorkoutPlan (workout items must include duration, reps, and muscleGroups)
  const planSchema = `{
    "type": "object",
    "properties": {
      "id": { "type": "string" },
      "name": { "type": "string" },
      "description": { "type": "string" },
      "startDate": { "type": "string", "pattern": "\\d{4}-\\d{2}-\\d{2}" },
      "endDate": { "type": "string", "pattern": "\\d{4}-\\d{2}-\\d{2}" },
      "totalDays": { "type": "number" },
      "totalTime": { "type": "string" },
      "weeklyStructure": { "type": "array", "items": { "type": "string" } },
      "dailyWorkouts": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "date": { "type": "string", "pattern": "\\d{4}-\\d{2}-\\d{2}" },
            "type": { "type": "string" },
            "completed": { "type": "boolean" },
            "totalTime": { "type": "string" },
            "workouts": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "name": { "type": "string" },
                  "difficulty": { "type": "string" },
                  "duration": { "type": "string" },
                  "reps": { "anyOf": [{ "type": "number" }, { "type": "string" }] },
                  "muscleGroups": { "type": "array", "items": { "type": "string" } },
                  "equipment": { "type": "array", "items": { "type": "string" } },
                  "description": { "type": "string" },
                  "sets": { "type": "number" },
                  "rest": { "type": "string" }
                },
                "required": ["name","difficulty","duration","reps","muscleGroups"]
              }
            },
            "alternativeWorkouts": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "name": { "type": "string" },
                  "difficulty": { "type": "string" },
                  "duration": { "type": "string" },
                  "reps": { "anyOf": [{ "type": "number" }, { "type": "string" }] },
                  "muscleGroups": { "type": "array", "items": { "type": "string" } },
                  "equipment": { "type": "array", "items": { "type": "string" } },
                  "description": { "type": "string" }
                },
                "required": ["name","difficulty","duration","reps","muscleGroups"]
              }
            }
          },
          "required": ["date","type","workouts","alternativeWorkouts"]
        }
      }
    },
    "required": ["id","name","description","startDate","endDate","totalDays","totalTime","weeklyStructure","dailyWorkouts"]
  }`;
  const questionsContext = JSON.stringify(
    questionsList.map(q => ({ id: q.id, title: q.title, subtitle: q.subtitle, type: q.type, options: q.options || [] })),
    null,
    2
  );
  const equipmentContext = buildEquipmentContext(userData.equipment || []);
  const equipmentInstructionsText = equipmentContext.cleaned.length
    ? `Equipment from Question 17: ${equipmentContext.cleaned.join(', ')}. Only use these items when specifying required equipment inside workouts (bodyweight is always allowed). Do NOT introduce or require any other equipment.`
    : 'Question 17 indicates no equipment is available, so generate bodyweight-only workouts and do not reference other equipment.';
  const answersContext = JSON.stringify(answers, null, 2);
  const instructions = `Please strictly adhere to the following JSON schema without adding any extra text, markdown, or code fences. Ensure all required fields are present and match the specified types. For the 'type' field in dailyWorkouts, use only one of the following values: 'strength', 'cardio', 'flexibility', 'rest', or 'mixed'.`;
  const fullPrompt = `${instructions}

${equipmentInstructionsText}

Schema:
${planSchema}

User Data:
${JSON.stringify(userData, null, 2)}

Questions Context:
${questionsContext}

Answers Context:
${answersContext}

The current date is ${today}. The plan MUST start on ${preferredStart}.

Follow the provided weeklyStructure order as given by the schema.


  In dailyWorkouts, items must include keys in this order: date, type, completed, totalTime, workouts, alternativeWorkouts.

  Each workout entry must have ONLY these fields (and in the schema above these are required where noted): name, difficulty, duration, reps, muscleGroups, equipment, description. Additional optional fields allowed are: sets (number) and rest (string).

  Field formats (MUST be human-readable where indicated):
  - duration: a human-readable time string such as "5 minutes", "30 sec", "1 min per side" or "15-20 minutes".
  - reps: either a number (e.g. 10) or a short string like "AMRAP", "to failure", "8-12". If an exercise is time-based, reps can be an empty string or a descriptor.
  - muscleGroups: an array of short strings naming targeted body parts, e.g. ["chest","triceps","quads"]. Use common single-word names; avoid sentences.

  Ensure the JSON is syntactically valid: all arrays, objects, quotes, commas, brackets and braces must be closed. No trailing commas. Do not truncate any lists or objects.

Generate and return the JSON now.`;
  // Send prompt to server endpoint which logs to audit_logs and returns AI text
  const nonce = Math.random().toString(36).slice(2, 9);
  const ts = new Date().toISOString();
  const prompt = `${fullPrompt}\n\nVariation-hint: please vary the workout details. RequestNonce:${nonce} RequestTime:${ts}`;
  const res = await fetch('/api/ai/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt, userId: (userData as any)?.id || null, meta: { nonce, ts } })
  });
  if (!res.ok) throw new Error('AI generation failed');
  const body = await res.json();
  const generatedText = body.text || '';
  if (!generatedText || String(generatedText).trim().length < 2) {
    console.warn('generateWorkoutPlan: empty AI response; using fallback plan');
    return buildFallbackPlan(userData, answers);
  }
  try {
    return parseAIResponse(generatedText, userData);
  } catch (err) {
    console.warn('generateWorkoutPlan: parse failed, falling back to deterministic plan', err);
    return buildFallbackPlan(userData, answers);
  }
};

// Parse AI JSON response into WorkoutPlan
const parseAIResponse = (responseText: string, userData: UserData): WorkoutPlan => {
  console.log('Parsing AI response:', responseText);

  try {
    // Use helper to extract a JSON block from whatever the AI returned
    const extracted = extractJSONBlock(responseText);
    if (!extracted) throw new Error('No JSON block found in AI response');
    let cleanedResponse = extracted;
    console.log('Extracted AI JSON:', cleanedResponse);

    // If the extract returned a larger block, trim to the first object/array
    const jsonBlockMatch = cleanedResponse.match(/[\[{][\s\S]*[\]}]/);
    if (jsonBlockMatch) {
      cleanedResponse = jsonBlockMatch[0];
      console.log('Trimmed to JSON block:', cleanedResponse);
    }
    // Validate if the cleaned response looks like JSON
    if (cleanedResponse.startsWith('{') || cleanedResponse.startsWith('[')) {
      let parsedResponse = JSON.parse(cleanedResponse);
      // If AI returned a wrapper object, unwrap it
      if (parsedResponse.workout_plan) {
        console.warn('parseAIResponse: unwrapping top-level workout_plan field');
        parsedResponse = parsedResponse.workout_plan;
      }
      // Fallback: if top-level 'workouts' is used instead of 'dailyWorkouts'
      if (!parsedResponse.dailyWorkouts && parsedResponse.workouts) {
        console.warn("parseAIResponse: mapping top-level 'workouts' to 'dailyWorkouts'");
        parsedResponse.dailyWorkouts = parsedResponse.workouts;
      }
      // Fallback: if all dailyWorkouts items lack a `date`, compute dates from startDate and weeklyStructure
      if (parsedResponse.dailyWorkouts && parsedResponse.dailyWorkouts.length > 0 && parsedResponse.dailyWorkouts.every((d: any) => !d.date) && parsedResponse.startDate && parsedResponse.weeklyStructure) {
        const startDate = new Date(parsedResponse.startDate);
        // Extract weekday names from weeklyStructure, e.g., "Monday: Strength"
        const weekdays = parsedResponse.weeklyStructure.map((s: string) => s.split(':')[0].trim());
        const weekdayToIndex: Record<string, number> = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
        // Compute first occurrence of each weekday on or after startDate
        const initialDates = weekdays.map((w: string) => {
          const wd = weekdayToIndex[w] ?? new Date(parsedResponse.startDate).getDay();
          const d = new Date(startDate);
          for (let i = 0; i < 7; i++) {
            if (d.getDay() === wd) return new Date(d);
            d.setDate(d.getDate() + 1);
          }
          return new Date(startDate);
        });
        const perWeek = weekdays.length;
        parsedResponse.dailyWorkouts.forEach((d: any, idx: number) => {
          const weekIndex = Math.floor(idx / perWeek);
          const dayIndex = idx % perWeek;
          // Assign computed date string
          const dt = new Date(initialDates[dayIndex]);
          dt.setDate(dt.getDate() + weekIndex * 7);
          d.date = dt.toISOString().split('T')[0];
          // Fallback type from weekday name
          d.type = weekdays[dayIndex].toLowerCase();
        });
        console.warn('parseAIResponse: assigned fallback dates/types from weeklyStructure');
      }

      console.log('Parsed AI response JSON:', parsedResponse);

      if (!parsedResponse.dailyWorkouts) {
        throw new Error('Parsed response missing dailyWorkouts');
      }
      const equipmentContext = buildEquipmentContext(userData.equipment || []);
      const allowedEquipmentSet = equipmentContext.allowedSet;
      const filterEquipmentList = (items: any): string[] => {
        if (!items) return [];
        const entries = Array.isArray(items) ? items : [items];
        const seen = new Set<string>();
        const result: string[] = [];
        for (const entry of entries) {
          const text = String(entry ?? '').trim();
          if (!text) continue;
          const normalized = normalizeEquipmentValue(text);
          if (!normalized || !allowedEquipmentSet.has(normalized)) continue;
          if (seen.has(normalized)) continue;
          seen.add(normalized);
          result.push(text);
        }
        return result;
      };
      const dailyWorkouts = parsedResponse.dailyWorkouts.map((day: any) => ({
        date: day.date,
        totalTime: day.totalTime || '',
        workouts: ((day.workouts ?? day.exercises) || []).map((w: any) => {
          if (typeof w === 'string') {
            return { name: w, description: w, difficulty: 'beginner' as 'beginner', muscleGroups: [], equipment: [], duration: '', reps: '' };
          }
          // choose correct field for name
          const name = w.name ?? w.exercise ?? '';
          const description = w.description ?? w.instructions ?? '';
          const duration = w.duration ?? (w.durationSeconds ? `${w.durationSeconds} sec` : '');
          const sets = w.sets;
          const reps = w.reps ?? '';
          const rest = w.rest ?? '';
          const difficultyValue = w.difficulty || 'beginner';
          const validDifficulty = ['beginner', 'intermediate', 'advanced'].includes(difficultyValue) 
            ? (difficultyValue as 'beginner' | 'intermediate' | 'advanced')
            : 'beginner' as const;
          return {
            name,
            description,
            difficulty: validDifficulty,
            muscleGroups: w.muscleGroups || [],
            equipment: filterEquipmentList(w.equipment),
            duration,
            reps,
            ...(sets !== undefined ? { sets } : {}),
            ...(rest ? { rest } : {})
          };
        }),
        alternativeWorkouts: ((day.alternativeWorkouts ?? day.alternatives) || []).map((w: any) => {
          if (typeof w === 'string') {
            return { name: w, description: w, difficulty: 'beginner' as 'beginner', muscleGroups: [], equipment: [], duration: '', reps: '' };
          }
          const name = w.name ?? w.exercise ?? '';
          const description = w.description ?? w.instructions ?? '';
          const duration = w.duration ?? (w.durationSeconds ? `${w.durationSeconds} sec` : '');
          const sets = w.sets;
          const reps = w.reps ?? '';
          const rest = w.rest ?? '';
          const difficultyValue = w.difficulty || 'beginner';
          const validDifficulty = ['beginner', 'intermediate', 'advanced'].includes(difficultyValue)
            ? (difficultyValue as 'beginner' | 'intermediate' | 'advanced')
            : 'beginner' as const;
          return {
            name,
            description,
            difficulty: validDifficulty,
            muscleGroups: w.muscleGroups || [],
            equipment: filterEquipmentList(w.equipment),
            duration,
            reps,
            ...(sets !== undefined ? { sets } : {}),
            ...(rest ? { rest } : {})
          };
        }),
        completed: day.completed ?? false,
        type: day.type || 'mixed'
      }));

      console.log('Mapped daily workouts:', dailyWorkouts);

      return {
        id: parsedResponse.id || `plan-${Date.now()}`,
  name: parsedResponse.name || `${(userData.username || 'User')}'s Fitness Plan`,
        description: parsedResponse.description || 'A personalized workout plan.',
        startDate: parsedResponse.startDate || new Date().toISOString().split('T')[0],
        endDate: parsedResponse.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        totalDays: parsedResponse.totalDays || 30,
        weeklyStructure: parsedResponse.weeklyStructure || [],
        dailyWorkouts
      };
    } else {
      throw new Error('Response is not in JSON format');
    }
  } catch (error) {
    console.error('Error parsing AI response:', error);
    console.error('Raw AI response:', responseText);

    // No fallback plan; propagate the error
    throw error;
  }
};

/**
 * Generate a single day's workout via Gemini AI, given full user context.
 */
export const generateWorkoutForDay = async (
  userData: UserData,
  answers: Record<string, any>,
  questionsList: any[],
  targetDate: string,
  workoutType: string,
  existingWorkouts: any[],
  currentDayWorkouts: any[]
): Promise<any> => {
  // build initial prompt
  const today = new Date().toISOString().split('T')[0];
  const preferredStart = answers.startDate || today;
  // JSON schema for a single DayWorkout
  const daySchema = `{
    "type": "object",
    "properties": {
      "date": { "type": "string", "pattern": "\\d{4}-\\d{2}-\\d{2}" },
      "type": { "type": "string" },
      "totalTime": { "type": "string" },
      "workouts": { "type": "array", "items": { "type": "object" } },
      "alternativeWorkouts": { "type": "array", "items": { "type": "object" } }
    },
    "required": ["date","type","workouts","alternativeWorkouts"]
  }`;
  const userContext = JSON.stringify(userData, null, 2);
  const questionsContext = JSON.stringify(questionsList.map((q: any) => ({ id: q.id, title: q.title, type: q.type, options: q.options || [] })), null, 2);
  const answersContext = JSON.stringify(answers, null, 2);
  const existingContext = JSON.stringify(existingWorkouts, null, 2);
  const currentContext = JSON.stringify(currentDayWorkouts, null, 2);
  const equipmentContextDay = buildEquipmentContext(userData.equipment || []);
  const equipmentNoteDay = equipmentContextDay.cleaned.length
    ? `Equipment from Question 17: ${equipmentContextDay.cleaned.join(', ')}. Only include these items when specifying required equipment for the workouts (bodyweight is always allowed) and avoid mentioning other equipment.`
    : 'Question 17 indicates no equipment; keep this day strictly bodyweight and do not reference equipment.';
  const basePrompt = `Here is the JSON schema for a DayWorkout:
${daySchema}

Preferred start date: ${preferredStart}
User data:
${userContext}

${equipmentNoteDay}

User questionnaire schema and answers:
${questionsContext}
${answersContext}

Existing plan workouts:
${existingContext}
Current day old workout:
${currentContext}

Current date: ${today}
Generate one DayWorkout JSON for ${targetDate}, type '${workoutType}', compatible with others. No wrappers, no markdown, pure JSON.`;
  const schemaReminderDay = '\nIMPORTANT: return only the pure JSON object matching the DayWorkout schema, no markdown or code fences.';

  const fallbackDay = () => ({
    date: targetDate,
    type: (workoutType || 'mixed'),
    completed: false,
    totalTime: '30 minutes',
    workouts: [{
      name: workoutType === 'cardio' ? 'Tempo Walk' : workoutType === 'rest' ? 'Rest Day' : 'Bodyweight Circuit',
      description: workoutType === 'rest'
        ? 'Take a breather to recover.'
        : 'A quick, equipment-free session to keep you moving.',
      difficulty: 'beginner' as 'beginner',
      duration: workoutType === 'rest' ? '0 min' : '30 minutes',
      reps: workoutType === 'rest' ? '' : '3 rounds',
      muscleGroups: workoutType === 'cardio' ? ['cardio'] : ['full body'],
      equipment: []
    }],
    alternativeWorkouts: []
  });
  // attempt fetch+parse up to 2 times
  for (let attempt = 1; attempt <= 2; attempt++) {
    // add nonce/ts to per-day prompt to avoid identical outputs
    const nonceDay = Math.random().toString(36).slice(2, 9);
    const tsDay = new Date().toISOString();
    const promptBase = `${basePrompt}\n\nVariation-hint: please vary the workout details and ordering where possible. RequestNonce:${nonceDay} RequestTime:${tsDay}`;
    const prompt = attempt === 1 ? promptBase : promptBase + schemaReminderDay;
    console.log(`generateWorkoutForDay: attempt ${attempt}, nonce=${nonceDay}, promptStart=`, prompt.slice(0, 300));
    // Short-circuit long waits with a client-side timeout
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutMs = attempt === 1 ? 12000 : 8000;
    const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    let data: any = null;
    try {
      const response = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        ...(controller ? { signal: controller.signal } : {})
      });
      data = await response.json();
      // Log raw provider response to help debug empty-text issues
      try { console.log('generateWorkoutForDay: raw AI response (post-fetch):', data); } catch (e) { /* ignore */ }
    } catch (err) {
      if ((err as any)?.name === 'AbortError') {
        console.warn(`generateWorkoutForDay: attempt ${attempt} timed out after ${timeoutMs}ms`);
      } else {
        console.warn(`generateWorkoutForDay: attempt ${attempt} failed`, err);
      }
      if (timeoutId) clearTimeout(timeoutId);
      if (attempt === 2) {
        console.warn('generateWorkoutForDay: using fallback day due to errors/timeouts');
        return fallbackDay();
      }
      continue;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
    // Accept several possible response shapes from local server or Gemini
    let generatedText = '';
    try {
      if (typeof data?.text === 'string' && data.text.trim()) generatedText = data.text;
      else if (typeof data?.message === 'string' && data.message.trim()) generatedText = data.message;
      else if (data?.candidates && data.candidates[0]?.content?.parts?.[0]?.text) generatedText = data.candidates[0].content.parts[0].text;
      else if (typeof data?.generated_text === 'string' && data.generated_text.trim()) generatedText = data.generated_text;
      else if (typeof data === 'string' && data.trim()) generatedText = data;
    } catch (e) {
      console.warn('generateWorkoutForDay: unexpected AI response shape', e, data);
    }
    console.log('generateWorkoutForDay: received AI text=', generatedText);
    try {
      // Extract potential JSON block robustly
      const extracted = extractJSONBlock(generatedText);
      let cleaned = extracted?.trim() ?? '';
      // If we still don't have content, try to find a {...} or [...] block
      if ((!cleaned || cleaned.length < 2) && generatedText) {
        const jsonMatch = generatedText.match(/[\[{][\s\S]*[\]}]/);
        if (jsonMatch) cleaned = jsonMatch[0];
      }
      if (!cleaned || cleaned.length < 2) throw new Error('Empty AI response');
      console.log('generateWorkoutForDay: parsing cleaned=', cleaned.slice(0, 2000));
      return JSON.parse(cleaned);
    } catch (e: any) {
      console.warn(`generateWorkoutForDay: parse failed on attempt ${attempt}:`, e);
      if (attempt === 2) {
        console.warn('generateWorkoutForDay: using fallback day due to parse errors');
        return fallbackDay();
      }
    }
  }
  return fallbackDay();
}

// Adding a proper TypeScript type for userData
export interface UserData {
  name?: string;
  username?: string;
  age: number;
  fitnessLevel: string;
  fitnessBackground?: string;
  motivation?: string;
  goals: string[];
  specificGoals?: string;
  timeAvailable: number;
  exerciseFormat?: string;
  planDuration?: string;
  daysPerWeek?: string;
  preferredTime?: string;
  energyLevels?: number;
  preferences?: string[];
  dislikes?: string;
  injuries?: string;
  equipment: string[];
  budget?: string;
  lifestyle?: string;
  sleepQuality?: number;
  stressLevel?: number;
  socialPreference?: string;
  progressTracking?: string[];
  concerns?: string;
}

// Generic function to request AI response (e.g., follow-up questions)
export async function getAIResponse(payload: any): Promise<any> {
  console.log('Requesting AI response with prompt:', payload.prompt);
  const response = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: payload.prompt }] }] })
  });
  const data = await response.json();
  console.log('Raw AI response:', data);
  // Accept several possible server/provider response shapes.
  const candidate = data.candidates?.[0];
  const providerText = typeof data?.text === 'string' ? data.text : undefined;
  const candidateText = candidate?.content?.parts?.[0]?.text;
  const generated_text = (data as any)?.generated_text;
  let rawText: string = '';
  if (typeof providerText === 'string' && providerText.trim()) rawText = providerText;
  else if (typeof candidateText === 'string' && candidateText.trim()) rawText = candidateText;
  else if (typeof generated_text === 'string' && generated_text.trim()) rawText = generated_text;
  else if (typeof data === 'string') rawText = data;

  console.log('Raw AI text extracted for parsing (trim 2000):', String(rawText).slice(0, 2000));

  // Robust extraction of JSON payloads: prefer fenced ```json``` blocks, then
  // any {...} or [...] top-level block. Fall back to the whole rawText.
  let cleaned = '';
  try {
    const fenceMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenceMatch && fenceMatch[1]) cleaned = fenceMatch[1].trim();
    if (!cleaned) {
      // try to find a JSON array or object block
      const arrayMatch = rawText.match(/\[[\s\S]*\]/);
      const objMatch = rawText.match(/\{[\s\S]*\}/);
      if (arrayMatch) cleaned = arrayMatch[0];
      else if (objMatch) cleaned = objMatch[0];
    }
    if (!cleaned) cleaned = rawText.trim();
  } catch (e) {
    cleaned = rawText.trim();
  }

  console.log('Cleaned AI JSON or text (trim 2000):', String(cleaned).slice(0, 2000));

  // Try to parse as JSON; if it fails, return the cleaned text as a fallback
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.warn('AI response is not valid JSON; returning cleaned text instead.', e);
    return cleaned;
  }
}

/**
 * getAITextResponse
 * A wrapper that always returns plain text from the AI. This is intended
 * for the chat UI so it never throws when AI returns non-JSON. Other callers
 * should continue to use getAIResponse for structured JSON responses.
 */
export async function getAITextResponse(payload: { prompt: string; workoutPlan?: any; localStorageContext?: { questionnaire?: any; userData?: any; workoutPlan?: any } }): Promise<{ text: string; raw: string }> {
  // Append truncated localStorage context (if provided) so the chat AI has accurate context.
  const parts: string[] = [payload.prompt];
  const ctx = payload.localStorageContext;
  if (ctx) {
    if (ctx.questionnaire) parts.push(`\n\nLocal: fitbuddyai_questionnaire_progress: ${JSON.stringify(ctx.questionnaire).slice(0,1200)}`);
    if (ctx.userData) parts.push(`\n\nLocal: fitbuddyai_user_data: ${JSON.stringify(ctx.userData).slice(0,1200)}`);
    if (ctx.workoutPlan) parts.push(`\n\nLocal: fitbuddyai_workout_plan: ${JSON.stringify(ctx.workoutPlan).slice(0,2000)}`);
  } else if (payload.workoutPlan) {
    // Backwards-compatible: support single workoutPlan param
    parts.push(`\n\nUser workoutPlan (truncated): ${JSON.stringify(payload.workoutPlan).slice(0,2000)}`);
  }
  const promptWithContext = parts.join('\n');
  console.log('Requesting AI text response with prompt (trim):', promptWithContext.slice(0, 300));
  const response = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: promptWithContext }] }] })
  });
  let data: any = null;
  try {
    data = await response.json();
  } catch (e) {
    console.warn('getAITextResponse: failed to parse JSON response', e);
  }
  if (!response.ok) {
    const diagnostic = data?.diagnostic;
    const missingKey = diagnostic?.env_GEMINI_API_KEY_present === false || /AI provider not configured/i.test(data?.message || '');
    const fallbackMessage = missingKey
      ? 'AI Coach needs GEMINI_API_KEY configured on the server. Set GEMINI_API_KEY (or enable LOCAL_AI_MOCK=1 for local dev) and restart before trying again.'
      : (data && (data.message || data.error)
        ? (data.message || data.error)
        : `AI request failed (${response.status})`);
    const rawError = String(data?.message || data?.error || `HTTP ${response.status}`);
    return { text: fallbackMessage, raw: rawError };
  }
  const candidate = data.candidates?.[0];
  // Accept several possible server response shapes:
  // - { text: '...' } (our local server)
  // - Gemini REST shape with candidates -> content -> parts -> text
  // - other providers may use generated_text or similar fields
  let rawText: string = '';
  if (typeof data?.text === 'string' && data.text.trim()) {
    rawText = data.text;
  } else if (typeof data?.message === 'string' && data.message.trim()) {
    // Handle server error payloads that are still 200 OK
    rawText = data.message;
  } else if (candidate && candidate.content && Array.isArray(candidate.content.parts) && candidate.content.parts[0] && typeof candidate.content.parts[0].text === 'string') {
    rawText = candidate.content.parts[0].text;
  } else if (typeof data?.generated_text === 'string') {
    rawText = data.generated_text;
  } else if (typeof data === 'string') {
    rawText = data;
  } else {
    rawText = '';
  }
  // Strip code fences if present for display, but also return raw
  const fenceMatch = rawText.match(/```(?:json)?\n([\s\S]*?)```/);
  const cleaned = fenceMatch && fenceMatch[1] ? fenceMatch[1].trim() : rawText.trim();
  // Avoid returning an empty string so the UI can show a helpful fallback
  const fallback = data?.message || 'Buddy is currently unavailable. Please try again later.';
  return { text: cleaned || fallback, raw: rawText || fallback };
}
