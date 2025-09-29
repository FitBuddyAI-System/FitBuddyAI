#!/usr/bin/env node
const fs = require('fs');

function main() {
  const depRaw = fs.readFileSync('deployments.json', 'utf8');
  const obj = JSON.parse(depRaw || '{}');
  const items = Array.isArray(obj.deployments) ? obj.deployments : (Array.isArray(obj) ? obj : []);
  const candidates = items.filter(d => {
    try {
      const isPreview = d && (d.target === 'preview' || d.type === 'preview');
      const meta = d.meta || {};
      const branch = meta.githubCommitRef || meta.githubBranch || meta.branch || '';
      const matchesBranch = branch === 'development' || (d && d.meta && (d.meta['githubCommitRef'] === 'development' || d.meta['githubBranch'] === 'development'));
      return isPreview && matchesBranch;
    } catch (e) { return false; }
  });
  if (!candidates.length) {
    console.log('No matching preview deployments found for branch development.');
    process.exit(0);
  }
  candidates.sort((a, b) => { const ta = a.created || a.createdAt || a.created_at || 0; const tb = b.created || b.createdAt || b.created_at || 0; return tb - ta; });
  const dep = candidates[0];
  const url = dep && dep.url ? (String(dep.url).startsWith('http') ? dep.url : 'https://' + dep.url) : null;
  if (!url) {
    console.log('No URL found on selected deployment.');
    process.exit(0);
  }
  console.log('Selected deployment URL:', url);

  const badgeJson = {
    message: 'preview',
    color: dep && dep.state === 'READY' ? 'brightgreen' : (dep && dep.state === 'ERROR' ? 'red' : 'orange'),
    url: url
  };

  fs.mkdirSync('.github', { recursive: true });
  fs.writeFileSync('.github/vercel-preview-badge.json', JSON.stringify(badgeJson, null, 2), 'utf8');
  fs.mkdirSync('public', { recursive: true });
  fs.writeFileSync('public/vercel-preview-badge.json', JSON.stringify(badgeJson, null, 2), 'utf8');
  console.log('Wrote .github/vercel-preview-badge.json and public/vercel-preview-badge.json');
  // Note: this script no longer edits README.md. To change the preview target manually,
  // edit `public/vercel-preview-badge.json` (url field) or update the markdown link in README.md.
}

main();
