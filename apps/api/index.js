const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });
const express = require('express');
const morgan = require('morgan');
const mongoose = require('mongoose');
const fs = require('fs');

const userRoutes = require('./src/routes/users');
const authRoutes = require('./src/routes/auth');

const app = express();
app.use(express.json({ limit: '6mb' }));
app.use(morgan('tiny'));

// Serve static landing page from /public
// Prefer serving built front-end (apps/web), with legacy fallbacks
const clientDistCandidates = [
  process.env.FRONTEND_DIST ? path.resolve(process.env.FRONTEND_DIST) : null,
  path.resolve(__dirname, '..', 'web', 'dist', 'public'),
].filter(Boolean);
const clientDist = clientDistCandidates.find(candidate => {
  return fs.existsSync(path.join(candidate, 'index.html'));
});
const clientIndex = clientDist ? path.join(clientDist, 'index.html') : null;

if (clientDist) {
  console.log('Serving client from', clientDist);
  app.use(express.static(clientDist));
} else {
  app.use(express.static(path.join(__dirname, 'public')));
}

// API root fallback if requested specifically
app.get('/api', (req, res) => {
  res.json({ message: 'Hello — MeetCute prototype API' });
});

app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

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

  app.listen(PORT, HOST, () => {
    console.log(`Server listening on http://${HOST}:${PORT}`);
  });
}

// Only start the server when run directly to make imports (tests) easier
if (require.main === module) {
  start();
}

module.exports = { app, start };

// Serve per-user page for any username path (after static and API handlers)
// For any non-API route (user-facing routes / SPA routes) serve the client index.html
app.get('*', (req, res) => {
  // Let API routes 404/forward as normal
  if (req.path.startsWith('/api')) return res.status(404).end();

  // Prefer serving built client index.html if available
  if (clientIndex && fs.existsSync(clientIndex)) {
    return res.sendFile(clientIndex);
  }

  // Fallback to legacy per-user HTML if present
  const legacyUser = path.join(__dirname, 'public', 'user.html');
  if (fs.existsSync(legacyUser)) return res.sendFile(legacyUser);

  res.status(404).end();
});
