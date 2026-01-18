const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');

let mongod;
let app;

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
  await request(app)
    .post('/api/users')
    .send({ username: 'immutest', email: 'immutest@example.com' });

  const res = await request(app)
    .put('/api/users/immutest')
    .send({ username: 'newname', age: 35 });

  expect(res.statusCode).toBe(400);
  expect(res.body.error).toMatch(/immutable/);

  // ensure username didn't change
  const getOld = await request(app).get('/api/users/immutest');
  expect(getOld.statusCode).toBe(200);
  expect(getOld.body.username).toBe('immutest');

  const getNew = await request(app).get('/api/users/newname');
  expect(getNew.statusCode).toBe(404);
});
