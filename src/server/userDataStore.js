// server/userDataStore.js
// Express router for saving and loading user questionnaire progress and workout plan
import fs from 'fs';
import path from 'path';
import express from 'express';

const router = express.Router();
const DATA_DIR = path.join(process.cwd(), 'server', 'user_data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Helper to get file path for a user
function getUserFilePath(userId) {
  return path.join(DATA_DIR, `${userId}.json`);
}

// Save user data (questionnaire progress and workout plan)

router.post('/api/userdata/save', (req, res) => {
  const { userId, fitbuddy_questionnaire_progress, fitbuddy_workout_plan, fitbuddy_assessment_data } = req.body;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });
  const filePath = getUserFilePath(userId);

  // If the POST contains only userId (no keys to save), treat it as a fetch/restore request and return stored payload
  const hasKeysToSave = (fitbuddy_questionnaire_progress !== undefined) || (fitbuddy_workout_plan !== undefined) || (fitbuddy_assessment_data !== undefined);
  if (!hasKeysToSave) {
    if (!fs.existsSync(filePath)) {
      return res.json({ fitbuddy_questionnaire_progress: null, fitbuddy_workout_plan: null, fitbuddy_assessment_data: null });
    }
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(content);
      return res.json({ stored: data });
    } catch (e) {
      return res.status(500).json({ error: 'Failed to read stored user data' });
    }
  }

  // Otherwise, perform save/update
  const data = {
    fitbuddy_questionnaire_progress: fitbuddy_questionnaire_progress || null,
    fitbuddy_workout_plan: fitbuddy_workout_plan || null,
    fitbuddy_assessment_data: fitbuddy_assessment_data || null,
    updated: new Date().toISOString()
  };
  fs.writeFile(filePath, JSON.stringify(data, null, 2), err => {
    if (err) return res.status(500).json({ error: 'Failed to save user data' });
    res.json({ success: true });
  });
});

// Load user data
// Deprecated: use POST /api/userdata/save with { userId } to fetch stored payload
router.get('/api/userdata/:userId', (req, res) => {
  const { userId } = req.params;
  console.warn('[userDataStore] Deprecated GET /api/userdata/:userId called for', userId, '- use POST /api/userdata/save instead');
  res.status(410).json({ error: 'This endpoint is deprecated. Please POST to /api/userdata/save with { userId } to retrieve stored data.' });
});

export default router;
