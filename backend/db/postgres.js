const { Pool } = require('pg');

// Log database configuration (without sensitive info)
console.log('Database Configuration:');
console.log('Host:', process.env.DB_HOST);
console.log('Port:', process.env.DB_PORT);
console.log('Database:', process.env.DB_NAME);
console.log('User:', process.env.DB_USER);

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false // Required for Neon
  },
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
  connectionTimeoutMillis: 2000, // How long to wait for a connection
});

// Test the connection with retry logic
async function testConnection(retries = 5, delay = 5000) {
  for (let i = 0; i < retries; i++) {
    try {
      const client = await pool.connect();
      // Test a simple query
      const result = await client.query('SELECT NOW()');
      console.log('Database connection test successful:', result.rows[0]);
      client.release();
      return true;
    } catch (err) {
      console.error(`Database connection attempt ${i + 1} failed:`, err.message);
      console.error('Full error:', err);
      if (i === retries - 1) {
        console.error('All database connection attempts failed');
        process.exit(1);
      }
      console.log(`Retrying in ${delay/1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Test the connection
testConnection();

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
}; 