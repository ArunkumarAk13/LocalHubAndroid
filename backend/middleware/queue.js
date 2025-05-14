const { logger } = require('../config/logger');

class RequestQueue {
  constructor(maxConcurrent = 100) {
    this.queue = [];
    this.processing = 0;
    this.maxConcurrent = maxConcurrent;
  }

  async add(request) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        request,
        resolve,
        reject
      });
      this.process();
    });
  }

  async process() {
    if (this.processing >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    this.processing++;
    const { request, resolve, reject } = this.queue.shift();

    try {
      const result = await request();
      resolve(result);
    } catch (error) {
      logger.error('Request queue error:', error);
      reject(error);
    } finally {
      this.processing--;
      this.process();
    }
  }
}

// Create queue instances for different types of requests
const queues = {
  general: new RequestQueue(100),
  upload: new RequestQueue(20),
  database: new RequestQueue(50)
};

// Queue middleware factory
const queueMiddleware = (queueType = 'general') => {
  return async (req, res, next) => {
    const queue = queues[queueType];
    if (!queue) {
      return next();
    }

    try {
      await queue.add(() => {
        return new Promise((resolve, reject) => {
          res.on('finish', () => {
            resolve();
          });
          res.on('error', (error) => {
            reject(error);
          });
          next();
        });
      });
    } catch (error) {
      logger.error('Queue middleware error:', error);
      res.status(503).json({
        success: false,
        message: 'Service temporarily unavailable'
      });
    }
  };
};

module.exports = {
  queueMiddleware,
  queues
}; 