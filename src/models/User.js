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
  next();
});

module.exports = mongoose.model('User', userSchema);
