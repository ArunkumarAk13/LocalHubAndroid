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
    
    // Don't automatically redirect on auth errors for login/register endpoints
    if (error.response?.status === 401 && 
        !error.config?.url?.includes('/auth/login') && 
        !error.config?.url?.includes('/auth/register')) {
      console.log('Authentication error, clearing token');
      localStorage.removeItem('token');
      localStorage.removeItem('subscribedCategories');
      localStorage.removeItem('userNotifications');
      // Don't force a page refresh - let the app handle this via React Router
    }
    return Promise.reject(error);
  }
);

// Authentication API
export const authAPI = {
  setAuthToken: (token: string) => {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  },
  login: async (phoneNumber: string, password: string) => {
    try {
      // Only use phone number for login
      const response = await api.post('/api/auth/login', { 
        phone_number: phoneNumber,
        password 
      });
      return response.data;
    } catch (error: any) {
      console.error("Login API error:", error.response || error);
      
      // Format error response
      if (error.response) {
        return {
          success: false,
          message: error.response.data?.message || "Invalid phone number or password"
        };
      }
      
      return {
        success: false,
        message: "Connection error. Please check your internet connection."
      };
    }
  },
  register: async (name: string, phoneNumber: string, password: string) => {
    const response = await api.post('/api/auth/register', { name, password, phone_number: phoneNumber });
    return response.data;
  },
  requestOTP: async (phoneNumber: string) => {
    try {
      const response = await api.post('/api/auth/request-otp', { phone_number: phoneNumber });
      return response.data;
    } catch (error: any) {
      console.error("OTP request error:", error.response || error);
      if (error.response) {
        return {
          success: false,
          message: error.response.data?.message || "Failed to send OTP"
        };
      }
      return {
        success: false,
        message: "Connection error. Please check your internet connection."
      };
    }
  },
  verifyOTP: async (phoneNumber: string, otp: string) => {
    try {
      const response = await api.post('/api/auth/verify-otp', { 
        phone_number: phoneNumber, 
        otp_code: otp 
      });
      return response.data;
    } catch (error: any) {
      console.error("OTP verification error:", error.response || error);
      if (error.response) {
        return {
          success: false,
          message: error.response.data?.message || "Invalid OTP code"
        };
      }
      return {
        success: false,
        message: "Connection error. Please check your internet connection."
      };
    }
  },
  registerWithOTP: async (name: string, phoneNumber: string, password: string, otp: string, firebaseUid?: string) => {
    try {
      const response = await api.post('/api/auth/register-with-otp', { 
        name, 
        password, 
        phone_number: phoneNumber,
        otp_code: otp,
        firebase_uid: firebaseUid
      });
      return response.data;
    } catch (error: any) {
      console.error("Registration with OTP error:", error.response || error);
      if (error.response) {
        return {
          success: false,
          message: error.response.data?.message || "Registration failed"
        };
      }
      return {
        success: false,
        message: "Connection error. Please check your internet connection."
      };
    }
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
    const data: { sellerId?: string; rating?: number } = {};
    
    if (sellerId) data.sellerId = sellerId;
    if (rating) data.rating = rating;
    
    const response = await api.patch(`/api/posts/${postId}/purchased`, data);
    return response.data;
  },
};

// Ratings API
export const ratingsAPI = {
  addRating: async (postId: string, rating: number, comment?: string) => {
    const response = await api.post('/api/ratings', { postId, rating, comment });
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
