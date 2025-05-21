const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

// Get ratings for a user
router.get('/user/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    const query = `
      SELECT 
        r.id, r.rating, r.comment, r.created_at,
        p.title as post_title,
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

// Get ratings for a post
router.get('/post/:postId', async (req, res, next) => {
  try {
    const { postId } = req.params;
    
    const query = `
      SELECT 
        r.id, r.rating, r.comment, r.created_at,
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

// Create a new rating
router.post('/', auth, async (req, res, next) => {
  try {
    const { postId, rating, comment } = req.body;
    
    if (!postId || !rating) {
      return res.status(400).json({
        success: false,
        message: 'Post ID and rating are required'
      });
    }
    
    // Check if post exists and belongs to another user
    const postCheck = await db.query(
      'SELECT user_id FROM posts WHERE id = $1',
      [postId]
    );
    
    if (postCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }
    
    if (postCheck.rows[0].user_id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot rate your own post'
      });
    }
    
    // Check if user has already rated this post
    const existingRating = await db.query(
      'SELECT id FROM ratings WHERE post_id = $1 AND user_id = $2',
      [postId, req.user.id]
    );
    
    if (existingRating.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You have already rated this post'
      });
    }
    
    // Create rating
    const result = await db.query(
      'INSERT INTO ratings (post_id, user_id, rating, comment) VALUES ($1, $2, $3, $4) RETURNING id',
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
    `, [postCheck.rows[0].user_id]);
    
    res.status(201).json({
      success: true,
      rating: {
        id: result.rows[0].id,
        rating,
        comment,
        created_at: new Date()
      }
    });
  } catch (error) {
    next(error);
  }
});

// Update a rating
router.put('/:id', auth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;
    
    // Check if rating exists and belongs to user
    const ratingCheck = await db.query(
      'SELECT r.*, p.user_id as post_user_id FROM ratings r JOIN posts p ON r.post_id = p.id WHERE r.id = $1',
      [id]
    );
    
    if (ratingCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Rating not found'
      });
    }
    
    if (ratingCheck.rows[0].user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this rating'
      });
    }
    
    // Update rating
    await db.query(
      'UPDATE ratings SET rating = $1, comment = $2 WHERE id = $3',
      [rating, comment, id]
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
    `, [ratingCheck.rows[0].post_user_id]);
    
    res.json({
      success: true,
      message: 'Rating updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Delete a rating
router.delete('/:id', auth, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if rating exists and belongs to user
    const ratingCheck = await db.query(
      'SELECT r.*, p.user_id as post_user_id FROM ratings r JOIN posts p ON r.post_id = p.id WHERE r.id = $1',
      [id]
    );
    
    if (ratingCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Rating not found'
      });
    }
    
    if (ratingCheck.rows[0].user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this rating'
      });
    }
    
    // Delete rating
    await db.query('DELETE FROM ratings WHERE id = $1', [id]);
    
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
    `, [ratingCheck.rows[0].post_user_id]);
    
    res.json({
      success: true,
      message: 'Rating deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router; 