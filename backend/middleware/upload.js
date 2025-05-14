const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create uploads directory if it doesn't exist
const uploadDir = process.env.UPLOAD_DIR || './uploads';
const avatarDir = path.join(uploadDir, 'avatar');
const postImagesDir = path.join(uploadDir, 'post-images');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log(`Created upload directory: ${uploadDir}`);
}

if (!fs.existsSync(avatarDir)) {
  fs.mkdirSync(avatarDir, { recursive: true });
  console.log(`Created avatar directory: ${avatarDir}`);
}

if (!fs.existsSync(postImagesDir)) {
  fs.mkdirSync(postImagesDir, { recursive: true });
  console.log(`Created post-images directory: ${postImagesDir}`);
}

// Configure storage for avatars
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    console.log(`Storing avatar in: ${avatarDir}`);
    cb(null, avatarDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const filename = `avatar-${uniqueSuffix}${path.extname(file.originalname)}`;
    console.log(`Generated avatar filename: ${filename}`);
    cb(null, filename);
  },
});

// Configure storage for post images
const postImagesStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    console.log(`Storing post image in: ${postImagesDir}`);
    cb(null, postImagesDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const filename = `post-${uniqueSuffix}${path.extname(file.originalname)}`;
    console.log(`Generated post image filename: ${filename}`);
    cb(null, filename);
  },
});

// File filter for images
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    console.log(`Accepted file of type: ${file.mimetype}`);
    cb(null, true);
  } else {
    console.log(`Rejected file of type: ${file.mimetype}`);
    cb(new Error('Only images are allowed'), false);
  }
};

// Configure multer for avatar uploads
const avatarUpload = multer({
  storage: avatarStorage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Configure multer for post image uploads
const upload = multer({
  storage: postImagesStorage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

module.exports = {
  avatarUpload,
  upload,
};
