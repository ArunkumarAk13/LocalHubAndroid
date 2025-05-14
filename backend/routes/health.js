const express = require('express');
const { pool } = require('../db/postgres');
const { logger } = require('../config/logger');

const router = express.Router();

// Health check endpoint
router.get('/', async (req, res) => {
  const healthcheck = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: Date.now()
  };

  try {
    // Check database connection
    const dbResult = await pool.query('SELECT NOW()');
    healthcheck.database = {
      status: 'OK',
      timestamp: dbResult.rows[0].now
    };
  } catch (error) {
    healthcheck.database = {
      status: 'ERROR',
      error: error.message
    };
    logger.error('Database health check failed:', error);
  }

  // Check memory usage
  const memoryUsage = process.memoryUsage();
  healthcheck.memory = {
    rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
    heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`
  };

  // Check CPU usage
  const cpuUsage = process.cpuUsage();
  healthcheck.cpu = {
    user: `${Math.round(cpuUsage.user / 1000)}ms`,
    system: `${Math.round(cpuUsage.system / 1000)}ms`
  };

  // Determine overall status
  const isHealthy = healthcheck.database.status === 'OK';

  res.status(isHealthy ? 200 : 503).json(healthcheck);
});

// Detailed system metrics
router.get('/metrics', async (req, res) => {
  const metrics = {
    timestamp: Date.now(),
    process: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      pid: process.pid,
      version: process.version
    },
    system: {
      platform: process.platform,
      arch: process.arch,
      cpus: require('os').cpus().length,
      totalMemory: require('os').totalmem(),
      freeMemory: require('os').freemem()
    }
  };

  res.json(metrics);
});

module.exports = router; 