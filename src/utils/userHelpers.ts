export function ensureUserId<T extends Record<string, any> | null | undefined>(user: T): T {
  if (!user || typeof user !== 'object') return user;
  if ('id' in user && user.id) return user;
  const fallbackId = user.user_id || user.userId || user.uid || user.sub;
  if (!fallbackId) return user;
  return { ...user, id: fallbackId };
}
