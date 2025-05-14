const multer = require('multer');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');

// Create uploads directory if it doesn't exist
const uploadDir = process.env.UPLOAD_DIR || './uploads';
const avatarDir = path.join(uploadDir, 'avatar');
const postImagesDir = path.join(uploadDir, 'post-images');

// Ensure directories exist
[uploadDir, avatarDir, postImagesDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
});

// File type validation
const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const fileFilter = (req, file, cb) => {
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`), false);
  }
};

// Generate unique filename
const generateUniqueFilename = (originalname) => {
  const timestamp = Date.now();
  const uniqueId = uuidv4();
  const ext = path.extname(originalname);
  return `${timestamp}-${uniqueId}${ext}`;
};

// Configure storage for avatars
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, avatarDir);
  },
  filename: (req, file, cb) => {
    cb(null, `avatar-${generateUniqueFilename(file.originalname)}`);
  }
});

// Configure storage for post images
const postImagesStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, postImagesDir);
  },
  filename: (req, file, cb) => {
    cb(null, `post-${generateUniqueFilename(file.originalname)}`);
  }
});

// Rate limiting for file uploads
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 uploads per windowMs
  message: 'Too many uploads from this IP, please try again later'
});

// Configure multer for avatar uploads with error handling
const avatarUpload = multer({
  storage: avatarStorage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1 // Only one file at a time
  }
}).single('avatar');

// Configure multer for post image uploads with error handling
const upload = multer({
  storage: postImagesStorage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 5 // Maximum 5 files
  }
}).array('images', 5);

// Error handling middleware for multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size too large. Maximum size is 5MB'
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files uploaded'
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }
  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }
  next();
};

module.exports = {
  avatarUpload,
  upload,
  uploadLimiter,
  handleMulterError
};
