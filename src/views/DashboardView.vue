<template>
  <div class="dashboard">
    <header class="header header-principal">
      <img src="/falube.jpg" alt="logo" class="logo" />

      <div class="header-main-area">
        <h1 class="main-dashboard-title">SISTEMA CERTIFICACIÓN DE OBRA</h1>

        <div class="action-buttons-container">
          <template v-if="authStore.canModify">
            <button @click="navigate('CrearObra')" class="btn-action btn-create-obra">
              <i class="fas fa-hammer"></i> Agregar Obra
            </button>

            <button @click="navigate('GestionarCatalogo')" class="btn-action btn-info">
              <i class="fas fa-list"></i> Agregar Item
            </button>

            <button
              v-if="esSuperAdmin"
              @click="navigate('CrearUsuario')"
              class="btn-action btn-user"
            >
              <i class="fas fa-user-plus"></i> Crear Usuario
            </button>
          </template>
        </div>
      </div>

      <!-- PERFIL + LOGOUT -->
      <div class="user-profile-widget">
        <p class="welcome-text">¡Bienvenido!</p>
        <p class="user-name">{{ authStore.user?.nombre || authStore.user?.email }}</p>

        <!-- ✅ Botón visible SIEMPRE (con fallback si FontAwesome no carga) -->
        <button @click="logout" class="btn-logout-visible" type="button" title="Cerrar sesión">
          <span class="logout-icon" aria-hidden="true">⎋</span>
          <span class="logout-text">Salir</span>
        </button>
      </div>

      <button class="hamburger" @click="toggleSidebar">☰</button>
    </header>

    <div class="main-content">
      <aside :class="['sidebar', { open: sidebarOpen }]">
        <h2 class="sidebar-title">Obras</h2>

        <ul class="obra-list">
          <li
            v-for="obra in obras"
            :key="obra.id"
            :class="{ selected: obra.id == obraActiva }"
            @click="seleccionarObra(obra.id)"
          >
            <span class="icon">🏗</span>
            <span class="obra-nombre">{{ obra.nombre }}</span>
            <div v-if="obra.id == obraActiva" class="active-indicator"></div>
          </li>
        </ul>
      </aside>

      <main class="panel-central">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script>
import api from "../config/axios.Config.js";
import { useAuthStore } from "../stores/authStore";

export default {
  name: "DashboardView",
  setup() {
    const authStore = useAuthStore();
    return { authStore };
  },
  data() {
    return {
      obras: [],
      sidebarOpen: false,
      obraActiva: null,
    };
  },
  computed: {
    esSuperAdmin() {
      return this.authStore.user && this.authStore.user.id === 1;
    },
  },
  methods: {
    toggleSidebar() {
      this.sidebarOpen = !this.sidebarOpen;
    },

    async cargarObras() {
      try {
        const res = await api.get("/obras");
        this.obras = res.data || [];
      } catch (error) {
        console.error("Error cargando obras:", error);
        this.obras = [];
      }
    },

    logout() {
      // ✅ store
      this.authStore.logout();

      // ✅ limpiar header global por seguridad
      delete api.defaults.headers.common["Authorization"];

      // ✅ limpiar estado UI
      this.obraActiva = null;
      this.sidebarOpen = false;

      this.$router.push({ name: "Login" });
    },

    navigate(name) {
      this.$router.push({ name });
    },

    seleccionarObra(id) {
      this.obraActiva = id;
      this.$router.push({ name: "ObraDetalle", params: { obraId: id } });
    },
  },
  mounted() {
    this.cargarObras();
  },
};
</script>

<!-- ✅ Esto se suma a tu dashboard.css, pero NO lo rompe -->
<style scoped>
/* Asegura que el widget de usuario sea visible y no tapeado */
.user-profile-widget {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  min-width: 180px;
}

/* Botón logout: visible, contrastado, clickeable */
.btn-logout-visible {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  background: rgba(0, 0, 0, 0.35);
  color: #fff;
  font-weight: 800;
  cursor: pointer;
  line-height: 1;
}

.btn-logout-visible:hover {
  background: rgba(239, 68, 68, 0.25);
  border-color: rgba(239, 68, 68, 0.65);
}

.logout-icon {
  font-size: 18px;
}

.logout-text {
  font-size: 13px;
  letter-spacing: 0.02em;
}
</style>

<style src="../assets/css/dashboard.css"></style>
