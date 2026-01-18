const express = require('express');
const router = express.Router();
const User = require('../models/User');

const PROMPT_PLACEHOLDER = 'I am too lazy for this shit';

const LEGACY_PROMPTS = {
  lookingFor: 'Someone who loves spontaneous adventures and good conversations over coffee.',
  idealWeekend: 'Hiking in the morning, farmers market for lunch, and a movie night at home.',
  superpower: 'I can make anyone laugh and I am great at giving genuine advice to friends.',
  petPeeve: 'People who do not listen actively or are always on their phones during conversations.'
};

const LEGACY_PROMPT_SET = new Set(
  Object.values(LEGACY_PROMPTS)
    .map((value) => value.trim().replace(/\s+/g, ' ').toLowerCase())
);

const DEFAULT_PROMPTS = {
  lookingFor: PROMPT_PLACEHOLDER,
  idealWeekend: PROMPT_PLACEHOLDER,
  superpower: PROMPT_PLACEHOLDER,
  petPeeve: PROMPT_PLACEHOLDER
};

const AGE_MIN = 18;
const AGE_MAX = 99;
const ALLOWED_INTENTIONS = new Set(['dating', 'friendship']);
const ALLOWED_INTERESTED_IN = new Set(['girls', 'guys', 'non-binary']);
const ALLOWED_GENDERS = new Set(['male', 'female', 'non-binary']);

const toUniqueList = (values) => Array.from(new Set(values));

const parseOptionalIntegerInRange = (value, { field, min, max }) => {
  if (value === undefined || value === null || value === '') return { value: undefined };
  const num = Number(value);
  if (!Number.isInteger(num)) return { error: `${field} must be an integer` };
  if (num < min || num > max) return { error: `${field} must be between ${min} and ${max}` };
  return { value: num };
};

const parseNullableIntegerInRange = (value, options) => {
  if (value === undefined) return { value: undefined };
  if (value === null || value === '') return { value: null };
  return parseOptionalIntegerInRange(value, options);
};

const parseNormalizedList = (input, { normalizer, allowed, field }) => {
  const rawValues = Array.isArray(input)
    ? input
    : String(input || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
  const normalized = rawValues.map(normalizer);
  const invalid = normalized.filter(value => !allowed.has(value));
  if (invalid.length > 0) return { error: `invalid ${field}` };
  return { value: toUniqueList(normalized) };
};

const normalizeIntentionValue = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'friends' || normalized === 'friend') return 'friendship';
  return normalized;
};

const normalizeIntentionList = (values) => {
  if (!Array.isArray(values)) return [];
  return toUniqueList(
    values
      .map(normalizeIntentionValue)
      .filter(value => ALLOWED_INTENTIONS.has(value))
  );
};

const normalizePromptValue = (value) => {
  const trimmed = String(value || '').trim();
  if (trimmed === '') return PROMPT_PLACEHOLDER;
  const normalized = trimmed.replace(/\s+/g, ' ').toLowerCase();
  if (LEGACY_PROMPT_SET.has(normalized)) return PROMPT_PLACEHOLDER;
  return trimmed;
};

const normalizePrompts = (prompts) => {
  const next = { ...DEFAULT_PROMPTS };
  Object.keys(DEFAULT_PROMPTS).forEach((key) => {
    if (prompts && Object.prototype.hasOwnProperty.call(prompts, key)) {
      next[key] = normalizePromptValue(prompts[key]);
    }
  });
  return next;
};

const withDefaultPrompts = (user) => {
  if (!user) return user;
  user.prompts = normalizePrompts(user.prompts);
  return user;
};

const normalizeInterestedInValue = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'male') return 'guys';
  if (normalized === 'female') return 'girls';
  if (normalized === 'nonbinary') return 'non-binary';
  return normalized;
};

const normalizeInterestedInList = (values) => {
  if (!Array.isArray(values)) return [];
  return toUniqueList(
    values
      .map(normalizeInterestedInValue)
      .filter(value => ALLOWED_INTERESTED_IN.has(value))
  );
};

const hasOwnField = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

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

    const minAgeParsed = parseOptionalIntegerInRange(minAge, { field: 'minAge', min: AGE_MIN, max: AGE_MAX });
    if (minAgeParsed.error) return res.status(400).json({ error: minAgeParsed.error });
    const maxAgeParsed = parseOptionalIntegerInRange(maxAge, { field: 'maxAge', min: AGE_MIN, max: AGE_MAX });
    if (maxAgeParsed.error) return res.status(400).json({ error: maxAgeParsed.error });
    if (typeof minAgeParsed.value === 'number' && typeof maxAgeParsed.value === 'number' && minAgeParsed.value > maxAgeParsed.value) {
      return res.status(400).json({ error: 'maxAge must be greater than or equal to minAge' });
    }

    // age filtering — include users without an age set (they match any range)
    if (minAgeParsed.value !== undefined || maxAgeParsed.value !== undefined) {
      const ageQuery = { $or: [{ age: { $exists: false } }, { age: null }] };
      const ageRange = {};
      if (typeof minAgeParsed.value === 'number') ageRange.$gte = minAgeParsed.value;
      if (typeof maxAgeParsed.value === 'number') ageRange.$lte = maxAgeParsed.value;
      if (Object.keys(ageRange).length > 0) ageQuery.$or.push({ age: ageRange });
      query.$or = ageQuery.$or;
    }

    if (intention) {
      const parsed = parseNormalizedList(intention, {
        normalizer: normalizeIntentionValue,
        allowed: ALLOWED_INTENTIONS,
        field: 'intention filter'
      });
      if (parsed.error) return res.status(400).json({ error: parsed.error });
      if (parsed.value.length > 0) query.intention = { $in: parsed.value };
    }

    if (interestedIn) {
      const parsed = parseNormalizedList(interestedIn, {
        normalizer: normalizeInterestedInValue,
        allowed: ALLOWED_INTERESTED_IN,
        field: 'interestedIn filter'
      });
      if (parsed.error) return res.status(400).json({ error: parsed.error });
      if (parsed.value.length > 0) query.interestedIn = { $in: parsed.value };
    }

    // use .lean() so we can inject generated avatar values without saving to DB here
    const users = await User.find(query).limit(200).lean();
    // Get the requesting user (from exclude param) to compute match status
    const excludeUsername = exclude ? String(exclude).trim().toLowerCase() : null;
    let requestingUser = null;
    if (excludeUsername) {
      requestingUser = await User.findOne({ username: excludeUsername }).lean();
    }
    const enriched = users.map(u => {
      const originalPrompts = u.prompts ? { ...u.prompts } : {};
      const normalizedIntention = normalizeIntentionList(u.intention || []);
      const normalizedInterestedIn = normalizeInterestedInList(u.interestedIn || []);
      const needsIntentionUpdate = JSON.stringify(normalizedIntention) !== JSON.stringify(u.intention || []);
      const needsInterestedInUpdate = JSON.stringify(normalizedInterestedIn) !== JSON.stringify(u.interestedIn || []);
      if (!u.avatar && u.username) {
        const initial = (u.username && u.username[0]) ? u.username[0].toUpperCase() : '?';
        const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128'><rect width='100%' height='100%' rx='20' fill='%2318273a'/><text x='50%' y='50%' dy='0.35em' text-anchor='middle' fill='%23ffd1b8' font-family='Arial,Helvetica,sans-serif' font-size='54'>${initial}</text></svg>`;
        u.avatar = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
      }
      if (needsIntentionUpdate) {
        u.intention = normalizedIntention;
      }
      if (needsInterestedInUpdate) {
        u.interestedIn = normalizedInterestedIn;
      }
      withDefaultPrompts(u);
      if (u._id && JSON.stringify(originalPrompts) !== JSON.stringify(u.prompts)) {
        User.updateOne({ _id: u._id }, { $set: { prompts: u.prompts } }).catch(() => {});
      }
      if (needsIntentionUpdate && u._id) {
        User.updateOne({ _id: u._id }, { $set: { intention: normalizedIntention } }).catch(() => {});
      }
      if (needsInterestedInUpdate && u._id) {
        User.updateOne({ _id: u._id }, { $set: { interestedIn: normalizedInterestedIn } }).catch(() => {});
      }
      // compute match status: orange if liked by requesting user, pink if mutual match
      if (requestingUser) {
        const iLikedThem = requestingUser.likedUsers && requestingUser.likedUsers.includes(u.username);
        const theyLikedMe = u.likedUsers && u.likedUsers.includes(excludeUsername);
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
    let { email } = req.body;
    const avatar = typeof req.body.avatar === 'string' ? req.body.avatar.trim() : '';
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
        withDefaultPrompts(existing);
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

    const createPayload = { username: normalizedUsername, prompts: DEFAULT_PROMPTS, email };
    if (avatar) createPayload.avatar = avatar;
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
    let user = await User.findOne({ username: normalized }).lean();
    if (!user) return res.status(404).json({ error: 'not found' });
    const originalPrompts = user.prompts ? { ...user.prompts } : {};
    const normalizedIntention = normalizeIntentionList(user.intention || []);
    const normalizedInterestedIn = normalizeInterestedInList(user.interestedIn || []);
    const needsIntentionUpdate = JSON.stringify(normalizedIntention) !== JSON.stringify(user.intention || []);
    const needsInterestedInUpdate = JSON.stringify(normalizedInterestedIn) !== JSON.stringify(user.interestedIn || []);
    if (!user.avatar && user.username) {
      const initial = (user.username && user.username[0]) ? user.username[0].toUpperCase() : '?';
      const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128'><rect width='100%' height='100%' rx='20' fill='%2318273a'/><text x='50%' y='50%' dy='0.35em' text-anchor='middle' fill='%23ffd1b8' font-family='Arial,Helvetica,sans-serif' font-size='54'>${initial}</text></svg>`;
      user.avatar = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
    }
    if (needsIntentionUpdate) {
      user.intention = normalizedIntention;
    }
    if (needsInterestedInUpdate) {
      user.interestedIn = normalizedInterestedIn;
    }
    withDefaultPrompts(user);
    if (user._id && JSON.stringify(originalPrompts) !== JSON.stringify(user.prompts)) {
      User.updateOne({ _id: user._id }, { $set: { prompts: user.prompts } }).catch(() => {});
    }
    if (needsIntentionUpdate && user._id) {
      User.updateOne({ _id: user._id }, { $set: { intention: normalizedIntention } }).catch(() => {});
    }
    if (needsInterestedInUpdate && user._id) {
      User.updateOne({ _id: user._id }, { $set: { interestedIn: normalizedInterestedIn } }).catch(() => {});
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
    const payload = {};

    // Accept only the allowed fields and sanitize types
    if (hasOwnField(req.body, 'intention')) {
      const parsed = parseNormalizedList(req.body.intention, {
        normalizer: normalizeIntentionValue,
        allowed: ALLOWED_INTENTIONS,
        field: 'intention'
      });
      if (parsed.error) return res.status(400).json({ error: parsed.error });
      payload.intention = parsed.value;
    }
    if (hasOwnField(req.body, 'interestedIn')) {
      const parsed = parseNormalizedList(req.body.interestedIn, {
        normalizer: normalizeInterestedInValue,
        allowed: ALLOWED_INTERESTED_IN,
        field: 'interestedIn'
      });
      if (parsed.error) return res.status(400).json({ error: parsed.error });
      payload.interestedIn = parsed.value;
    }
    if (hasOwnField(req.body, 'age')) {
      const parsed = parseNullableIntegerInRange(req.body.age, { field: 'age', min: AGE_MIN, max: AGE_MAX });
      if (parsed.error) return res.status(400).json({ error: parsed.error });
      if (parsed.value === null) {
        payload.age = null;
      } else if (typeof parsed.value === 'number') {
        payload.age = parsed.value;
      }
    }
    if (hasOwnField(req.body, 'gender')) {
      const g = String(req.body.gender || '').trim().toLowerCase();
      if (g === '') {
        // explicit empty -> remove gender by not including it
      } else if (ALLOWED_GENDERS.has(g)) {
        payload.gender = g;
      } else {
        return res.status(400).json({ error: 'invalid gender' });
      }
    }
    if (hasOwnField(req.body, 'avatar')) {
      const avatar = String(req.body.avatar || '').trim();
      payload.avatar = avatar === '' ? null : avatar;
    }
    if (hasOwnField(req.body, 'preferredAgeRange')) {
      const r = req.body.preferredAgeRange || {};
      const minParsed = parseOptionalIntegerInRange(r.min, { field: 'preferredAgeRange.min', min: AGE_MIN, max: AGE_MAX });
      if (minParsed.error) return res.status(400).json({ error: minParsed.error });
      const maxParsed = parseOptionalIntegerInRange(r.max, { field: 'preferredAgeRange.max', min: AGE_MIN, max: AGE_MAX });
      if (maxParsed.error) return res.status(400).json({ error: maxParsed.error });
      if (typeof minParsed.value !== 'number' || typeof maxParsed.value !== 'number') {
        return res.status(400).json({ error: 'preferredAgeRange requires both min and max' });
      }
      if (minParsed.value > maxParsed.value) {
        return res.status(400).json({ error: 'preferredAgeRange.max must be greater than or equal to preferredAgeRange.min' });
      }
      payload.preferredAgeRange = { min: minParsed.value, max: maxParsed.value };
    }
    if (req.body.prompts && typeof req.body.prompts === 'object') {
      const incoming = req.body.prompts;
      const sanitized = {};
      Object.keys(DEFAULT_PROMPTS).forEach(key => {
        if (Object.prototype.hasOwnProperty.call(incoming, key)) {
          const value = String(incoming[key] || '').trim();
          sanitized[key] = value === '' ? PROMPT_PLACEHOLDER : value;
        }
      });
      payload.prompts = Object.assign({}, DEFAULT_PROMPTS, sanitized);
    }

    if (Object.keys(payload).length === 0) return res.status(400).json({ error: 'no updatable fields provided' });

    const updated = await User.findOneAndUpdate(
      { username },
      { $set: payload },
      { new: true, runValidators: true, context: 'query' }
    );
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
    const likerUsername = req.body.likerUsername; // passed from frontend
    const normalizedLiker = String(likerUsername || '').trim().toLowerCase();
    const action = String(req.body.action || 'like').trim().toLowerCase();

    if (!normalizedLiker) return res.status(400).json({ error: 'likerUsername required' });

    if (action === 'unlike') {
      const [updatedTarget, updatedLiker] = await Promise.all([
        User.findOneAndUpdate(
          { username: normalized },
          { $pull: { interestedUsers: normalizedLiker, matchedUsers: normalizedLiker } },
          { new: true }
        ),
        User.findOneAndUpdate(
          { username: normalizedLiker },
          { $pull: { likedUsers: normalized, matchedUsers: normalized } },
          { new: true }
        )
      ]);

      if (!updatedTarget) return res.status(404).json({ error: 'user not found' });
      if (!updatedLiker) return res.status(404).json({ error: 'liker not found' });

      return res.json({ success: true, action: 'unlike' });
    }

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

    res.json({ success: true, action: 'like', interestedUsers: updatedTarget.interestedUsers, likedUsers: updatedLiker.likedUsers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users/:username/avatar — update profile image
router.post('/:username/avatar', async (req, res) => {
  try {
    const { username } = req.params;
    const normalized = String(username).trim().toLowerCase();
    const avatar = String(req.body.avatar || '').trim();

    if (!avatar) return res.status(400).json({ error: 'avatar required' });

    const updated = await User.findOneAndUpdate(
      { username: normalized },
      { $set: { avatar } },
      { new: true }
    );

    if (!updated) return res.status(404).json({ error: 'not found' });
    withDefaultPrompts(updated);
    res.json({ success: true, avatar: updated.avatar });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users/:username/avatar-secondary — update secondary profile image
router.post('/:username/avatar-secondary', async (req, res) => {
  try {
    const { username } = req.params;
    const normalized = String(username).trim().toLowerCase();
    const avatarSecondary = String(req.body.avatarSecondary || '').trim();

    if (!avatarSecondary) return res.status(400).json({ error: 'avatarSecondary required' });

    const updated = await User.findOneAndUpdate(
      { username: normalized },
      { $set: { avatarSecondary } },
      { new: true }
    );

    if (!updated) return res.status(404).json({ error: 'not found' });
    withDefaultPrompts(updated);
    res.json({ success: true, avatarSecondary: updated.avatarSecondary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
