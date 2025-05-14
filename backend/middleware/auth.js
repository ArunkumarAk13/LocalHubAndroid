const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      console.log('No token provided in request');
      return res.status(401).json({
        success: false,
        message: 'No authentication token, authorization denied'
      });
    }

    // Log the token for debugging (remove in production)
    console.log('Received token:', token);

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Decoded token payload:', decoded);

    // Ensure user ID exists
    if (!decoded.id) {
      console.log('No user ID in token payload:', decoded);
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID in token'
      });
    }

    // Convert ID to number and validate
    const userId = parseInt(decoded.id, 10);
    
    if (isNaN(userId)) {
      console.log('Invalid user ID format:', decoded.id);
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    // Set user in request
    req.user = {
      ...decoded,
      id: userId
    };
    
    console.log('Authenticated user:', req.user);
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token format'
      });
    }
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired'
      });
    }
    res.status(401).json({
      success: false,
      message: 'Token is not valid'
    });
  }
};
