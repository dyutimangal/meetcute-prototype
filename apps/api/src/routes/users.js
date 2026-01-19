const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { DEFAULT_PROMPTS } = require('../lib/defaultPrompts');
const { createUser } = require('../lib/userService');
const { requireAuth } = require('../lib/session');

const withDefaultPrompts = (user) => {
  if (!user) return user;
  user.prompts = Object.assign({}, DEFAULT_PROMPTS, user.prompts || {});
  return user;
};

router.use((req, res, next) => {
  if (req.method === 'POST' && req.path === '/') return next();
  return requireAuth(req, res, next);
});

// GET /api/users — list with optional filtering
// query params:
//  - exclude=username
//  - minAge, maxAge
//  - intention (comma-separated list)
//  - interestedIn (comma-separated list)
router.get('/', async (req, res) => {
  try {
    const { minAge, maxAge, intention, interestedIn } = req.query;
    const query = {};
    const authUsername = req.authUser ? String(req.authUser.username).trim().toLowerCase() : null;
    if (authUsername) query.username = { $ne: authUsername };

    // age filtering — include users without an age set (they match any range)
    if (minAge || maxAge) {
      const ageQuery = { $or: [{ age: { $exists: false } }, { age: null }] };
      if (minAge || maxAge) {
        const ageRange = {};
        if (minAge) ageRange.$gte = Number(minAge);
        if (maxAge) ageRange.$lte = Number(maxAge);
        ageQuery.$or.push({ age: ageRange });
      }
      query.$or = ageQuery.$or;
    }

    if (intention) {
      const arr = String(intention).split(',').map(s => s.trim()).filter(Boolean);
      if (arr.length > 0) query.intention = { $in: arr };
    }

    if (interestedIn) {
      const arr = String(interestedIn).split(',').map(s => s.trim()).filter(Boolean);
      if (arr.length > 0) query.interestedIn = { $in: arr };
    }

    // use .lean() so we can inject generated avatar values without saving to DB here
    const users = await User.find(query).limit(200).lean();
    // Get the requesting user (from exclude param) to compute match status
    const requestingUser = authUsername
      ? await User.findOne({ username: authUsername }).lean()
      : null;
    const enriched = users.map(u => {
      const needsPrompts = !u.prompts || Object.keys(u.prompts).length === 0;
      if (!u.avatar && u.username) {
        const initial = (u.username && u.username[0]) ? u.username[0].toUpperCase() : '?';
        const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128'><rect width='100%' height='100%' rx='20' fill='%2318273a'/><text x='50%' y='50%' dy='0.35em' text-anchor='middle' fill='%23ffd1b8' font-family='Arial,Helvetica,sans-serif' font-size='54'>${initial}</text></svg>`;
        u.avatar = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
      }
      withDefaultPrompts(u);
      if (needsPrompts && u._id) {
        User.updateOne({ _id: u._id }, { $set: { prompts: u.prompts } }).catch(() => {});
      }
      // compute match status: orange if liked by requesting user, pink if mutual match
      if (requestingUser) {
        const iLikedThem = requestingUser.likedUsers && requestingUser.likedUsers.includes(u.username);
        const theyLikedMe = u.likedUsers && u.likedUsers.includes(authUsername);
        u.likedByYou = !!iLikedThem;
        u.likedYou = !!theyLikedMe;
        if (iLikedThem && theyLikedMe) {
          u.matchStatus = 'matched'; // pink
        } else if (iLikedThem) {
          u.matchStatus = 'liked'; // orange
        } else {
          u.matchStatus = 'default'; // blue
        }
      } else {
        u.matchStatus = 'default';
      }
      return u;
    });
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users — create (username-only signup)
router.post('/', async (req, res) => {
  // keep username visible to catch block (avoid ReferenceError)
  let username = undefined;
  try {
    username = req.body.username;
    const { email } = req.body;
    const { user, status } = await createUser({ username, email });
    withDefaultPrompts(user);
    res.status(status).json(user);
  } catch (err) {
    // duplicate key (username already exists)
    if (err && err.code === 11000) {
      // duplicate key from MongoDB - detect which field triggered the conflict
      console.warn('POST /api/users - duplicate key error for:', username, err.keyValue || err.message);
      if (err.keyValue && err.keyValue.username) return res.status(409).json({ error: 'username already exists' });
      if (err.keyValue && err.keyValue.email) return res.status(409).json({ error: 'email already exists' });
      return res.status(409).json({ error: 'duplicate key' });
    }
    const status = err && err.status ? err.status : 500;
    res.status(status).json({ error: err.message });
  }
});

// GET /api/users/:username — fetch a user by username
router.get('/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const normalized = String(username).trim().toLowerCase();
    let user = await User.findOne({ username: normalized }).lean();
    if (!user) return res.status(404).json({ error: 'not found' });
    const needsPrompts = !user.prompts || Object.keys(user.prompts).length === 0;
    if (!user.avatar && user.username) {
      const initial = (user.username && user.username[0]) ? user.username[0].toUpperCase() : '?';
      const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128'><rect width='100%' height='100%' rx='20' fill='%2318273a'/><text x='50%' y='50%' dy='0.35em' text-anchor='middle' fill='%23ffd1b8' font-family='Arial,Helvetica,sans-serif' font-size='54'>${initial}</text></svg>`;
      user.avatar = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
    }
    withDefaultPrompts(user);
    if (needsPrompts && user._id) {
      User.updateOne({ _id: user._id }, { $set: { prompts: user.prompts } }).catch(() => {});
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/:username — update profile/preferences
router.put('/:username', async (req, res) => {
  try {
    // username is immutable — reject attempts to change it in the request body
    if (typeof req.body.username !== 'undefined') return res.status(400).json({ error: 'username is immutable and cannot be changed' });
    let { username } = req.params;
    username = String(username).trim().toLowerCase();
    if (req.authUser && req.authUser.username !== username) {
      return res.status(403).json({ error: 'forbidden' });
    }
    const payload = {};

    // Accept only the allowed fields and sanitize types
    if (req.body.intention) payload.intention = Array.isArray(req.body.intention) ? req.body.intention : String(req.body.intention).split(',').map(s => s.trim()).filter(Boolean);
    if (req.body.interestedIn) payload.interestedIn = Array.isArray(req.body.interestedIn) ? req.body.interestedIn : String(req.body.interestedIn).split(',').map(s => s.trim()).filter(Boolean);
    if (typeof req.body.age !== 'undefined') payload.age = Number(req.body.age) || undefined;
    if (typeof req.body.gender !== 'undefined') {
      const g = String(req.body.gender || '').trim();
      const allowed = ['male', 'female', 'non-binary'];
      if (g === '') {
        // explicit empty -> remove gender by not including it
      } else if (allowed.includes(g)) {
        payload.gender = g;
      } else {
        return res.status(400).json({ error: 'invalid gender' });
      }
    }
    if (typeof req.body.avatar !== 'undefined') {
      const avatar = String(req.body.avatar || '').trim();
      payload.avatar = avatar === '' ? null : avatar;
    }
    if (req.body.preferredAgeRange) {
      const r = req.body.preferredAgeRange;
      const min = Number(r.min);
      const max = Number(r.max);
      if (!Number.isNaN(min) && !Number.isNaN(max)) payload.preferredAgeRange = { min, max };
    }
    if (req.body.prompts && typeof req.body.prompts === 'object') {
      const incoming = req.body.prompts;
      const sanitized = {};
      Object.keys(DEFAULT_PROMPTS).forEach(key => {
        if (Object.prototype.hasOwnProperty.call(incoming, key)) {
          sanitized[key] = String(incoming[key] || '').trim();
        }
      });
      payload.prompts = Object.assign({}, DEFAULT_PROMPTS, sanitized);
    }

    if (Object.keys(payload).length === 0) return res.status(400).json({ error: 'no updatable fields provided' });

    const updated = await User.findOneAndUpdate({ username }, { $set: payload }, { new: true });
    if (!updated) return res.status(404).json({ error: 'not found' });
    res.json(updated);
  } catch (err) {
    if (err && err.code === 11000) return res.status(409).json({ error: 'duplicate value' });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users/:username/like — record that the requesting user likes the target user
router.post('/:username/like', async (req, res) => {
  try {
    const { username } = req.params;
    const normalized = String(username).trim().toLowerCase();
    const normalizedLiker = req.authUser ? String(req.authUser.username).trim().toLowerCase() : '';
    if (!normalizedLiker) return res.status(401).json({ error: 'unauthorized' });

    // add liker to target's interestedUsers and target to liker's likedUsers
    const [updatedTarget, updatedLiker] = await Promise.all([
      User.findOneAndUpdate(
        { username: normalized },
        { $addToSet: { interestedUsers: normalizedLiker } },
        { new: true }
      ),
      User.findOneAndUpdate(
        { username: normalizedLiker },
        { $addToSet: { likedUsers: normalized } },
        { new: true }
      )
    ]);

    if (!updatedTarget) return res.status(404).json({ error: 'user not found' });
    if (!updatedLiker) return res.status(404).json({ error: 'liker not found' });

    // Check if this creates a mutual match and update matchedUsers if so
    if (updatedTarget.likedUsers && updatedTarget.likedUsers.includes(normalizedLiker)) {
      await Promise.all([
        User.findOneAndUpdate(
          { username: normalized },
          { $addToSet: { matchedUsers: normalizedLiker } }
        ),
        User.findOneAndUpdate(
          { username: normalizedLiker },
          { $addToSet: { matchedUsers: normalized } }
        )
      ]);
    }

    res.json({ success: true, interestedUsers: updatedTarget.interestedUsers, likedUsers: updatedLiker.likedUsers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
