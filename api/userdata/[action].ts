// Robust forwarder: attempt to import the compiled handler (index.js) first, then fall back to the TypeScript module (index)
export default async function actionHandler(req: any, res: any) {
  try {
    let mod: any = null;
    try {
      // Preferred in deployment output
      mod = await import('./index.js');
    } catch (e) {
      // Fallback to source during local dev or different resolver
      try { mod = await import('./index'); } catch (e2) { mod = null; }
    }
    if (!mod || !mod.default) {
      console.error('[api/userdata/[action]] failed to load handler module (tried index.js and index)');
      return res.status(500).json({ error: 'Handler module not found' });
    }
    const handler = mod.default;
    return await handler(req, res);
  } catch (err: any) {
    console.error('[api/userdata/[action]] forward error', err);
    return res.status(500).json({ error: err?.message || 'Forwarding failed' });
  }
}
