const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const cluster = require('cluster');
const os = require('os');

const numCPUs = os.cpus().length;

if (cluster.isMaster) {
  console.log(`Master ${process.pid} is running`);

  // Fork workers.
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`worker ${worker.process.pid} died`);
    console.log("Let's fork another worker!");
    cluster.fork();
  });

} else {
  // Import routes
  const authRoutes = require('./routes/auth');
  const postRoutes = require('./routes/posts');
  const userRoutes = require('./routes/users');
  const ratingRoutes = require('./routes/ratings');
  const chatRoutes = require('./routes/chat');

  const app = express();
  const PORT = process.env.PORT || 3000;

  // CORS configuration
  const corsOptions = {
    origin: [
    'http://localhost:5173',
      'http://localhost',
      'https://localhost',
    'capacitor://localhost',
      'http://localhost:8100',
      'https://localhub-frontend.onrender.com'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 200
  };

  // Apply CORS middleware
  app.use(cors(corsOptions));

  // Add logging middleware
  app.use((req, res, next) => {
    console.log(`Worker ${process.pid}: ${req.method} ${req.url}`);
    console.log('Headers:', req.headers);
    next();
  });

  // Body parser middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

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
    console.error(`Worker ${process.pid} Error:`, err);
    res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Internal server error'
    });
  });

  // Start server with error handling
  const server = app.listen(PORT, () => {
    console.log(`Worker ${process.pid} started, listening on port ${PORT}`);
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use on worker ${process.pid}.`);
      // The master will handle respawning, so just exit gracefully
      process.exit(1); 
    } else {
      console.error(`Worker ${process.pid} server error:`, err);
      process.exit(1);
    }
  });
}
