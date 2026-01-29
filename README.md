# CRUD App

Personal task manager with email/password accounts. The backend is a Node.js + Express API that can run on MySQL in production (Vercel) and falls back to SQLite locally. The frontend is a lightweight dashboard written with vanilla HTML, CSS, and JavaScript.

## Project layout

```
CRUD app/
├── backend/        # Express server + database helpers
├── database/       # SQL schema + seed data
└── frontend/       # Static HTML/CSS/JS client
```

## Prerequisites

- Node.js 18+

## Getting started

1. Install dependencies:
   ```bash
   cd backend
   npm install
   ```
2. (SQLite local) Initialize the local DB (creates `database/app.db`, runs schema + seeds):
   ```bash
   npm run init-db
   ```
3. Start the server (serves the API on `http://localhost:5000` and the frontend from `/frontend`):
   ```bash
   npm start
   ```
4. Open the app in the browser: `http://localhost:5000`

## API overview

All endpoints are prefixed with `/api`.

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| POST | `/api/auth/register` | Create a new account (`name`, `email`, `password`) |
| POST | `/api/auth/login` | Exchange email/password for a session payload |
| GET | `/api/users/:userId/tasks` | List tasks that belong to the user |
| POST | `/api/users/:userId/tasks` | Create a task (`title`) for the user |
| PUT | `/api/users/:userId/tasks/:taskId` | Update task title or completion flag |
| DELETE | `/api/users/:userId/tasks/:taskId` | Remove a task |

All requests/response bodies are JSON encoded. Passwords must be at least six characters; hashes are stored with `bcryptjs`.

## Usage flow

1. Visit `http://localhost:5000` once the server is running.
2. Use the **Register** tab to create an account (name, email, password).
3. Log in with the same credentials; the UI switches to your personal task board.
4. Add, complete, edit, or delete tasks. Every action is scoped to the logged-in user identifier.

## Environment variables

- `MYSQL_URL` (prod): MySQL connection string for Vercel.
- `DB_FILE` (local optional): SQLite path when `MYSQL_URL` is not set. Defaults to `database/app.db`.
- `PORT` (optional local): override default server port (`5000`).

## Development tips

- Use `npm run dev` in `backend/` for automatic reloads via `nodemon`.
- `database/schema.sql` contains the full DDL; tweak it to add more tables or columns.
- `database/seed.sql` is run once per `npm run init-db`; adjust or clear it when reseeding.
