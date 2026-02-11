console.log("MONGO_URI:", process.env.MONGO_URI);


const path = require('path');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

require('dotenv').config();

const app = express();
const SALT_ROUNDS = 10;

app.use(cors());
app.use(express.json());

/* ===========================
   MongoDB Connection (Vercel Safe)
=========================== */

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(process.env.MONGO_URI, {
      bufferCommands: false,
    }).then((mongoose) => mongoose);
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

connectDB().catch(err => console.error("MongoDB Connection Failed:", err));

/* ===========================
   Schemas
=========================== */

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password_hash: String,
}, { timestamps: true });

const taskSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  title: String,
  completed: { type: Boolean, default: false },
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model("User", userSchema);
const Task = mongoose.models.Task || mongoose.model("Task", taskSchema);

/* ===========================
   AUTH ROUTES
=========================== */

app.post('/api/auth/register', async (req, res) => {
  try {
    await connectDB();

    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ message: "All fields required" });

    if (password.length < 6)
      return res.status(400).json({ message: "Password must be at least 6 characters" });

    const existing = await User.findOne({ email });
    if (existing)
      return res.status(409).json({ message: "Email already registered" });

    const hash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await User.create({
      name,
      email,
      password_hash: hash
    });

    res.status(201).json({
      user: { id: user._id, name: user.name, email: user.email }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    await connectDB();

    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user)
      return res.status(401).json({ message: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password_hash);

    if (!match)
      return res.status(401).json({ message: "Invalid credentials" });

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===========================
   TASK ROUTES
=========================== */

app.get('/api/users/:userId/tasks', async (req, res) => {
  try {
    await connectDB();

    const tasks = await Task.find({ userId: req.params.userId })
      .sort({ createdAt: -1 });

    res.json(tasks);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

app.post('/api/users/:userId/tasks', async (req, res) => {
  try {
    await connectDB();

    const { title } = req.body;

    if (!title)
      return res.status(400).json({ message: "Task title required" });

    const task = await Task.create({
      userId: req.params.userId,
      title
    });

    res.status(201).json(task);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

app.put('/api/users/:userId/tasks/:taskId', async (req, res) => {
  try {
    await connectDB();

    const updated = await Task.findByIdAndUpdate(
      req.params.taskId,
      req.body,
      { new: true }
    );

    if (!updated)
      return res.status(404).json({ message: "Task not found" });

    res.json(updated);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

app.delete('/api/users/:userId/tasks/:taskId', async (req, res) => {
  try {
    await connectDB();

    await Task.findByIdAndDelete(req.params.taskId);
    res.status(204).send();

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===========================
   FRONTEND
=========================== */

app.use(express.static(path.resolve(__dirname, '../../frontend')));

app.get('*', (_req, res) => {
  res.sendFile(path.resolve(__dirname, '../../frontend/index.html'));
});

module.exports = app;
