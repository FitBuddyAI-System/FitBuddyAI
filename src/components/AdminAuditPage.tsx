import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import NotFoundPage from './NotFoundPage';
import './AdminAuditPage.css';

const AdminPage: React.FC = () => {
  // client-side admin guard: check local storage and JWT payload for admin role
  const [isAllowed, setIsAllowed] = useState<boolean | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem('fitbuddy_user_data');
      const parsed = raw ? JSON.parse(raw) : null;

      // Allow local admin user ONLY on localhost/127.0.0.1
      const email = parsed?.email || parsed?.data?.email;
      const isLocalhost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
      if (isLocalhost && email === "admin@local") {
        setIsAllowed(true);
        return;
      }

      const role = parsed?.role || parsed?.data?.role;
      if (role && String(role).toLowerCase() === 'admin') {
        setIsAllowed(true);
        return;
      }

      const token = parsed?.data?.token ?? parsed?.token ?? null;
      if (token) {
        try {
          const parts = token.split('.');
          if (parts.length >= 2) {
            const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
            const roles = payload?.roles || payload?.role || [];
            if (Array.isArray(roles) && roles.includes('admin')) { setIsAllowed(true); return; }
            if (String(roles).toLowerCase() === 'admin') { setIsAllowed(true); return; }
          }
        } catch {}
      }
      setIsAllowed(false);
    } catch {
      setIsAllowed(false);
    }
  }, []);

  const [logs, setLogs] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRestore, setShowRestore] = useState(false);
  const [showBanned, setShowBanned] = useState(false);
  const [deletedPlans, setDeletedPlans] = useState<any[]>([]);
  const [restoringPlanId, setRestoringPlanId] = useState<string | null>(null);
  const [bannedUsernames, setBannedUsernames] = useState<string[]>([]);
  const [newBannedUsername, setNewBannedUsername] = useState('');

  // Helper: call server API with Authorization header set from Supabase client session
  const apiFetch = async (input: RequestInfo, init?: RequestInit) => {
    const opts: RequestInit = init ? { ...init } : {};
    const headers: any = opts.headers ? { ...(opts.headers as any) } : {};
    try {
      // Try supabase client session first
      if (supabase && typeof supabase.auth?.getSession === 'function') {
        const result = await supabase.auth.getSession();
        const token = result?.data?.session?.access_token ?? null;
        if (token) headers['Authorization'] = `Bearer ${token}`;
      }
    } catch (e) {
      // ignore
    }
    // fallback: local storage token used by older flows
    if (!headers['Authorization']) {
      try {
        const raw = localStorage.getItem('fitbuddy_user_data');
        const parsed = raw ? JSON.parse(raw) : null;
        const token = parsed?.data?.token ?? parsed?.token ?? null;
        if (token) headers['Authorization'] = `Bearer ${token}`;
      } catch {}
    }
    opts.headers = headers;
    return fetch(input, opts);
  };

  // Don't early-return here; render decision will happen after hooks to avoid hooks-order mismatch

  useEffect(() => {
    // Only fetch restore plans when the panel is requested and the user is allowed
    if (showRestore && isAllowed === true) {
      (async () => {
        setLoading(true);
        const { data, error } = await supabase.from('workout_plans').select('*').eq('deleted', true);
        if (!error) setDeletedPlans(data || []);
        setLoading(false);
      })();
    }
  }, [showRestore, isAllowed]);

  useEffect(() => {
    if (showBanned && isAllowed === true) {
      (async () => {
        setLoading(true);
        const { data, error } = await supabase.from('banned_usernames').select('username');
        if (!error) setBannedUsernames((data || []).map((d: any) => d.username));
        setLoading(false);
      })();
    }
  }, [showBanned, isAllowed]);

  useEffect(() => {
    // Only fetch admin payloads when we've decided the user is allowed
    if (isAllowed !== true) return;
    const fetchAll = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch users via server admin endpoint which uses the service role key
        const usersRes = await apiFetch('/api/admin/users', { method: 'GET' });
        if (!usersRes.ok) {
          const txt = await usersRes.text();
          throw new Error(`Failed to load users: ${usersRes.status} ${txt}`);
        }
        const usersJson = await usersRes.json();
        setUsers(usersJson?.users || []);

        const { data: logsData, error: logsError } = await supabase.from('audit_logs').select('*').order('timestamp', { ascending: false });
        if (logsError) {
          if (String(logsError.message).toLowerCase().includes('relation') || String(logsError.message).toLowerCase().includes('could not find')) {
            setError("Audit log table not found. Run the DB setup SQL (sql/setup_db.sql) to create required tables.");
          } else throw logsError;
        }
        setLogs(logsData || []);
      } catch (err: any) {
        setError(err.message || 'Error');
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [isAllowed]);

  const handleRestorePlan = async (planId: string) => {
    setRestoringPlanId(planId);
  const res = await apiFetch(`/api/admin/users?action=restore_plan`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ planId }) });
    if (res.ok) setDeletedPlans(plans => plans.filter(p => p.id !== planId));
    else setError('Failed to restore');
    setRestoringPlanId(null);
  };

  const handleBanUsername = async () => {
    if (!newBannedUsername.trim()) return;
    setLoading(true);
  const res = await apiFetch(`/api/admin/users?action=ban_username`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: newBannedUsername.trim() }) });
    if (res.ok) setBannedUsernames(list => [...list, newBannedUsername.trim()]);
    else setError('Failed to ban username');
    setNewBannedUsername('');
    setLoading(false);
  };

  const handleUnbanUsername = async (username: string) => {
    setLoading(true);
  const res = await apiFetch(`/api/admin/users?action=unban_username`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username }) });
    if (res.ok) setBannedUsernames(list => list.filter(u => u !== username));
    else setError('Failed to unban username');
    setLoading(false);
  };

  const handleBanUser = async (userId: string) => {
    setLoading(true);
  const res = await apiFetch(`/api/admin/users?action=ban`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) });
    if (res.ok) setUsers(users => users.map(u => u.id === userId ? { ...u, banned: true } : u));
    else setError('Failed to ban user');
    setLoading(false);
  };

  const handleUnbanUser = async (userId: string) => {
    setLoading(true);
  const res = await apiFetch(`/api/admin/users?action=unban`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) });
    if (res.ok) setUsers(users => users.map(u => u.id === userId ? { ...u, banned: false } : u));
    else setError('Failed to unban user');
    setLoading(false);
  };

  const handleDeleteUser = async (userId: string) => {
    setLoading(true);
  const res = await apiFetch(`/api/admin/users?action=delete`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) });
    if (res.ok) setUsers(users => users.filter(u => u.id !== userId));
    else setError('Failed to delete user');
    setLoading(false);
  };

  const download = () => {
    const blob = new Blob([logs.map(l => JSON.stringify(l)).join('\n')], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ai_action_audit.log';
    a.click();
    URL.revokeObjectURL(url);
  };

  // If we know the user is explicitly not allowed, render 404 here (after hooks)
  if (isAllowed === false) return <NotFoundPage />;

  return (
    <div className="admin-audit-root">
      <div className="admin-hero">
        <div>
          <div className="title">Admin Console</div>
          <div className="subtitle">Manage users, audit logs and site-wide policies.</div>
        </div>
      </div>

      <div className="admin-grid">
        <div className="admin-card">
          <div className="admin-section-title">Admin Powers</div>
          <div className="admin-powers">
            <button className="admin-power-btn" onClick={download} disabled={logs.length === 0}>Download Audit Log</button>
            <button className="admin-power-btn" onClick={() => setShowRestore(true)}>Restore Workout Plans</button>
            <button className="admin-power-btn" onClick={() => setShowBanned(true)}>Manage Banned Usernames</button>
            <div className="admin-power-row">
              <button className="admin-power-btn secondary" onClick={() => window.location.href = '/'}>Open App</button>
            </div>
            <div className="admin-power-note">Tip: actions are proxied through the server to protect secrets and follow RLS.</div>
          </div>
        </div>

        <div>
          <div className="admin-card mb-20">
            <div className="admin-section-title">Users</div>
            {users.length === 0 && <div className="muted">No users found.</div>}
            <div className="users-list">
              {users.map((u: any) => (
                <div key={u.id} className={`user-row${u.banned ? ' banned' : ''}`.trim()}>
                  <div className="user-meta">
                    <div className="user-name">{u.username || u.email}</div>
                    <div className="user-email">{u.email}</div>
                    <div className="meta-id">{u.id}</div>
                  </div>
                  <div className="user-actions">
                    {u.banned ? (
                      <button className="small-btn ghost" onClick={() => handleUnbanUser(u.id)} disabled={loading}>Unban</button>
                    ) : (
                      <button className="small-btn ghost" onClick={() => handleBanUser(u.id)} disabled={loading}>Ban</button>
                    )}
                    <button className="small-btn negative" onClick={() => handleDeleteUser(u.id)} disabled={loading}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="admin-card">
            <div className="admin-section-title">AI Action Audit Log</div>
            {loading && <div className="muted">Loading...</div>}
            {error && <div className="error">{error}</div>}
            <div className="audit-list">
              {logs.map((l, i) => (
                <div key={i} className="audit-row">
                  <div className="audit-ts">{l.timestamp}</div>
                  {l.event === 'rickroll' ? (
                    <div className="audit-rickroll">
                      <div>Event: rickroll</div>
                      <div>IP: {l.ip || '—'}</div>
                      <div>Verified: {String(l.verified)}</div>
                      <div>UserAgent: <pre className="audit-json-small">{String(l.userAgent || '')}</pre></div>
                    </div>
                  ) : (
                    <pre className="audit-json">{JSON.stringify(l.action, null, 2)}</pre>
                  )}
                </div>
              ))}
              {logs.length === 0 && !loading && <div className="muted">No audit entries found.</div>}
            </div>
          </div>
        </div>
      </div>

      {/* Restore Workout Plans Modal */}
      {showRestore && (
        <div className="admin-modal-overlay">
          <div className="admin-modal">
            <h3>Restore Workout Plans</h3>
            {loading && <div>Loading...</div>}
            <div>
              {deletedPlans.map(plan => (
                <div key={plan.id} className="admin-modal-list-item">
                  <div>
                    <b>{plan.name}</b>
                    <div className="meta-id">{plan.id}</div>
                  </div>
                  <div>
                    <button className="small-btn" onClick={() => handleRestorePlan(plan.id)} disabled={restoringPlanId===plan.id}>{restoringPlanId===plan.id ? 'Restoring...' : 'Restore'}</button>
                  </div>
                </div>
              ))}
              {deletedPlans.length === 0 && !loading && <div>No deleted plans found.</div>}
            </div>
            <div className="modal-footer">
              <button className="small-btn ghost" onClick={() => setShowRestore(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Banned Usernames Modal */}
      {showBanned && (
        <div className="admin-modal-overlay">
          <div className="admin-modal">
            <h3>Manage Banned Usernames</h3>
            {loading && <div>Loading...</div>}
            <div>
              {bannedUsernames.map(username => (
                <div key={username} className="admin-modal-list-item">
                  <div>{username}</div>
                  <div>
                    <button className="small-btn ghost" onClick={() => handleUnbanUsername(username)} disabled={loading}>Unban</button>
                  </div>
                </div>
              ))}
              {bannedUsernames.length === 0 && !loading && <div>No banned usernames.</div>}
            </div>
            <div className="admin-modal-input-row">
              <input type="text" value={newBannedUsername} onChange={e => setNewBannedUsername(e.target.value)} placeholder="Ban new username..." className="admin-modal-input" />
              <button className="small-btn warn" onClick={handleBanUsername} disabled={loading || !newBannedUsername.trim()}>Ban</button>
            </div>
            <div className="modal-footer">
              <button className="small-btn ghost" onClick={() => setShowBanned(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminPage;

