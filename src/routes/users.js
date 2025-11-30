const express = require('express');
const router = express.Router();
const User = require('../models/User');

// GET /api/users — list with optional filtering
// query params:
//  - exclude=username
//  - minAge, maxAge
//  - intention (comma-separated list)
//  - interestedIn (comma-separated list)
router.get('/', async (req, res) => {
  try {
    const { exclude, minAge, maxAge, intention, interestedIn } = req.query;
    const query = {};
    if (exclude) query.username = { $ne: String(exclude).trim().toLowerCase() };

    // age filtering
    if (minAge || maxAge) {
      query.age = {};
      if (minAge) query.age.$gte = Number(minAge);
      if (maxAge) query.age.$lte = Number(maxAge);
    }

    if (intention) {
      const arr = String(intention).split(',').map(s => s.trim()).filter(Boolean);
      if (arr.length) query.intention = { $in: arr };
    }

    if (interestedIn) {
      const arr = String(interestedIn).split(',').map(s => s.trim()).filter(Boolean);
      if (arr.length) query.interestedIn = { $in: arr };
    }

    const users = await User.find(query).limit(200);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users — create (username-only signup)
router.post('/', async (req, res) => {
  // keep username visible to catch block (avoid ReferenceError)
  let username = undefined;
  try {
    let { email } = req.body;
    // require email for signup to disambiguate users
    if (!email) return res.status(400).json({ error: 'email required' });
    // basic email validation
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailValid) return res.status(400).json({ error: 'invalid email' });
    username = req.body.username;
    if (!username) return res.status(400).json({ error: 'username required' });

    // simple validation: usernames should be alphanumeric + dashes/underscores, 2-32 chars
    const valid = /^[a-zA-Z0-9_-]{2,32}$/.test(username);
    if (!valid) return res.status(400).json({ error: 'invalid username (allowed: letters, numbers, - or _ , 2-32 chars)' });

    // Attempt to create the user directly. Rely on MongoDB unique index to prevent duplicates.
    // This avoids the race condition between a separate existence check and insert.
    // check if username already exists — if it does, check the email
    // normalize for case-insensitive comparison
    const normalizedUsername = String(username).trim().toLowerCase();
    email = String(email).trim().toLowerCase();

    const existing = await User.findOne({ username: normalizedUsername });
    if (existing) {
      // If the existing record has the same email -> user already signed up
      if (existing.email && existing.email === email) {
        console.log('POST /api/users - username+email match — returning existing user:', username);
        return res.status(200).json(existing);
      }

      // username exists but email differs -> username taken
      console.log('POST /api/users - username exists with different email:', username);
      return res.status(409).json({ error: 'username already exists with another email' });
    }

    console.log('POST /api/users - creating username:', normalizedUsername);
    // ensure email isn't already used by another username
    const emailOwner = await User.findOne({ email });
    if (emailOwner) {
      return res.status(409).json({ error: 'email already exists with another account' });
    }

    const createPayload = { username: normalizedUsername };
    // only attach email if explicitly provided (avoid inserting null which can trip unique indexes)
    createPayload.email = email;
    const user = new User(createPayload);
    await user.save();
    res.status(201).json(user);
  } catch (err) {
    // duplicate key (username already exists)
    if (err && err.code === 11000) {
      // duplicate key from MongoDB - detect which field triggered the conflict
      console.warn('POST /api/users - duplicate key error for:', username, err.keyValue || err.message);
      if (err.keyValue && err.keyValue.username) return res.status(409).json({ error: 'username already exists' });
      if (err.keyValue && err.keyValue.email) return res.status(409).json({ error: 'email already exists' });
      return res.status(409).json({ error: 'duplicate key' });
    }
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/:username — fetch a user by username
router.get('/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const normalized = String(username).trim().toLowerCase();
    const user = await User.findOne({ username: normalized });
    if (!user) return res.status(404).json({ error: 'not found' });
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
    const payload = {};

    // Accept only the allowed fields and sanitize types
    if (req.body.intention) payload.intention = Array.isArray(req.body.intention) ? req.body.intention : String(req.body.intention).split(',').map(s => s.trim()).filter(Boolean);
    if (req.body.interestedIn) payload.interestedIn = Array.isArray(req.body.interestedIn) ? req.body.interestedIn : String(req.body.interestedIn).split(',').map(s => s.trim()).filter(Boolean);
    if (typeof req.body.age !== 'undefined') payload.age = Number(req.body.age) || undefined;
    if (req.body.preferredAgeRange) {
      const r = req.body.preferredAgeRange;
      const min = Number(r.min);
      const max = Number(r.max);
      if (!Number.isNaN(min) && !Number.isNaN(max)) payload.preferredAgeRange = { min, max };
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

module.exports = router;
