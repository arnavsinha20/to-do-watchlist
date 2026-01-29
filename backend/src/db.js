const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const mysql = require('mysql2/promise');

const DEFAULT_DB_FILE = path.resolve(__dirname, '../../database/app.db');
const SCHEMA_FILE = path.resolve(__dirname, '../../database/schema.sql');
const SEED_FILE = path.resolve(__dirname, '../../database/seed.sql');

const useMySql = Boolean(process.env.MYSQL_URL);
let mysqlPool;
let sqliteDb;

async function getMySqlPool() {
  if (!mysqlPool) {
    mysqlPool = mysql.createPool(process.env.MYSQL_URL);
  }
  return mysqlPool;
}

function getSqliteDb() {
  if (!sqliteDb) {
    const dbFile = process.env.DB_FILE ? path.resolve(process.env.DB_FILE) : DEFAULT_DB_FILE;
    sqliteDb = new sqlite3.Database(dbFile, (err) => {
      if (err) {
        console.error('Failed to connect to SQLite database', err);
        process.exit(1);
      }
      sqliteDb.exec('PRAGMA foreign_keys = ON');
    });
  }
  return sqliteDb;
}

function applySqlFile(filePath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      return resolve();
    }

    const sql = fs.readFileSync(filePath, 'utf8');
    const db = getSqliteDb();
    db.exec(sql, (err) => {
      if (err) {
        return reject(err);
      }
      resolve();
    });
  });
}

async function query(text, params = []) {
  if (useMySql) {
    const pool = await getMySqlPool();
    const [rows] = await pool.execute(text.replace(/\$\d+/g, '?'), params);
    return { rows, rowCount: rows.length };
  }

  const db = getSqliteDb();
  const sqlText = text.replace(/\$\d+/g, '?');
  const trimmed = text.trim().toLowerCase();
  const isSelect = trimmed.startsWith('select');
  const isInsert = trimmed.startsWith('insert');
  const isUpdate = trimmed.startsWith('update');
  const isDelete = trimmed.startsWith('delete');

  if (isSelect) {
    return new Promise((resolve, reject) => {
      db.all(sqlText, params, (err, rows) => {
        if (err) return reject(err);
        resolve({ rows, rowCount: rows.length });
      });
    });
  }

  if (isInsert || isUpdate || isDelete) {
    return new Promise((resolve, reject) => {
      db.run(sqlText, params, function runCallback(err) {
        if (err) return reject(err);
        resolve({ rowCount: this.changes, rows: [], lastID: this.lastID });
      });
    });
  }

  return new Promise((resolve, reject) => {
    db.run(sqlText, params, function runCallback(err) {
      if (err) return reject(err);
      resolve({ rowCount: this.changes, rows: [], lastID: this.lastID });
    });
  });
}

async function bootstrapDatabase() {
  if (useMySql) {
    const pool = await getMySqlPool();
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        title TEXT NOT NULL,
        completed BOOLEAN NOT NULL DEFAULT FALSE,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);
    return;
  }

  await applySqlFile(SCHEMA_FILE);
  await applySqlFile(SEED_FILE);
}

module.exports = {
  query,
  bootstrapDatabase,
};
