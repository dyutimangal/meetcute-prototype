const crypto = require('crypto');

const SESSION_COOKIE = 'meetcute_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const sessions = new Map();

const parseCookies = (cookieHeader = '') => {
  return cookieHeader.split(';').reduce((acc, pair) => {
    const trimmed = pair.trim();
    if (!trimmed) return acc;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) return acc;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!key) return acc;
    acc[key] = decodeURIComponent(value);
    return acc;
  }, {});
};

const createSession = (user) => {
  const id = crypto.randomBytes(24).toString('hex');
  sessions.set(id, { user, createdAt: Date.now() });
  return id;
};

const getSession = (id) => {
  if (!id) return null;
  const session = sessions.get(id);
  if (!session) return null;
  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    sessions.delete(id);
    return null;
  }
  return session;
};

const getSessionId = (req) => {
  const cookies = parseCookies(req.headers.cookie || '');
  return cookies[SESSION_COOKIE] || null;
};

const getSessionUser = (req) => {
  const sessionId = getSessionId(req);
  const session = getSession(sessionId);
  return session ? session.user : null;
};

const deleteSession = (sessionId) => {
  if (sessionId) sessions.delete(sessionId);
};

const setSessionCookie = (res, sessionId) => {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  res.append('Set-Cookie', `${SESSION_COOKIE}=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`);
};

const clearSessionCookie = (res) => {
  res.append('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
};

const requireAuth = (req, res, next) => {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  req.authUser = user;
  return next();
};

module.exports = {
  SESSION_COOKIE,
  createSession,
  getSessionId,
  getSessionUser,
  deleteSession,
  setSessionCookie,
  clearSessionCookie,
  requireAuth,
};
