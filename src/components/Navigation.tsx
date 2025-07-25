import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Grid, Bell, User, Plus, Check, Search, MessageCircle } from 'lucide-react';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from 'sonner';
import { usersAPI } from '@/api';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE_URL } from '@/api/config';

const CATEGORIES = [
  // Electronics & Gadgets
  'Smartphones', 'Laptops', 'Tablets', 'Desktop Computers', 'Gaming Consoles',
  'Smart Watches', 'Headphones', 'Speakers', 'Cameras', 'TVs & Monitors',
  'Printers', 'Routers', 'Power Banks', 'Chargers', 'Cables & Adapters',
  
  // Home & Furniture
  'Sofas & Couches', 'Beds & Mattresses', 'Tables', 'Chairs', 'Wardrobes',
  'Kitchen Appliances', 'Home Decor', 'Lighting', 'Curtains & Blinds',
  'Garden Furniture', 'Storage Solutions',
  
  // Clothing & Fashion
  'Men\'s Clothing', 'Women\'s Clothing', 'Kids\' Clothing', 'Footwear',
  'Accessories', 'Jewelry', 'Watches', 'Bags & Backpacks', 'Sportswear',
  'Traditional Wear',
  
  // Vehicles & Transportation
  'Cars', 'Motorcycles', 'Bicycles', 'Auto Parts', 'Vehicle Accessories',
  'Car Electronics', 'Tires & Wheels', 'Vehicle Maintenance',
  
  // Books & Education
  'Textbooks', 'Fiction Books', 'Non-Fiction Books', 'Educational Materials',
  'Stationery', 'Art Supplies', 'Musical Instruments',
  
  // Sports & Fitness
  'Sports Equipment', 'Fitness Gear', 'Exercise Machines', 'Sports Wear',
  'Outdoor Gear', 'Camping Equipment',
  
  // Services
  'Home Services', 'Professional Services', 'Educational Services',
  'Health & Wellness', 'Beauty & Personal Care', 'Cleaning Services',
  'Repair & Maintenance', 'Transportation Services',
  
  // Others
  'Toys & Games', 'Pet Supplies', 'Baby Products', 'Health Products',
  'Beauty Products', 'Food & Beverages', 'Office Supplies',
  'Industrial Equipment', 'Agricultural Supplies'
];

interface Notification {
  id: string;
  title: string;
  description: string;
  created_at: string;
  is_read: boolean;
  post_id: string;
}

const Navigation: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation(); // Track route changes
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [subscribedCategories, setSubscribedCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [categorySearch, setCategorySearch] = useState('');
  const [chatUnreadCount, setChatUnreadCount] = useState<number>(0);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState<number>(0);
  
  const filteredCategories = CATEGORIES.filter(category =>
    category.toLowerCase().includes(categorySearch.toLowerCase())
  );

  // Create memoized fetch functions to avoid recreating them on each render
  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated || !user) {
      return;
    }
    
    try {
      const response = await usersAPI.getNotifications();
      if (response.success) {
        // This only gets regular notifications (not chat notifications)
        setNotifications(response.notifications || []);
        setNotificationUnreadCount(response.notifications.filter(n => !n.is_read).length);
      } else {
        console.error("Failed to fetch notifications:", response.message);
        if (isInitialLoad) {
          toast.error("Failed to load notifications");
        }
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
      if (isInitialLoad) {
        toast.error("Failed to load notifications");
      }
    }
  }, [isAuthenticated, user, isInitialLoad]);

  const fetchSubscribedCategories = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setSubscribedCategories([]);
      return;
    }
    
    try {
      const response = await usersAPI.getSubscribedCategories();
      if (response.success && Array.isArray(response.categories)) {
        setSubscribedCategories(response.categories);
      } else {
        console.error("Failed to fetch subscribed categories:", response.message);
        setSubscribedCategories([]);
        if (isInitialLoad) {
          toast.error("Failed to load category subscriptions");
        }
      }
      return response;
    } catch (error) {
      console.error("Error fetching subscribed categories:", error);
      setSubscribedCategories([]);
      if (isInitialLoad) {
        toast.error("Failed to load category subscriptions");
      }
      throw error;
    }
  }, [isAuthenticated, user, isInitialLoad]);

  // Reset state when user changes
  useEffect(() => {
    if (user?.id?.toString() !== currentUserId) {
      setCurrentUserId(user?.id?.toString() || null);
      setSubscribedCategories([]);
      setNotifications([]);
      setIsInitialLoad(true);
    }
  }, [user, currentUserId]);
  
  // Fetch data when component mounts, user changes, or route changes
  useEffect(() => {
    if (isAuthenticated && user) {
      const timer = setTimeout(() => {
        Promise.all([
          fetchNotifications(),
          fetchSubscribedCategories()
        ]).then(() => {
          setIsInitialLoad(false);
        }).catch(err => {
          console.error("Error loading initial data:", err);
          setIsInitialLoad(false);
        });
      }, 500);
      
      return () => clearTimeout(timer);
    } else {
      setNotifications([]);
      setSubscribedCategories([]);
      setIsInitialLoad(true);
    }
  }, [user, isAuthenticated, location.pathname, fetchNotifications, fetchSubscribedCategories]);

  // Set up a periodic refresh of data when authenticated
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    
    const refreshInterval = setInterval(() => {
      fetchNotifications();
      fetchSubscribedCategories();
    }, 10000); // Poll every 10 seconds instead of 30
    
    return () => clearInterval(refreshInterval);
  }, [isAuthenticated, user, fetchNotifications, fetchSubscribedCategories]);
  
  const toggleCategorySubscription = async (category: string) => {
    if (!isAuthenticated || !user) {
      toast.error("You must be logged in to subscribe to categories");
      return;
    }
    
    setLoading(true);
    try {
      if (subscribedCategories.includes(category)) {
        const response = await usersAPI.unsubscribeFromCategory(category);
        if (response.success) {
          setSubscribedCategories(prev => prev.filter(c => c !== category));
          toast.success(`Unsubscribed from ${category} notifications`);
        } else {
          toast.error(response.message || `Failed to unsubscribe from ${category}`);
        }
      } else {
        const response = await usersAPI.subscribeToCategory(category);
        if (response.success) {
          setSubscribedCategories(prev => [...prev, category]);
          toast.success(`Subscribed to ${category} notifications`);
          fetchNotifications();
        } else {
          if (response.message && response.message.includes("Already subscribed")) {
            setSubscribedCategories(prev => 
              prev.includes(category) ? prev : [...prev, category]
            );
            fetchSubscribedCategories();
          }
          toast.error(response.message || `Failed to subscribe to ${category}`);
        }
      }
    } catch (error: any) {
      console.error(`Error toggling subscription for ${category}:`, error);
      const errorMessage = error.response?.data?.message || `Failed to update subscription for ${category}`;
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const markNotificationAsRead = async (notificationId: string) => {
    if (!isAuthenticated || !user) return;
    
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
      console.error("Error marking notification as read:", error);
    }
  };

  const unreadNotificationsCount = notifications.filter(notification => !notification.is_read).length;
  
  // Fetch unread message count for chat notifications
  useEffect(() => {
    const fetchUnreadCount = async () => {
      if (!isAuthenticated) return;
      
      try {
        const response = await fetch(`${API_BASE_URL}/api/chats/unread-count`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        });
        if (!response.ok) throw new Error('Failed to fetch unread count');
        const data = await response.json();
        setChatUnreadCount(data.count);
      } catch (error) {
        console.error('Error fetching unread count:', error);
      }
    };

    fetchUnreadCount();
    // Poll for new unread messages every 5 seconds
    const interval = setInterval(fetchUnreadCount, 5000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  return (
    <div className="fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-border flex justify-around items-center px-4 sm:px-6 z-50 md:px-8">
      <Link to="/" className="nav-icon">
        <Home size={24} />
      </Link>
      
      <Link to="/chat" className="nav-icon relative">
        <MessageCircle size={24} />
        {chatUnreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs flex items-center justify-center rounded-full">
            {chatUnreadCount}
          </span>
        )}
      </Link>

      <Link to="/post" className="nav-icon">
        <div className="bg-accent1-500 rounded-full p-3">
          <Plus size={24} className="text-white" />
        </div>
      </Link>
      
      <Link to="/notifications" className="nav-icon relative">
        <Bell size={24} />
        {notificationUnreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs flex items-center justify-center rounded-full">
            {notificationUnreadCount}
          </span>
        )}
        {isInitialLoad && isAuthenticated && (
          <span className="absolute top-0 right-0 h-3 w-3 bg-yellow-500 rounded-full animate-pulse"></span>
        )}
      </Link>

      <Link to="/profile" className="nav-icon">
        <User size={24} />
      </Link>
    </div>
  );
};

export default Navigation;
