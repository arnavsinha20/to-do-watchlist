const { bootstrapDatabase } = require('./db');

bootstrapDatabase()
  .then(() => {
    console.log('Database initialized successfully.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Database initialization failed:', err);
    process.exit(1);
  });
