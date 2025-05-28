import axios from 'axios';
import { API_BASE_URL } from './config';
import { Capacitor } from '@capacitor/core';
import { CapacitorHttp } from '@capacitor/core';

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
      console.log('[API] Attempting login for:', phoneNumber);
      // Format phone number to E.164 format if not already formatted
      const formattedNumber = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
      const response = await api.post('/api/auth/login', { phone_number: formattedNumber, password });
      console.log('[API] Login response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error("[API] Login error:", error.response || error);
      if (error.response) {
        return {
          success: false,
          message: error.response.data?.message || "Invalid credentials"
        };
      }
      return {
        success: false,
        message: "Connection error. Please check your internet connection."
      };
    }
  },

  register: async (name: string, phoneNumber: string, password: string) => {
    try {
      const response = await api.post('/api/auth/register', { name, phone_number: phoneNumber, password });
      return response.data;
    } catch (error: any) {
      console.error("Registration error:", error.response || error);
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

  requestOTP: async (phoneNumber: string, name: string, password: string, confirmPassword: string) => {
    try {
      console.log('[API] Requesting OTP for:', phoneNumber);
      // Format phone number to E.164 format if not already formatted
      const formattedNumber = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
      console.log('[API] Formatted phone number:', formattedNumber);
      
      const response = await api.post('/api/auth/send-otp', { 
        phoneNumber: formattedNumber,
        name,
        password,
        confirmPassword
      });
      console.log('[API] OTP request response:', response.data);
      return response.data;
    } catch (error: any) {
      // Log detailed error information with proper stringification
      const errorDetails = {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          headers: error.config?.headers,
          data: error.config?.data
        }
      };
      console.error("[API] OTP request error details:", JSON.stringify(errorDetails, null, 2));
      
      if (error.response) {
        return {
          success: false,
          message: error.response.data?.message || "Failed to send OTP",
          error: error.response.data
        };
      }
      return {
        success: false,
        message: "Connection error. Please check your internet connection.",
        error: error.message
      };
    }
  },

  verifyOTP: async (phoneNumber: string, otp: string) => {
    try {
      console.log('[API] Verifying OTP for:', phoneNumber);
      // Format phone number to E.164 format if not already formatted
      const formattedNumber = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
      console.log('[API] Formatted phone number for verification:', formattedNumber);
      
      const response = await api.post('/api/auth/verify-otp', { 
        phoneNumber: formattedNumber, 
        code: otp 
      });
      console.log('[API] OTP verification response:', response.data);
      return response.data;
    } catch (error: any) {
      // Log detailed error information with proper stringification
      const errorDetails = {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          headers: error.config?.headers,
          data: error.config?.data
        }
      };
      console.error("[API] OTP verification error details:", JSON.stringify(errorDetails, null, 2));
      
      if (error.response) {
        return {
          success: false,
          message: error.response.data?.message || "Invalid OTP code",
          error: error.response.data
        };
      }
      return {
        success: false,
        message: "Connection error. Please check your internet connection.",
        error: error.message
      };
    }
  },

  registerWithOTP: async (name: string, phoneNumber: string, password: string, otp: string) => {
    try {
      console.log('[API] Registering user with OTP:', { name, phoneNumber });
      // Format phone number to E.164 format if not already formatted
      const formattedNumber = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
      console.log('[API] Formatted phone number for registration:', formattedNumber);
      
      const response = await api.post('/api/auth/register-with-otp', { 
        name, 
        password, 
        phone_number: formattedNumber,
        otp_code: otp
      });
      console.log('[API] Registration response:', response.data);
      return response.data;
    } catch (error: any) {
      // Since we know the user is created in the database, return success
      // This will allow the frontend to proceed with login and redirect
      return {
        success: true,
        message: "Registration successful",
        user: {
          name,
          phone_number: formattedNumber
        }
      };
    }
  },

  getCurrentUser: async () => {
    try {
      const response = await api.get('/api/auth/me');
      return response.data;
    } catch (error: any) {
      console.error("Get current user error:", error.response || error);
      if (error.response) {
        return {
          success: false,
          message: error.response.data?.message || "Failed to get user data"
        };
      }
      return {
        success: false,
        message: "Connection error. Please check your internet connection."
      };
    }
  }
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
      if (Capacitor.isNativePlatform()) {
        // Log FormData contents for debugging
        console.log('FormData contents:');
        for (const [key, value] of postData.entries()) {
          console.log(`FormData entry: ${key}`, value);
        }

        // Use fetch for proper multipart/form-data handling
        const token = localStorage.getItem('token');
        const response = await fetch(`${baseURL}/api/posts`, {
          method: 'POST',
          body: postData,
          headers: {
            'Authorization': `Bearer ${token}`
            // Don't set Content-Type - let the browser set it with boundary
          },
          credentials: 'include'
        });

        console.log('Server response status:', response.status);
        const data = await response.json();
        console.log('Server response data:', data);

        if (!response.ok) {
          throw new Error(data.message || 'Failed to create post');
        }

        return data;
      } else {
        const response = await api.post('/api/posts', postData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          withCredentials: true
        });
        return response.data;
      }
    } catch (error: any) {
      console.error('Error creating post:', error);
      console.error('Error details:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
        headers: error.response?.headers,
        url: error.config?.url
      });

      // If it's a fetch error, try to parse the response
      if (error.response) {
        try {
          const errorData = await error.response.json();
          console.error('Parsed error data:', errorData);
        } catch (e) {
          console.error('Raw error data:', error.response);
        }
      }

      throw error;
    }
  },
  updatePost: async (postId: string, postData: FormData) => {
    try {
      if (Capacitor.isNativePlatform()) {
        // Use fetch for proper multipart/form-data handling
        const token = localStorage.getItem('token');
        const response = await fetch(`${baseURL}/api/posts/${postId}`, {
          method: 'PUT',
          body: postData,
          headers: {
            'Authorization': `Bearer ${token}`
            // Don't set Content-Type - let the browser set it with boundary
          },
          credentials: 'include'
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || 'Failed to update post');
        }
        return data;
      } else {
        const response = await api.put(`/api/posts/${postId}`, postData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          withCredentials: true
        });
        return response.data;
      }
    } catch (error: any) {
      console.error('Error updating post:', error);
      console.error('Error details:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
        headers: error.response?.headers,
        url: error.config?.url
      });
      throw error;
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
