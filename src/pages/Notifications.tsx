import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import Navigation from '@/components/Navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usersAPI } from '@/api';
import { useAuth } from '@/contexts/AuthContext';

interface Notification {
  id: string;
  title: string;
  description: string;
  created_at: string;
  is_read: boolean;
  post_id?: string;
  category?: string;
}

const Notifications: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    const loadNotifications = async () => {
      try {
        // First mark all notifications as read
        await usersAPI.markAllNotificationsAsRead();
        
        // Then fetch the updated notifications
        const response = await usersAPI.getNotifications();
        if (response.success) {
          setNotifications(response.notifications || []);
        } else {
          toast.error(response.message || 'Failed to load notifications');
        }
      } catch (error) {
        console.error('Error handling notifications:', error);
        toast.error('Failed to load notifications');
      } finally {
        setLoading(false);
      }
    };

    loadNotifications();
  }, [isAuthenticated, navigate]);

  const markNotificationAsRead = async (notificationId: string) => {
    try {
      const response = await usersAPI.markNotificationAsRead(notificationId);
      if (response.success) {
        setNotifications(prev =>
          prev.map(notification =>
            notification.id === notificationId
              ? { ...notification, is_read: true }
              : notification
          )
        );
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
      toast.error('Failed to mark notification as read');
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    markNotificationAsRead(notification.id);
  };

  const handleViewPostClick = (e: React.MouseEvent, postId: string) => {
    e.stopPropagation(); // Prevent the card click handler from firing
    navigate(`/post/${postId}`);
  };

  const getNotificationIcon = (notification: Notification) => {
    if (notification.category) {
      return '📋'; // Category subscription notification
    } else if (notification.post_id) {
      return '📝'; // Post-related notification
    }
    return '🔔'; // Default notification
  };

  return (
    <div className="h-[90vh] bg-background overflow-y-auto">
      <div className="w-full max-w-5xl mx-auto px-3 sm:px-4 py-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Notifications</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-4">Loading notifications...</div>
            ) : notifications.length > 0 ? (
              <div className="space-y-4">
                {notifications.map(notification => (
                  <div
                    key={notification.id}
                    className={`p-4 rounded-lg cursor-pointer transition-colors ${
                      notification.is_read
                        ? 'bg-secondary/50 hover:bg-secondary/70'
                        : 'bg-secondary hover:bg-secondary/80'
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-start space-x-3">
                        <span className="text-xl mt-1">{getNotificationIcon(notification)}</span>
                        <div>
                          <h3 className={`font-medium ${!notification.is_read ? 'font-bold' : ''}`}>
                            {notification.title}
                          </h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {notification.description}
                          </p>
                          {notification.category && (
                            <Badge variant="secondary" className="mt-2">
                              {notification.category}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {!notification.is_read && (
                        <Badge variant="default" className="ml-2">
                          New
                        </Badge>
                      )}
                    </div>
                    <div className="flex justify-between items-center mt-3">
                      <span className="text-xs text-muted-foreground">
                        {new Date(notification.created_at).toLocaleDateString()}
                      </span>
                      {notification.post_id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleViewPostClick(e, notification.post_id!)}
                        >
                          View Post
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No notifications yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <Navigation />
    </div>
  );
};

export default Notifications; 