// Removed incorrect import of UserData from '../App'. Use the local UserData interface below.
import { WorkoutPlan } from '../types';

// API endpoint and key for Gemini via REST call
const GEMINI_API_KEY = 'AIzaSyCdu8joW4s3FN2ybROS9f0Vj26fsmNGSlQ'; // Hardcoded API key per request
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

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
  const answersContext = JSON.stringify(answers, null, 2);
  const instructions = `Please strictly adhere to the following JSON schema without adding any extra text, markdown, or code fences. Ensure all required fields are present and match the specified types. For the 'type' field in dailyWorkouts, use only one of the following values: 'strength', 'cardio', 'flexibility', 'rest', or 'mixed'.`;
  const fullPrompt = `${instructions}

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
  return parseAIResponse(generatedText, userData);
};

// Parse AI JSON response into WorkoutPlan
const parseAIResponse = (responseText: string, userData: UserData): WorkoutPlan => {
  console.log('Parsing AI response:', responseText);

  try {
    // Extract JSON between ``` or ```json fences
    let cleanedResponse = responseText;
    const codeFenceMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (codeFenceMatch && codeFenceMatch[1]) {
      cleanedResponse = codeFenceMatch[1].trim();
    } else {
      // Fallback: strip any backticks markers
      cleanedResponse = responseText.replace(/```[a-zA-Z]*\n?|```/g, '').trim();
    }
    console.log('Extracted AI JSON:', cleanedResponse);

    // Ensure we only keep the JSON object by finding the first '{' and last '}'
    const jsonBlockMatch = cleanedResponse.match(/{[\s\S]*}/);
    if (jsonBlockMatch) {
      cleanedResponse = jsonBlockMatch[0];
      console.log('Trimmed to JSON block:', cleanedResponse);
    }
    // Validate if the cleaned response is JSON
    if (cleanedResponse.startsWith('{') && cleanedResponse.endsWith('}')) {
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
      const dailyWorkouts = parsedResponse.dailyWorkouts.map((day: any) => ({
        date: day.date,
        totalTime: day.totalTime || '',
        workouts: ((day.workouts ?? day.exercises) || []).map((w: any) => {
          if (typeof w === 'string') {
            return { name: w, description: w, difficulty: 'beginner', muscleGroups: [], equipment: [], duration: '', reps: '' };
          }
        // choose correct field for name
        const name = w.name ?? w.exercise ?? '';
        const description = w.description ?? w.instructions ?? '';
        const duration = w.duration ?? (w.durationSeconds ? `${w.durationSeconds} sec` : '');
        const sets = w.sets;
        const reps = w.reps ?? '';
        const rest = w.rest ?? '';
          return {
            name,
            description,
            difficulty: w.difficulty || 'beginner',
            muscleGroups: w.muscleGroups || [],
            equipment: w.equipment || [],
            duration,
            reps,
            ...(sets !== undefined ? { sets } : {}),
            ...(rest ? { rest } : {})
          };
        }),
        alternativeWorkouts: ((day.alternativeWorkouts ?? day.alternativeExercises) || []).map((w: any) => {
          if (typeof w === 'string') {
            return { name: w, description: w, difficulty: 'beginner', muscleGroups: [], equipment: [], duration: '', reps: '' };
          }
        const altName = w.name ?? w.exercise ?? '';
        const altDescription = w.description ?? w.instructions ?? '';
        const altDuration = w.duration ?? (w.durationSeconds ? `${w.durationSeconds} sec` : '');
        const altSets = w.sets;
        const altReps = w.reps ?? '';
        const altRest = w.rest ?? '';
          return {
            name: altName,
            description: altDescription,
            difficulty: w.difficulty || 'beginner',
            muscleGroups: w.muscleGroups || [],
            equipment: w.equipment || [],
            duration: altDuration,
            reps: altReps,
            ...(altSets !== undefined ? { sets: altSets } : {}),
            ...(altRest ? { rest: altRest } : {})
          };
        }),
        completed: false,
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
  const basePrompt = `Here is the JSON schema for a DayWorkout:
${daySchema}

Preferred start date: ${preferredStart}
User data:
${userContext}

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

  let lastErrorDay: Error | null = null;
  // attempt fetch+parse up to 2 times
  for (let attempt = 1; attempt <= 2; attempt++) {
    // add nonce/ts to per-day prompt to avoid identical outputs
    const nonceDay = Math.random().toString(36).slice(2, 9);
    const tsDay = new Date().toISOString();
    const promptBase = `${basePrompt}\n\nVariation-hint: please vary the workout details and ordering where possible. RequestNonce:${nonceDay} RequestTime:${tsDay}`;
    const prompt = attempt === 1 ? promptBase : promptBase + schemaReminderDay;
    console.log(`generateWorkoutForDay: attempt ${attempt}, nonce=${nonceDay}, promptStart=`, prompt.slice(0, 300));
    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    const data = await response.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('generateWorkoutForDay: received AI text=', generatedText);
    try {
      // reuse cleaning/parsing logic
      const codeFenceMatch = generatedText.match(/```(?:json)?\s*([\s\S]*?)```/i);
      let cleaned = codeFenceMatch?.[1]?.trim() ?? generatedText.replace(/```[a-zA-Z]*\\n?|```/g, '').trim();
      const jsonMatch = cleaned.match(/{[\s\S]*}/);
      if (jsonMatch) cleaned = jsonMatch[0];
      console.log('generateWorkoutForDay: parsing cleaned=', cleaned);
      return JSON.parse(cleaned);
    } catch (e: any) {
      console.warn(`generateWorkoutForDay: parse failed on attempt ${attempt}:`, e);
      lastErrorDay = e;
      if (attempt === 2) throw lastErrorDay;
    }
  }
  throw new Error('generateWorkoutForDay: unknown error');
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
  // Log the content.parts[0].text to inspect the exact text block
  const candidate = data.candidates?.[0];
  console.log('Candidate content:', candidate?.content);
  console.log('Candidate content.parts:', candidate?.content?.parts);
  console.log('Candidate content.parts[0].text:', candidate?.content?.parts?.[0]?.text);
  // Extract generated text from candidates
  const rawText: string = candidate?.content?.parts?.[0]?.text || '';
  // Attempt to extract JSON between code fences
  let cleaned = rawText;
  const match = rawText.match(/```(?:json)?\n([\s\S]*?)```/);
  if (match && match[1]) {
    cleaned = match[1].trim();
  }
  console.log('Cleaned AI JSON or text:', cleaned);
  // Try to parse as JSON; if it fails, return the cleaned text as a fallback
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.warn('AI response is not valid JSON, returning raw text instead.');
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
    if (ctx.questionnaire) parts.push(`\n\nLocal: fitbuddy_questionnaire_progress: ${JSON.stringify(ctx.questionnaire).slice(0,1200)}`);
    if (ctx.userData) parts.push(`\n\nLocal: fitbuddy_user_data: ${JSON.stringify(ctx.userData).slice(0,1200)}`);
    if (ctx.workoutPlan) parts.push(`\n\nLocal: fitbuddy_workout_plan: ${JSON.stringify(ctx.workoutPlan).slice(0,2000)}`);
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
  const data = await response.json();
  const candidate = data.candidates?.[0];
  const rawText: string = candidate?.content?.parts?.[0]?.text || '';
  // Strip code fences if present for display, but also return raw
  const fenceMatch = rawText.match(/```(?:json)?\n([\s\S]*?)```/);
  const cleaned = fenceMatch && fenceMatch[1] ? fenceMatch[1].trim() : rawText.trim();
  return { text: cleaned, raw: rawText };
}
