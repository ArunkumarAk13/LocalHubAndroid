import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import Navigation from '@/components/Navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usersAPI } from '@/api';
import { useAuth } from '@/contexts/AuthContext';
import { Bell, FileText } from 'lucide-react';
import { Capacitor } from '@capacitor/core';

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
        await usersAPI.markAllNotificationsAsRead();
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
    
    // Clear Android notifications when notifications page is opened
    if (Capacitor.isNativePlatform()) {
      if (window.MainActivity && window.MainActivity.clearNotifications) {
        window.MainActivity.clearNotifications();
      }
    }
  }, [isAuthenticated, navigate]);

  const handleNotificationClick = async (notification: Notification) => {
    try {
      // Mark as read
      await usersAPI.markNotificationAsRead(notification.id);
      
      // Update local state
      setNotifications(prev =>
        prev.map(n =>
          n.id === notification.id ? { ...n, is_read: true } : n
        )
      );

      // Navigate to post if it exists
      if (notification.post_id) {
        navigate(`/post/${notification.post_id}`);
      }
    } catch (error) {
      console.error('Error handling notification click:', error);
    }
  };

  const formatNotificationTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const getNotificationIcon = (notification: Notification) => {
    if (notification.category) {
      return <Bell className="h-5 w-5 text-primary" />;
    }
    return <FileText className="h-5 w-5 text-primary" />;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container max-w-4xl mx-auto py-6 px-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold flex items-center gap-2">
              <Bell className="h-6 w-6" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-4">Loading notifications...</div>
            ) : notifications.length > 0 ? (
              <div className="space-y-4">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 rounded-lg border cursor-pointer transition-colors
                      ${notification.is_read ? 'bg-background' : 'bg-accent/5'}
                      hover:bg-accent/10`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        {getNotificationIcon(notification)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-medium">
                            {notification.title}
                          </h3>
                          <span className="text-sm text-muted-foreground whitespace-nowrap">
                            {formatNotificationTime(notification.created_at)}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {notification.description}
                        </p>
                        {notification.category && (
                          <Badge variant="outline" className="mt-2">
                            {notification.category}
                          </Badge>
                        )}
                        {notification.post_id && (
                          <Button
                            variant="link"
                            className="mt-2 h-auto p-0 text-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/post/${notification.post_id}`);
                            }}
                          >
                            View Post →
                          </Button>
                        )}
                      </div>
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
    </div>
  );
};

export default Notifications; 