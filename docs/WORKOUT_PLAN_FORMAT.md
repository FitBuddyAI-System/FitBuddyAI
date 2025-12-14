# Workout Plan JSON Format

This document describes the JSON schema used by FitBuddyAI for workout plan generation, storage, and consumption by the client and server. It lists the commonly used fields, types, constraints, useful flags (like `isRickroll`), and provides an example of a complete plan.

---

## Top-level shape

A plan is typically an object with metadata plus an array of daily entries.

- `id` (string) — unique identifier for the plan.
- `name` (string) — human-friendly plan name.
- `description` (string, optional) — short description or notes about the plan.
- `startDate` (string, YYYY-MM-DD) — first date covered by the plan.
- `endDate` (string, YYYY-MM-DD, optional) — last date covered by the plan.
- `totalDays` (number, optional) — total number of days included in the plan.
- `totalTime` (string, optional) — human-friendly total time estimate, e.g. "45 minutes/day".
- `dailyWorkouts` (array of DayWorkout) — an ordered list of daily entries. Each entry is applied to a specific date.

Storage wrapper (persisted form): the app sometimes stores a wrapper object with metadata:

```
{
  "data": { ...plan object above... },
  "timestamp": 1690000000000
}
```

When reading/writing locally, you may see the wrapper or the raw plan. The localStorage key commonly used is `fitbuddyai_workout_plan`.

---

## DayWorkout (dailyWorkouts items)

Each element in `dailyWorkouts` represents what the user should do (or rest) on a given date.

Common fields:

- `date` (string, YYYY-MM-DD) — required. The date this entry applies to.
- `type` (string) — common values: `Workout`, `Rest`, `ActiveRecovery`, `Challenge`, etc.
- `completed` (boolean) — whether the user has marked the day as complete.
- `totalTime` (string) — human readable (e.g., `30 minutes`) for the day's plan.
- `workouts` (array of Workout) — list of planned workouts for the day. Can be empty for rest days.
- `alternativeWorkouts` (array of Workout, optional) — fallback choices for the user.
- `notes` (string, optional) — coach notes or special instructions.
- `tags` (array of string, optional) — arbitrary tags like `cardio`, `legs`, `home`.
- `isRickroll` (boolean, optional) — special flag used by the app to render a playful "rickroll" rest-day UI; treated as a rest-day marker.
- `intensity` (string or number, optional) — `low`/`medium`/`high` or numeric scale.
- `custom` (object, optional) — free-form object for extensions (e.g., generated AI metadata, prompts, IDs).

### Workout item (in `workouts` or `alternativeWorkouts`)

Each workout object may contain subset of these fields:

- `name` (string) — workout name.
- `description` (string) — instructions, steps, or summary.
- `difficulty` (string) — `beginner`, `intermediate`, `advanced`.
- `duration` (string or number) — human readable `20 min` or numeric minutes `20`.
- `reps` (string or number, optional) — reps description for strength moves.
- `sets` (number, optional)
- `rest` (string, optional) — rest instructions (`60s`, `30s between sets`).
- `equipment` (array of strings, optional) — `['dumbbell', 'bodyweight']`.
- `muscleGroups` (array of strings, optional) — `['legs','core']`.
- `link` or `video` (string, optional) — URL for demo or embedded media (YouTube, MP4, etc.).
- `embed` (object, optional) — structured embed info (e.g., `{ type: 'youtube', id: 'abc123' }`).
- `metadata` (object, optional) — provider-specific fields (e.g., AI prompt, source id).

Notes:
- The app is permissive: many fields are optional to allow partial/AI-generated output.
- Prefer ISO date strings for `date`, not timestamps.

---

## Example plan (pretty JSON)

```json
{
  "id": "example-plan-001",
  "name": "Beginner 7-Day Kickstart",
  "description": "A gentle week to build consistency: three workouts, two active recovery sessions, two rest days.",
  "startDate": "2025-09-01",
  "endDate": "2025-09-07",
  "totalDays": 7,
  "totalTime": "20-30 minutes/day",
  "dailyWorkouts": [
    {
      "date": "2025-09-01",
      "type": "Workout",
      "completed": false,
      "totalTime": "25 minutes",
      "workouts": [
        {
          "name": "Full Body Circuit",
          "description": "3 rounds: 10 squats, 8 push-ups, 12 bent-over rows (use dumbbells). Rest 60s between rounds.",
          "difficulty": "beginner",
          "duration": "25 min",
          "sets": 3,
          "reps": "varies",
          "equipment": ["dumbbell"],
          "muscleGroups": ["legs","upper body","core"]
        }
      ],
      "alternativeWorkouts": []
    },
    {
      "date": "2025-09-02",
      "type": "ActiveRecovery",
      "completed": false,
      "totalTime": "20 minutes",
      "workouts": [
        {
          "name": "Walk + Stretch",
          "description": "20-minute brisk walk followed by 8 minutes of mobility drills.",
          "duration": "20 min",
          "difficulty": "low"
        }
      ]
    },
    {
      "date": "2025-09-03",
      "type": "Rest",
      "completed": false,
      "totalTime": "0 minutes",
      "workouts": [],
      "alternativeWorkouts": []
    },
    {
      "date": "2025-09-04",
      "type": "Workout",
      "completed": false,
      "totalTime": "30 minutes",
      "workouts": [
        {
          "name": "Lower Body Strength",
          "description": "4 sets of 8 goblet squats, 12 lunges, 10 Romanian deadlifts.",
          "difficulty": "intermediate",
          "duration": "30 min",
          "equipment": ["dumbbell"],
          "muscleGroups": ["legs"]
        }
      ]
    },
    {
      "date": "2025-09-05",
      "type": "Workout",
      "completed": false,
      "totalTime": "20 minutes",
      "workouts": [
        {
          "name": "Core + Conditioning",
          "description": "AMRAP 12 minutes: 10 sit-ups, 15 mountain climbers, 20s plank. Cool down 5 min.",
          "duration": "20 min"
        }
      ]
    },
    {
      "date": "2025-09-06",
      "type": "Rest",
      "completed": false,
      "totalTime": "0 minutes",
      "workouts": [],
      "alternativeWorkouts": [],
      "isRickroll": true
    },
    {
      "date": "2025-09-07",
      "type": "Workout",
      "completed": false,
      "totalTime": "30 minutes",
      "workouts": [
        {
          "name": "Mixed Cardio",
          "description": "20 minutes intervals: 2 min hard / 2 min easy. Finish with 8 minutes mobility.",
          "duration": "30 min"
        }
      ]
    }
  ]
}
```

In the example above, `2025-09-06` is a rest day flagged with `"isRickroll": true` — the client uses this flag to show a special UI (see `WorkoutModal.tsx` and `.rickroll-rest` CSS).

---

## Extension points and custom fields

The plan format is intentionally flexible so AI generators or server-side processes can attach metadata.

- `dailyWorkouts[].custom` — object for AI provenance, e.g. `{ prompt: 'create a low-impact rest day', source: 'gemini-v1' }`.
- `workouts[].metadata` — provider-specific info (IDs, sample sets, deep links to exercise libraries).
- `plan-level metadata` — you may add a `meta` or `tags` field on the top-level plan for categorization.

Keep these under an explicit `custom` or `metadata` key to avoid collisions with built-in fields.

---

## Validation recommendations

- Dates should be ISO-format `YYYY-MM-DD` and consistent with `startDate`/`endDate`.
- Use arrays for `workouts` and `alternativeWorkouts` even when empty.
- Keep `totalDays` in sync with the number of entries in `dailyWorkouts` if you use it.
- When persisting locally, wrap with `{ data: <plan>, timestamp: Date.now() }` to allow expiry/verification logic.

If you want, I can also:

- Provide a JSON Schema (draft-07 / 2020-12) for programmatic validation.
- Add a TypeScript `interface` / types definition matching the format.
- Add a small utility script for generating a skeleton plan for a specified date range.

---

Last updated: 2025-12-04
