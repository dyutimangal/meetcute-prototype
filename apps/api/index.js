const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });
const express = require('express');
const morgan = require('morgan');
const mongoose = require('mongoose');
const userRoutes = require('./src/routes/users');

const app = express();
app.use(express.json({ limit: '2000mb' }));
app.use(morgan('tiny'));

app.get('/', (req, res) => {
  res.json({ message: 'MeetCute API' });
});

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
