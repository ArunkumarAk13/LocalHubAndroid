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

// Generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send Email OTP
router.post('/send-email-otp', async (req, res) => {
  console.log('Received send-email-otp request:', {
    body: {
      email: req.body.email,
      name: req.body.name,
      phoneNumber: req.body.phoneNumber ? 'provided' : 'not provided'
    },
    headers: req.headers,
    brevoConfig: {
      hasApiKey: !!process.env.BREVO_API_KEY,
      apiKeyFormat: process.env.BREVO_API_KEY?.startsWith('xkeysib-') ? 'valid' : 'invalid',
      hasBrevoSender: !!process.env.BREVO_SENDER_EMAIL,
      senderEmailValid: process.env.BREVO_SENDER_EMAIL?.includes('@')
    }
  });

  try {
    const { email, name, phoneNumber, password } = req.body;

    if (!email || !name || !password) {
      console.log('Missing required fields:', {
        hasEmail: !!email,
        hasName: !!name,
        hasPassword: !!password
      });
      return res.status(400).json({
        success: false,
        message: 'Email, name, and password are required'
      });
    }

    // Check if email already exists
    console.log('Checking if email exists:', email);
    const userCheck = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userCheck.rows.length > 0) {
      console.log('Email already registered:', email);
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Check if phone number already exists
    if (phoneNumber) {
      console.log('Checking if phone number exists:', phoneNumber);
      const phoneCheck = await db.query('SELECT * FROM users WHERE phone_number = $1', [phoneNumber]);
      if (phoneCheck.rows.length > 0) {
        console.log('Phone number already registered:', phoneNumber);
        return res.status(400).json({
          success: false,
          message: 'Phone number already registered'
        });
      }
    }

    // Generate OTP
    const otp = generateOTP();
    console.log('Generated OTP for', email);
    
    // Store verification data with expiry in the database
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry
    await db.query(`
      INSERT INTO pending_verifications (email, otp, name, phone_number, password, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (email) DO UPDATE SET
        otp = EXCLUDED.otp,
        name = EXCLUDED.name,
        phone_number = EXCLUDED.phone_number,
        password = EXCLUDED.password,
        expires_at = EXCLUDED.expires_at
    `, [email, otp, name, phoneNumber, password, expiresAt]);

    console.log('Stored verification data for:', email);

    try {
      // Send OTP email
      console.log('Attempting to send OTP email to:', email);
      await sendOTPEmail(email, otp);
      console.log('Successfully sent OTP email to:', email);

      res.json({
        success: true,
        message: 'Verification code sent to your email'
      });
    } catch (emailError) {
      console.error('Error in sendOTPEmail:', {
        error: emailError,
        message: emailError.message,
        code: emailError.code,
        stack: emailError.stack
      });
      
      // Handle specific error codes
      switch (emailError.code) {
        case 'MISSING_API_KEY':
          return res.status(500).json({
            success: false,
            message: 'Email service is not configured. Please contact support.',
            code: emailError.code
          });

        case 'INVALID_API_KEY':
        case 'INVALID_API_KEY_FORMAT':
          return res.status(500).json({
            success: false,
            message: 'Email service authentication failed. Please contact support.',
            code: emailError.code
          });
          
        case 'MISSING_SENDER_EMAIL':
          return res.status(500).json({
            success: false,
            message: 'Email service configuration error. Please contact support.',
            code: emailError.code
          });
          
        case 'API_INIT_ERROR':
          return res.status(500).json({
            success: false,
            message: 'Email service initialization failed. Please contact support.',
            code: emailError.code
          });
          
        case 'NETWORK_ERROR':
          return res.status(503).json({
            success: false,
            message: 'Unable to connect to email service. Please try again later.',
            code: emailError.code
          });
          
        default:
          return res.status(500).json({
            success: false,
            message: 'Failed to send verification code. Please try again later.',
            code: emailError.code || 'UNKNOWN_ERROR'
          });
      }
    }
  } catch (error) {
    console.error('Error in /send-email-otp route:', {
      error: error,
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      message: 'An unexpected error occurred',
      code: error.code || 'UNKNOWN_ERROR'
    });
  }
});

// Verify Email OTP and Complete Registration
router.post('/verify-email-otp', async (req, res) => {
  console.log('Received verify-email-otp request:', {
    body: {
      email: req.body.email,
      otpLength: req.body.otp?.length
    },
    headers: req.headers
  });

  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      console.log('Missing required fields:', {
        hasEmail: !!email,
        hasOTP: !!otp
      });
      return res.status(400).json({
        success: false,
        message: 'Email and verification code are required'
      });
    }

    console.log('Checking verification data for email:', email);
    const result = await db.query(
      'SELECT * FROM pending_verifications WHERE email = $1',
      [email]
    );
    const verificationData = result.rows[0];
    
    if (!verificationData) {
      console.log('No verification data found for email:', email);
      return res.status(400).json({
        success: false,
        message: 'No verification pending for this email'
      });
    }

    console.log('Verification data found:', {
      email,
      hasOTP: !!verificationData.otp,
      expiresAt: new Date(verificationData.expires_at).toISOString(),
      isExpired: Date.now() > new Date(verificationData.expires_at).getTime(),
      otpMatch: verificationData.otp === otp
    });

    if (Date.now() > new Date(verificationData.expires_at).getTime()) {
      console.log('Verification code expired for email:', email);
      await db.query('DELETE FROM pending_verifications WHERE email = $1', [email]);
      return res.status(400).json({
        success: false,
        message: 'Verification code expired'
      });
    }

    if (verificationData.otp !== otp) {
      console.log('Invalid verification code for email:', email);
      return res.status(400).json({
        success: false,
        message: 'Invalid verification code'
      });
    }

    // Hash password
    console.log('Hashing password for user:', email);
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(verificationData.password, salt);
    
    // Use default avatar
    const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(verificationData.name)}&background=random`;
    
    // Insert user into database
    console.log('Inserting new user into database:', {
      email,
      name: verificationData.name,
      hasPhoneNumber: !!verificationData.phone_number
    });

    try {
      const result = await db.query(
        'INSERT INTO users (name, email, phone_number, password, avatar, verified) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, phone_number, avatar, rating',
        [verificationData.name, email, verificationData.phone_number, hashedPassword, avatar, true]
      );
      
      const user = result.rows[0];
      console.log('Successfully created user:', {
        userId: user.id,
        email: user.email
      });
      
      // Generate JWT token
      console.log('Generating JWT token for user:', user.id);
      const token = jwt.sign(
        { id: user.id, name: user.name, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );

      // Clear verification data from the database
      await db.query('DELETE FROM pending_verifications WHERE email = $1', [email]);
      
      res.status(201).json({
        success: true,
        message: 'Registration successful',
        user,
        token
      });
    } catch (dbError) {
      console.error('Database error during user creation:', {
        error: dbError,
        message: dbError.message,
        code: dbError.code,
        constraint: dbError.constraint
      });

      // Handle specific database errors
      if (dbError.code === '23505') { // unique_violation
        if (dbError.constraint === 'users_email_key') {
          return res.status(400).json({
            success: false,
            message: 'Email already registered'
          });
        }
        if (dbError.constraint === 'users_phone_number_key') {
          return res.status(400).json({
            success: false,
            message: 'Phone number already registered'
          });
        }
      }

      throw dbError; // Re-throw for general error handling
    }
  } catch (error) {
    console.error('Error in /verify-email-otp route:', {
      error: error,
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      message: 'Registration failed. Please try again.'
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
