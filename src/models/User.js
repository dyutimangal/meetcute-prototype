const mongoose = require('mongoose');

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
  // list of usernames who have liked/shown interest in this user
  interestedUsers: { type: [String], default: [] },
  // list of usernames this user has matched with (mutual likes)
  matchedUsers: { type: [String], default: [] },
  // 'age' — user's age as integer
  age: { type: Number, required: false },
  // 'preferredAgeRange' — [min, max]
  preferredAgeRange: {
    min: { type: Number, default: 18 },
    max: { type: Number, default: 99 }
  },

  createdAt: { type: Date, default: Date.now }
});

// Ensure username/email are normalized on save (extra safety)
userSchema.pre('save', function (next) {
  if (this.username && typeof this.username === 'string') this.username = this.username.trim().toLowerCase();
  if (this.email && typeof this.email === 'string') this.email = this.email.trim().toLowerCase();
  // ensure avatar exists: generate a simple SVG data-URI showing initials when missing
  if (!this.avatar && this.username) {
    const initial = (this.username && this.username[0]) ? this.username[0].toUpperCase() : '?';
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128'><rect width='100%' height='100%' rx='20' fill='%2318273a'/><text x='50%' y='50%' dy='0.35em' text-anchor='middle' fill='%23ffd1b8' font-family='Arial,Helvetica,sans-serif' font-size='54'>${initial}</text></svg>`;
    this.avatar = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }
  next();
});

module.exports = mongoose.model('User', userSchema);
