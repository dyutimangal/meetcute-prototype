require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const mongoose = require('mongoose');

const userRoutes = require('./src/routes/users');

const app = express();
app.use(express.json());
app.use(morgan('tiny'));

// Serve static landing page from /public
const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));

// API root fallback if requested specifically
app.get('/api', (req, res) => {
  res.json({ message: 'Hello — MeetCute prototype API' });
});

app.use('/api/users', userRoutes);

const PORT = process.env.PORT || 3000;

async function start() {
  if (process.env.MONGODB_URI) {
    try {
      await mongoose.connect(process.env.MONGODB_URI, { autoIndex: true });
      console.log('Connected to MongoDB');
    } catch (err) {
      console.error('MongoDB connection error:', err.message);
    }
  } else {
    console.warn('MONGODB_URI not set — server will run without DB');
  }

  app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
}

// Only start the server when run directly to make imports (tests) easier
if (require.main === module) {
  start();
}

module.exports = { app, start };

// Serve per-user page for any username path (after static and API handlers)
// Serve per-user page for any username path (after static and API handlers)
app.get('/:username', (req, res) => {
  const { username } = req.params;
  // don't override API paths or static assets — only serve for plain username-like paths
  if (username.startsWith('api') || username.includes('.')) return res.status(404).end();

  // If the client has a session cookie `meetcute_user`, enforce that they can only access their own page.
  const rawCookies = req.headers.cookie || '';
  const cookies = rawCookies.split(';').map(c => c.trim()).reduce((acc, pair) => {
    const [k, ...v] = pair.split('=');
    if (!k) return acc;
    acc[k] = decodeURIComponent((v || []).join('='));
    return acc;
  }, {});

  if (cookies.meetcute_user) {
    const loggedIn = String(cookies.meetcute_user).trim();
    if (loggedIn && loggedIn !== username) {
      // Forbidden — logged in user attempting to view another user's page
      res.status(403).send(`<html><body style="font-family:Inter,Arial,sans-serif;background:#07102a;color:#e6eef6;display:flex;align-items:center;justify-content:center;height:100vh"><div style="padding:20px;border-radius:8px;background:#061029">Forbidden — you are logged in as <strong>${loggedIn}</strong>. <a href="/${encodeURIComponent(loggedIn)}" style="color:#ffd1b8">Go to your page</a></div></body></html>`);
      return;
    }
  }

  res.sendFile(require('path').join(__dirname, 'public', 'user.html'));
});
