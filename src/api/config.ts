// Remove any trailing /api from the base URL to avoid double /api in requests
const cleanBaseUrl = (url: string) => {
  if (url.endsWith('/api')) {
    return url.slice(0, -4); // Remove trailing /api
  }
  return url;
};

export const API_BASE_URL = cleanBaseUrl(import.meta.env.VITE_API_URL || 'https://localhub-backend-so0i.onrender.com');

export const API_ENDPOINTS = {
  auth: `${API_BASE_URL}/api/auth`,
  posts: `${API_BASE_URL}/api/posts`,
  users: `${API_BASE_URL}/api/users`,
  ratings: `${API_BASE_URL}/api/ratings`,
  chats: `${API_BASE_URL}/api/chats`,
  uploads: `${API_BASE_URL}/uploads`
}; 