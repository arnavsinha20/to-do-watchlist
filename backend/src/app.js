const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const { query, bootstrapDatabase } = require('./db');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
const SALT_ROUNDS = 10;
const dbReady = bootstrapDatabase();

app.use((req, res, next) => {
  dbReady.then(() => next()).catch(next);
});

app.use(cors());
app.use(express.json());

const hashPassword = (plain) =>
  new Promise((resolve, reject) => {
    bcrypt.hash(plain, SALT_ROUNDS, (err, hash) => {
      if (err) {
        return reject(err);
      }
      resolve(hash);
    });
  });

const comparePassword = (plain, hashed) =>
  new Promise((resolve, reject) => {
    bcrypt.compare(plain, hashed, (err, match) => {
      if (err) {
        return reject(err);
      }
      resolve(match);
    });
  });

const sanitizeUser = (row) => ({ id: row.id, name: row.name, email: row.email });
const mapTask = (row) => ({
  id: row.id,
  userId: row.user_id,
  title: row.title,
  completed: Boolean(row.completed),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

async function ensureUser(userId) {
  const id = Number.parseInt(userId, 10);
  if (Number.isNaN(id)) {
    const error = new Error('Invalid user id');
    error.status = 400;
    throw error;
  }
  const result = await query('SELECT id, name, email FROM users WHERE id = $1', [id]);
  const user = result.rows?.[0];
  if (!user) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }
  return user;
}

function handleError(res, error, fallbackMessage = 'Request failed') {
  const status = error.status || 500;
  res.status(status).json({ message: error.message || fallbackMessage });
}

app.get('/api/health', async (_req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    const email = (req.body.email || '').trim().toLowerCase();
    const password = req.body.password || '';

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows?.length) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const passwordHash = await hashPassword(password);
    const created = await query(
      'INSERT INTO users (name, email, password_hash, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW()) RETURNING id, name, email',
      [name, email, passwordHash]
    ).catch(async (err) => {
      // Fallback for MySQL which doesn't support RETURNING
      if (err && err.code === 'ER_PARSE_ERROR') {
        await query(
          'INSERT INTO users (name, email, password_hash, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())',
          [name, email, passwordHash]
        );
        const fetched = await query('SELECT id, name, email FROM users WHERE email = $1', [email]);
        return { rows: [fetched.rows[0]] };
      }
      throw err;
    });

    res.status(201).json({ user: sanitizeUser(created.rows[0]) });
  } catch (error) {
    handleError(res, error, 'Failed to register');
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    const password = req.body.password || '';

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const result = await query('SELECT id, name, email, password_hash FROM users WHERE email = $1', [email]);
    const user = result.rows?.[0];
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const match = await comparePassword(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    handleError(res, error, 'Failed to login');
  }
});

app.get('/api/users/:userId/tasks', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await ensureUser(userId);
    const result = await query(
      'SELECT id, user_id, title, completed, created_at, updated_at FROM tasks WHERE user_id = $1 ORDER BY created_at DESC',
      [user.id]
    );
    res.json(result.rows.map(mapTask));
  } catch (error) {
    handleError(res, error, 'Failed to load tasks');
  }
});

app.post('/api/users/:userId/tasks', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await ensureUser(userId);
    const title = (req.body.title || '').trim();
    if (!title) {
      return res.status(400).json({ message: 'Task title is required' });
    }

    const created = await query(
      'INSERT INTO tasks (user_id, title, completed, created_at, updated_at) VALUES ($1, $2, FALSE, NOW(), NOW()) RETURNING id, user_id, title, completed, created_at, updated_at',
      [user.id, title]
    ).catch(async (err) => {
      if (err && err.code === 'ER_PARSE_ERROR') {
        await query(
          'INSERT INTO tasks (user_id, title, completed, created_at, updated_at) VALUES ($1, $2, FALSE, NOW(), NOW())',
          [user.id, title]
        );
        const fetched = await query(
          'SELECT id, user_id, title, completed, created_at, updated_at FROM tasks WHERE user_id = $1 ORDER BY id DESC LIMIT 1',
          [user.id]
        );
        return { rows: [fetched.rows[0]] };
      }
      throw err;
    });
    res.status(201).json(mapTask(created.rows[0]));
  } catch (error) {
    handleError(res, error, 'Failed to create task');
  }
});

app.put('/api/users/:userId/tasks/:taskId', async (req, res) => {
  try {
    const { userId, taskId } = req.params;
    const user = await ensureUser(userId);
    const existing = await query(
      'SELECT id, user_id, title, completed, created_at, updated_at FROM tasks WHERE id = $1 AND user_id = $2',
      [taskId, user.id]
    );

    const current = existing.rows?.[0];
    if (!current) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const hasTitle = req.body.title !== undefined;
    const title = hasTitle ? String(req.body.title ?? '').trim() : current.title;
    if (hasTitle && !title) {
      return res.status(400).json({ message: 'Task title cannot be empty' });
    }

    const completed =
      typeof req.body.completed === 'boolean' ? (req.body.completed ? true : false) : Boolean(current.completed);

    const updated = await query(
      'UPDATE tasks SET title = $1, completed = $2, updated_at = NOW() WHERE id = $3 AND user_id = $4 RETURNING id, user_id, title, completed, created_at, updated_at',
      [title, completed, taskId, user.id]
    );

    res.json(mapTask(updated.rows[0]));
  } catch (error) {
    handleError(res, error, 'Failed to update task');
  }
});

app.delete('/api/users/:userId/tasks/:taskId', async (req, res) => {
  try {
    const { userId, taskId } = req.params;
    const user = await ensureUser(userId);
    const result = await query('DELETE FROM tasks WHERE id = $1 AND user_id = $2', [taskId, user.id]);
    if (!result.rowCount) {
      return res.status(404).json({ message: 'Task not found' });
    }
    res.status(204).send();
  } catch (error) {
    handleError(res, error, 'Failed to delete task');
  }
});

app.use(express.static(path.resolve(__dirname, '../../frontend')));
app.get('*', (_req, res) => {
  res.sendFile(path.resolve(__dirname, '../../frontend/index.html'));
});

module.exports = { app, dbReady };
