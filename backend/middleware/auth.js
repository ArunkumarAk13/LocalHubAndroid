const jwt = require('jsonwebtoken');
const db = require('../db');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    console.log('Auth middleware received request:', {
      path: req.path,
      method: req.method,
      headers: req.headers,
      body: req.body,
      token: token ? 'present' : 'missing'
    });

    if (!token) {
      console.log('No token provided');
      return res.status(401).json({ message: 'No token provided' });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('Token decoded:', {
        userId: decoded.id,
        email: decoded.email,
        exp: decoded.exp,
        iat: decoded.iat
      });

      // Verify user exists
      const user = await db.oneOrNone('SELECT * FROM users WHERE id = $1', [decoded.id]);
      
      if (!user) {
        console.log('User not found:', decoded.id);
        return res.status(401).json({ message: 'User not found' });
      }

      console.log('User authenticated:', {
        id: user.id,
        email: user.email,
        role: user.role
      });

      req.user = user;
      next();
    } catch (error) {
      console.error('Token verification failed:', error);
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Token expired' });
      }
      return res.status(403).json({ message: 'Invalid token' });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = authenticateToken;
