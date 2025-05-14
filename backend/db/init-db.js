const db = require('./index');

// Initialize logger
const logger = {
  info: (...args) => console.log('[INFO]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args),
  debug: (...args) => console.debug('[DEBUG]', ...args)
};

// Test database connection
async function testConnection() {
  try {
    const result = await db.query('SELECT NOW()');
    logger.info('Database connection successful:', result.rows[0]);
    return true;
  } catch (error) {
    logger.error('Database connection failed:', error);
    throw error;
  }
}

// Initialize database connection
async function initDatabase() {
  try {
    await testConnection();
    logger.info('Database initialization completed successfully');
  } catch (error) {
    logger.error('Failed to initialize database:', error);
    throw error;
  }
}

// If this file is run directly, test the connection
if (require.main === module) {
  initDatabase()
    .then(() => {
      logger.info('Database connection test completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Database connection test failed:', error);
      process.exit(1);
    });
}

module.exports = {
  initDatabase,
  testConnection
}; 