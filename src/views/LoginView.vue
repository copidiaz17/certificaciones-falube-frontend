<template>
  <div class="login-page">
    <div class="login-container">
      <h1 class="login-title">SISTEMA DE CERTIFICACIÓN DE OBRA</h1>

      <form @submit.prevent="login" class="login-form">
        <img src="/falube.jpg" alt="Logo" class="logo" />

        <div class="input-group">
          <input v-model="email" type="email" placeholder="Email" required />
        </div>

        <div class="input-group">
          <input v-model="password" type="password" placeholder="Contraseña" required />
        </div>

        <button type="submit" class="btn-submit">Ingresar</button>

        <p v-if="error" class="error">{{ error }}</p>
      </form>
    </div>
  </div>
</template>

<script>
import api from "../config/axios.Config.js";
import { useAuthStore } from '../stores/authStore';

// 🟢 CORRECCIÓN: Importar el CSS local aquí
import "../assets/css/Loguin.css"

export default {
  name: "LoginView",
  data() {
    return {
      email: "user@test.com", 
      password: "password123", 
      error: null
    };
  },
  methods: {
    async login() {
      this.error = null;
      try {
        const res = await api.post("/auth/login", {
          email: this.email,
          password: this.password
        });

        localStorage.setItem("token", res.data.token);
        
        const authStore = useAuthStore();
        authStore.loadUserFromToken(res.data.token);
        
        window.location.replace("/dashboard"); 

      } catch (err) {
        this.error = err.response?.data?.message || "Error al iniciar sesión";
      }
    }
  }
};
</script>

<style scoped>
/* NOTA: Estos estilos son mínimos, el resto debe estar en login.css */
img {
  max-width: 200px;
  height: auto;
}
</style>