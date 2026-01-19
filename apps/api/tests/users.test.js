const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');

let mongod;
let app;
const registerUser = async (username, email) => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ username, email })
    .set('Accept', 'application/json');
  const cookies = res.headers['set-cookie'] || [];
  const sessionCookie = cookies.find((cookie) => cookie.startsWith('meetcute_session='));
  return { res, sessionCookie };
};

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  // connect mongoose for tests
  await mongoose.connect(uri, { dbName: 'test' });

  // import app after mongoose is connected
  // index.js exports { app, start }
  ({ app } = require('../index'));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  // clear users collection between tests
  await mongoose.connection.db.collection('users').deleteMany({});
});

test('signup creates a user and returns 201', async () => {
  const res = await request(app)
    .post('/api/users')
    .send({ username: 'TestUser', email: 'testuser@example.com' })
    .set('Accept', 'application/json');

  expect(res.statusCode).toBe(201);
  expect(res.body).toHaveProperty('username', 'testuser');
  expect(res.body).toHaveProperty('email', 'testuser@example.com');
});

test('same username+email returns 200 (idempotent)', async () => {
  await request(app)
    .post('/api/users')
    .send({ username: 'TestUser', email: 'testuser@example.com' });

  const res = await request(app)
    .post('/api/users')
    .send({ username: 'testuser', email: 'testuser@example.com' });

  expect(res.statusCode).toBe(200);
  expect(res.body.username).toBe('testuser');
});

test('same username different email returns 409', async () => {
  await request(app)
    .post('/api/users')
    .send({ username: 'sameuser', email: 'first@example.com' });

  const res = await request(app)
    .post('/api/users')
    .send({ username: 'SameUser', email: 'other@example.com' });

  expect(res.statusCode).toBe(409);
  expect(res.body.error).toMatch(/username already exists/);
});

test('same email different username returns 409', async () => {
  await request(app)
    .post('/api/users')
    .send({ username: 'userone', email: 'shared@example.com' });

  const res = await request(app)
    .post('/api/users')
    .send({ username: 'usertwo', email: 'SHARED@example.com' });

  expect(res.statusCode).toBe(409);
  expect(res.body.error).toMatch(/email already exists/);
});

test('usernames are case-insensitive', async () => {
  const first = await request(app)
    .post('/api/users')
    .send({ username: 'CaseUser', email: 'case@example.com' });
  expect(first.statusCode).toBe(201);

  // attempt with different casing and same email => idempotent
  const second = await request(app)
    .post('/api/users')
    .send({ username: 'caseuser', email: 'case@example.com' });
  expect(second.statusCode).toBe(200);

  // attempt different casing with a different email -> username taken
  const third = await request(app)
    .post('/api/users')
    .send({ username: 'CASEUSER', email: 'other@example.com' });
  expect(third.statusCode).toBe(409);
});

test('username cannot be changed (immutable)', async () => {
  const { sessionCookie } = await registerUser('immutest', 'immutest@example.com');

  const res = await request(app)
    .put('/api/users/immutest')
    .set('Cookie', sessionCookie)
    .send({ username: 'newname', age: 35 });

  expect(res.statusCode).toBe(400);
  expect(res.body.error).toMatch(/immutable/);

  // ensure username didn't change
  const getOld = await request(app)
    .get('/api/users/immutest')
    .set('Cookie', sessionCookie);
  expect(getOld.statusCode).toBe(200);
  expect(getOld.body.username).toBe('immutest');

  const getNew = await request(app)
    .get('/api/users/newname')
    .set('Cookie', sessionCookie);
  expect(getNew.statusCode).toBe(404);
});

test('incomplete profiles are hidden from other users', async () => {
  const { sessionCookie: viewerCookie } = await registerUser('viewer', 'viewer@example.com');
  await registerUser('incomplete', 'incomplete@example.com');
  const { sessionCookie: completeCookie } = await registerUser('complete', 'complete@example.com');

  await request(app)
    .put('/api/users/complete')
    .set('Cookie', completeCookie)
    .send({
      age: 29,
      gender: 'female',
      intention: ['dating'],
      interestedIn: ['guys'],
      avatar: 'data:image/jpeg;base64,complete',
      preferredAgeRange: { min: 24, max: 36 },
    });

  const res = await request(app)
    .get('/api/users')
    .set('Cookie', viewerCookie);

  expect(res.statusCode).toBe(200);
  const usernames = res.body.map((user) => user.username);
  expect(usernames).toContain('complete');
  expect(usernames).not.toContain('incomplete');
  expect(usernames).not.toContain('viewer');
});

test('incomplete profile is not fetchable by others', async () => {
  const { sessionCookie: viewerCookie } = await registerUser('viewer2', 'viewer2@example.com');
  await registerUser('incomplete2', 'incomplete2@example.com');

  const res = await request(app)
    .get('/api/users/incomplete2')
    .set('Cookie', viewerCookie);

  expect(res.statusCode).toBe(404);
});

test('liking requires the liker to complete their profile', async () => {
  const { sessionCookie: likerCookie } = await registerUser('liker', 'liker@example.com');
  const { sessionCookie: targetCookie } = await registerUser('target', 'target@example.com');

  await request(app)
    .put('/api/users/target')
    .set('Cookie', targetCookie)
    .send({
      age: 31,
      gender: 'male',
      intention: ['dating'],
      interestedIn: ['girls'],
      avatar: 'data:image/jpeg;base64,target',
      preferredAgeRange: { min: 25, max: 35 },
    });

  const res = await request(app)
    .post('/api/users/target/like')
    .set('Cookie', likerCookie)
    .send({ action: 'like' });

  expect(res.statusCode).toBe(403);
  expect(res.body.error).toMatch(/complete profile required/);
});
