<template>
  <div class="edit-cert-view">
    <h2 class="titulo">Editar Certificación</h2>

    <div v-if="cargando" class="loading">Cargando...</div>

    <div v-else class="form-card">
      <div class="campo">
        <label>N° de Certificado</label>
        <input type="number" v-model="form.numero_certificado" min="1" />
      </div>

      <div class="campo">
        <label>Fecha de Emisión</label>
        <input type="date" v-model="form.fecha_certificacion" min="2000-01-01" max="2099-12-31" />
      </div>

      <div class="campo">
        <label>Periodo Desde</label>
        <input type="date" v-model="form.periodo_desde" min="2000-01-01" max="2099-12-31" />
      </div>

      <div class="campo">
        <label>Periodo Hasta</label>
        <input type="date" v-model="form.periodo_hasta" min="2000-01-01" max="2099-12-31" />
      </div>

      <div class="acciones">
        <button class="btn-guardar" @click="guardar">Guardar cambios</button>
        <button class="btn-volver" @click="$router.back()">Cancelar</button>
      </div>
    </div>
  </div>
</template>

<script>
import api from "../config/axios.Config.js";
import { useToast } from "vue-toastification";

export default {
  name: "EditCertificacionView",
  props: ["obraId", "certId"],

  setup() {
    const toast = useToast();
    return { toast };
  },

  data() {
    return {
      cargando: true,
      form: {
        numero_certificado: "",
        fecha_certificacion: "",
        periodo_desde: "",
        periodo_hasta: "",
      },
    };
  },

  methods: {
    async cargarDatos() {
      try {
        const res = await api.get(`/certificaciones/${this.certId}/detalle`);
        if (!res.data.ok) throw new Error(res.data.error);
        const c = res.data.certificado;
        this.form.numero_certificado = c.numero_certificado;
        this.form.fecha_certificacion = c.fecha_certificacion;
        this.form.periodo_desde = c.periodo_desde;
        this.form.periodo_hasta = c.periodo_hasta;
      } catch (error) {
        this.toast.error("Error al cargar la certificación.");
        console.error(error);
      } finally {
        this.cargando = false;
      }
    },

    async guardar() {
      if (!this.form.numero_certificado || !this.form.fecha_certificacion ||
          !this.form.periodo_desde || !this.form.periodo_hasta) {
        this.toast.warning("Completá todos los campos.");
        return;
      }

      const fechasValidas = [
        this.form.fecha_certificacion,
        this.form.periodo_desde,
        this.form.periodo_hasta,
      ].every((f) => {
        const year = parseInt((f || "").split("-")[0]);
        return year >= 2000 && year <= 2099;
      });
      if (!fechasValidas) {
        this.toast.warning("Año inválido en alguna fecha. Verificá que sea correcto (ej: 2025).");
        return;
      }

      if (new Date(this.form.periodo_hasta) < new Date(this.form.periodo_desde)) {
        this.toast.warning("El Periodo Hasta no puede ser anterior al Periodo Desde.");
        return;
      }

      try {
        await api.put(`/certificaciones/${this.certId}`, this.form);
        this.toast.success("Certificación actualizada correctamente.");
        this.$router.back();
      } catch (error) {
        const msg = error.response?.data?.error || "Error al guardar los cambios.";
        this.toast.error(msg);
      }
    },
  },

  mounted() {
    this.cargarDatos();
  },
};
</script>

<style scoped>
.edit-cert-view {
  padding: 24px;
  max-width: 500px;
  margin: 0 auto;
}

.titulo {
  font-size: 1.5rem;
  margin-bottom: 20px;
  color: #bbf7d0;
}

.loading {
  color: #9ca3af;
  padding: 20px 0;
}

.form-card {
  background: #0b1120;
  border: 1px solid #22c55e;
  border-radius: 10px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.campo {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.campo label {
  font-size: 13px;
  font-weight: 600;
  color: #e5e7eb;
}

.campo input {
  padding: 8px 10px;
  border: 1px solid #4b5563;
  border-radius: 6px;
  background: #020617;
  color: #f9fafb;
  font-size: 14px;
}

.campo input:focus {
  outline: none;
  border-color: #22c55e;
}

.acciones {
  display: flex;
  gap: 12px;
  margin-top: 6px;
}

.btn-guardar {
  padding: 9px 20px;
  background: #16a34a;
  color: #ecfdf5;
  border: none;
  border-radius: 999px;
  cursor: pointer;
  font-weight: 700;
  font-size: 0.9rem;
}
.btn-guardar:hover { background: #15803d; }

.btn-volver {
  padding: 9px 20px;
  background: transparent;
  color: #9ca3af;
  border: 1px solid #4b5563;
  border-radius: 999px;
  cursor: pointer;
  font-size: 0.9rem;
}
.btn-volver:hover { border-color: #9ca3af; color: #e5e7eb; }
</style>
