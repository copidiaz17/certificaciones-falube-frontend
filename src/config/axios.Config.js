// src/config/axios.Config.js
import axios from 'axios';

// 🛑 Configura la URL base de tu API de Node.js
const API_BASE_URL = 'http://localhost:3000/api'; 

const api = axios.create({
  baseURL: API_BASE_URL, 
  timeout: 10000 
});

// Interceptor para adjuntar el token y manejar el 401
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            // Si el token es inválido o expiró, cierra sesión
            localStorage.removeItem('token');
            window.location.href = "/"; // Redirige a la raíz (Login)
        }
        return Promise.reject(error);
    }
);

export default api;