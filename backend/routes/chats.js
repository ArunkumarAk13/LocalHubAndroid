const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { validationResult } = require('express-validator');

// Get all chats for a user
router.get('/', auth, async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT 
        c.id,
        c.post_id,
        p.title as post_title,
        p.description as post_description,
        p.images as post_images,
        json_build_object(
          'id', u.id,
          'name', u.name,
          'avatar', u.avatar
        ) as other_user,
        (
          SELECT json_build_object(
            'content', m.content,
            'created_at', m.created_at,
            'sender_id', m.sender_id
          )
          FROM messages m
          WHERE m.chat_id = c.id
          ORDER BY m.created_at DESC
          LIMIT 1
        ) as last_message
      FROM chats c
      JOIN posts p ON c.post_id = p.id
      JOIN chat_participants cp1 ON c.id = cp1.chat_id
      JOIN chat_participants cp2 ON c.id = cp2.chat_id
      JOIN users u ON cp2.user_id = u.id
      WHERE cp1.user_id = $1 AND cp2.user_id != $1
      ORDER BY c.created_at DESC
    `, [req.user.id]);

    res.json({
      success: true,
      chats: result.rows
    });
  } catch (error) {
    next(error);
  }
});

// Get messages for a specific chat
router.get('/:chatId/messages', auth, async (req, res, next) => {
  try {
    const { chatId } = req.params;

    // Check if user is a participant in the chat
    const participantCheck = await db.query(
      'SELECT 1 FROM chat_participants WHERE chat_id = $1 AND user_id = $2',
      [chatId, req.user.id]
    );

    if (participantCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this chat'
      });
    }

    const result = await db.query(`
      SELECT 
        m.id,
        m.content,
        m.created_at,
        m.sender_id,
        json_build_object(
          'id', u.id,
          'name', u.name,
          'avatar', u.avatar
        ) as sender
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.chat_id = $1
      ORDER BY m.created_at ASC
    `, [chatId]);

    res.json({
      success: true,
      messages: result.rows
    });
  } catch (error) {
    next(error);
  }
});

// Create a new chat
router.post('/', auth, async (req, res, next) => {
  const client = await db.pool.connect();
  
  try {
    const { postId, userId } = req.body;

    if (!postId || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Post ID and user ID are required'
      });
    }

    await client.query('BEGIN');

    // Check if chat already exists
    const existingChat = await client.query(`
      SELECT c.id
      FROM chats c
      JOIN chat_participants cp1 ON c.id = cp1.chat_id
      JOIN chat_participants cp2 ON c.id = cp2.chat_id
      WHERE c.post_id = $1 AND cp1.user_id = $2 AND cp2.user_id = $3
    `, [postId, req.user.id, userId]);

    if (existingChat.rows.length > 0) {
      await client.query('COMMIT');
      return res.json({
        success: true,
        chatId: existingChat.rows[0].id,
        message: 'Chat already exists'
      });
    }

    // Create new chat
    const chatResult = await client.query(
      'INSERT INTO chats (post_id) VALUES ($1) RETURNING id',
      [postId]
    );

    const chatId = chatResult.rows[0].id;

    // Add participants
    await client.query(
      'INSERT INTO chat_participants (chat_id, user_id) VALUES ($1, $2), ($1, $3)',
      [chatId, req.user.id, userId]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      chatId,
      message: 'Chat created successfully'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

// Send a message
router.post('/:chatId/messages', auth, async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        message: 'Message content is required'
      });
    }

    // Check if user is a participant in the chat
    const participantCheck = await db.query(
      'SELECT 1 FROM chat_participants WHERE chat_id = $1 AND user_id = $2',
      [chatId, req.user.id]
    );

    if (participantCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to send messages in this chat'
      });
    }

    // Insert message
    const result = await db.query(
      'INSERT INTO messages (chat_id, sender_id, content) VALUES ($1, $2, $3) RETURNING *',
      [chatId, req.user.id, content]
    );

    res.status(201).json({
      success: true,
      message: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// Mark messages as read
router.put('/:chatId/read', auth, async (req, res, next) => {
  try {
    const { chatId } = req.params;

    // Check if user is a participant in the chat
    const participantCheck = await db.query(
      'SELECT 1 FROM chat_participants WHERE chat_id = $1 AND user_id = $2',
      [chatId, req.user.id]
    );

    if (participantCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this chat'
      });
    }

    // Mark messages as read
    await db.query(
      'UPDATE messages SET read = true WHERE chat_id = $1 AND sender_id != $2 AND read = false',
      [chatId, req.user.id]
    );

    res.json({
      success: true,
      message: 'Messages marked as read'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router; 