const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const notificationService = require('../services/notificationService');

// Send message
router.post('/:chatId/messages', auth, async (req, res) => {
    try {
        const { chatId } = req.params;
        const { content } = req.body;
        const senderId = req.user.id;

        // Verify chat exists and user is part of it
        const chatResult = await db.query(
            `SELECT * FROM chats 
            WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)`,
            [chatId, senderId]
        );

        if (chatResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Chat not found'
            });
        }

        const chat = chatResult.rows[0];
        const receiverId = chat.user1_id === senderId ? chat.user2_id : chat.user1_id;

        // Insert message
        const messageResult = await db.query(
            `INSERT INTO messages (chat_id, sender_id, content)
            VALUES ($1, $2, $3)
            RETURNING *`,
            [chatId, senderId, content]
        );

        // Update chat's updated_at timestamp
        await db.query(
            'UPDATE chats SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
            [chatId]
        );

        // Send notification to receiver
        await notificationService.sendChatNotification(senderId, receiverId, content);

        res.json({
            success: true,
            message: messageResult.rows[0]
        });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send message'
        });
    }
}); 