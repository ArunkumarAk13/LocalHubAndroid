const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const { createServer } = require('http');
const { router: chatRouter, wss } = require('./routes/chat');
const auth = require('./middleware/auth');

// Import routes
const authRoutes = require('./routes/auth');
const postRoutes = require('./routes/posts');
const userRoutes = require('./routes/users');
const ratingRoutes = require('./routes/ratings');

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 5000;

// CORS configuration
const allowedOrigins = [
  'http://localhost:8080',
  'http://localhost:5173',
  'https://local-hub-website.vercel.app',
  'capacitor://localhost',
  'http://localhost'
];

app.use(cors({
  origin: function(origin, callback) {
    console.log('Request origin:', origin);
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

// WebSocket upgrade handler
server.on('upgrade', (request, socket, head) => {
  // Extract token from query string
  const token = request.url.split('token=')[1];
  if (!token) {
    socket.destroy();
    return;
  }

  // Verify token and get user
  auth.verifyToken(token, (err, user) => {
    if (err) {
      socket.destroy();
      return;
    }

    request.user = user;
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/users', userRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/chats', chatRouter);

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
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Please try a different port.`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
    process.exit(1);
  }
});
