const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });
const express = require('express');
const morgan = require('morgan');
const mongoose = require('mongoose');
const fs = require('fs');
const userRoutes = require('./src/routes/users');
const authRoutes = require('./src/routes/auth');

const app = express();
app.use(express.json({ limit: '200mb' }));
app.use(morgan('tiny'));

const corsOrigin = process.env.CORS_ORIGIN || process.env.FRONTEND_URL || '*';
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', corsOrigin);
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
});

const clientDist = process.env.FRONTEND_DIST
  ? path.resolve(process.env.FRONTEND_DIST)
  : path.resolve(__dirname, '..', 'web', 'dist', 'public');
const clientIndex = path.join(clientDist, 'index.html');
const shouldServeWeb = process.env.SERVE_WEB === '1';

if (shouldServeWeb && fs.existsSync(clientIndex)) {
  app.use(express.static(clientDist));
} else if (shouldServeWeb) {
  console.warn('SERVE_WEB=1 but no built frontend found at', clientDist);
}

app.get('/', (req, res) => {
  res.json({ message: 'MeetCute API' });
});

// API root fallback if requested specifically
app.get('/api', (req, res) => {
  res.json({ message: 'Hello — MeetCute prototype API' });
});

app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);

const PORT = process.env.PORT || 3001;
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

// If frontend isn't served here, redirect to a configured frontend URL.
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).end();

  if (shouldServeWeb && fs.existsSync(clientIndex)) {
    return res.sendFile(clientIndex);
  }

  const frontendUrl = process.env.FRONTEND_URL;
  if (frontendUrl) {
    try {
      const target = new URL(req.path, frontendUrl);
      return res.redirect(302, target.toString());
    } catch {
      return res.redirect(302, frontendUrl);
    }
  }

  return res.status(404).json({ error: 'Frontend not configured. Set FRONTEND_URL or SERVE_WEB=1.' });
});
