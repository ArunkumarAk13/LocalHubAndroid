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

// Register with OTP verification (using Twilio)
router.post('/register-with-otp', async (req, res) => {
  try {
    const { name, phone_number, password, otp_code } = req.body;

    // Validate required fields
    if (!name || !phone_number || !password || !otp_code) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Verify OTP first
    const verifyResponse = await twilioService.verifyOTP(phone_number, otp_code);
    if (!verifyResponse.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP code'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate default avatar
    const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;

    // Insert user into database
    const result = await pool.query(
      'INSERT INTO users (name, password, avatar, phone_number, verified) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, avatar, phone_number, rating',
      [name, hashedPassword, avatar, phone_number, true]
    );

    const user = result.rows[0];

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
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
    });
  } catch (err) {
    console.error('Registration with OTP error:', err);
    res.status(500).json({
      success: false,
      message: 'Registration failed'
    });
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
        const { phoneNumber } = req.body;
        
        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                message: 'Phone number is required'
            });
        }

        console.log('[Backend] Received OTP request for:', phoneNumber);
        
        // Format phone number to E.164 format if not already formatted
        const formattedNumber = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
        console.log('[Backend] Formatted phone number:', formattedNumber);
        
        // Send verification code
        const verification = await twilioClient.verify.v2
            .services(process.env.TWILIO_VERIFY_SERVICE_SID)
            .verifications.create({ to: formattedNumber, channel: 'sms' });

        console.log('[Backend] Twilio verification response:', verification);

        res.json({ 
            success: true,
            message: 'OTP sent successfully',
            verification
        });
    } catch (error) {
        console.error('[Backend] Error sending OTP:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to send OTP'
        });
    }
});

// Verify OTP
router.post('/verify-otp', async (req, res) => {
    try {
        const { phoneNumber, code, password, confirmPassword } = req.body;
        
        // Validate password if provided (for new user registration)
        if (password || confirmPassword) {
            if (!password || !confirmPassword) {
                return res.status(400).json({
                    success: false,
                    error: 'Both password and confirm password are required'
                });
            }
            if (password !== confirmPassword) {
                return res.status(400).json({
                    success: false,
                    error: 'Passwords do not match'
                });
            }
            if (password.length < 6) {
                return res.status(400).json({
                    success: false,
                    error: 'Password must be at least 6 characters long'
                });
            }
        }
        
        // Format phone number to E.164 format
        const formattedNumber = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
        
        // Verify the code
        const verificationCheck = await twilioClient.verify.v2
            .services(process.env.TWILIO_VERIFY_SERVICE_SID)
            .verificationChecks.create({ to: formattedNumber, code });

        if (verificationCheck.status === 'approved') {
            // Check if user exists
            const userResult = await pool.query(
                'SELECT * FROM users WHERE phone_number = $1',
                [formattedNumber]
            );

            if (userResult.rows.length === 0) {
                // For new user registration, password is required
                if (!password) {
                    return res.status(400).json({
                        success: false,
                        error: 'Password is required for new user registration'
                    });
                }

                // Generate a default name using the last 4 digits of the phone number
                const defaultName = `User${formattedNumber.slice(-4)}`;
                const defaultAvatar = 'https://media.istockphoto.com/id/1495088043/vector/user-profile-icon-avatar-or-person-icon-profile-picture-portrait-symbol-default-portrait.jpg?s=612x612&w=0&k=20&c=dhV2p1JwmloBTOaGAtaA3AW1KSnjsdMt7-U_3EZElZ0=';
                
                // Hash the provided password
                const hashedPassword = await bcrypt.hash(password, 10);
                
                // Create new user with default name, avatar and provided password
                await pool.query(
                    'INSERT INTO users (name, phone_number, avatar, password, created_at) VALUES ($1, $2, $3, $4, NOW())',
                    [defaultName, formattedNumber, defaultAvatar, hashedPassword]
                );
            }

            res.json({ 
                success: true, 
                message: 'Phone number verified successfully',
                isNewUser: userResult.rows.length === 0
            });
        } else {
            res.status(400).json({ 
                success: false, 
                error: 'Invalid verification code' 
            });
        }
    } catch (error) {
        console.error('Error verifying OTP:', error);
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
