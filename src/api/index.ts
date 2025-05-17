import axios from 'axios';
import { API_BASE_URL } from './config';
import { Capacitor } from '@capacitor/core';

// Create an axios instance with the correct baseURL
const baseURL = API_BASE_URL;

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  // withCredentials is needed for web, but can cause issues on native mobile
  withCredentials: !Capacitor.isNativePlatform()
});

// Add a request interceptor to include the token in all authenticated requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      // Ensure the Authorization header is properly set
      config.headers.Authorization = `Bearer ${token}`;
      
      // Only log in development
      if (process.env.NODE_ENV !== 'production') {
        console.log('Making request to:', config.baseURL + config.url);
      }
    } else {
      console.warn('No token found in localStorage for request to:', config.baseURL + config.url);
    }
    return config;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle token expiration
api.interceptors.response.use(
  (response) => {
    console.log('Response received:', response.config.baseURL + response.config.url, response.status);
    return response;
  },
  (error) => {
    console.error('API Error:', {
      url: error.config?.baseURL + error.config?.url,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
      token: error.config?.headers?.Authorization ? 'Present' : 'Missing'
    });
    
    if (error.response?.status === 401) {
      console.log('Authentication error, clearing token and redirecting to login');
      localStorage.removeItem('token');
      localStorage.removeItem('subscribedCategories');
      localStorage.removeItem('userNotifications');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Authentication API
export const authAPI = {
  login: async (email: string, password: string) => {
    const response = await api.post('/api/auth/login', { email, password });
    return response.data;
  },
  register: async (name: string, email: string, password: string, phoneNumber: string) => {
    const response = await api.post('/api/auth/register', { name, email, password, phoneNumber });
    return response.data;
  },
  getCurrentUser: async () => {
    const response = await api.get('/api/auth/me');
    return response.data;
  },
};

// Posts API
export const postsAPI = {
  getAllPosts: async (filters?: { category?: string; search?: string }) => {
    const response = await api.get('/api/posts', { params: filters });
    return response.data;
  },
  getPostById: async (postId: string) => {
    const response = await api.get(`/api/posts/${postId}`);
    return response.data;
  },
  getUserPosts: async (userId: string) => {
    const response = await api.get(`/api/posts/user/${userId}`);
    return response.data;
  },
  createPost: async (postData: FormData) => {
    const response = await api.post('/api/posts', postData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  updatePost: async (postId: string, postData: FormData) => {
    const response = await api.put(`/api/posts/${postId}`, postData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  deletePost: async (postId: string) => {
    const response = await api.delete(`/api/posts/${postId}`);
    return response.data;
  },
  markAsPurchased: async (postId: string, sellerId?: string, rating?: number) => {
    try {
      const data: { sellerId?: string; rating?: number } = {};
      
      if (sellerId) data.sellerId = sellerId;
      if (rating) data.rating = rating;
      
      const response = await api.patch(`/api/posts/${postId}/purchased`, data);
      
      // If we have both a seller ID and rating, ensure the rating is created properly
      if (sellerId && rating && rating > 0) {
        try {
          // Also create a direct rating for the user to ensure it's counted in their profile
          await ratingsAPI.addRating(postId, rating, `Rating from purchased post ${postId}`, sellerId);
          console.log('Successfully added rating for seller:', sellerId, 'with score:', rating);
        } catch (ratingError) {
          console.error('Failed to add rating for seller:', ratingError);
          // Don't fail the whole operation if just the rating fails
        }
      }
      
      return response.data;
    } catch (error) {
      console.error("Error marking post as purchased:", error);
      throw error;
    }
  },
};

// Ratings API
export const ratingsAPI = {
  addRating: async (postId: string, rating: number, comment?: string, userId?: string) => {
    const data = {
      postId,
      rating,
      comment: comment || '',
    };
    
    // If a specific user ID is provided, include it in the request
    if (userId) {
      data['userId'] = userId;
    }
    
    const response = await api.post('/api/ratings', data);
    return response.data;
  },
  getPostRatings: async (postId: string) => {
    const response = await api.get(`/api/ratings/post/${postId}`);
    return response.data;
  },
};

// Users API
export const usersAPI = {
  getUserProfile: async (userId: string) => {
    const response = await api.get(`/api/users/${userId}`);
    return response.data;
  },
  
  updateProfile: async (data: { name: string; avatar: string }) => {
    try {
      const response = await api.put('/api/users/profile', data);
      return response.data;
    } catch (error: any) {
      console.error("Error updating profile:", error);
      if (error.response) {
        return error.response.data;
      }
      throw error;
    }
  },
  
  subscribeToCategory: async (categoryName: string) => {
    try {
      const response = await api.post('/api/users/subscribe/category', { categoryName });
      return response.data;
    } catch (error: any) {
      console.error("Error in subscribe category:", error);
      if (error.response) {
        return error.response.data;
      }
      throw error;
    }
  },
  
  unsubscribeFromCategory: async (categoryName: string) => {
    try {
      const response = await api.delete('/api/users/unsubscribe/category', {
        data: { categoryName },
      });
      return response.data;
    } catch (error: any) {
      console.error("Error in unsubscribe category:", error);
      if (error.response) {
        return error.response.data;
      }
      throw error;
    }
  },
  
  getSubscribedCategories: async () => {
    try {
      console.log("API: Fetching subscribed categories");
      // Make sure we have a token before attempting to fetch
      const token = localStorage.getItem('token');
      if (!token) {
        console.log("No token available, cannot fetch subscribed categories");
        return { 
          success: false, 
          categories: [],
          message: "Authentication required" 
        };
      }
      
      // Clear any cached categories when fetching new ones for the current user
      localStorage.removeItem('subscribedCategories');
      
      // Add a random query parameter to prevent caching
      const cacheBuster = new Date().getTime();
      const response = await api.get(`/api/users/subscribed-categories?_=${cacheBuster}`);
      console.log("API received subscribed categories:", response.data);
      
      // Store successfully fetched categories in localStorage with a user identifier
      if (response.data.success && Array.isArray(response.data.categories)) {
        localStorage.setItem('subscribedCategories', JSON.stringify(response.data.categories));
      }
      
      return response.data;
    } catch (error: any) {
      console.error("Error fetching subscribed categories:", error);
      
      // Don't use cached data for this scenario as it may belong to another user
      return { 
        success: false, 
        categories: [],
        message: error.response?.data?.message || "Failed to fetch subscribed categories" 
      };
    }
  },
  
  getNotifications: async () => {
    try {
      // Make sure we have a token before attempting to fetch
      const token = localStorage.getItem('token');
      if (!token) {
        console.log("No token available, cannot fetch notifications");
        return { 
          success: false, 
          notifications: [],
          message: "Authentication required" 
        };
      }
      
      // Clear any cached notifications when fetching new ones for the current user
      localStorage.removeItem('userNotifications');
      
      // Add a random query parameter to prevent caching
      const cacheBuster = new Date().getTime();
      const response = await api.get(`/api/users/notifications?_=${cacheBuster}`);
      console.log("API response for notifications:", response.data);
      
      // Store successfully fetched notifications in localStorage for resilience
      if (response.data.success && Array.isArray(response.data.notifications)) {
        localStorage.setItem('userNotifications', JSON.stringify(response.data.notifications));
      }
      
      return response.data;
    } catch (error: any) {
      console.error("Error fetching notifications:", error);
      
      // Don't use cached data as it may belong to another user
      return { 
        success: false, 
        notifications: [],
        message: error.response?.data?.message || "Server error"
      };
    }
  },
  
  markNotificationAsRead: async (notificationId: string) => {
    try {
      const response = await api.put(`/api/users/notifications/${notificationId}/read`);
      
      // Update the cached notifications if the API call was successful
      if (response.data.success) {
        try {
          const cachedNotifications = localStorage.getItem('userNotifications');
          if (cachedNotifications) {
            const notifications = JSON.parse(cachedNotifications);
            const updatedNotifications = notifications.map((notification: any) => 
              notification.id === notificationId 
                ? { ...notification, is_read: true } 
                : notification
            );
            localStorage.setItem('userNotifications', JSON.stringify(updatedNotifications));
          }
        } catch (cacheError) {
          console.error("Error updating cached notifications:", cacheError);
        }
      }
      
      return response.data;
    } catch (error: any) {
      console.error("Error marking notification as read:", error);
      if (error.response) {
        return error.response.data;
      }
      throw error;
    }
  },

  markAllNotificationsAsRead: async () => {
    try {
      const response = await api.put('/api/users/notifications/read-all');
      
      // Update the cached notifications if the API call was successful
      if (response.data.success) {
        try {
          const cachedNotifications = localStorage.getItem('userNotifications');
          if (cachedNotifications) {
            const notifications = JSON.parse(cachedNotifications);
            const updatedNotifications = notifications.map((notification: any) => ({
              ...notification,
              is_read: true
            }));
            localStorage.setItem('userNotifications', JSON.stringify(updatedNotifications));
          }
        } catch (cacheError) {
          console.error("Error updating cached notifications:", cacheError);
        }
      }
      
      return response.data;
    } catch (error: any) {
      console.error("Error marking all notifications as read:", error);
      if (error.response) {
        return error.response.data;
      }
      throw error;
    }
  },

  getUserSettings: async () => {
    try {
      const response = await api.get('/api/users/settings');
      return response.data;
    } catch (error: any) {
      console.error("Error fetching user settings:", error);
      if (error.response) {
        return error.response.data;
      }
      throw error;
    }
  },

  updateUserSettings: async (settings: { whatsappEnabled: boolean }) => {
    try {
      const response = await api.put('/api/users/settings', settings);
      return response.data;
    } catch (error: any) {
      console.error("Error updating user settings:", error);
      if (error.response) {
        return error.response.data;
      }
      throw error;
    }
  },
};

// Chats API
export const chatsAPI = {
  getAllChats: async () => {
    try {
      const response = await api.get(`/api/chats`);
      console.log("Raw chats API response:", response);
      
      // If response.data is an array, return it directly
      if (Array.isArray(response.data)) {
        return {
          success: true,
          chats: response.data
        };
      }
      
      // Otherwise return the response data as is
      return response.data;
    } catch (error: any) {
      console.error("Error fetching chats:", error);
      if (error.response) {
        return error.response.data;
      }
      return { 
        success: false, 
        chats: [],
        message: error.message || "Failed to fetch chats" 
      };
    }
  },
  // Add other chat-related API functions here
};

export default api;
