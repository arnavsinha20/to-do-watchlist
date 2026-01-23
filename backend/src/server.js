const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const { db, bootstrapDatabase } = require('./db');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
const PORT = process.env.PORT || 5000;
const SALT_ROUNDS = 10;

app.use(cors());
app.use(express.json());

function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function runCallback(err) {
      if (err) {
        return reject(err);
      }
      resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        return reject(err);
      }
      resolve(row);
    });
  });
}

function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        return reject(err);
      }
      resolve(rows);
    });
  });
}

async function ensureUserTableShape() {
  const columns = await allAsync('PRAGMA table_info(users)');
  const columnNames = columns.map((col) => col.name);

  if (!columnNames.includes('password_hash')) {
    console.warn('Upgrading users table: adding password_hash column (existing users will be cleared).');
    await runAsync('ALTER TABLE users ADD COLUMN password_hash TEXT');
    await runAsync('DELETE FROM users');
  }

  if (!columnNames.includes('updated_at')) {
    console.warn('Upgrading users table: adding updated_at column.');
    await runAsync('ALTER TABLE users ADD COLUMN updated_at TEXT');
    await runAsync("UPDATE users SET updated_at = COALESCE(updated_at, created_at, datetime('now'))");
  }
}

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
  const user = await getAsync('SELECT id, name, email FROM users WHERE id = ?', [userId]);
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
    await getAsync('SELECT 1');
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

    const existing = await getAsync('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const passwordHash = await hashPassword(password);
    const now = new Date().toISOString();
    const result = await runAsync(
      'INSERT INTO users (name, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [name, email, passwordHash, now, now]
    );

    const created = await getAsync('SELECT id, name, email FROM users WHERE id = ?', [result.id]);
    res.status(201).json({ user: sanitizeUser(created) });
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

    const user = await getAsync('SELECT id, name, email, password_hash FROM users WHERE email = ?', [email]);
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
    await ensureUser(userId);
    const rows = await allAsync(
      'SELECT id, user_id, title, completed, created_at, updated_at FROM tasks WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    res.json(rows.map(mapTask));
  } catch (error) {
    handleError(res, error, 'Failed to load tasks');
  }
});

app.post('/api/users/:userId/tasks', async (req, res) => {
  try {
    const { userId } = req.params;
    await ensureUser(userId);
    const title = (req.body.title || '').trim();
    if (!title) {
      return res.status(400).json({ message: 'Task title is required' });
    }
    const now = new Date().toISOString();
    const result = await runAsync(
      'INSERT INTO tasks (user_id, title, completed, created_at, updated_at) VALUES (?, ?, 0, ?, ?)',
      [userId, title, now, now]
    );
    const created = await getAsync(
      'SELECT id, user_id, title, completed, created_at, updated_at FROM tasks WHERE id = ?',
      [result.id]
    );
    res.status(201).json(mapTask(created));
  } catch (error) {
    handleError(res, error, 'Failed to create task');
  }
});

app.put('/api/users/:userId/tasks/:taskId', async (req, res) => {
  try {
    const { userId, taskId } = req.params;
    await ensureUser(userId);
    const existing = await getAsync(
      'SELECT id, user_id, title, completed, created_at, updated_at FROM tasks WHERE id = ? AND user_id = ?',
      [taskId, userId]
    );

    if (!existing) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const hasTitle = req.body.title !== undefined;
    const title = hasTitle ? String(req.body.title ?? '').trim() : existing.title;
    if (hasTitle && !title) {
      return res.status(400).json({ message: 'Task title cannot be empty' });
    }

    const completed =
      typeof req.body.completed === 'boolean' ? (req.body.completed ? 1 : 0) : existing.completed;

    const now = new Date().toISOString();
    await runAsync(
      'UPDATE tasks SET title = ?, completed = ?, updated_at = ? WHERE id = ? AND user_id = ?',
      [title, completed, now, taskId, userId]
    );

    const updated = await getAsync(
      'SELECT id, user_id, title, completed, created_at, updated_at FROM tasks WHERE id = ?',
      [taskId]
    );

    res.json(mapTask(updated));
  } catch (error) {
    handleError(res, error, 'Failed to update task');
  }
});

app.delete('/api/users/:userId/tasks/:taskId', async (req, res) => {
  try {
    const { userId, taskId } = req.params;
    await ensureUser(userId);
    const result = await runAsync('DELETE FROM tasks WHERE id = ? AND user_id = ?', [taskId, userId]);
    if (result.changes === 0) {
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

async function startServer() {
  try {
    await bootstrapDatabase();
    await ensureUserTableShape();

    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  } catch (error) {
    console.error('Unable to start server', error);
    process.exit(1);
  }
}

startServer();
