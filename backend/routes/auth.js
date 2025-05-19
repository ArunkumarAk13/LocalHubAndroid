const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

// Register a new user
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, phoneNumber } = req.body;
    
    // Check if user exists
    const userCheck = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Use default avatar
    const avatar = 'https://media.istockphoto.com/id/1495088043/vector/user-profile-icon-avatar-or-person-icon-profile-picture-portrait-symbol-default-portrait.jpg?s=612x612&w=0&k=20&c=dhV2p1JwmloBTOaGAtaA3AW1KSnjsdMt7-U_3EZElZ0=';
    
    // Insert user into database
    const result = await db.query(
      'INSERT INTO users (name, email, password, avatar, phone_number) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, avatar, phone_number, rating',
      [name, email, hashedPassword, avatar, phoneNumber]
    );
    
    const user = result.rows[0];
    
    // Generate JWT token with numeric ID
    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    res.status(201).json({
      success: true,
      user,
      token
    });
  } catch (error) {
    next(error);
  }
});

// Register with OTP verification (using Firebase)
router.post('/register-with-otp', async (req, res, next) => {
  try {
    const { name, phone_number, password, otp_code, firebase_uid } = req.body;
    
    // Validate required fields
    if (!name || !phone_number || !password || !firebase_uid) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields' 
      });
    }
    
    // Check if user exists by phone number
    const phoneCheck = await db.query('SELECT * FROM users WHERE phone_number = $1', [phone_number]);
    if (phoneCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this phone number'
      });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Use default avatar
    const avatar = 'https://media.istockphoto.com/id/1495088043/vector/user-profile-icon-avatar-or-person-icon-profile-picture-portrait-symbol-default-portrait.jpg?s=612x612&w=0&k=20&c=dhV2p1JwmloBTOaGAtaA3AW1KSnjsdMt7-U_3EZElZ0=';
    
    // First, you might need to add the firebase_uid column to your users table
    // ALTER TABLE users ADD COLUMN firebase_uid VARCHAR(255);
    
    // Insert user into database with firebase_uid
    try {
      const result = await db.query(
        'INSERT INTO users (name, password, avatar, phone_number, firebase_uid, verified) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, avatar, phone_number, rating',
        [name, hashedPassword, avatar, phone_number, firebase_uid, true]
      );
      
      const user = result.rows[0];
      
      // Generate JWT token
      const token = jwt.sign(
        { id: user.id, name: user.name },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );
      
      res.status(201).json({
        success: true,
        message: 'User registered successfully with verified phone',
        user,
        token
      });
    } catch (err) {
      console.error('Database error:', err);
      
      // If there's an error related to missing firebase_uid column
      if (err.message && err.message.includes('firebase_uid')) {
        // Fall back to inserting without firebase_uid
        const result = await db.query(
          'INSERT INTO users (name, password, avatar, phone_number, verified) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, avatar, phone_number, rating',
          [name, hashedPassword, avatar, phone_number, true]
        );
        
        const user = result.rows[0];
        
        // Generate JWT token
        const token = jwt.sign(
          { id: user.id, name: user.name },
          process.env.JWT_SECRET,
          { expiresIn: '30d' }
        );
        
        // Return success response with warning
        res.status(201).json({
          success: true,
          message: 'User registered successfully but firebase_uid column is missing',
          user,
          token
        });
      } else {
        // Rethrow other errors
        throw err;
      }
    }
  } catch (error) {
    console.error('Registration with OTP error:', error);
    next(error);
  }
});

// Login user
router.post('/login', async (req, res, next) => {
  try {
    const { email, password, phone_number } = req.body;
    let user;
    
    // Get user from database - support both email and phone number login
    if (email) {
      const emailResult = await db.query('SELECT * FROM users WHERE email = $1', [email]);
      if (emailResult.rows.length > 0) {
        user = emailResult.rows[0];
      }
    }
    
    // If no user found by email, try phone number
    if (!user && phone_number) {
      const phoneResult = await db.query('SELECT * FROM users WHERE phone_number = $1', [phone_number]);
      if (phoneResult.rows.length > 0) {
        user = phoneResult.rows[0];
      }
    }
    
    // If no user found at all
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid login credentials'
      });
    }
    
    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid login credentials'
      });
    }
    
    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;
    
    // Generate JWT token with numeric ID
    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    res.json({
      success: true,
      user: userWithoutPassword,
      token
    });
  } catch (error) {
    next(error);
  }
});

// Get current user
router.get('/me', auth, async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT id, name, email, avatar, phone_number, rating, created_at, location FROM users WHERE id = $1',
      [req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      user: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
