import fs from 'fs';
import path from 'path';

function usage() {
  console.log('Usage: node src/server/restorePlan.js <userId>');
  process.exit(1);
}

const userId = process.argv[2];
if (!userId) usage();

const usersFile = path.join(process.cwd(), 'src', 'server', 'users.json');
if (!fs.existsSync(usersFile)) {
  console.error('users.json not found at expected location:', usersFile);
  process.exit(2);
}

const backup = usersFile + '.' + Date.now() + '.bak';
try {
  fs.copyFileSync(usersFile, backup);
  console.log('Backup created at', backup);
} catch (e) {
  console.error('Failed to create backup:', e);
  process.exit(3);
}

let data;
try {
  data = JSON.parse(fs.readFileSync(usersFile, 'utf-8'));
} catch (e) {
  console.error('Failed to parse users.json:', e);
  process.exit(4);
}

const user = data.find(u => u.id === userId || u.email === userId || u.username === userId);
if (!user) {
  console.error('User not found (tried id, email, username):', userId);
  process.exit(5);
}

if (!Array.isArray(user.workoutPlanHistory) || user.workoutPlanHistory.length === 0) {
  console.error('No workoutPlanHistory available to restore from for user:', userId);
  process.exit(6);
}

const last = user.workoutPlanHistory.pop();
user.workoutPlan = last.plan;

try {
  fs.writeFileSync(usersFile, JSON.stringify(data, null, 2));
  console.log('Restored workoutPlan for user', user.id, 'from history timestamp', last.timestamp);
  console.log('Wrote updated users.json (backup at', backup + ')');
  process.exit(0);
} catch (e) {
  console.error('Failed to write users.json:', e);
  process.exit(7);
}
