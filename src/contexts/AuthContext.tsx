import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from "sonner";
import { authAPI } from '../api';

// Define the User type
export interface User {
  id: number;
  name: string;
  email: string;
  avatar: string;
  phone_number: string;
  rating?: number;
  created_at?: string;
}

// Define the context type
interface AuthContextType {
  user: User | null;
  login: (phoneNumber: string, password: string) => Promise<any>;
  register: (name: string, phoneNumber: string, password: string) => Promise<any>;
  requestOTP: (phoneNumber: string) => Promise<any>;
  verifyOTP: (phoneNumber: string, otp: string) => Promise<any>;
  registerWithOTP: (name: string, phoneNumber: string, password: string, otp: string) => Promise<any>;
  logout: () => void;
  updateProfile: (data: { name: string; avatar: string; phoneNumber: string }) => Promise<any>;
  isAuthenticated: boolean;
}

// Create the context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Create a provider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Check localStorage for existing token and fetch user data
  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('token');
      
      if (token) {
        try {
          const response = await authAPI.getCurrentUser();
          if (response.success) {
            setUser(response.user);
          } else {
            // If token is invalid, clear it
            localStorage.removeItem('token');
            localStorage.removeItem('subscribedCategories');
            localStorage.removeItem('userNotifications');
            setUser(null);
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          localStorage.removeItem('token');
          localStorage.removeItem('subscribedCategories');
          localStorage.removeItem('userNotifications');
          setUser(null);
        }
      }
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  // Login function
  const login = async (phoneNumber: string, password: string) => {
    try {
      // Clear previous user data first
      localStorage.removeItem('subscribedCategories');
      localStorage.removeItem('userNotifications');
      
      const response = await authAPI.login(phoneNumber, password);
      
      if (response.success) {
        // Set user data first
        setUser(response.user);
        // Then set token
        localStorage.setItem('token', response.token);
        toast.success('Login successful!');
        // Use navigate directly instead of setTimeout
        navigate('/', { replace: true });
        return true;
      } else {
        // Don't use toast here as it might disappear too quickly
        console.error('Login failed:', response.message || 'Invalid phone number or password');
        return false;
      }
    } catch (error: any) {
      // Don't use toast here as it might disappear too quickly
      console.error('Login error:', error);
      // Return false rather than throwing an error
      return false;
    }
  };

  // Register function
  const register = async (name: string, phoneNumber: string, password: string) => {
    try {
      // Clear previous user data first
      localStorage.removeItem('subscribedCategories');
      localStorage.removeItem('userNotifications');
      
      const response = await authAPI.register(name, phoneNumber, password);
      
      if (response.success) {
        setUser(response.user);
        localStorage.setItem('token', response.token);
        toast.success('Registration successful!');
        navigate('/');
        return true;
      } else {
        toast.error(response.message || 'Registration failed');
        return false;
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Registration failed');
      console.error('Registration error:', error);
      return false;
    }
  };

  // Request OTP function
  const requestOTP = async (phoneNumber: string) => {
    try {
      const response = await authAPI.requestOTP(phoneNumber);
      if (response.success) {
        toast.success('OTP sent successfully');
        return { success: true };
      } else {
        toast.error(response.message || 'Failed to send OTP');
        return { success: false, message: response.message };
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to send OTP');
      console.error('OTP request error:', error);
      return { success: false, message: 'Failed to send OTP' };
    }
  };

  // Verify OTP function
  const verifyOTP = async (phoneNumber: string, otp: string) => {
    try {
      const response = await authAPI.verifyOTP(phoneNumber, otp);
      if (response.success) {
        return { success: true };
      } else {
        toast.error(response.message || 'Invalid OTP');
        return { success: false, message: response.message };
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'OTP verification failed');
      console.error('OTP verification error:', error);
      return { success: false, message: 'OTP verification failed' };
    }
  };

  // Register with OTP function
  const registerWithOTP = async (name: string, phoneNumber: string, password: string, otp: string) => {
    try {
      // Clear previous user data first
      localStorage.removeItem('subscribedCategories');
      localStorage.removeItem('userNotifications');
      
      const response = await authAPI.registerWithOTP(name, phoneNumber, password, otp);
      
      if (response.success) {
        setUser(response.user);
        localStorage.setItem('token', response.token);
        toast.success('Registration successful!');
        navigate('/');
        return true;
      } else {
        toast.error(response.message || 'Registration failed');
        return false;
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Registration failed');
      console.error('Registration with OTP error:', error);
      return false;
    }
  };

  // Logout function
  const logout = () => {
    setUser(null);
    localStorage.removeItem('token');
    // Clear user-specific stored data
    localStorage.removeItem('subscribedCategories');
    localStorage.removeItem('userNotifications');
    toast.success('You have been logged out');
    navigate('/login');
  };

  const updateProfile = async (data: { name: string; avatar: string; phoneNumber: string }) => {
    try {
      const response = await authAPI.updateProfile(data);
      
      if (response.success) {
        setUser(prev => prev ? { ...prev, ...data } : null);
        return { success: true };
      } else {
        return { success: false, message: response.message };
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      return { success: false, message: 'Failed to update profile' };
    }
  };

  // Don't render children until initial auth check is complete
  if (isLoading) {
    return null;
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        register,
        requestOTP,
        verifyOTP,
        registerWithOTP,
        logout,
        updateProfile,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Create a hook to use the auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
