#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const usersFile = path.join(__dirname, 'users.json');

// Avoid accidental local file mutation when Supabase is configured for this project.
if (process.env.SUPABASE_URL) {
  console.error('[sanitizeUsers] Supabase is configured. Local users.json mutation is disabled to prevent data divergence.');
  console.error('Use the migration scripts in /scripts to migrate local data into Supabase before running sanitizers.');
  process.exit(2);
}

function sanitize() {
  try {
    const raw = fs.readFileSync(usersFile, 'utf-8');
    const users = JSON.parse(raw);
    let changed = 0;
    for (const u of users) {
      if (u && u.workoutPlan && Array.isArray(u.workoutPlan.dailyWorkouts)) {
        const before = u.workoutPlan.dailyWorkouts.length;
        // remove falsy entries
        let cleaned = u.workoutPlan.dailyWorkouts.filter(Boolean);
        // dedupe by date (keep last occurrence)
        const seen = new Map();
        for (const d of cleaned) {
          if (d && d.date) seen.set(d.date, d);
        }
        const deduped = Array.from(seen.values()).sort((a,b) => String(a.date).localeCompare(String(b.date)));
        u.workoutPlan.dailyWorkouts = deduped;
        const after = u.workoutPlan.dailyWorkouts.length;
        if (after !== before) changed++;
      }
    }
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
    console.log('Sanitize complete. Users updated:', changed);
  } catch (err) {
    console.error('Sanitize failed:', err);
    process.exit(1);
  }
}

sanitize();
