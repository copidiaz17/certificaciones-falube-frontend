// src/config/axios.Config.js
import axios from "axios";

// ✅ En prod: VITE_API_URL=https://tu-backend.onrender.com/api
// ✅ En dev: cae a localhost
const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3000/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Interceptor para adjuntar el token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor para manejar 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem("token");
      // ✅ si tu ruta de login es "Login", normalmente es "/"
      // si es "/login", cambiá esta línea
      window.location.href = "/";
    }
    return Promise.reject(error);
  }
);

export default api;
