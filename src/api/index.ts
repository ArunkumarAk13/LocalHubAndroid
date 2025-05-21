import axios from 'axios';
import { API_BASE_URL } from './config';
import { Capacitor } from '@capacitor/core';
import { Http } from '@capacitor/http';

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
      config.headers.Authorization = `Bearer ${token}`;
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
  (response) => response,
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
      localStorage.removeItem('token');
      localStorage.removeItem('subscribedCategories');
      localStorage.removeItem('userNotifications');
    }
    return Promise.reject(error);
  }
);

// Authentication API
export const authAPI = {
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
  getAllPosts: async (filters?: { category?: string; search?: string; userLocation?: string }) => {
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
    try {
      // Log FormData contents for debugging
      console.log('FormData contents before sending:');
      for (const [key, value] of postData.entries()) {
        if (value instanceof File) {
          console.log(`${key}: File - ${value.name} (${value.type}, ${value.size} bytes)`);
        } else {
          console.log(`${key}: ${value}`);
        }
      }

      // Create a new FormData instance
      const formData = new FormData();
      
      // Append all fields from the original FormData
      for (const [key, value] of postData.entries()) {
        if (value instanceof File) {
          // For files, append with the same key to maintain array structure
          formData.append('images', value);
        } else {
          formData.append(key, value);
        }
      }

      // Convert FormData to a format that works with Capacitor's HTTP interceptor
      const formDataArray = [];
      for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
          // Read the file as ArrayBuffer
          const arrayBuffer = await value.arrayBuffer();
          const base64 = btoa(
            new Uint8Array(arrayBuffer)
              .reduce((data, byte) => data + String.fromCharCode(byte), '')
          );
          
          formDataArray.push({
            key,
            value: base64,
            type: 'file',
            filename: value.name,
            contentType: value.type
          });
        } else {
          formDataArray.push({
            key,
            value,
            type: 'string'
          });
        }
      }

      const response = await api.post('/api/posts', formDataArray, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      return {
        success: true,
        post: response.data
      };
    } catch (error: any) {
      console.error('Error creating post:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to create post'
      };
    }
  },
  updatePost: async (postId: string, postData: FormData) => {
    try {
      // Create a new FormData instance
      const formData = new FormData();
      
      // Append all fields from the original FormData
      for (const [key, value] of postData.entries()) {
        if (value instanceof File) {
          // For files, append with the same key to maintain array structure
          formData.append('images', value);
        } else {
          formData.append(key, value);
        }
      }

      // Convert FormData to a format that works with Capacitor's HTTP interceptor
      const formDataArray = [];
      for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
          // Read the file as ArrayBuffer
          const arrayBuffer = await value.arrayBuffer();
          const base64 = btoa(
            new Uint8Array(arrayBuffer)
              .reduce((data, byte) => data + String.fromCharCode(byte), '')
          );
          
          formDataArray.push({
            key,
            value: base64,
            type: 'file',
            filename: value.name,
            contentType: value.type
          });
        } else {
          formDataArray.push({
            key,
            value,
            type: 'string'
          });
        }
      }

      const response = await api.put(`/api/posts/${postId}`, formDataArray, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      return {
        success: true,
        post: response.data
      };
    } catch (error: any) {
      console.error('Error updating post:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to update post'
      };
    }
  },
  deletePost: async (postId: string) => {
    const response = await api.delete(`/api/posts/${postId}`);
    return response.data;
  },
  markAsPurchased: async (postId: string, sellerId?: string, rating?: number, comment?: string) => {
    const data: { sellerId?: string; rating?: number; comment?: string } = {};
    
    if (sellerId) data.sellerId = sellerId;
    if (rating) data.rating = rating;
    if (comment) data.comment = comment;
    
    const response = await api.patch(`/api/posts/${postId}/purchased`, data);
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
      // Make sure we have a token before attempting to fetch
      const token = localStorage.getItem('token');
      if (!token) {
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

export const markPostAsPurchased = async (postId: number, rating: number, comment?: string) => {
  try {
    const response = await api.post(`/posts/${postId}/purchase`, {
      rating,
      comment
    });
    return response.data;
  } catch (error) {
    console.error('Error marking post as purchased:', error);
    throw error;
  }
};

export default api;
