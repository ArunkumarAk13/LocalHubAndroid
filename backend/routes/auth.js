const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
const auth = require('../middleware/auth');
const { Pool } = require('pg');
const { sendOTPEmail } = require('../services/brevoService');

const router = express.Router();

// Initialize PostgreSQL connection
const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: {
        rejectUnauthorized: false
    }
});

// Store pending verifications (in production, use Redis or similar)
const pendingVerifications = new Map();

// Generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send Email OTP
router.post('/send-email-otp', async (req, res) => {
  try {
    const { email, name, phoneNumber, password } = req.body;

    if (!email || !name || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email, name, and password are required'
      });
    }

    // Check if email already exists
    const userCheck = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Check if phone number already exists
    if (phoneNumber) {
      const phoneCheck = await db.query('SELECT * FROM users WHERE phone_number = $1', [phoneNumber]);
      if (phoneCheck.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Phone number already registered'
        });
      }
    }

    // Generate OTP
    const otp = generateOTP();
    console.log('Generated OTP for', email, ':', otp);
    
    // Store verification data with expiry
    pendingVerifications.set(email, {
      otp,
      name,
      phoneNumber,
      password,
      expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes expiry
    });

    try {
      // Send OTP email
      await sendOTPEmail(email, otp);

      res.json({
        success: true,
        message: 'Verification code sent to your email'
      });
    } catch (emailError) {
      console.error('Error in sendOTPEmail:', emailError);
      
      // Clear the pending verification since email failed
      pendingVerifications.delete(email);
      
      // Check for specific error types
      if (emailError.message === 'BREVO_API_KEY is not configured' || 
          emailError.message === 'BREVO_SENDER_EMAIL is not configured') {
        return res.status(500).json({
          success: false,
          message: 'Email service is not properly configured'
        });
      }
      
      // Handle other email sending errors
      res.status(500).json({
        success: false,
        message: 'Failed to send verification code. Please try again later.'
      });
    }
  } catch (error) {
    console.error('Error in /send-email-otp route:', error);
    res.status(500).json({
      success: false,
      message: 'An unexpected error occurred'
    });
  }
});

// Verify Email OTP and Complete Registration
router.post('/verify-email-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    const verificationData = pendingVerifications.get(email);
    if (!verificationData) {
      return res.status(400).json({
        success: false,
        message: 'No verification pending for this email'
      });
    }

    if (Date.now() > verificationData.expiresAt) {
      pendingVerifications.delete(email);
      return res.status(400).json({
        success: false,
        message: 'Verification code expired'
      });
    }

    if (verificationData.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification code'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(verificationData.password, salt);
    
    // Use default avatar
    const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(verificationData.name)}&background=random`;
    
    // Insert user into database
    const result = await db.query(
      'INSERT INTO users (name, email, phone_number, password, avatar, verified) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, phone_number, avatar, rating',
      [verificationData.name, email, verificationData.phoneNumber, hashedPassword, avatar, true]
    );
    
    const user = result.rows[0];
    
    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Clear verification data
    pendingVerifications.delete(email);
    
    res.status(201).json({
      success: true,
      message: 'Registration successful',
      user,
      token
    });
  } catch (error) {
    console.error('Error verifying email OTP:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed'
    });
  }
});

// Register a new user
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, phoneNumber, password } = req.body;
    
    // Check if user exists with email
    const userCheckEmail = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userCheckEmail.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Check if user exists with phone number
    const userCheckPhone = await db.query('SELECT * FROM users WHERE phone_number = $1', [phoneNumber]);
    if (userCheckPhone.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this phone number'
      });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Use default avatar
    const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
    
    // Insert user into database with both email and phone number
    const result = await db.query(
      'INSERT INTO users (name, email, phone_number, password, avatar) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, phone_number, avatar, rating',
      [name, email, phoneNumber, hashedPassword, avatar]
    );
    
    const user = result.rows[0];
    
    // Generate JWT token
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

// Login user
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }
    
    // Get user from database
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    
    // If no user found
    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid login credentials'
      });
    }
    
    const user = result.rows[0];
    
    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid login credentials'
      });
    }
    
    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;
    
    // Generate JWT token
    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
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
      'SELECT id, name, email, avatar, phone_number, rating, created_at FROM users WHERE id = $1',
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

// Test database connection
router.get('/api/test-db', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({
            success: true,
            message: 'Database connection successful',
            timestamp: result.rows[0].now
        });
    } catch (error) {
        console.error('Database connection error:', error);
        res.status(500).json({
            success: false,
            error: 'Database connection failed',
            details: error.message
        });
    }
});

module.exports = router;
