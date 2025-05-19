import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from "sonner";
import { authAPI } from '../api';
import { sendOTP, verifyOTP as firebaseVerifyOTP, signOutUser } from '../services/firebase';

// Define the User type
export interface User {
  id: number;
  name: string;
  email: string;
  avatar: string;
  phone_number: string;
  rating?: number;
  created_at?: string;
  firebaseUid?: string;
  location?: string;
}

// Define the context type
interface AuthContextType {
  user: User | null;
  login: (phoneNumber: string, password: string) => Promise<any>;
  register: (name: string, phoneNumber: string, password: string) => Promise<any>;
  requestOTP: (phoneNumber: string) => Promise<any>;
  verifyOTP: (phoneNumber: string, otp: string) => Promise<any>;
  registerWithOTP: (name: string, phoneNumber: string, password: string, otp: string, firebaseUid?: string) => Promise<any>;
  logout: () => void;
  updateProfile: (data: { name: string; avatar: string; phoneNumber: string }) => Promise<any>;
  updateUserData: (newData: Partial<User>) => void;
  isAuthenticated: boolean;
}

// Create the context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Create a provider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Get current user
  const getCurrentUser = async () => {
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
      console.error('Error getting current user:', error);
      // If there's an error, clear the token and user data
      localStorage.removeItem('token');
      localStorage.removeItem('subscribedCategories');
      localStorage.removeItem('userNotifications');
      setUser(null);
    }
  };

  // Check authentication status on mount and when token changes
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      getCurrentUser();
    } else {
      setUser(null);
    }
    setIsLoading(false);
  }, []);

  // Add token to API requests
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      // Add token to all API requests
      authAPI.setAuthToken(token);
    }
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

  // Request OTP function - Using Firebase
  const requestOTP = async (phoneNumber: string) => {
    try {
      // First, add an invisible recaptcha container if it doesn't exist
      if (!document.getElementById('recaptcha-container')) {
        const recaptchaContainer = document.createElement('div');
        recaptchaContainer.id = 'recaptcha-container';
        recaptchaContainer.style.display = 'none';
        document.body.appendChild(recaptchaContainer);
      }
      
      // Call the Firebase sendOTP function
      const response = await sendOTP(phoneNumber);
      
      if (response.success) {
        toast.success('OTP sent successfully');
        return { success: true };
      } else {
        toast.error(response.message || 'Failed to send OTP');
        return { success: false, message: response.message };
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to send OTP');
      console.error('OTP request error:', error);
      return { success: false, message: 'Failed to send OTP' };
    }
  };

  // Verify OTP function - Using Firebase
  const verifyOTP = async (phoneNumber: string, otp: string) => {
    try {
      // Call the Firebase verifyOTP function
      const response = await firebaseVerifyOTP(otp);
      
      if (response.success) {
        // Store the Firebase UID for later use during registration
        localStorage.setItem('tempFirebaseUid', response.user.uid);
        return { success: true };
      } else {
        toast.error(response.message || 'Invalid OTP');
        return { success: false, message: response.message };
      }
    } catch (error: any) {
      toast.error(error.message || 'OTP verification failed');
      console.error('OTP verification error:', error);
      return { success: false, message: 'OTP verification failed' };
    }
  };

  // Register with OTP function - Using Firebase
  const registerWithOTP = async (name: string, phoneNumber: string, password: string, otp: string, firebaseUid?: string) => {
    try {
      // Clear previous user data first
      localStorage.removeItem('subscribedCategories');
      localStorage.removeItem('userNotifications');
      
      // Get the Firebase UID from verification or use provided one
      let tempFirebaseUid = firebaseUid || localStorage.getItem('tempFirebaseUid');
      
      // In development mode, we might not have a Firebase UID
      if (!tempFirebaseUid) {
        if (process.env.NODE_ENV !== 'production') {
          // Use a fake UID for development
          tempFirebaseUid = `dev-${Date.now()}`;
          console.log('[DEV] Using development Firebase UID:', tempFirebaseUid);
        } else {
          toast.error('Phone verification required before registration');
          return false;
        }
      }
      
      // Call your backend API with the Firebase UID for additional security
      const response = await authAPI.registerWithOTP(name, phoneNumber, password, otp, tempFirebaseUid);
      
      if (response.success) {
        // Clear the temporary Firebase UID
        localStorage.removeItem('tempFirebaseUid');
        
        // Set user data
        setUser({
          ...response.user,
          firebaseUid: tempFirebaseUid
        });
        
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
  const logout = async () => {
    try {
      // Sign out from Firebase
      await signOutUser();
      
      // Clear local user data
      setUser(null);
      localStorage.removeItem('token');
      localStorage.removeItem('subscribedCategories');
      localStorage.removeItem('userNotifications');
      
      toast.success('You have been logged out');
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      
      // Even if Firebase logout fails, clear local data
      setUser(null);
      localStorage.removeItem('token');
      localStorage.removeItem('subscribedCategories');
      localStorage.removeItem('userNotifications');
      
      navigate('/login');
    }
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

  // Update user data
  const updateUserData = (newData: Partial<User>) => {
    setUser(prev => prev ? { ...prev, ...newData } : null);
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
        updateUserData,
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
