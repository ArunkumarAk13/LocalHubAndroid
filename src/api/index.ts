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
      // Format data with all possible variations to ensure it works
      const data = {
        // Include both snake_case and camelCase for compatibility
        sellerId,
        seller_id: sellerId,
        userId: sellerId,
        user_id: sellerId,
        rating,
        post_id: postId,
        postId,
        purchased: true,
        update_user_rating: true // Signal to backend that we want to update the seller rating
      };
      
      console.log('Marking post as purchased with data:', data);
      
      const response = await api.patch(`/api/posts/${postId}/purchased`, data);
      console.log('Purchase response:', response.data);
      
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
    try {
      // Include all fields with both naming conventions to ensure compatibility
      const data = {
        // Post info
        post_id: postId, 
        postId: postId,
        
        // User info
        user_id: userId,
        userId: userId,
        seller_id: userId,
        sellerId: userId,
        
        // Rating details
        rating: rating,
        comment: comment || '',
        
        // Flags to ensure the backend treats this properly
        type: 'seller_rating',
        is_seller_rating: true,
        update_user_rating: true
      };
      
      console.log('Sending rating data:', data);
      
      const response = await api.post('/api/ratings', data);
      console.log('Rating creation response:', response.data);
      return response.data;
    } catch (error) {
      // Log the complete error for debugging
      console.error("Error adding rating:", error);
      console.error("Error response data:", error.response?.data);
      
      // Return a structured error response
      return {
        success: false,
        message: error.response?.data?.message || error.message || "Failed to add rating"
      };
    }
  },
  
  // Direct method to create a rating specifically for a seller
  createSellerRating: async (sellerId: string, postId: string, rating: number, comment: string = "Good seller") => {
    try {
      console.log(`Creating seller rating: seller=${sellerId}, post=${postId}, rating=${rating}`);
      
      // This is a simple, focused payload specifically for seller ratings
      const data = {
        seller_id: sellerId,
        post_id: postId,
        rating: rating,
        comment: comment,
        type: "seller_rating"
      };
      
      // Try endpoint specifically for seller ratings first
      try {
        const response = await api.post('/api/user-ratings', data);
        console.log('Seller rating response:', response.data);
        return response.data;
      } catch (error) {
        // Fall back to the standard ratings endpoint
        const response = await api.post('/api/ratings', data);
        console.log('Fallback rating response:', response.data);
        return response.data;
      }
    } catch (error) {
      console.error('Failed to create seller rating:', error);
      return { success: false, message: "Failed to create seller rating" };
    }
  },
  
  getPostRatings: async (postId: string) => {
    try {
      const response = await api.get(`/api/ratings/post/${postId}`);
      return response.data;
    } catch (error) {
      console.error("Error fetching post ratings:", error);
      return {
        success: false,
        ratings: [],
        message: error.response?.data?.message || "Failed to fetch ratings"
      };
    }
  },

  // Direct method to update a user's rating by adding a specific review
  addUserReview: async (userId: string, rating: number, comment: string = "Great seller!") => {
    try {
      console.log(`Adding review for user ${userId} with rating ${rating}`);
      
      // Format data according to backend expectations
      const data = {
        user_id: userId,
        rating: rating,
        comment: comment
      };
      
      // Send to the user ratings endpoint
      const response = await api.post(`/api/users/${userId}/ratings`, data);
      console.log('User review response:', response.data);
      
      return response.data;
    } catch (error) {
      console.error('User rating update failed:', error);
      if (error.response) {
        return error.response.data;
      }
      return { success: false, message: "Failed to update user rating" };
    }
  },
};

// Users API
export const usersAPI = {
  getUserProfile: async (userId: string) => {
    try {
      // Add cache busting to ensure fresh data
      const cacheBuster = new Date().getTime();
      const url = `${API_BASE_URL}/api/users/${userId}?_=${cacheBuster}`;
      
      console.log('Fetching user profile:', url);
      const response = await api.get(url);
      return response.data;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      if (error.response) {
        return error.response.data;
      }
      return { success: false, message: "Failed to fetch user profile" };
    }
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

  // Method to add a direct user review
  addUserReview: async (userId: string, rating: number, comment: string = "Great seller!") => {
    try {
      console.log(`Adding review for user ${userId} with rating ${rating}`);
      
      // Format data according to backend expectations
      const data = {
        user_id: userId,
        rating: rating,
        comment: comment
      };
      
      // Send to the user ratings endpoint
      const response = await api.post(`/api/users/${userId}/ratings`, data);
      console.log('User review response:', response.data);
      
      return response.data;
    } catch (error) {
      console.error('User rating update failed:', error);
      if (error.response) {
        return error.response.data;
      }
      return { success: false, message: "Failed to update user rating" };
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
