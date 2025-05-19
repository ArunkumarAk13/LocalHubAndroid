const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const { avatarUpload } = require('../config/cloudinary');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// Get user settings
router.get('/settings', auth, async (req, res, next) => {
  try {
    console.log("Backend: Fetching settings for user:", req.user.id);
    
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    // First check if user exists
    const userResult = await db.query(
      'SELECT id FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      console.log("Backend: User not found:", req.user.id);
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const result = await db.query(
      'SELECT whatsapp_enabled FROM user_settings WHERE user_id = $1',
      [req.user.id]
    );
    
    // If no settings exist, create default settings
    if (result.rows.length === 0) {
      console.log("Backend: Creating default settings for user:", req.user.id);
      await db.query(
        'INSERT INTO user_settings (user_id, whatsapp_enabled) VALUES ($1, $2)',
        [req.user.id, false]
      );
      
      return res.json({
        success: true,
        settings: {
          whatsappEnabled: false
        }
      });
    }
    
    console.log("Backend: Found settings for user:", req.user.id, result.rows[0]);
    res.json({
      success: true,
      settings: {
        whatsappEnabled: result.rows[0].whatsapp_enabled
      }
    });
  } catch (error) {
    console.error("Backend error fetching settings:", error);
    next(error);
  }
});

// Update user settings
router.put('/settings', auth, async (req, res, next) => {
  try {
    const { whatsappEnabled } = req.body;
    console.log("Backend: Updating settings for user:", req.user.id, "whatsappEnabled:", whatsappEnabled);
    
    // Check if settings exist
    const checkResult = await db.query(
      'SELECT id FROM user_settings WHERE user_id = $1',
      [req.user.id]
    );
    
    if (checkResult.rows.length === 0) {
      // Create new settings
      await db.query(
        'INSERT INTO user_settings (user_id, whatsapp_enabled) VALUES ($1, $2)',
        [req.user.id, whatsappEnabled]
      );
    } else {
      // Update existing settings
      await db.query(
        'UPDATE user_settings SET whatsapp_enabled = $1 WHERE user_id = $2',
        [whatsappEnabled, req.user.id]
      );
    }
    
    res.json({
      success: true,
      message: 'Settings updated successfully'
    });
  } catch (error) {
    console.error("Backend error updating settings:", error);
    next(error);
  }
});

// Get user's subscribed categories
router.get('/subscribed-categories', auth, async (req, res, next) => {
  try {
    console.log("Backend: Fetching subscribed categories for user ID:", req.user.id);
    
    // Make sure the user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
        categories: []
      });
    }
    
    // Use a proper JOIN to get categories
    const result = await db.query(`
      SELECT c.name
      FROM category_subscriptions cs
      JOIN categories c ON cs.category_id = c.id
      WHERE cs.user_id = $1
    `, [req.user.id]);
    
    console.log("Backend: Found subscribed categories:", result.rows);
    
    // Return the category names as an array
    res.json({
      success: true,
      categories: result.rows.map(row => row.name)
    });
  } catch (error) {
    console.error("Backend error in subscribed-categories:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch subscribed categories: " + error.message,
      categories: []
    });
  }
});

// Get user notifications
router.get('/notifications', auth, async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
        notifications: []
      });
    }

    const result = await db.query(`
      SELECT 
        n.id, 
        n.title, 
        n.description, 
        n.created_at, 
        n.is_read, 
        n.post_id,
        c.name as category
      FROM notifications n
      LEFT JOIN posts p ON n.post_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE n.user_id = $1
      ORDER BY n.created_at DESC
    `, [req.user.id]);

    res.json({
      success: true,
      notifications: result.rows
    });
  } catch (error) {
    console.error("Error getting notifications:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
      notifications: []
    });
  }
});

// Get user profile by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if id is a valid integer
    if (isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }
    
    const userResult = await db.query(`
      SELECT u.id, u.name, u.email, u.avatar, u.rating, u.created_at, u.phone_number, u.location,
             COALESCE(us.whatsapp_enabled, false) as whatsapp_enabled
      FROM users u
      LEFT JOIN user_settings us ON u.id = us.user_id
      WHERE u.id = $1
    `, [id]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const user = userResult.rows[0];
    
    // Count user's posts
    const postCountResult = await db.query(
      'SELECT COUNT(*) FROM posts WHERE user_id = $1',
      [id]
    );
    
    const postCount = parseInt(postCountResult.rows[0].count);
    
    res.json({
      success: true,
      user: {
        ...user,
        postCount,
        settings: {
          whatsappEnabled: user.whatsapp_enabled
        }
      }
    });
  } catch (error) {
    console.error("Error getting user profile:", error);
    next(error);
  }
});

// Subscribe to category notifications
router.post('/subscribe/category', auth, async (req, res, next) => {
  try {
    const { categoryName } = req.body;
    console.log("Backend: Subscribe request for category:", categoryName, "by user:", req.user.id);
    
    if (!categoryName) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required'
      });
    }
    
    // Get category ID
    const categoryResult = await db.query(
      'SELECT id FROM categories WHERE name = $1',
      [categoryName]
    );
    
    let categoryId;
    
    if (categoryResult.rows.length === 0) {
      // If category doesn't exist, create it
      console.log("Backend: Creating new category:", categoryName);
      try {
        const newCategoryResult = await db.query(
          'INSERT INTO categories (name) VALUES ($1) RETURNING id',
          [categoryName]
        );
        
        categoryId = newCategoryResult.rows[0].id;
        console.log("Backend: Created new category with ID:", categoryId);
      } catch (err) {
        console.error("Error creating category:", err);
        // If there's a unique constraint error, the category might have been created by another request
        // Try to get the category ID again
        const retryResult = await db.query(
          'SELECT id FROM categories WHERE name = $1',
          [categoryName]
        );
        
        if (retryResult.rows.length === 0) {
          return res.status(500).json({
            success: false,
            message: 'Failed to create category'
          });
        }
        
        categoryId = retryResult.rows[0].id;
        console.log("Backend: Retrieved existing category with ID:", categoryId);
      }
    } else {
      categoryId = categoryResult.rows[0].id;
      console.log("Backend: Found existing category with ID:", categoryId);
    }
    
    // Check if already subscribed
    const subscriptionCheck = await db.query(
      'SELECT * FROM category_subscriptions WHERE user_id = $1 AND category_id = $2',
      [req.user.id, categoryId]
    );
    
    if (subscriptionCheck.rows.length > 0) {
      console.log("Backend: User already subscribed to this category");
      return res.status(400).json({
        success: false,
        message: 'Already subscribed to this category'
      });
    }
    
    // Add subscription
    console.log("Backend: Adding subscription for user:", req.user.id, "and category:", categoryId);
    await db.query(
      'INSERT INTO category_subscriptions (user_id, category_id) VALUES ($1, $2)',
      [req.user.id, categoryId]
    );
    
    // Create notification for subscription
    await db.query(`
      INSERT INTO notifications (user_id, title, description, post_id)
      VALUES ($1, $2, $3, NULL)
    `, [
      req.user.id, 
      `Category Subscription: ${categoryName}`, 
      `You are now subscribed to new posts in the ${categoryName} category. You will be notified when new items are posted in this category.`
    ]);
    
    console.log("Backend: Successfully subscribed to category");
    res.status(201).json({
      success: true,
      message: `Subscribed to ${categoryName} notifications`
    });
  } catch (error) {
    console.error("Backend error in subscribe category:", error);
    res.status(500).json({
      success: false,
      message: `Failed to update subscription: ${error.message}`
    });
  }
});

// Unsubscribe from category notifications
router.delete('/unsubscribe/category', auth, async (req, res, next) => {
  try {
    const { categoryName } = req.body;
    console.log("Backend: Unsubscribe request for category:", categoryName, "by user:", req.user.id);
    
    if (!categoryName) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required'
      });
    }
    
    // Get category ID
    const categoryResult = await db.query(
      'SELECT id FROM categories WHERE name = $1',
      [categoryName]
    );
    
    if (categoryResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }
    
    const categoryId = categoryResult.rows[0].id;
    
    // Delete subscription
    console.log("Backend: Removing subscription for user:", req.user.id, "and category:", categoryId);
    await db.query(
      'DELETE FROM category_subscriptions WHERE user_id = $1 AND category_id = $2',
      [req.user.id, categoryId]
    );
    
    console.log("Backend: Successfully unsubscribed from category");
    res.json({
      success: true,
      message: `Unsubscribed from ${categoryName} notifications`
    });
  } catch (error) {
    console.error("Backend error in unsubscribe category:", error);
    res.status(500).json({
      success: false,
      message: `Failed to update subscription: ${error.message}`
    });
  }
});

// Mark notification as read
router.put('/notifications/:id/read', auth, async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log("Backend: Marking notification as read:", id, "for user:", req.user.id);
    
    await db.query(
      'UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    
    console.log("Backend: Successfully marked notification as read");
    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error("Backend error marking notification as read:", error);
    next(error);
  }
});

// Mark all notifications as read
router.put('/notifications/read-all', auth, async (req, res, next) => {
  try {
    console.log("Backend: Marking all notifications as read for user:", req.user.id);
    
    await db.query(
      'UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE',
      [req.user.id]
    );
    
    console.log("Backend: Successfully marked all notifications as read");
    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error("Backend error marking all notifications as read:", error);
    next(error);
  }
});

// Update user profile
router.put('/profile', auth, avatarUpload.single('avatar'), async (req, res, next) => {
  try {
    const { name, phoneNumber, location } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Name is required'
      });
    }

    // Start a transaction
    await db.query('BEGIN');

    try {
      let avatarUrl = null;

      // If a new avatar was uploaded
      if (req.file) {
        console.log('Processing new avatar upload:', req.file);
        avatarUrl = req.file.path; // Cloudinary provides the URL in the path property
        console.log('New avatar URL:', avatarUrl);
      }

      // Update user profile
      const result = await db.query(
        'UPDATE users SET name = $1, phone_number = $2, avatar = COALESCE($3, avatar), location = $4 WHERE id = $5 RETURNING id, name, email, avatar, phone_number, rating, location',
        [name, phoneNumber, avatarUrl, location, req.user.id]
      );

      await db.query('COMMIT');

      res.json({
        success: true,
        user: result.rows[0]
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
