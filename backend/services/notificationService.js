const axios = require('axios');
const db = require('../db');

class NotificationService {
    constructor() {
        this.ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
        this.ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;
    }

    async sendNotification(userId, title, message, type, targetId = null) {
        try {
            // Get user's OneSignal player ID from database
            const userResult = await db.query(
                'SELECT onesignal_player_id FROM users WHERE id = $1',
                [userId]
            );

            if (!userResult.rows[0]?.onesignal_player_id) {
                console.error('User has no OneSignal player ID:', userId);
                return false;
            }

            const playerId = userResult.rows[0].onesignal_player_id;

            // Prepare notification data
            const notificationData = {
                app_id: this.ONESIGNAL_APP_ID,
                include_player_ids: [playerId],
                headings: { en: title },
                contents: { en: message },
                data: {
                    type: type,
                    target_id: targetId
                }
            };

            // Send notification via OneSignal API
            const response = await axios.post(
                'https://onesignal.com/api/v1/notifications',
                notificationData,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Basic ${this.ONESIGNAL_REST_API_KEY}`
                    }
                }
            );

            // Only save notification to database if it's not a chat notification
            if (type !== 'chat') {
                await db.query(
                    `INSERT INTO notifications (user_id, title, description, post_id)
                    VALUES ($1, $2, $3, $4)`,
                    [userId, title, message, targetId]
                );
            }

            return response.data;
        } catch (error) {
            console.error('Error sending notification:', error);
            if (error.response) {
                console.error('OneSignal API error:', error.response.data);
            }
            return false;
        }
    }

    async sendChatNotification(senderId, receiverId, message) {
        try {
            // Get sender's name
            const senderResult = await db.query(
                'SELECT name FROM users WHERE id = $1',
                [senderId]
            );
            const senderName = senderResult.rows[0]?.name || 'Someone';

            // Get chat ID
            const chatResult = await db.query(
                `SELECT id FROM chats 
                WHERE (user1_id = $1 AND user2_id = $2) 
                OR (user1_id = $2 AND user2_id = $1)`,
                [senderId, receiverId]
            );
            const chatId = chatResult.rows[0]?.id;

            if (!chatId) {
                console.error('Chat not found between users:', senderId, receiverId);
                return false;
            }

            // Send notification
            return await this.sendNotification(
                receiverId,
                `New message from ${senderName}`,
                message,
                'chat',
                chatId.toString()
            );
        } catch (error) {
            console.error('Error sending chat notification:', error);
            return false;
        }
    }

    async sendCategoryNotification(userId, categoryName, postTitle, postId = null) {
        try {
            const title = `New Post in ${categoryName}`;
            const message = `${postTitle}\n\nA new item has been posted in the ${categoryName} category.`;
            
            return await this.sendNotification(
                userId,
                title,
                message,
                'category_post',
                postId
            );
        } catch (error) {
            console.error('Error sending category notification:', error);
            return false;
        }
    }
}

module.exports = new NotificationService(); 