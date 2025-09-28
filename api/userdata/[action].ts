// Import the built JS module explicitly so ESM resolution on the deployment (Vercel) finds the compiled file.
import handler from './index.js';

export default async function actionHandler(req: any, res: any) {
  // Single dynamic route to handle /api/userdata/save, /api/userdata/load, /api/userdata/admin, etc.
  // Forward to the consolidated handler which contains the logic for save/admin/get.
  try {
    return await handler(req, res);
  } catch (err: any) {
    console.error('[api/userdata/[action]] forward error', err);
    return res.status(500).json({ error: err?.message || 'Forwarding failed' });
  }
}
