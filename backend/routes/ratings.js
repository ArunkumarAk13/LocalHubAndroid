
const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

// Add rating to a post
router.post('/', auth, async (req, res, next) => {
  const client = await db.query('BEGIN');
  
  try {
    const { postId, rating, comment } = req.body;
    
    if (!postId || !rating) {
      return res.status(400).json({
        success: false,
        message: 'Post ID and rating are required'
      });
    }
    
    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }
    
    // Check if post exists
    const postResult = await db.query(
      'SELECT p.id, p.user_id FROM posts p WHERE p.id = $1',
      [postId]
    );
    
    if (postResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }
    
    const post = postResult.rows[0];
    
    // Check if user is trying to rate their own post
    if (post.user_id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot rate your own post'
      });
    }
    
    // Check if user has already rated this post
    const existingRating = await db.query(
      'SELECT * FROM ratings WHERE post_id = $1 AND user_id = $2',
      [postId, req.user.id]
    );
    
    if (existingRating.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You have already rated this post'
      });
    }
    
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
        FROM posts p
        JOIN ratings r ON p.id = r.post_id
        WHERE p.user_id = $1
      )
      WHERE id = $1
    `, [post.user_id]);
    
    await db.query('COMMIT');
    
    // Get updated user rating
    const updatedUser = await db.query(
      'SELECT rating FROM users WHERE id = $1',
      [post.user_id]
    );
    
    res.status(201).json({
      success: true,
      message: 'Rating added successfully',
      userRating: updatedUser.rows[0].rating
    });
  } catch (error) {
    await db.query('ROLLBACK');
    next(error);
  }
});

// Get ratings for a post
router.get('/post/:postId', async (req, res, next) => {
  try {
    const { postId } = req.params;
    
    const result = await db.query(`
      SELECT 
        r.id, r.rating, r.comment, r.created_at,
        json_build_object(
          'id', u.id,
          'name', u.name,
          'avatar', u.avatar
        ) AS user
      FROM 
        ratings r
      JOIN 
        users u ON r.user_id = u.id
      WHERE 
        r.post_id = $1
      ORDER BY 
        r.created_at DESC
    `, [postId]);
    
    res.json({
      success: true,
      ratings: result.rows
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
