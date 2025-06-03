import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { authAPI } from '../api';
import { Capacitor } from '@capacitor/core';
import { usersAPI } from '../api';

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
  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, phoneNumber: string, password: string) => Promise<boolean>;
  logout: () => void;
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
            // Set OneSignal external user ID if on native platform
            if (Capacitor.isNativePlatform() && response.user.id) {
              // @ts-ignore - OneSignal is injected by the native platform
              if (window.MainActivity) {
                // @ts-ignore
                window.MainActivity.setExternalUserId(response.user.id.toString());
              }
            }
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

  // Listen for push token from OneSignal
  useEffect(() => {
    const handlePushToken = async (event: CustomEvent) => {
      const pushToken = event.detail;
      console.log('[Frontend] Received push token event:', pushToken);
      
      try {
        console.log('[Frontend] Sending push token to server...');
        // Send the push token to your server using the new method
        const response = await usersAPI.updateOneSignalPlayerId(pushToken);
        console.log('[Frontend] Server response:', response);
        
        if (response.success) {
          console.log('[Frontend] Push token updated successfully');
          // Refresh user data to get updated OneSignal ID
          const userResponse = await authAPI.getCurrentUser();
          if (userResponse.success) {
            setUser(userResponse.user);
            console.log('[Frontend] User data refreshed with new OneSignal ID');
          }
        } else {
          console.error('[Frontend] Failed to update push token:', response.message);
          if (response.error) {
            console.error('[Frontend] Error details:', response.error);
          }
        }
      } catch (error) {
        console.error('[Frontend] Error updating push token:', error);
        if (error.response) {
          console.error('[Frontend] Error response:', error.response.data);
        }
      }
    };

    console.log('[Frontend] Setting up pushTokenReceived event listener');
    // Add event listener
    window.addEventListener('pushTokenReceived', handlePushToken as EventListener);

    // Cleanup
    return () => {
      console.log('[Frontend] Cleaning up pushTokenReceived event listener');
      window.removeEventListener('pushTokenReceived', handlePushToken as EventListener);
    };
  }, []);

  // Login function
  const login = async (email: string, password: string) => {
    try {
      const response = await authAPI.login(email, password);
      if (response.success) {
        localStorage.setItem('token', response.token);
        setUser(response.user);
        
        // Set OneSignal external user ID
        if (Capacitor.isNativePlatform()) {
          try {
            // @ts-ignore
            window.MainActivity.setExternalUserId(response.user.id.toString());
          } catch (error) {
            console.error('Error setting OneSignal external user ID:', error);
          }
        }
        
        toast.success('Login successful!');
        // Add a small delay before navigation to ensure state is updated
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 100);
        return true;
      } else {
        toast.error(response.message || 'Login failed');
        return false;
      }
    } catch (error: any) {
      console.error('Login error:', error);
      toast.error(error.response?.data?.message || 'Failed to login. Please try again.');
      return false;
    }
  };

  // Register function
  const register = async (name: string, email: string, phoneNumber: string, password: string) => {
    try {
      // Clear previous user data first
      localStorage.removeItem('subscribedCategories');
      localStorage.removeItem('userNotifications');
      
      const response = await authAPI.register(name, email, phoneNumber, password);
      
      if (response.success) {
        setUser(response.user);
        localStorage.setItem('token', response.token);
        
        // Set OneSignal external user ID if on native platform
        if (Capacitor.isNativePlatform() && response.user.id) {
          // @ts-ignore - OneSignal is injected by the native platform
          if (window.MainActivity) {
            // @ts-ignore
            window.MainActivity.setExternalUserId(response.user.id.toString());
          }
        }
        
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

  // Logout function
  const logout = () => {
    // Clear local user data
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('subscribedCategories');
    localStorage.removeItem('userNotifications');
    
    // Clear OneSignal external user ID if on native platform
    if (Capacitor.isNativePlatform()) {
      // @ts-ignore - OneSignal is injected by the native platform
      if (window.MainActivity) {
        // @ts-ignore
        window.MainActivity.setExternalUserId(null);
      }
    }
    
    toast.success('You have been logged out');
    navigate('/login');
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
        logout,
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
