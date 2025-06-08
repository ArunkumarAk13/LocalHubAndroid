const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const db = require('../db');
const notificationService = require('../services/notificationService');

// Get all chats for the current user
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const chats = await db.query(`
      SELECT 
        c.id,
        c.created_at,
        CASE 
          WHEN c.user1_id = $1 THEN u2.id
          ELSE u1.id
        END as participant_id,
        CASE 
          WHEN c.user1_id = $1 THEN u2.name
          ELSE u1.name
        END as participant_name,
        CASE 
          WHEN c.user1_id = $1 THEN u2.avatar
          ELSE u1.avatar
        END as participant_avatar,
        (
          SELECT content 
          FROM messages 
          WHERE chat_id = c.id 
          ORDER BY created_at DESC 
          LIMIT 1
        ) as last_message,
        (
          SELECT COUNT(*) 
          FROM messages m
          LEFT JOIN message_reads mr ON m.id = mr.message_id AND mr.user_id = $1
          WHERE m.chat_id = c.id 
          AND m.sender_id != $1 
          AND mr.id IS NULL
        ) as unread_count
      FROM chats c
      JOIN users u1 ON c.user1_id = u1.id
      JOIN users u2 ON c.user2_id = u2.id
      WHERE c.user1_id = $1 OR c.user2_id = $1
      ORDER BY c.updated_at DESC
    `, [userId]);

    res.json(chats.rows);
  } catch (error) {
    console.error('Error fetching chats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get total unread message count
router.get('/unread-count', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await db.query(`
      SELECT COUNT(*) as count
      FROM messages m
      LEFT JOIN message_reads mr ON m.id = mr.message_id AND mr.user_id = $1
      JOIN chats c ON m.chat_id = c.id
      WHERE (c.user1_id = $1 OR c.user2_id = $1)
      AND m.sender_id != $1
      AND mr.id IS NULL
    `, [userId]);

    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark messages as read
router.post('/:chatId/read', auth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    // Verify user is part of the chat
    const chatCheck = await db.query(
      'SELECT * FROM chats WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
      [chatId, userId]
    );

    if (chatCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not authorized to access this chat' });
    }

    // Mark all unread messages as read
    await db.query(`
      INSERT INTO message_reads (message_id, user_id)
      SELECT m.id, $1
      FROM messages m
      LEFT JOIN message_reads mr ON m.id = mr.message_id AND mr.user_id = $1
      WHERE m.chat_id = $2
      AND m.sender_id != $1
      AND mr.id IS NULL
    `, [userId, chatId]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get messages for a specific chat
router.get('/:chatId/messages', auth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    // Verify user is part of the chat
    const chatCheck = await db.query(
      'SELECT * FROM chats WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
      [chatId, userId]
    );

    if (chatCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not authorized to access this chat' });
    }

    const messages = await db.query(`
      SELECT 
        m.*,
        u.name as sender_name,
        u.avatar as sender_avatar
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.chat_id = $1
      ORDER BY m.created_at ASC
    `, [chatId]);

    // Mark messages as read
    await db.query(`
      INSERT INTO message_reads (message_id, user_id)
      SELECT m.id, $1
      FROM messages m
      LEFT JOIN message_reads mr ON m.id = mr.message_id AND mr.user_id = $1
      WHERE m.chat_id = $2
      AND m.sender_id != $1
      AND mr.id IS NULL
    `, [userId, chatId]);

    res.json(messages.rows);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send a message
router.post('/:chatId/messages', auth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    // Verify user is part of the chat
    const chatCheck = await db.query(
      'SELECT * FROM chats WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
      [chatId, userId]
    );

    if (chatCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not authorized to access this chat' });
    }

    const chat = chatCheck.rows[0];
    const receiverId = chat.user1_id === userId ? chat.user2_id : chat.user1_id;

    // Insert the message
    const result = await db.query(
      `INSERT INTO messages (chat_id, sender_id, content)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [chatId, userId, content]
    );

    // Update chat's updated_at timestamp
    await db.query(
      'UPDATE chats SET updated_at = NOW() WHERE id = $1',
      [chatId]
    );

    // Send notification to receiver
    await notificationService.sendChatNotification(userId, receiverId, content);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new chat
router.post('/', auth, async (req, res) => {
  try {
    const { participantId } = req.body;
    const userId = req.user.id;

    // Check if chat already exists
    const existingChat = await db.query(
      `SELECT * FROM chats 
       WHERE (user1_id = $1 AND user2_id = $2)
       OR (user1_id = $2 AND user2_id = $1)`,
      [userId, participantId]
    );

    if (existingChat.rows.length > 0) {
      return res.json(existingChat.rows[0]);
    }

    // Create new chat
    const result = await db.query(
      `INSERT INTO chats (user1_id, user2_id)
       VALUES ($1, $2)
       RETURNING *`,
      [userId, participantId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating chat:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 