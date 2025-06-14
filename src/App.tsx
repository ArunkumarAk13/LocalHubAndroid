import React, { useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import Index from "./pages/Index";
import Post from "./pages/Post";
import PostDetail from "./pages/PostDetail";
import Profile from "./pages/Profile";
import UserProfile from "./pages/UserProfile";
import MyPosts from "./pages/MyPosts";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Notifications from "./pages/Notifications";
import Chat from "./pages/Chat";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';

const queryClient = new QueryClient();

// Add back button handler
const handleBackButton = () => {
  if (Capacitor.isNativePlatform()) {
    CapacitorApp.addListener('backButton', () => {
      CapacitorApp.exitApp();
    });
  }
};

// Protected route component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  
  if (isLoading) {
    return null;
  }
  
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  return <>{children}</>;
};

// App routes with AuthProvider
const AppRoutes = () => {
  const location = useLocation();
  const isAuthPage = location.pathname === "/login" || location.pathname === "/register";
  const isChatPage = location.pathname.startsWith("/chat");
  const isIndexPage = location.pathname === "/";
  const hideNavbar = isAuthPage || isChatPage || !isIndexPage;
  
  // Handle back button press
  React.useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      // Listen for the exitApp event from Android
      const handleExitApp = () => {
        CapacitorApp.exitApp();
      };

      window.addEventListener('exitApp', handleExitApp);

      return () => {
        window.removeEventListener('exitApp', handleExitApp);
      };
    }
  }, []);
  
  return (
    <>
      {!hideNavbar && <Navbar />}
      <main className={isAuthPage ? "h-screen" : "container py-0 px-0"}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
          <Route path="/post" element={<ProtectedRoute><Post /></ProtectedRoute>} />
          <Route path="/post/:postId" element={<ProtectedRoute><PostDetail /></ProtectedRoute>} />
          <Route path="/post/:postId/edit" element={<ProtectedRoute><Post /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/profile/:userId" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
          <Route path="/my-posts" element={<ProtectedRoute><MyPosts /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
          <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </>
  );
};

const App = () => {
  useEffect(() => {
    handleBackButton();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
