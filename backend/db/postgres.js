const { Pool } = require('pg');
const { logger } = require('../config/logger');

// Enhanced connection pool configuration
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  // Optimize pool settings for better performance
  max: 20, // Maximum number of clients in the pool
  min: 4,  // Minimum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
  maxUses: 7500, // Close and replace a connection after it has been used 7500 times
});

// Query optimization with prepared statements
const queryCache = new Map();

const getPreparedStatement = (query) => {
  if (!queryCache.has(query)) {
    queryCache.set(query, {
      name: `query_${queryCache.size + 1}`,
      text: query
    });
  }
  return queryCache.get(query);
};

// Enhanced query function with retry logic and performance monitoring
const queryWithRetry = async (text, params = [], retries = 3) => {
  const startTime = Date.now();
  let lastError;

  for (let i = 0; i < retries; i++) {
    try {
      const client = await pool.connect();
      try {
        const prepared = getPreparedStatement(text);
        const result = await client.query(prepared, params);
        const duration = Date.now() - startTime;
        
        // Log slow queries
        if (duration > 1000) {
          logger.warn('Slow query detected:', {
            query: text,
            duration,
            params
          });
        }
        
        return result;
      } finally {
        client.release();
      }
    } catch (error) {
      lastError = error;
      logger.error('Query error:', {
        error: error.message,
        query: text,
        attempt: i + 1
      });
      
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 100));
    }
  }
  
  throw lastError;
};

// Batch query execution for better performance
const batchQuery = async (queries) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const results = await Promise.all(
      queries.map(({ text, params }) => 
        client.query(getPreparedStatement(text), params)
      )
    );
    await client.query('COMMIT');
    return results;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Connection pool event handlers
pool.on('connect', (client) => {
  logger.debug('New client connected to pool');
});

pool.on('error', (err, client) => {
  logger.error('Unexpected error on idle client', err);
});

pool.on('acquire', (client) => {
  logger.debug('Client acquired from pool');
});

pool.on('remove', (client) => {
  logger.debug('Client removed from pool');
});

// Health check function
const checkConnection = async () => {
  try {
    const result = await queryWithRetry('SELECT NOW()');
    return result.rows[0].now;
  } catch (error) {
    logger.error('Database health check failed:', error);
    throw error;
  }
};

module.exports = {
  pool,
  queryWithRetry,
  batchQuery,
  checkConnection
}; 