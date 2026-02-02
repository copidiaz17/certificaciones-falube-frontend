// src/main.js
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router'; 
import { useAuthStore } from './stores/authStore'; 
// import './assets/main.css'; // Si usas archivos CSS por defecto
import './assets/css/dashboard.css';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia); // 🟢 1. Inicializa Pinia
app.use(router); 

// 🟢 2. CRÍTICO: Inicializar el estado de autenticación ANTES de montar
const authStore = useAuthStore(); 
authStore.initialize(); 

app.mount('#app');