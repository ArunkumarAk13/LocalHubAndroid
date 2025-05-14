const express = require('express');
const cors = require('cors');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
require('dotenv').config();
const { pool } = require('./db/postgres');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Initialize Database
async function initializeDatabase() {
  const client = await pool.connect();
  try {
    // Start transaction
    await client.query('BEGIN');

    // Grant necessary permissions first
    await client.query('GRANT ALL ON SCHEMA public TO current_user');
    await client.query('GRANT ALL ON ALL TABLES IN SCHEMA public TO current_user');
    await client.query('GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO current_user');

    // Read and execute the schema file
    const schemaPath = path.join(__dirname, 'db', 'schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('Creating database schema...');
    await client.query(schemaSQL);
    
    // Commit transaction
    await client.query('COMMIT');
    console.log('Database initialization completed successfully');
  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    console.error('Database initialization failed:', error);
    // Don't throw error, just log it
  } finally {
    client.release();
  }
}

// Import routes
const authRoutes = require('./routes/auth');
const postRoutes = require('./routes/posts');
const userRoutes = require('./routes/users');
const ratingRoutes = require('./routes/ratings');
const chatRoutes = require('./routes/chat');

const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration
const allowedOrigins = [
  'http://localhost:8080',
  'http://localhost:5173',
  'https://local-hub-app.vercel.app',
  'capacitor://localhost',
  'http://localhost',
  'https://localhubandroid.onrender.com'
];

app.use(cors({
  origin: function(origin, callback) {
    console.log('Request origin:', origin);
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      console.log('No origin, allowing request');
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      console.log('Origin allowed:', origin);
      callback(null, true);
    } else {
      console.log('Origin not allowed:', origin);
      console.log('Allowed origins:', allowedOrigins);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Add logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  console.log('Headers:', req.headers);
  next();
});

app.use(express.json());

// Ensure upload directory path is correct and accessible
const uploadDir = path.resolve(__dirname, process.env.UPLOAD_DIR || './uploads');
console.log('Upload directory path:', uploadDir);

// Serve static files from uploads directory with proper MIME types
app.use('/uploads', express.static(uploadDir, {
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

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/users', userRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/chats', chatRoutes);

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
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server with error handling
const server = app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  // Initialize database after server starts
  await initializeDatabase();
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Please try a different port.`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
    process.exit(1);
  }
});
