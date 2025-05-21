const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

// Get ratings for a post
router.get('/post/:postId', async (req, res, next) => {
  try {
    const { postId } = req.params;
    
    const query = `
      SELECT 
        r.id,
        r.rating,
        r.comment,
        r.created_at,
        json_build_object(
          'id', u.id,
          'name', u.name,
          'avatar', u.avatar
        ) as rated_by
      FROM 
        ratings r
      JOIN 
        users u ON r.user_id = u.id
      WHERE 
        r.post_id = $1
      ORDER BY 
        r.created_at DESC
    `;
    
    const result = await db.query(query, [postId]);
    
    res.json({
      success: true,
      ratings: result.rows
    });
  } catch (error) {
    next(error);
  }
});

// Get ratings for a user
router.get('/user/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    const query = `
      SELECT 
        r.id,
        r.rating,
        r.comment,
        r.created_at,
        json_build_object(
          'id', p.id,
          'title', p.title
        ) as post,
        json_build_object(
          'id', u.id,
          'name', u.name,
          'avatar', u.avatar
        ) as rated_by
      FROM 
        ratings r
      JOIN 
        posts p ON r.post_id = p.id
      JOIN 
        users u ON r.user_id = u.id
      WHERE 
        p.user_id = $1
      ORDER BY 
        r.created_at DESC
    `;
    
    const result = await db.query(query, [userId]);
    
    res.json({
      success: true,
      ratings: result.rows
    });
  } catch (error) {
    next(error);
  }
});

// Add a rating (protected route)
router.post('/', auth, async (req, res, next) => {
  try {
    const { postId, rating, comment } = req.body;
    
    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }
    
    // Check if post exists
    const postResult = await db.query(
      'SELECT * FROM posts WHERE id = $1',
      [postId]
    );
    
    if (postResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }
    
    // Start transaction
    await db.query('BEGIN');
    
    try {
      // Add rating
      await db.query(
        'INSERT INTO ratings (post_id, user_id, rating, comment) VALUES ($1, $2, $3, $4)',
        [postId, req.user.id, rating, comment]
      );
      
      // Update user's average rating
      await db.query(`
        UPDATE users 
        SET rating = (
          SELECT COALESCE(ROUND(AVG(r.rating)::numeric, 1), 0)
          FROM ratings r
          JOIN posts p ON r.post_id = p.id
          WHERE p.user_id = $1
        )
        WHERE id = $1
      `, [postResult.rows[0].user_id]);
      
      await db.query('COMMIT');
      
      res.json({
        success: true,
        message: 'Rating added successfully'
      });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router; 