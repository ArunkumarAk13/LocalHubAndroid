const express = require('express');
const cors = require('cors');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const morgan = require('morgan');
require('dotenv').config();
const { pool } = require('./db/postgres');
const { logger, stream } = require('./config/logger');
const { queueMiddleware } = require('./middleware/queue');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { initDatabase } = require('./db/init-db');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Import routes
const authRoutes = require('./routes/auth');
const postRoutes = require('./routes/posts');
const userRoutes = require('./routes/users');
const ratingRoutes = require('./routes/ratings');
const chatRoutes = require('./routes/chats');
const healthRoutes = require('./routes/health');

// Import middleware
const { upload, handleUploadError } = require('./middleware/upload');

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      mediaSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: [
        "'self'",
        "https://api.cloudinary.com",
        "https://local-hub-website.vercel.app",
        "https://localhub-web.vercel.app",
        "https://localhub-backend-so0i.onrender.com"
      ]
    }
  },
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" }
}));

// Enable CORS with specific options
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [
        'https://local-hub-website.vercel.app',
        'https://localhub-web.vercel.app',
        process.env.FRONTEND_URL
      ].filter(Boolean)
    : ['http://localhost:3000', 'http://localhost:8080'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400 // 24 hours
}));

// Compression middleware with options
app.use(compression({
  level: 6, // Higher compression level
  threshold: 100 * 1024, // Only compress responses larger than 100kb
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// Rate limiting with different rules for different endpoints
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 requests per windowMs
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

// Apply rate limiting
app.use('/api/auth', authLimiter);
app.use('/api/', generalLimiter);

// Request logging with custom format
app.use(morgan('combined', { 
  stream,
  skip: (req, res) => res.statusCode < 400 // Only log errors
}));

// Body parsing middleware with size limits
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb' 
}));

// Request timing middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// Apply queue middleware to different routes
app.use('/api/posts', queueMiddleware('database'));
app.use('/api/users', queueMiddleware('database'));
app.use('/api/ratings', queueMiddleware('database'));
app.use('/api/upload', queueMiddleware('upload'));

// Ensure upload directory exists
const uploadDir = path.resolve(__dirname, process.env.UPLOAD_DIR || './uploads');
if (!require('fs').existsSync(uploadDir)) {
  require('fs').mkdirSync(uploadDir, { recursive: true });
}

// Serve static files with proper MIME types and caching
app.use('/uploads', express.static(uploadDir, {
  maxAge: '1d',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (filePath.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    } else if (filePath.endsWith('.gif')) {
      res.setHeader('Content-Type', 'image/gif');
    }
  }
}));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/users', userRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/health', healthRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to LocalHub API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      posts: '/api/posts',
      categories: '/api/categories',
      ratings: '/api/ratings',
      chats: '/api/chats',
      health: '/api/health'
    }
  });
});

// Test endpoint
app.get('/api/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ 
      status: 'success', 
      message: 'Database connection working',
      timestamp: result.rows[0].now
    });
  } catch (err) {
    console.error('Database test failed:', err);
    res.status(500).json({ 
      status: 'error', 
      message: 'Database connection failed',
      error: err.message 
    });
  }
});

// Debug route for uploads directory
app.get('/api/debug/uploads', (req, res) => {
  const fs = require('fs');
  fs.readdir(uploadDir, (err, files) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ files });
  });
});

// Error handling middleware
app.use(handleUploadError);
app.use((err, req, res, next) => {
  logger.error('Error:', err);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }
  
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
  
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// Graceful shutdown
const gracefulShutdown = async () => {
  logger.info('Received shutdown signal. Starting graceful shutdown...');
  
  try {
    // Close database pool
    await pool.end();
    logger.info('Database pool closed');
    
    // Close server
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
const server = app.listen(PORT, async () => {
  try {
    // Initialize database
    await initDatabase();
    logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}).on('error', (err) => {
  logger.error('Server error:', err);
  process.exit(1);
});

module.exports = app;
