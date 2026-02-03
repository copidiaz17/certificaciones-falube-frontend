// frontend/src/config/axios.Config.js
import axios from "axios";

// ✅ En Render (frontend) seteás: VITE_API_BASE_URL=https://TU-BACKEND.onrender.com/api
// ✅ En local cae a localhost
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// 401 -> logout
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/"; // o '/login'
    }
    return Promise.reject(error);
  }
);

export default api;
