<template>
  <div class="add-cert-view">
    <h2 class="titulo">{{ editMode ? "Editar Avance de Obra" : "Nuevo Avance de Obra" }}</h2>

    <!-- CABECERA -->
    <div class="cabecera-cert">
      <div class="campo">
        <label>N° de Avance</label>
        <input type="number" v-model="avance.numero_avance" />
      </div>

      <div class="campo">
        <label>Fecha de Avance</label>
        <input type="date" v-model="avance.fecha_avance" />
      </div>

      <div class="campo">
        <label>Periodo Desde</label>
        <input type="date" v-model="avance.periodo_desde" />
      </div>

      <div class="campo">
        <label>Periodo Hasta</label>
        <input type="date" v-model="avance.periodo_hasta" />
      </div>
    </div>

    <!-- RESUMEN PONDERADO -->
    <div class="resumen-total" v-if="avanceItems.length">
      <div>
        <strong>Total obra:</strong> $ {{ mostrar(totalProyecto) }}
      </div>
      <div>
        <strong>Avance real del período (ponderado):</strong>
        <span :class="avanceGlobalPonderado >= 0 ? 'ok' : 'bad'">
          {{ avanceGlobalPonderado.toFixed(2) }}%
        </span>
      </div>
    </div>

    <!-- TABLA -->
    <table class="data-table">
      <thead>
        <tr>
          <th>Ítem</th>
          <th>Descripción</th>
          <th>Unidad</th>
          <th>Cantidad</th>
          <th>% Disp.</th>
          <th>Avance (%)</th>
        </tr>
      </thead>

      <tbody>
        <tr v-for="item in avanceItems" :key="item.pliego_item_id">
          <td>{{ item.numeroItem }}</td>
          <td>{{ item.descripcion }}</td>
          <td>{{ item.unidad }}</td>
          <td>{{ mostrar(item.cantidad) }}</td>
          <td>{{ item.porcentajeDisponible }}%</td>

          <td>
            <input
              type="number"
              min="0"
              :max="item.porcentajeDisponible"
              step="0.01"
              v-model.number="item.avance_porcentaje"
              class="input-porcentaje"
            />
          </td>
        </tr>
      </tbody>
    </table>

    <button class="btn-guardar" @click="guardarAvance">
      {{ editMode ? "Actualizar Avance de Obra" : "Guardar Avance de Obra" }}
    </button>
  </div>
</template>

<script>
import api from "../config/axios.Config.js";
import { useToast } from "vue-toastification";

export default {
  name: "AddAvanceObraView",
  props: ["obraId", "avanceId"],

  setup() {
    const toast = useToast();
    return { toast };
  },

  data() {
    return {
      editMode: false,
      avance: {
        numero_avance: "",
        fecha_avance: "",
        periodo_desde: "",
        periodo_hasta: "",
      },
      avanceItems: [],
    };
  },

  computed: {
    totalProyecto() {
      return this.avanceItems.reduce(
        (acc, i) => acc + Number(i.costoParcial || 0),
        0
      );
    },

    avanceGlobalPonderado() {
      const total = this.totalProyecto;
      if (!total) return 0;

      const ejecutado = this.avanceItems.reduce((acc, i) => {
        const costo = Number(i.costoParcial || 0);
        const porc = Math.max(0, Math.min(100, Number(i.avance_porcentaje || 0)));
        return acc + (costo * porc) / 100;
      }, 0);

      return Number(((ejecutado / total) * 100).toFixed(2));
    },
  },

  methods: {
    mostrar(n) {
      return Number(n || 0).toLocaleString("es-AR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    },

    async cargarPliego() {
      const res = await api.get(`/obras/${this.obraId}/items-disponibles-avance`);

      this.avanceItems = (res.data || []).map((it) => ({
        pliego_item_id: it.id,
        numeroItem: it.numeroItem,
        descripcion: it.descripcionItem,
        unidad: it.unidadMedida,
        cantidad: it.cantidad,
        costoParcial: Number(it.costoParcial || 0),
        porcentajeDisponible: Number(it.porcentajeDisponible || 100),
        avance_porcentaje: 0,
      }));
    },

    async cargarAvanceExistente() {
      const [disponiblesRes, avanceRes] = await Promise.all([
        api.get(`/obras/${this.obraId}/items-disponibles-avance`),
        api.get(`/obras/${this.obraId}/avances/${this.avanceId}`),
      ]);

      const avanceData = avanceRes.data;

      this.avance.numero_avance = avanceData.numero_avance;
      this.avance.fecha_avance = avanceData.fecha_avance
        ? avanceData.fecha_avance.split("T")[0]
        : "";
      this.avance.periodo_desde = avanceData.periodo_desde
        ? avanceData.periodo_desde.split("T")[0]
        : "";
      this.avance.periodo_hasta = avanceData.periodo_hasta
        ? avanceData.periodo_hasta.split("T")[0]
        : "";

      // Mapa de ítems disponibles (sin este avance, ítems a 100% no aparecen)
      const disponiblesMap = {};
      (disponiblesRes.data || []).forEach((it) => {
        disponiblesMap[it.id] = {
          pliego_item_id: it.id,
          numeroItem: it.numeroItem,
          descripcion: it.descripcionItem,
          unidad: it.unidadMedida,
          cantidad: it.cantidad,
          costoParcial: Number(it.costoParcial || 0),
          porcentajeDisponible: Number(it.porcentajeDisponible || 0),
          avance_porcentaje: 0,
        };
      });

      // Fusionar con los ítems existentes del avance
      (avanceData.items || []).forEach((ei) => {
        const pid = ei.pliego_item_id;
        const porcentaje = Number(ei.avance_porcentaje || 0);
        const pi = ei.pliegoItem || {};

        if (disponiblesMap[pid]) {
          // Ya está disponible: sumarle su propia contribución al máximo
          disponiblesMap[pid].porcentajeDisponible = Math.min(
            100,
            disponiblesMap[pid].porcentajeDisponible + porcentaje
          );
          disponiblesMap[pid].avance_porcentaje = porcentaje;
        } else {
          // Llegó a 100%: lo agregamos con el porcentaje actual como máximo
          disponiblesMap[pid] = {
            pliego_item_id: pid,
            numeroItem: pi.numeroItem || "",
            descripcion: pi.descripcionItem || "",
            unidad: pi.unidadMedida || "",
            cantidad: pi.cantidad || 0,
            costoParcial: Number(pi.costoParcial || 0),
            porcentajeDisponible: porcentaje,
            avance_porcentaje: porcentaje,
          };
        }
      });

      this.avanceItems = Object.values(disponiblesMap);
    },

    async guardarAvance() {
      if (!this.avance.numero_avance || !this.avance.fecha_avance) {
        this.toast.warning("Completá N° de avance y Fecha.");
        return;
      }

      const payload = {
        ...this.avance,
        items: this.avanceItems.map((i) => ({
          pliego_item_id: i.pliego_item_id,
          avance_porcentaje: Math.max(0, Math.min(100, Number(i.avance_porcentaje || 0))),
        })),
      };

      try {
        if (this.editMode) {
          await api.put(`/obras/${this.obraId}/avances/${this.avanceId}`, payload);
          this.toast.success("Avance actualizado correctamente.");
        } else {
          const res = await api.post(`/obras/${this.obraId}/avances`, payload);
          const msgExtra =
            res?.data?.avance_periodo_ponderado != null
              ? `\nAvance ponderado período: ${Number(res.data.avance_periodo_ponderado).toFixed(2)}%`
              : "";
          this.toast.success("Avance de obra guardado correctamente" + msgExtra);
        }
        this.$router.back();
      } catch (err) {
        console.error("Error guardando avance:", err);
        const msg = err.response?.data?.message || "Error al guardar el avance.";
        this.toast.error(msg);
      }
    },
  },

  mounted() {
    if (this.avanceId) {
      this.editMode = true;
      this.cargarAvanceExistente();
    } else {
      this.cargarPliego();
    }
  },
};
</script>

<style scoped>
.add-cert-view {
  padding: 20px;
}

.cabecera-cert {
  display: flex;
  gap: 20px;
  margin-bottom: 15px;
  background: #121212;
  padding: 15px;
  border-radius: 8px;
  border: 1px solid #d0d6dd;
}

.campo {
  display: flex;
  flex-direction: column;
}

.campo label {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 4px;
  color: #e5e7eb;
}

.campo input {
  padding: 6px 8px;
  border: 1px solid #999;
  border-radius: 4px;
  font-size: 14px;
}

.resumen-total {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  margin: 10px 0 18px;
  padding: 12px 14px;
  background: #0b1120;
  border: 1px solid #334155;
  border-radius: 8px;
  color: #e5e7eb;
  font-weight: 600;
}

.ok { color: #bef264; }
.bad { color: #fb7185; }

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th,
.data-table td {
  border: 1px solid #666;
  padding: 6px;
  text-align: center;
}

.data-table th {
  background: #222;
  color: white;
  font-size: 0.9rem;
}

.input-porcentaje {
  width: 80px;
  padding: 4px;
  text-align: center;
}

.btn-guardar {
  margin-top: 20px;
  background: #166534;
  color: white;
  padding: 10px 18px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
}
</style>
