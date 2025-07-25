const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const { upload } = require('../config/cloudinary');
const cloudinary = require('../config/cloudinary');
const notificationService = require('../services/notificationService');

const router = express.Router();

// Get all posts with filters
router.get('/', async (req, res, next) => {
  try {
    const { category, search, limit = 20, offset = 0, userCity, userDistrict, userState } = req.query;
    
    let query = `
      SELECT 
        p.id, p.title, p.description, p.created_at, p.purchased,
        c.name AS category,
        json_build_object(
          'id', u.id,
          'name', u.name,
          'avatar', u.avatar,
          'phone_number', COALESCE(u.phone_number, ''),
          'settings', json_build_object(
            'whatsappEnabled', COALESCE(us.whatsapp_enabled, false)
          )
        ) AS posted_by,
        COALESCE(
          (SELECT json_agg(pi.image_url)
           FROM post_images pi
           WHERE pi.post_id = p.id), '[]'
        ) AS images
      FROM 
        posts p
      JOIN 
        users u ON p.user_id = u.id
      JOIN 
        categories c ON p.category_id = c.id
      LEFT JOIN
        user_settings us ON u.id = us.user_id
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
    
    // Add location-based sorting if userCity/userDistrict/userState is provided
    if (userCity || userDistrict || userState) {
      query += `
        ORDER BY 
          CASE 
            WHEN LOWER(TRIM(p.city)) = LOWER(TRIM($${queryParams.length + 1})) THEN 0
            WHEN LOWER(TRIM(p.district)) = LOWER(TRIM($${queryParams.length + 2})) THEN 1
            WHEN LOWER(TRIM(p.state)) = LOWER(TRIM($${queryParams.length + 3})) THEN 2
            ELSE 3
          END,
          p.created_at DESC
      `;
      queryParams.push(userCity || '', userDistrict || '', userState || '');
    } else {
      query += ` ORDER BY p.created_at DESC`;
    }
    
    query += ` LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(limit, offset);
    
    const result = await db.query(query, queryParams);
    
    res.json({
      success: true,
      posts: result.rows
    });
  } catch (error) {
    console.error('Error in GET /api/posts:', error);
    console.error('Query:', query);
    console.error('Query Params:', queryParams);
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
        p.id, p.title, p.description, p.created_at, p.purchased,
        c.name AS category,
        json_build_object(
          'id', u.id,
          'name', u.name,
          'avatar', u.avatar,
          'phone_number', COALESCE(u.phone_number, ''),
          'settings', json_build_object(
            'whatsappEnabled', COALESCE(us.whatsapp_enabled, false)
          )
        ) AS posted_by,
        COALESCE(
          (SELECT json_agg(pi.image_url)
           FROM post_images pi
           WHERE pi.post_id = p.id), '[]'
        ) AS images
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
        p.id, p.title, p.description, p.created_at,
        c.name AS category,
        json_build_object(
          'id', u.id,
          'name', u.name,
          'avatar', u.avatar,
          'phone_number', COALESCE(u.phone_number, ''),
          'settings', json_build_object(
            'whatsappEnabled', COALESCE(us.whatsapp_enabled, false)
          )
        ) AS posted_by,
        COALESCE(
          (SELECT json_agg(pi.image_url)
           FROM post_images pi
           WHERE pi.post_id = p.id), '[]'
        ) AS images
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

// Create a new post
router.post('/', auth, upload.array('images', 5), async (req, res, next) => {
  const client = await db.query('BEGIN');
  
  try {
    const { title, description, category, city, district, state } = req.body;
    
    if (!title || !description || !category || !city || !district || !state) {
      return res.status(400).json({
        success: false,
        message: 'Title, description, category, city, district, and state are required'
      });
    }
    
    // Normalize city, district, state
    const cityNorm = city.trim().toLowerCase();
    const districtNorm = district.trim().toLowerCase();
    const stateNorm = state.trim().toLowerCase();
    
    // Get category ID
    const categoryResult = await db.query('SELECT id FROM categories WHERE name = $1', [category]);
    
    let categoryId;
    if (categoryResult.rows.length === 0) {
      // If category doesn't exist, create it
      console.log("Creating new category:", category);
      const newCategoryResult = await db.query(
        'INSERT INTO categories (name) VALUES ($1) RETURNING id',
        [category]
      );
      categoryId = newCategoryResult.rows[0].id;
    } else {
      categoryId = categoryResult.rows[0].id;
    }
    
    // Insert post
    const postResult = await db.query(
      'INSERT INTO posts (title, description, category_id, user_id, city, district, state) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [title, description, categoryId, req.user.id, cityNorm, districtNorm, stateNorm]
    );
    
    const postId = postResult.rows[0].id;
    
    // Handle image uploads
    const imageUrls = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        // Cloudinary provides the URL in the path property
        const imageUrl = file.path;
        console.log('Saving image URL:', imageUrl);
        await db.query('INSERT INTO post_images (post_id, image_url) VALUES ($1, $2)', [postId, imageUrl]);
        imageUrls.push(imageUrl);
      }
    } else {
      // Add a default image if no images were uploaded
      const defaultImage = 'https://images.unsplash.com/photo-1600585152220-90363fe7e115?q=80&w=500&auto=format&fit=crop';
      await db.query('INSERT INTO post_images (post_id, image_url) VALUES ($1, $2)', [postId, defaultImage]);
      imageUrls.push(defaultImage);
    }
    
    // Check for subscribed users to notify
    const subscribedUsersResult = await db.query(`
      SELECT 
        u.id,
        u.onesignal_player_id
      FROM users u
      JOIN category_subscriptions cs ON u.id = cs.user_id
      WHERE cs.category_id = $1 AND u.id != $2 AND u.onesignal_player_id IS NOT NULL
    `, [categoryId, req.user.id]);
    
    // Create notifications for subscribed users
    for (const user of subscribedUsersResult.rows) {
      // Send push notification and save to database using notification service
      await notificationService.sendCategoryNotification(
        user.id,
        category,
        title,
        postId
      );
    }
    
    await db.query('COMMIT');
    
    res.status(201).json({
      success: true,
      post: {
        id: postId,
        title,
        description,
        category,
        city: cityNorm,
        district: districtNorm,
        state: stateNorm,
        images: imageUrls,
        posted_by: {
          id: req.user.id,
          name: req.user.name
        },
        created_at: new Date()
      }
    });
  } catch (error) {
    await db.query('ROLLBACK');
    next(error);
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

    // Start a transaction
    await db.query('BEGIN');

    try {
      // Toggle the purchased status
      const newStatus = !postResult.rows[0].purchased;
      
      // Update post
      await db.query(
        'UPDATE posts SET purchased = $1 WHERE id = $2',
        [newStatus, req.params.id]
      );
      
      await db.query('COMMIT');
      
      res.json({ 
        success: true,
        message: newStatus ? 'Post marked as purchased' : 'Post marked as available',
        purchased: newStatus
      });
      
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error marking post as purchased:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to update post status' 
    });
  }
});

// Update a post
router.put('/:id', auth, upload.array('images', 5), async (req, res, next) => {
  const client = await db.query('BEGIN');
  
  try {
    const { id } = req.params;
    const { title, description, category, location } = req.body;
    
    // Check if post exists and belongs to user
    const postCheck = await db.query(
      'SELECT * FROM posts WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    
    if (postCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Post not found or you do not have permission to edit it'
      });
    }
    
    if (!title || !description || !category) {
      return res.status(400).json({
        success: false,
        message: 'Title, description, and category are required'
      });
    }
    
    // Get category ID
    const categoryResult = await db.query('SELECT id FROM categories WHERE name = $1', [category]);
    
    let categoryId;
    if (categoryResult.rows.length === 0) {
      // If category doesn't exist, create it
      const newCategoryResult = await db.query(
        'INSERT INTO categories (name) VALUES ($1) RETURNING id',
        [category]
      );
      categoryId = newCategoryResult.rows[0].id;
    } else {
      categoryId = categoryResult.rows[0].id;
    }
    
    // Update post
    await db.query(
      'UPDATE posts SET title = $1, description = $2, category_id = $3 WHERE id = $4',
      [title, description, categoryId, id]
    );
    
    // Handle images
    let existingImages = [];
    if (req.body.existingImages) {
      try {
        existingImages = JSON.parse(req.body.existingImages);
      } catch (error) {
        console.error('Error parsing existingImages:', error);
        existingImages = [];
      }
    }
    
    // Delete images that are not in the existingImages list
    if (existingImages.length > 0) {
      await db.query(
        'DELETE FROM post_images WHERE post_id = $1 AND image_url != ALL($2)',
        [id, existingImages]
      );
    } else {
      // If no existing images to keep, delete all
      await db.query('DELETE FROM post_images WHERE post_id = $1', [id]);
    }
    
    // Add new images if provided
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const imageUrl = file.path;
        await db.query('INSERT INTO post_images (post_id, image_url) VALUES ($1, $2)', [id, imageUrl]);
      }
    }
    
    await db.query('COMMIT');
    
    // Get updated post with all details
    const updatedPost = await db.query(`
      SELECT 
        p.id, p.title, p.description, p.created_at, p.purchased,
        c.name AS category,
        json_build_object(
          'id', u.id,
          'name', u.name,
          'avatar', u.avatar,
          'phone_number', COALESCE(u.phone_number, ''),
          'settings', json_build_object(
            'whatsappEnabled', COALESCE(us.whatsapp_enabled, false)
          )
        ) AS posted_by,
        COALESCE(
          (SELECT json_agg(pi.image_url)
           FROM post_images pi
           WHERE pi.post_id = p.id), '[]'
        ) AS images
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
    `, [id]);
    
    res.json({
      success: true,
      post: updatedPost.rows[0]
    });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error updating post:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update post'
    });
  }
});

module.exports = router;
