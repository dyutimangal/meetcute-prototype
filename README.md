# meetcute-prototype

Minimal starter project: Node.js + Express + Mongoose (MongoDB) — a tiny REST API to show how to get started.

Prereqs
 - Node.js (18+ recommended) and npm
 - A MongoDB server (local or Atlas) if you want persistence

Quick start

1. Install dependencies

```bash
npm install
```

2. Configure environment

Copy `.env.example` -> `.env` and change MONGODB_URI if needed.

3. Run the app

```bash
# development (auto reload)
npm run dev

# production/start
npm start
```

4. Quick sanity check (no DB required)

```bash
# run unit tests (Jest + in-memory MongoDB)
npm test

# quick startup-check (old script)
npm run test:quick
```

Basic API

- GET / — basic hello
 - GET / — landing page with username signup
 - GET /api/users — list users (returns [] if DB empty)
 - POST /api/users — create an account (body: { "username": "alice", "email": "alice@example.com" })
 - GET /api/users/:username — fetch user by username

Username signup flow

1. Open the landing page (http://localhost:3000) and enter a username.
2. The page will attempt to create the account by POSTing `{ username, email }` to `/api/users`.
	 - If the username+email matches an existing account you'll be redirected to `/<username>`.
	 - If the username already exists with a different email you'll be asked to choose another username (or check the email you entered).

Username rules & notes

- Allowed characters: letters, numbers, dash (-) and underscore (_).
- Length: 2–32 characters.
- Duplicate usernames produce an HTTP 409 Conflict response.

User profile & matching

After you sign up and are at `/<username>`, you can edit your profile preferences from the landing/profile page. The profile fields available are:

- `intention` (array) — multi-select values including: `dating`, `friendship`
- `interestedIn` (array) — multi-select values including: `girls`, `guys`, `non-binary`
- `age` (integer)
- `preferredAgeRange` (min/max integers)

The personal page (`/<username>`) will show how many other users match your preferences (and a visual list of icons). The server filters other users based on your `preferredAgeRange` and — if set — will prefer users matching your `intention` and `interestedIn` selections.

Note: usernames are immutable once created and are case-insensitive (stored lowercased). If you need to change your username later we'll add an account/edit flow with authentication — for now usernames cannot be updated via the API.

Update profile (example)

```bash
curl -X PUT http://localhost:3000/api/users/alice \
	-H "Content-Type: application/json" \
	-d '{"age":28, "intention":["dating"], "interestedIn":["guys"], "preferredAgeRange":{"min":24,"max":40}}'
```

Manual test examples

Create an account with curl (username + email):

```bash
curl -X POST http://localhost:3000/api/users \
	-H "Content-Type: application/json" \
	-d '{"username":"alice","email":"alice@example.com"}'

# expected: 201 created and JSON user returned
```

Fetch the user:

```bash
curl http://localhost:3000/api/users/alice
```

Open your personal page in the browser:

```
http://localhost:3000/alice
```

Example: create a user with curl

```bash
curl -X POST http://localhost:3000/api/users -H "Content-Type: application/json" -d '{"name":"Alice","email":"alice@example.com"}'

Deleting existing users / cleanup

If you have old or test entries you want to remove, you can:

- Use the provided destructive script (only for development / tests). This script reads MONGODB_URI from `.env` and will refuse to run unless you pass --confirm or set CLEAR_USERS=1 to avoid accidents.

```bash
# make sure .env has your MONGODB_URI then run with explicit confirmation
node scripts/clear-users.js --confirm
```

- Or use the Mongo shell or Atlas UI to delete documents from the `users` collection.

If your database has problematic existing indexes (e.g., several documents with null emails colliding with a unique index), you may need to clean the documents first or drop and recreate indexes in the Atlas UI or using the mongo shell.
```

How it is structured

- `index.js` — app/server entrypoint
- `src/models/User.js` — a tiny Mongoose model
- `src/routes/users.js` — example routes

Next steps / ideas

- Add validation and better error handling
- Add authentication (JWT / sessions)
- Add tests (Jest / Supertest) and CI

Running with MongoDB

Local MongoDB:

1. Install and start MongoDB (on many systems: `sudo systemctl start mongod` or use docker)

Using Docker (recommended for an isolated local DB):

```bash
docker run --rm -d --name mongo-dev -p 27017:27017 mongo:7.0
```

Then set `MONGODB_URI=mongodb://localhost:27017/meetcute-development` in `.env`.

MongoDB Atlas (cloud):

1. Create a free cluster at https://cloud.mongodb.com
2. Create a Database User and whitelist your IP / or allow access from anywhere for testing
3. Get the connection string and set `MONGODB_URI` in your `.env` accordingly (replace <password> and <dbname>)

Debugging notes & troubleshooting

- If your server starts but API requests give 500, check the logs — missing MONGODB_URI will still allow the server but DB operations will fail.
- Use `curl` or Postman to exercise endpoints. Example create-a-user:

```bash
curl -X POST http://localhost:3000/api/users \
	-H "Content-Type: application/json" \
	-d '{"name":"Bob","email":"bob@example.com"}'
```

Where to go from here

- Add request validation (express-validator / zod), convert to TypeScript, or add a frontend.
- Add authentication (Passport.js / JWT), integrate real features and UI.
- Add automated tests and CI (GitHub Actions) to verify API behaviour.

