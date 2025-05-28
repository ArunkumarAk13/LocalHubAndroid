const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
const auth = require('../middleware/auth');
const twilio = require('twilio');
const { Pool } = require('pg');
const twilioService = require('../services/twilioService');

const router = express.Router();

// Initialize Twilio client
const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

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

// Store verified phone numbers (in production, use Redis or similar)
const verifiedPhones = new Map();

// Store pending registrations (in production, use Redis or similar)
const pendingRegistrations = new Map();

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

// Register with OTP verification
router.post('/register-with-otp', async (req, res) => {
  try {
    console.log('[Backend] Registration request received:', JSON.stringify(req.body, null, 2));
    const { name, phone_number, password } = req.body;

    // Validate required fields
    if (!name || !phone_number || !password) {
      console.log('[Backend] Missing required fields:', { name: !!name, phone_number: !!phone_number, password: !!password });
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Format phone number
    const formattedNumber = phone_number.startsWith('+') ? phone_number : `+91${phone_number}`;
    console.log('[Backend] Formatted phone number:', formattedNumber);

    // Check if phone number is verified
    const verificationStatus = verifiedPhones.get(formattedNumber);
    console.log('[Backend] Verification status:', JSON.stringify(verificationStatus, null, 2));

    if (!verificationStatus || !verificationStatus.verified || Date.now() > verificationStatus.expiresAt) {
      console.log('[Backend] Phone number not verified or verification expired');
      return res.status(400).json({
        success: false,
        message: 'Phone number not verified or verification expired. Please verify your phone number again.'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate default avatar
    const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;

    // Insert user into database
    console.log('[Backend] Inserting user into database:', { name, phone_number: formattedNumber });
    const result = await pool.query(
      'INSERT INTO users (name, password, avatar, phone_number, verified) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, avatar, phone_number, rating',
      [name, hashedPassword, avatar, formattedNumber, true]
    );

    const user = result.rows[0];
    console.log('[Backend] User created successfully:', JSON.stringify(user, null, 2));

    // Remove the verified phone number from storage
    verifiedPhones.delete(formattedNumber);

    // Generate JWT token with 'id' instead of 'userId'
    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const response = {
      success: true,
      message: 'User registered successfully',
      user: {
        id: user.id,
        name: user.name,
        phone_number: user.phone_number,
        avatar: user.avatar,
        rating: user.rating
      },
      token
    };
    console.log('[Backend] Registration response:', JSON.stringify(response, null, 2));
    res.json(response);
  } catch (err) {
    console.error('[Backend] Registration error:', err);
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: err.message
    });
  }
});

// Login user
router.post('/login', async (req, res, next) => {
  try {
    const { phone_number } = req.body;
    
    if (!phone_number) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    // Format phone number to E.164 format
    const formattedNumber = phone_number.startsWith('+') ? phone_number : `+91${phone_number}`;
    
    // Get user from database
    const result = await db.query('SELECT * FROM users WHERE phone_number = $1', [formattedNumber]);
    
    // If no user found
    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid login credentials'
      });
    }
    
    const user = result.rows[0];
    
    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;
    
    // Generate JWT token with 'id' instead of 'userId'
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

// Get Twilio config
router.get('/api/twilio/config', async (req, res) => {
    try {
        res.json({
            accountSid: process.env.TWILIO_ACCOUNT_SID,
            authToken: process.env.TWILIO_AUTH_TOKEN,
            verifyServiceSid: process.env.TWILIO_VERIFY_SERVICE_SID
        });
    } catch (error) {
        console.error('Error getting Twilio config:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Send OTP
router.post('/send-otp', async (req, res) => {
  try {
    console.log('[Backend] OTP request received:', JSON.stringify(req.body, null, 2));
    const { phoneNumber, name, password, confirmPassword } = req.body;
    
    // Validate phone number
    if (!phoneNumber) {
      console.log('[Backend] Missing phone number');
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    // Format phone number to E.164 format if not already formatted
    const formattedNumber = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
    console.log('[Backend] Formatted phone number:', formattedNumber);

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE phone_number = $1',
      [formattedNumber]
    );

    if (existingUser.rows.length > 0) {
      console.log('[Backend] User already exists with this phone number');
      return res.status(400).json({
        success: false,
        message: 'User already exists with this phone number'
      });
    }

    // Validate other fields if provided
    if (name || password || confirmPassword) {
      if (!name || !password || !confirmPassword) {
        console.log('[Backend] Missing registration fields:', { 
          name: !!name, 
          password: !!password, 
          confirmPassword: !!confirmPassword 
        });
        return res.status(400).json({
          success: false,
          message: 'All registration fields (name, password, confirmPassword) are required'
        });
      }

      if (password !== confirmPassword) {
        console.log('[Backend] Passwords do not match');
        return res.status(400).json({
          success: false,
          message: 'Passwords do not match'
        });
      }

      if (password.length < 6) {
        console.log('[Backend] Password too short');
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters long'
        });
      }
    }
    
    // Send verification code
    console.log('[Backend] Sending verification code to:', formattedNumber);
    const verification = await twilioClient.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verifications.create({ to: formattedNumber, channel: 'sms' });

    console.log('[Backend] Twilio verification response:', JSON.stringify(verification, null, 2));

    // Store the pending registration if registration data was provided
    if (name && password) {
      pendingRegistrations.set(formattedNumber, {
        name,
        password,
        expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
      });
    }

    const response = { 
      success: true,
      message: 'OTP sent successfully',
      verification
    };
    console.log('[Backend] OTP response:', JSON.stringify(response, null, 2));
    res.json(response);
  } catch (error) {
    console.error('[Backend] Error sending OTP:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to send OTP',
      error: error.message
    });
  }
});

// Verify OTP and complete registration
router.post('/verify-otp', async (req, res) => {
  try {
    console.log('[Backend] OTP verification request received:', JSON.stringify(req.body, null, 2));
    const { phoneNumber, code, name, password } = req.body;
    
    // Format phone number to E.164 format
    const formattedNumber = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
    console.log('[Backend] Formatted phone number:', formattedNumber);
    
    // Verify the code
    console.log('[Backend] Verifying code with Twilio');
    const verificationCheck = await twilioClient.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verificationChecks.create({ to: formattedNumber, code });

    console.log('[Backend] Twilio verification check response:', JSON.stringify(verificationCheck, null, 2));

    if (verificationCheck.status === 'approved') {
      // Get pending registration or use provided registration data
      let registration = pendingRegistrations.get(formattedNumber);
      
      // If no pending registration but registration data provided in request
      if (!registration && name && password) {
        registration = {
          name,
          password,
          expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
        };
      }

      console.log('[Backend] Registration data:', JSON.stringify(registration, null, 2));

      if (!registration || Date.now() > registration.expiresAt) {
        console.log('[Backend] Registration session expired or missing registration data');
        return res.status(400).json({
          success: false,
          message: 'Registration session expired or missing registration data. Please start again.'
        });
      }

      // Check if user already exists
      console.log('[Backend] Checking for existing user');
      const existingUser = await pool.query(
        'SELECT * FROM users WHERE phone_number = $1',
        [formattedNumber]
      );

      if (existingUser.rows.length > 0) {
        console.log('[Backend] User already exists');
        return res.status(400).json({
          success: false,
          message: 'User already exists with this phone number'
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(registration.password, 10);

      // Generate default avatar
      const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(registration.name)}&background=random`;
      
      // Create new user
      console.log('[Backend] Creating new user');
      const result = await pool.query(
        'INSERT INTO users (name, password, avatar, phone_number, verified) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, phone_number, avatar, rating',
        [registration.name, hashedPassword, avatar, formattedNumber, true]
      );

      const user = result.rows[0];
      console.log('[Backend] User created:', JSON.stringify(user, null, 2));

      // Remove pending registration
      pendingRegistrations.delete(formattedNumber);

      // Generate JWT token with 'id' instead of 'userId'
      const token = jwt.sign(
        { id: user.id },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      const response = {
        success: true,
        message: 'Registration successful',
        user: {
          id: user.id,
          name: user.name,
          phone_number: user.phone_number,
          avatar: user.avatar,
          rating: user.rating
        },
        token
      };
      console.log('[Backend] Verification response:', JSON.stringify(response, null, 2));
      res.json(response);
    } else {
      console.log('[Backend] Invalid verification code');
      res.status(400).json({ 
        success: false, 
        error: 'Invalid verification code',
        status: verificationCheck.status
      });
    }
  } catch (error) {
    console.error('[Backend] Error verifying OTP:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to verify OTP',
      details: error.message 
    });
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
