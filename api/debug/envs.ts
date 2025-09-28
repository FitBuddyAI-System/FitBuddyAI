export default function handler(req: any, res: any) {
  const isProd = process.env.NODE_ENV === 'production';
  const adminToken = process.env.ADMIN_API_TOKEN;
  const provided = String(req.headers.authorization || req.headers.Authorization || '').replace(/^Bearer\s*/i, '');

  if (isProd && (!adminToken || provided !== adminToken)) {
    return res.status(403).json({ ok: false, message: 'Forbidden' });
  }

  // Return only presence and masked length of sensitive envs
  const vars = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_KEY',
    'GEMINI_API_KEY',
    'ADMIN_API_TOKEN',
  ];

  const out: Record<string, any> = {};
  vars.forEach((v) => {
    const val = process.env[v];
    out[v] = {
      present: !!val,
      length: val ? String(val).length : 0,
      sample: val ? `${String(val).slice(0,4)}...${String(val).slice(-4)}` : null,
    };
  });

  // Do not expose actual keys. This endpoint is intended for quick sanity checks only.
  return res.status(200).json({ ok: true, envs: out });
}
