import axios from 'axios';
import { API_BASE_URL } from './config';
import { Capacitor } from '@capacitor/core';
import { CapacitorHttp } from '@capacitor/core';

// Create an axios instance with the correct baseURL
const baseURL = API_BASE_URL;

// Helper function to handle API errors
const handleApiError = (error: any) => {
  console.error('API Error:', {
    url: error.config?.url,
    status: error.response?.status,
    data: error.response?.data,
    message: error.message
  });

  return {
    success: false,
    message: error.response?.data?.message || error.message || 'An error occurred'
  };
};

// Configure axios for native platforms
const configureAxiosForNative = () => {
  if (Capacitor.isNativePlatform()) {
    return {
      baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: false // Disable withCredentials for native
    };
  }

  return {
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
    withCredentials: true
  };
};

const api = axios.create(configureAxiosForNative());

// Helper function to validate token
const validateToken = (token: string): boolean => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    const payload = JSON.parse(jsonPayload);
    const currentTime = Math.floor(Date.now() / 1000);
    
    // Check if token is expired
    if (payload.exp && payload.exp < currentTime) {
      return false;
    }
    
    // Check if user ID exists
    if (!payload.userId) {
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Token validation error:', error);
    return false;
  }
};

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
  login: async (email: string, password: string) => {
    try {
      const response = await api.post('/api/auth/login', { 
        email,
        password 
      });
      return response.data;
    } catch (error: any) {
      console.error("Login API error:", error.response || error);
      
      if (error.response) {
        return {
          success: false,
          message: error.response.data?.message || "Invalid email or password"
        };
      }
      
      return {
        success: false,
        message: "Connection error. Please check your internet connection."
      };
    }
  },

  register: async (name: string, email: string, phoneNumber: string, password: string) => {
    try {
      const response = await api.post('/api/auth/register', { 
        name, 
        email, 
        phoneNumber, 
        password 
      });
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

  getCurrentUser: async () => {
    try {
      const response = await api.get('/api/auth/me');
      return response.data;
    } catch (error: any) {
      console.error("Get current user error:", error.response || error);
      return {
        success: false,
        message: error.response?.data?.message || "Failed to get user data"
      };
    }
  },

  sendEmailOTP: async (email: string, name: string, phoneNumber: string, password: string) => {
    try {
      console.log('Sending email OTP request:', {
        url: `${baseURL}/api/auth/send-email-otp`,
        email,
        name,
        phoneNumber: phoneNumber ? 'provided' : 'not provided'
      });

      let response;
      
      if (Capacitor.isNativePlatform()) {
        // Use Capacitor HTTP for native platforms
        console.log('Using Capacitor HTTP for request');
        const requestData = {
          url: `${baseURL}/api/auth/send-email-otp`,
          headers: {
            'Content-Type': 'application/json'
          },
          data: {
            email,
            name,
            phoneNumber,
            password
          }
        };
        
        console.log('Capacitor request config:', {
          url: requestData.url,
          headers: requestData.headers
        });

        try {
          response = await CapacitorHttp.post(requestData);
          console.log('Capacitor response:', {
            status: response.status,
            data: response.data,
            headers: response.headers
          });
        } catch (capacitorError: any) {
          console.error('Capacitor HTTP error:', {
            message: capacitorError.message,
            code: capacitorError.code,
            response: capacitorError.response
          });
          throw capacitorError;
        }

        return {
          success: response.status === 200,
          message: response.data.message,
          data: response.data
        };
      } else {
        // Use axios for web platform
        console.log('Using Axios for request');
        response = await api.post('/api/auth/send-email-otp', {
          email,
          name,
          phoneNumber,
          password
        });
        console.log('Axios response:', {
          status: response.status,
          data: response.data
        });
        return response.data;
      }
    } catch (error: any) {
      console.error("Send Email OTP error:", {
        message: error.message,
        response: error.response,
        status: error.status,
        data: error.response?.data,
        stack: error.stack
      });
      
      // Check if it's a network error
      if (!error.response) {
        return {
          success: false,
          message: "Network error. Please check your internet connection."
        };
      }
      
      // Check if it's a server error
      if (error.response?.status >= 500) {
        return {
          success: false,
          message: "Server error. Please try again later."
        };
      }
      
      return {
        success: false,
        message: error.response?.data?.message || error.message || "Failed to send verification code"
      };
    }
  },

  verifyEmailOTP: async (email: string, otp: string) => {
    try {
      console.log('Sending verify-email-otp request:', {
        email,
        otpLength: otp?.length
      });

      let response;
      
      if (Capacitor.isNativePlatform()) {
        // Use Capacitor HTTP for native platforms
        console.log('Using Capacitor HTTP for verification');
        const requestData = {
          url: `${baseURL}/api/auth/verify-email-otp`,
          headers: {
            'Content-Type': 'application/json'
          },
          data: {
            email,
            otp
          }
        };

        console.log('Capacitor request config:', {
          url: requestData.url,
          headers: requestData.headers
        });

        try {
          response = await CapacitorHttp.post(requestData);
          console.log('Capacitor verification response:', {
            status: response.status,
            data: response.data
          });

          return {
            success: response.status === 201,
            message: response.data.message,
            data: response.data
          };
        } catch (capacitorError: any) {
          console.error('Capacitor HTTP verification error:', {
            message: capacitorError.message,
            code: capacitorError.code,
            response: capacitorError.response
          });
          throw capacitorError;
        }
      } else {
        // Use axios for web platform
        console.log('Using Axios for verification');
        response = await api.post('/api/auth/verify-email-otp', {
          email,
          otp
        });
        console.log('Axios verification response:', {
          status: response.status,
          data: response.data
        });
        return response.data;
      }
    } catch (error: any) {
      console.error("Verify Email OTP error:", {
        message: error.message,
        response: error.response,
        status: error.status,
        data: error.response?.data
      });

      // Check if it's a network error
      if (!error.response) {
        return {
          success: false,
          message: "Network error. Please check your internet connection."
        };
      }

      // Return the error message from the server if available
      return {
        success: false,
        message: error.response?.data?.message || error.message || "Verification failed"
      };
    }
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
  markAsPurchased: async (postId: string) => {
    const response = await api.patch(`/api/posts/${postId}/purchased`);
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
      return {
        success: false,
        message: error.response?.data?.message || "Failed to subscribe to category"
      };
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
      const token = localStorage.getItem('token');
      if (!token) {
        return { 
          success: false, 
          categories: [],
          message: "Authentication required" 
        };
      }
      
      const response = await api.get('/api/users/subscribed-categories');
      
      if (response.data.success && Array.isArray(response.data.categories)) {
        localStorage.setItem('subscribedCategories', JSON.stringify(response.data.categories));
      }
      
      return response.data;
    } catch (error: any) {
      console.error("Error fetching subscribed categories:", error);
      return { 
        success: false, 
        categories: [],
        message: error.response?.data?.message || "Failed to fetch subscribed categories" 
      };
    }
  },
  
  getNotifications: async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        return { 
          success: false, 
          notifications: [],
          message: "Authentication required" 
        };
      }
      
      const response = await api.get('/api/users/notifications');
      
      if (response.data.success && Array.isArray(response.data.notifications)) {
        localStorage.setItem('userNotifications', JSON.stringify(response.data.notifications));
      }
      
      return response.data;
    } catch (error: any) {
      console.error("Error fetching notifications:", error);
      return { 
        success: false, 
        notifications: [],
        message: error.response?.data?.message || "Failed to fetch notifications" 
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

  post: async (url: string, data: any) => {
    try {
      const response = await api.post(url, data);
      return {
        success: true,
        data: response.data,
        message: response.data.message
      };
    } catch (error: any) {
      // Create a detailed error object
      const errorDetails = {
        url,
        data,
        error: {
          message: error.message,
          response: {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data
          },
          request: {
            headers: error.config?.headers,
            method: error.config?.method,
            url: error.config?.url
          }
        }
      };

      // Log the stringified error details
      console.error("Error making POST request:", JSON.stringify(errorDetails, null, 2));
      
      // Return a more detailed error response
      return {
        success: false,
        message: error.response?.data?.message || error.message || "Failed to make request",
        error: {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data
        }
      };
    }
  },

  updateOneSignalPlayerId: async (playerId: string) => {
    try {
      const response = await api.post('/api/users/onesignal-player-id', { playerId });
      return {
        success: true,
        data: response.data,
        message: response.data.message
      };
    } catch (error: any) {
      console.error("Error updating OneSignal player ID:", error);
      return {
        success: false,
        message: error.response?.data?.message || "Failed to update OneSignal player ID",
        error: {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data
        }
      };
    }
  },
};

// Chats API
export const chatsAPI = {
  getAllChats: async () => {
    try {
      const response = await api.get('/api/chats');
      return {
        success: true,
        chats: Array.isArray(response.data) ? response.data : response.data.chats || []
      };
    } catch (error: any) {
      console.error("Error fetching chats:", error);
      return { 
        success: false, 
        chats: [],
        message: error.response?.data?.message || "Failed to fetch chats" 
      };
    }
  },

  getUnreadCount: async () => {
    try {
      const response = await api.get('/api/chats/unread-count');
      return {
        success: true,
        count: response.data.count || 0
      };
    } catch (error: any) {
      console.error("Error fetching unread count:", error);
      return {
        success: false,
        count: 0,
        message: error.response?.data?.message || "Failed to fetch unread count"
      };
    }
  }
};

export default api;
