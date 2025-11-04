// ESM-compatible branding replacement script
// Usage:
//   node scripts/replace_branding.js --dry
//   node scripts/replace_branding.js --apply
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const EXCLUDE_DIRS = ['node_modules', '.git', 'dist', 'build', 'out', '.turbo', '.next'];
const TEXT_EXTS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.json', '.md', '.html', '.css', '.scss',
  '.env', '.yml', '.yaml', '.txt', '.svg', '.json5', '.xml', '.csv'
]);

const replacements = [
  { from: /FitBuddy/g, to: 'FitBuddyAI' },
  { from: /fitbuddy/g, to: 'fitbuddyai' },
  { from: /FITBUDDY/g, to: 'FITBUDDYAI' },
];

let changedFiles = [];

async function isTextFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return TEXT_EXTS.has(ext) || ext === '';
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (EXCLUDE_DIRS.includes(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      await walk(full);
    } else if (e.isFile()) {
      if (!await isTextFile(full)) continue;
      await processFile(full);
    }
  }
}

async function processFile(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    let out = data;
    for (const r of replacements) out = out.replace(r.from, r.to);
    if (out !== data) changedFiles.push({ filePath, old: data, new: out });
  } catch (err) {
    // ignore unreadable files
  }
}

async function applyChanges(dry) {
  await walk(ROOT);
  console.log('Matches found:', changedFiles.length);
  for (const c of changedFiles) {
    console.log(c.filePath);
  }
  if (!dry && changedFiles.length) {
    for (const c of changedFiles) {
      await fs.writeFile(c.filePath, c.new, 'utf8');
    }
    console.log('Applied replacements to', changedFiles.length, 'files.');
  } else if (dry) {
    console.log('Dry-run complete. Use --apply to write changes.');
  } else {
    console.log('No changes to apply.');
  }
}

(async () => {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry') || !args.includes('--apply');
  await applyChanges(dry);
})();