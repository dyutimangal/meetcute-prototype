const User = require('../models/User');
const { DEFAULT_PROMPTS } = require('./defaultPrompts');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_-]{2,32}$/;

const createUser = async ({ username, email }) => {
  if (!email) {
    const err = new Error('email required');
    err.status = 400;
    throw err;
  }
  if (!EMAIL_REGEX.test(email)) {
    const err = new Error('invalid email');
    err.status = 400;
    throw err;
  }
  if (!username) {
    const err = new Error('username required');
    err.status = 400;
    throw err;
  }
  if (!USERNAME_REGEX.test(username)) {
    const err = new Error('invalid username (allowed: letters, numbers, - or _ , 2-32 chars)');
    err.status = 400;
    throw err;
  }

  const normalizedUsername = String(username).trim().toLowerCase();
  const normalizedEmail = String(email).trim().toLowerCase();

  const existing = await User.findOne({ username: normalizedUsername });
  if (existing) {
    if (existing.email && existing.email === normalizedEmail) {
      return { user: existing, status: 200, existing: true };
    }
    const err = new Error('username already exists with another email');
    err.status = 409;
    throw err;
  }

  const emailOwner = await User.findOne({ email: normalizedEmail });
  if (emailOwner) {
    const err = new Error('email already exists with another account');
    err.status = 409;
    throw err;
  }

  const createPayload = {
    username: normalizedUsername,
    email: normalizedEmail,
    prompts: DEFAULT_PROMPTS,
  };
  const user = new User(createPayload);
  await user.save();
  return { user, status: 201, existing: false };
};

module.exports = { createUser };
