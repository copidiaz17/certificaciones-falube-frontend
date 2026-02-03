<script>
import api from "../config/axios.Config.js";
import { useAuthStore } from "../stores/authStore";
import "../assets/css/Loguin.css";

export default {
  name: "LoginView",
  data() {
    return {
      email: "",
      password: "",
      error: null,
      loading: false,
    };
  },
  methods: {
    async login() {
      this.error = null;
      this.loading = true;

      try {
        console.log("[LOGIN] intentando:", this.email);

        const res = await api.post("/auth/login", {
          email: this.email,
          password: this.password,
        });

        console.log("[LOGIN] OK:", res.data);

        const token = res.data?.token;
        if (!token) throw new Error("No vino token en la respuesta");

        localStorage.setItem("token", token);

        const authStore = useAuthStore();
        // si tu store tiene loadUserFromToken, ok:
        if (authStore.loadUserFromToken) authStore.loadUserFromToken(token);
        // si además tenés initialize(), no hace daño:
        if (authStore.initialize) authStore.initialize();

        // ✅ navegación SPA (no recarga el sitio)
        this.$router.push({ name: "Dashboard" });
      } catch (err) {
        console.error("[LOGIN] ERROR:", err);
        console.error("[LOGIN] response:", err?.response);
        this.error = err?.response?.data?.message || err?.message || "Error al iniciar sesión";
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>
