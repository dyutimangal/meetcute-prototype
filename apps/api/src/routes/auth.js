const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { createUser } = require('../lib/userService');
const {
  createSession,
  getSessionId,
  getSessionUser,
  deleteSession,
  setSessionCookie,
  clearSessionCookie,
} = require('../lib/session');

const sanitizeUser = (user) => ({
  username: user.username,
  email: user.email,
});

router.post('/login', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim().toLowerCase();
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!username || !email) {
      return res.status(400).json({ error: 'username and email required' });
    }
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ error: 'account not found' });
    if (!user.email || user.email !== email) {
      return res.status(401).json({ error: 'email does not match this username' });
    }
    const sessionId = createSession(sanitizeUser(user));
    setSessionCookie(res, sessionId);
    return res.json(sanitizeUser(user));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { user, status } = await createUser({
      username: req.body.username,
      email: req.body.email,
    });
    const sessionId = createSession(sanitizeUser(user));
    setSessionCookie(res, sessionId);
    return res.status(status).json(sanitizeUser(user));
  } catch (err) {
    if (err && err.code === 11000) {
      if (err.keyValue && err.keyValue.username) return res.status(409).json({ error: 'username already exists' });
      if (err.keyValue && err.keyValue.email) return res.status(409).json({ error: 'email already exists' });
      return res.status(409).json({ error: 'duplicate key' });
    }
    const status = err && err.status ? err.status : 500;
    return res.status(status).json({ error: err.message });
  }
});

router.get('/me', (req, res) => {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  return res.json(user);
});

router.post('/logout', (req, res) => {
  const sessionId = getSessionId(req);
  if (sessionId) deleteSession(sessionId);
  clearSessionCookie(res);
  return res.status(204).end();
});

module.exports = router;
