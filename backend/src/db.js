const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DEFAULT_DB_FILE = path.resolve(__dirname, '../../database/app.db');
const SCHEMA_FILE = path.resolve(__dirname, '../../database/schema.sql');
const SEED_FILE = path.resolve(__dirname, '../../database/seed.sql');

const dbFile = process.env.DB_FILE ? path.resolve(process.env.DB_FILE) : DEFAULT_DB_FILE;

const db = new sqlite3.Database(dbFile, (err) => {
  if (err) {
    console.error('Failed to connect to SQLite database', err);
    process.exit(1);
  }
  db.exec('PRAGMA foreign_keys = ON');
});

function applySqlFile(filePath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      return resolve();
    }

    const sql = fs.readFileSync(filePath, 'utf8');
    db.exec(sql, (err) => {
      if (err) {
        return reject(err);
      }
      resolve();
    });
  });
}

async function bootstrapDatabase() {
  await applySqlFile(SCHEMA_FILE);
  await applySqlFile(SEED_FILE);
}

module.exports = {
  db,
  bootstrapDatabase,
};
