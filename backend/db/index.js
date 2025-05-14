const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  }
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Database connected successfully at:', res.rows[0].now);
  }
});

// Helper for more consistent query handling
module.exports = {
  query: (text, params) => {
    console.log('DB Query:', { text, params });
    return pool.query(text, params)
      .catch(err => {
        console.error('Query error:', err);
        throw err;
      });
  },
};
