const mongoose = require('mongoose');

const PROMPT_PLACEHOLDER = 'I am too lazy for this shit';
const AGE_MIN = 18;
const AGE_MAX = 99;

const promptsSchema = new mongoose.Schema({
  lookingFor: { type: String, default: PROMPT_PLACEHOLDER },
  idealWeekend: { type: String, default: PROMPT_PLACEHOLDER },
  superpower: { type: String, default: PROMPT_PLACEHOLDER },
  petPeeve: { type: String, default: PROMPT_PLACEHOLDER }
}, { _id: false });

const userSchema = new mongoose.Schema({
  // store usernames lowercased so uniqueness is case-insensitive
  // immutable: true prevents username from being changed after creation
  username: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true, immutable: true },
  // require email for accounts and enforce uniqueness
  email: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },

  // Preferences/profile fields
  // 'intention' — what user is looking for (array of strings): 'dating', 'friendship'
  intention: { type: [String], default: [] },
  // 'interestedIn' — who they are into (array of strings): 'girls','guys','non-binary'
  interestedIn: { type: [String], default: [] },
  // 'gender' — how the user identifies (stored as string): 'male','female','non-binary'
  gender: { type: String, enum: ['male', 'female', 'non-binary'], required: false },
  // optional avatar (data URL or remote URL). If not provided, auto-generated from username initial.
  avatar: { type: String, required: false },
  // optional secondary avatar/image
  avatarSecondary: { type: String, required: false },
  // prompts for profile questions
  prompts: { type: promptsSchema, default: () => ({}) },
  // list of usernames this user has liked
  likedUsers: { type: [String], default: [] },
  // list of usernames who have liked/shown interest in this user
  interestedUsers: { type: [String], default: [] },
  // list of usernames this user has matched with (mutual likes)
  matchedUsers: { type: [String], default: [] },
  // 'age' — user's age as integer
  age: {
    type: Number,
    required: false,
    min: AGE_MIN,
    max: AGE_MAX,
    validate: {
      validator: (value) => value == null || Number.isInteger(value),
      message: 'age must be an integer'
    }
  },
  // 'preferredAgeRange' — [min, max]
  preferredAgeRange: {
    min: {
      type: Number,
      default: AGE_MIN,
      min: AGE_MIN,
      max: AGE_MAX,
      validate: {
        validator: (value) => value == null || Number.isInteger(value),
        message: 'preferredAgeRange.min must be an integer'
      }
    },
    max: {
      type: Number,
      default: AGE_MAX,
      min: AGE_MIN,
      max: AGE_MAX,
      validate: {
        validator: (value) => value == null || Number.isInteger(value),
        message: 'preferredAgeRange.max must be an integer'
      }
    }
  },

  createdAt: { type: Date, default: Date.now }
});

// Ensure username/email are normalized on save (extra safety)
userSchema.pre('save', function (next) {
  if (this.username && typeof this.username === 'string') this.username = this.username.trim().toLowerCase();
  if (this.email && typeof this.email === 'string') this.email = this.email.trim().toLowerCase();
  next();
});

userSchema.pre('validate', function (next) {
  const range = this.preferredAgeRange;
  if (!range || range.min == null || range.max == null) return next();
  if (range.min <= range.max) return next();
  return next(new Error('preferredAgeRange min must be less than or equal to max'));
});

module.exports = mongoose.model('User', userSchema);
