// userDataStore.js
// Secure user data storage for FitBuddyAI (Node.js server-side)
// Uses AES encryption for user data at rest

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_FILE = path.join(__dirname, 'users.enc.json');
const ENCRYPTION_KEY = process.env.FITBUDDYAI_USERDATA_KEY || 'fitbuddyai_default_key_32bytes!'; // 32 bytes for AES-256
const IV_LENGTH = 16;

function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift(), 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

function saveUsers(users) {
  const json = JSON.stringify(users, null, 2);
  const encrypted = encrypt(json);
  fs.writeFileSync(DATA_FILE, encrypted, 'utf8');
}

function loadUsers() {
  if (!fs.existsSync(DATA_FILE)) return [];
  const encrypted = fs.readFileSync(DATA_FILE, 'utf8');
  try {
    const decrypted = decrypt(encrypted);
    return JSON.parse(decrypted);
  } catch (e) {
    return [];
  }
}

module.exports = {
  saveUsers,
  loadUsers,
};
