/**
 * Danger: destructive script to delete all users in the connected MongoDB.
 * Usage:
 *   node scripts/clear-users.js --confirm
 * or set environment variable CLEAR_USERS=1
 */
require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not set in environment (.env)');
    process.exit(2);
  }

  const confirmed = process.argv.includes('--confirm') || process.env.CLEAR_USERS === '1';
  if (!confirmed) {
    console.error('Refusing to delete users. Pass --confirm or set CLEAR_USERS=1 to proceed.');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    const { deletedCount } = await mongoose.connection.db.collection('users').deleteMany({});
    console.log('Deleted users count:', deletedCount);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error deleting users:', err);
    process.exit(3);
  }
}

main();
