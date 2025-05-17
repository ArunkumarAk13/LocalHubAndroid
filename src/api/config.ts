export const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://localhub-backend-so0i.onrender.com';

export const API_ENDPOINTS = {
  auth: `${API_BASE_URL}/api/auth`,
  posts: `${API_BASE_URL}/api/posts`,
  users: `${API_BASE_URL}/api/users`,
  ratings: `${API_BASE_URL}/api/ratings`,
  chats: `${API_BASE_URL}/api/chats`,
  uploads: `${API_BASE_URL}/uploads`
}; 