const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const { upload, uploadLimiter, handleUploadError } = require('../middleware/upload');
const { validatePost } = require('../middleware/validation');
const { validationResult } = require('express-validator');
const cloudinary = require('cloudinary');

const router = express.Router();

// Get all posts with filters and pagination
router.get('/', async (req, res, next) => {
  try {
    const { 
      category, 
      search, 
      limit = 20, 
      offset = 0,
      sort = 'created_at',
      order = 'DESC'
    } = req.query;
    
    // Validate pagination parameters
    const validatedLimit = Math.min(Math.max(parseInt(limit), 1), 50);
    const validatedOffset = Math.max(parseInt(offset), 0);
    
    // Validate sort parameters
    const allowedSortFields = ['created_at', 'title', 'rating'];
    const validatedSort = allowedSortFields.includes(sort) ? sort : 'created_at';
    const validatedOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    let query = `
      WITH post_ratings AS (
        SELECT 
          post_id,
          AVG(rating) as average_rating,
          COUNT(*) as rating_count
        FROM ratings
        GROUP BY post_id
      )
      SELECT 
        p.id, p.title, p.description, p.location, p.created_at, p.purchased,
        c.name AS category,
        json_build_object(
          'id', u.id,
          'name', u.name,
          'avatar', u.avatar,
          'rating', u.rating,
          'phone_number', COALESCE(u.phone_number, ''),
          'settings', json_build_object(
            'whatsappEnabled', COALESCE(us.whatsapp_enabled, false)
          )
        ) AS posted_by,
        COALESCE(
          (SELECT json_agg(pi.image_url)
           FROM post_images pi
           WHERE pi.post_id = p.id), '[]'
        ) AS images,
        COALESCE(pr.average_rating, 0) AS average_rating,
        COALESCE(pr.rating_count, 0) AS rating_count,
        COUNT(*) OVER() as total_count
      FROM 
        posts p
      JOIN 
        users u ON p.user_id = u.id
      JOIN 
        categories c ON p.category_id = c.id
      LEFT JOIN
        user_settings us ON u.id = us.user_id
      LEFT JOIN
        post_ratings pr ON p.id = pr.post_id
      WHERE
        p.purchased = false
    `;
    
    const queryParams = [];
    let conditions = [];
    
    if (category) {
      queryParams.push(category);
      conditions.push(`c.name = $${queryParams.length}`);
    }
    
    if (search) {
      queryParams.push(`%${search}%`);
      conditions.push(`(p.title ILIKE $${queryParams.length} OR p.description ILIKE $${queryParams.length})`);
    }
    
    if (conditions.length > 0) {
      query += ` AND ${conditions.join(' AND ')}`;
    }
    
    query += ` ORDER BY p.${validatedSort} ${validatedOrder} LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(validatedLimit, validatedOffset);
    
    const result = await db.query(query, queryParams);
    
    const totalCount = result.rows[0]?.total_count || 0;
    
    res.json({
      success: true,
      posts: result.rows,
      pagination: {
        total: parseInt(totalCount),
        limit: validatedLimit,
        offset: validatedOffset,
        hasMore: validatedOffset + validatedLimit < totalCount
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get posts by user ID
router.get('/user/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { limit = 20, offset = 0 } = req.query;
    
    const query = `
      SELECT 
        p.id, p.title, p.description, p.location, p.created_at, p.purchased,
        c.name AS category,
        json_build_object(
          'id', u.id,
          'name', u.name,
          'avatar', u.avatar,
          'rating', u.rating,
          'phone_number', COALESCE(u.phone_number, ''),
          'settings', json_build_object(
            'whatsappEnabled', COALESCE(us.whatsapp_enabled, false)
          )
        ) AS posted_by,
        COALESCE(
          (SELECT json_agg(pi.image_url)
           FROM post_images pi
           WHERE pi.post_id = p.id), '[]'
        ) AS images,
        COALESCE(
          (SELECT AVG(r.rating)
           FROM ratings r
           WHERE r.post_id = p.id), 0
        ) AS average_rating,
        COALESCE(
          (SELECT COUNT(r.id)
           FROM ratings r
           WHERE r.post_id = p.id), 0
        ) AS rating_count
      FROM 
        posts p
      JOIN 
        users u ON p.user_id = u.id
      JOIN 
        categories c ON p.category_id = c.id
      LEFT JOIN
        user_settings us ON u.id = us.user_id
      WHERE
        u.id = $1
      ORDER BY 
        p.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    const result = await db.query(query, [userId, limit, offset]);
    
    res.json({
      success: true,
      posts: result.rows
    });
  } catch (error) {
    next(error);
  }
});

// Get post by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        p.id, p.title, p.description, p.location, p.created_at,
        c.name AS category,
        json_build_object(
          'id', u.id,
          'name', u.name,
          'avatar', u.avatar,
          'rating', u.rating,
          'phone_number', COALESCE(u.phone_number, ''),
          'settings', json_build_object(
            'whatsappEnabled', COALESCE(us.whatsapp_enabled, false)
          )
        ) AS posted_by,
        COALESCE(
          (SELECT json_agg(pi.image_url)
           FROM post_images pi
           WHERE pi.post_id = p.id), '[]'
        ) AS images,
        COALESCE(
          (SELECT json_agg(
             json_build_object(
               'id', r.id,
               'userId', ru.id,
               'userName', ru.name,
               'rating', r.rating,
               'comment', r.comment,
               'createdAt', r.created_at
             )
           )
           FROM ratings r
           JOIN users ru ON r.user_id = ru.id
           WHERE r.post_id = p.id), '[]'
        ) AS ratings
      FROM 
        posts p
      JOIN 
        users u ON p.user_id = u.id
      JOIN 
        categories c ON p.category_id = c.id
      LEFT JOIN
        user_settings us ON u.id = us.user_id
      WHERE 
        p.id = $1
    `;
    
    const result = await db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }
    
    res.json({
      success: true,
      post: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// Create a new post with validation and error handling
router.post('/', 
  auth, 
  uploadLimiter,
  upload.array('images', 5),
  handleUploadError,
  validatePost,
  async (req, res, next) => {
    const client = await db.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const { title, description, category, location } = req.body;
      
      // Get or create category
      const categoryResult = await client.query(
        'SELECT id FROM categories WHERE name = $1',
        [category]
      );
      
      let categoryId;
      if (categoryResult.rows.length === 0) {
        const newCategoryResult = await client.query(
          'INSERT INTO categories (name) VALUES ($1) RETURNING id',
          [category]
        );
        categoryId = newCategoryResult.rows[0].id;
      } else {
        categoryId = categoryResult.rows[0].id;
      }
      
      // Insert post
      const postResult = await client.query(
        'INSERT INTO posts (title, description, category_id, user_id, location) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [title, description, categoryId, req.user.id, location]
      );
      
      const postId = postResult.rows[0].id;
      
      // Handle image uploads
      const imageUrls = [];
      if (req.files && req.files.length > 0) {
        const imageValues = req.files.map(file => [postId, file.path]);
        await client.query(
          'INSERT INTO post_images (post_id, image_url) VALUES ($1, $2)',
          imageValues
        );
        imageUrls.push(...req.files.map(file => file.path));
      } else {
        const defaultImage = 'https://images.unsplash.com/photo-1600585152220-90363fe7e115?q=80&w=500&auto=format&fit=crop';
        await client.query(
          'INSERT INTO post_images (post_id, image_url) VALUES ($1, $2)',
          [postId, defaultImage]
        );
        imageUrls.push(defaultImage);
      }
      
      // Notify subscribed users
      await client.query(`
        INSERT INTO notifications (user_id, title, description, post_id)
        SELECT 
          u.id,
          $1,
          $2,
          $3
        FROM users u
        JOIN category_subscriptions cs ON u.id = cs.user_id
        WHERE cs.category_id = $4 AND u.id != $5
      `, [
        `New post in ${category}`,
        title,
        postId,
        categoryId,
        req.user.id
      ]);
      
      await client.query('COMMIT');
      
      res.status(201).json({
        success: true,
        post: {
          id: postId,
          title,
          description,
          category,
          location,
          images: imageUrls,
          posted_by: {
            id: req.user.id,
            name: req.user.name
          },
          created_at: new Date()
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      next(error);
    } finally {
      client.release();
    }
});

// Delete a post
router.delete('/:id', auth, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if post exists and belongs to user
    const postCheck = await db.query(
      'SELECT * FROM posts WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    
    if (postCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Post not found or you do not have permission to delete it'
      });
    }
    
    // Delete post (cascade will delete images and ratings)
    await db.query('DELETE FROM posts WHERE id = $1', [id]);
    
    res.json({
      success: true,
      message: 'Post deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Mark post as purchased
router.patch('/:id/purchased', auth, async (req, res, next) => {
  try {
    // Check if post exists and belongs to user
    const postResult = await db.query(
      'SELECT * FROM posts WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    
    if (postResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Post not found or you do not have permission to modify it' 
      });
    }
    
    // Toggle the purchased status
    const newStatus = !postResult.rows[0].purchased;
    
    // Update post
    await db.query(
      'UPDATE posts SET purchased = $1 WHERE id = $2',
      [newStatus, req.params.id]
    );
    
    res.json({ 
      success: true,
      message: newStatus ? 'Post marked as purchased' : 'Post marked as available',
      purchased: newStatus
    });
    
  } catch (error) {
    console.error('Error marking post as purchased:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to update post status' 
    });
  }
});

// Update a post
router.put('/:id', auth, upload.array('images', 5), handleUploadError, async (req, res, next) => {
  try {
    const postId = req.params.id;
    const { title, description, category, location, price, contact } = req.body;
    const userId = req.user.id;

    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Check if post exists and belongs to user
    const post = await db.query(
      'SELECT * FROM posts WHERE id = $1 AND user_id = $2',
      [postId, userId]
    );

    if (post.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Post not found or unauthorized'
      });
    }

    // Handle image uploads
    let imageUrls = post.rows[0].images || [];
    if (req.files && req.files.length > 0) {
      // Upload new images to Cloudinary
      const uploadPromises = req.files.map(file => 
        cloudinary.uploader.upload(file.path, {
          folder: 'localhub/posts',
          resource_type: 'auto'
        })
      );

      const uploadResults = await Promise.all(uploadPromises);
      imageUrls = uploadResults.map(result => result.secure_url);

      // Delete old images from Cloudinary if they exist
      if (post.rows[0].images) {
        const deletePromises = post.rows[0].images.map(url => {
          const publicId = url.split('/').pop().split('.')[0];
          return cloudinary.uploader.destroy(publicId);
        });
        await Promise.all(deletePromises);
      }
    }

    // Update post
    const updatedPost = await db.query(
      `UPDATE posts 
       SET title = $1, description = $2, category = $3, 
           location = $4, price = $5, contact = $6, 
           images = $7, updated_at = CURRENT_TIMESTAMP
       WHERE id = $8 AND user_id = $9
       RETURNING *`,
      [title, description, category, location, price, contact, imageUrls, postId, userId]
    );

    res.json({
      success: true,
      data: updatedPost.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
