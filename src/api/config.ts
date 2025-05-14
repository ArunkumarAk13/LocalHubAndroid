export const API_BASE_URL = import.meta.env.VITE_API_URL;

export const API_ENDPOINTS = {
  auth: `${API_BASE_URL}/auth`,
  posts: `${API_BASE_URL}/posts`,
  users: `${API_BASE_URL}/users`,
  ratings: `${API_BASE_URL}/ratings`,
  chats: `${API_BASE_URL}/chats`,
  uploads: `${API_BASE_URL.replace('/api', '')}/uploads`
}; 