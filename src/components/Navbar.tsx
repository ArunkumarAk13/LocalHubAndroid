import React, { useState, useEffect } from 'react';
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { User } from "lucide-react";
import { API_BASE_URL } from '@/api/config';

interface UnreadCount {
  count: number;
}

const Navbar = () => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isAuthPage, setIsAuthPage] = useState(false);

  // Update isAuthPage when location changes
  useEffect(() => {
    setIsAuthPage(location.pathname === "/login" || location.pathname === "/register");
  }, [location.pathname]);
  
  // Fetch unread message count
  useEffect(() => {
    if (!isAuthenticated || isAuthPage) return;

    const fetchUnreadCount = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/chats/unread-count`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        });
        if (!response.ok) throw new Error('Failed to fetch unread count');
        const data: UnreadCount = await response.json();
        setUnreadCount(data.count);
      } catch (error) {
        console.error('Error fetching unread count:', error);
      }
    };

    fetchUnreadCount();
    // Poll for new unread messages every 5 seconds
    const interval = setInterval(fetchUnreadCount, 5000);
    return () => clearInterval(interval);
  }, [isAuthenticated, isAuthPage]);

  if (isAuthPage) {
    return null;
  }

  return (
    <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between">
        <div className="flex">
          <Link to="/" className="flex items-center space-x-2">
            <span className="font-bold text-xl">Local Hub</span>
          </Link>
        </div>
        {isAuthenticated && (
          <div className="flex items-center">
            <Link
              to="/profile"
              className="flex flex-col items-center p-2"
            >
              <User className="h-5 w-5" />
              <span className="text-xs mt-1">Profile</span>
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar; 