import React, { Suspense, lazy, useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { toast } from 'sonner';

// Lazy load page components
const Index = lazy(() => import('./pages/Index'));
const Post = lazy(() => import('./pages/Post'));
const PostDetail = lazy(() => import('./pages/PostDetail'));
const Profile = lazy(() => import('./pages/Profile'));
const UserProfile = lazy(() => import('./pages/UserProfile'));
const MyPosts = lazy(() => import('./pages/MyPosts'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Chat = lazy(() => import('./pages/Chat'));

const queryClient = new QueryClient();

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

// A simple loading spinner component
const LoadingFallback = () => (
  <div className="flex justify-center items-center h-screen">
    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary"></div>
  </div>
);

// App routes with AuthProvider
const AppRoutes = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isAuthPage = location.pathname === "/login" || location.pathname === "/register";
  const isChatPage = location.pathname.startsWith("/chat");
  const isIndexPage = location.pathname === "/";
  const hideNavbar = isAuthPage || isChatPage || !isIndexPage;
  
  // Double-back-to-exit logic
  const backPressRef = React.useRef<number>(0);

  React.useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const onExitApp = (e: Event) => {
      if (!isIndexPage) {
        navigate('/', { replace: true });
        return;
      }
      const now = Date.now();
      if (backPressRef.current && now - backPressRef.current < 2000) {
        CapacitorApp.exitApp();
      } else {
        backPressRef.current = now;
        toast("Press back again to exit");
      }
      };

    window.addEventListener('exitApp', onExitApp);
      return () => {
      window.removeEventListener('exitApp', onExitApp);
      };
  }, [isIndexPage, navigate]);
  
  return (
    <>
      {!hideNavbar && <Navbar />}
      <main className={isAuthPage ? "h-screen" : "container py-0 px-0"}>
        <Suspense fallback={<LoadingFallback />}>
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
        </Suspense>
      </main>
    </>
  );
};

const App = () => {
  useEffect(() => {
    // Clear notifications when app is opened
    if (Capacitor.isNativePlatform()) {
      // Call Android method to clear notifications
      if (window.MainActivity && window.MainActivity.clearNotifications) {
        window.MainActivity.clearNotifications();
      }
    }
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
