<template>
  <div class="add-cert-view">
    <h2 class="titulo">{{ editMode ? "Editar Planificación" : "Planificación de Obra" }}</h2>

    <!-- MENSAJES -->
    <div v-if="mensaje" class="mensaje-exito">
      {{ mensaje }}
    </div>

    <div v-if="error" class="mensaje-error">
      {{ error }}
    </div>

    <!-- CABECERA -->
    <div class="cabecera-cert">
      <div class="campo">
        <label>Desde</label>
        <input type="date" v-model="periodo.desde" />
      </div>

      <div class="campo">
        <label>Hasta</label>
        <input type="date" v-model="periodo.hasta" />
      </div>
    </div>

    <!-- GRILLA -->
    <table class="data-table">
      <thead>
        <tr>
          <th>Ítem</th>
          <th>Descripción</th>
          <th>Unidad</th>
          <th>Cantidad</th>
          <th>% Disponible</th>
          <th>% Planificado</th>
        </tr>
      </thead>

      <tbody>
        <tr
          v-for="item in items"
          :key="item.pliego_item_id"
        >
          <td>{{ item.numeroItem }}</td>
          <td>{{ item.descripcion }}</td>
          <td>{{ item.unidad }}</td>
          <td>{{ mostrar(item.cantidad) }}</td>
          <td>{{ item.porcentaje_disponible }}%</td>
          <td>
            <input
              type="number"
              min="0"
              :max="item.porcentaje_disponible"
              step="0.01"
              v-model.number="item.porcentaje_planificado"
              class="input-porcentaje"
            />
          </td>
        </tr>

        <tr v-if="items.length === 0">
          <td colspan="6" class="sin-items">
            No hay ítems disponibles para planificar
          </td>
        </tr>
      </tbody>
    </table>

    <button
      class="btn-guardar"
      @click="guardar"
      :disabled="guardando"
    >
      {{ guardando ? "Guardando..." : (editMode ? "Actualizar Planificación" : "Guardar Planificación") }}
    </button>
  </div>
</template>

<script>
import api from "../config/axios.Config.js";

export default {
  props: ["obraId", "planifId"],

  data() {
    return {
      editMode: false,
      periodo: {
        desde: "",
        hasta: "",
      },
      items: [],
      mensaje: "",
      error: "",
      guardando: false,
    };
  },

  methods: {
    mostrar(n) {
      return Number(n).toLocaleString("es-AR", {
        minimumFractionDigits: 2,
      });
    },

    async cargarPliego() {
      try {
        const res = await api.get(
          `/obras/${this.obraId}/items-disponible-planificacion`
        );

        this.items = res.data.map(it => ({
          pliego_item_id: it.id,
          numeroItem: it.numeroItem,
          descripcion: it.descripcionItem,
          unidad: it.unidadMedida,
          cantidad: it.cantidad,
          porcentaje_planificado: 0,
          porcentaje_disponible: it.porcentajeDisponible,
        }));
      } catch (err) {
        console.error(err);
        this.error = "Error al cargar ítems disponibles para planificar";
      }
    },

    async cargarPlanificacionExistente() {
      try {
        const [disponiblesRes, planifRes] = await Promise.all([
          api.get(`/obras/${this.obraId}/items-disponible-planificacion`),
          api.get(`/obras/${this.obraId}/planificaciones/${this.planifId}`),
        ]);

        const planifData = planifRes.data;

        this.periodo.desde = planifData.fecha_desde
          ? planifData.fecha_desde.split("T")[0]
          : "";
        this.periodo.hasta = planifData.fecha_hasta
          ? planifData.fecha_hasta.split("T")[0]
          : "";

        // Mapa de ítems disponibles
        const disponiblesMap = {};
        (disponiblesRes.data || []).forEach((it) => {
          disponiblesMap[it.id] = {
            pliego_item_id: it.id,
            numeroItem: it.numeroItem,
            descripcion: it.descripcionItem,
            unidad: it.unidadMedida,
            cantidad: it.cantidad,
            porcentaje_disponible: Number(it.porcentajeDisponible || 0),
            porcentaje_planificado: 0,
          };
        });

        // Fusionar con los ítems existentes de la planificación
        (planifData.items || []).forEach((ei) => {
          const pid = ei.pliego_item_id;
          const porcentaje = Number(ei.porcentaje_planificado || 0);
          const pi = ei.pliegoItem || {};

          if (disponiblesMap[pid]) {
            disponiblesMap[pid].porcentaje_disponible = Math.min(
              100,
              disponiblesMap[pid].porcentaje_disponible + porcentaje
            );
            disponiblesMap[pid].porcentaje_planificado = porcentaje;
          } else {
            disponiblesMap[pid] = {
              pliego_item_id: pid,
              numeroItem: pi.numeroItem || "",
              descripcion: pi.descripcionItem || "",
              unidad: pi.unidadMedida || "",
              cantidad: pi.cantidad || 0,
              porcentaje_disponible: porcentaje,
              porcentaje_planificado: porcentaje,
            };
          }
        });

        this.items = Object.values(disponiblesMap);
      } catch (err) {
        console.error(err);
        this.error = "Error al cargar la planificación";
      }
    },

    validarPeriodo() {
      if (!this.periodo.desde || !this.periodo.hasta) {
        this.error = "Debe indicar fecha desde y hasta";
        return false;
      }

      if (this.periodo.desde > this.periodo.hasta) {
        this.error = "La fecha desde no puede ser mayor que la fecha hasta";
        return false;
      }

      return true;
    },

    async guardar() {
      this.mensaje = "";
      this.error = "";

      if (!this.validarPeriodo()) return;

      this.guardando = true;

      const payload = {
        fecha_desde: this.periodo.desde,
        fecha_hasta: this.periodo.hasta,
        items: this.items
          .filter(i => i.porcentaje_planificado > 0)
          .map(i => ({
            pliego_item_id: i.pliego_item_id,
            porcentaje_planificado: Number(i.porcentaje_planificado),
          })),
      };

      try {
        if (this.editMode) {
          await api.put(
            `/obras/${this.obraId}/planificacion/${this.planifId}`,
            payload
          );
          this.mensaje = "Planificación actualizada correctamente";
        } else {
          await api.post(
            `/obras/${this.obraId}/planificacion`,
            payload
          );
          this.mensaje = "Planificación guardada correctamente";
        }

        setTimeout(() => {
          this.$router.back();
        }, 1500);

      } catch (err) {
        console.error(err.response?.data || err);
        const msg = err.response?.data?.message || "Error al guardar la planificación";
        this.error = msg;
      } finally {
        this.guardando = false;
      }
    },
  },

  mounted() {
    if (this.planifId) {
      this.editMode = true;
      this.cargarPlanificacionExistente();
    } else {
      this.cargarPliego();
    }
  },
};
</script>

<style scoped>
.cabecera-cert {
  display: flex;
  gap: 20px;
  margin-bottom: 16px;
}

.campo {
  display: flex;
  flex-direction: column;
}

.mensaje-exito {
  background: #e6f4ea;
  color: #1e7e34;
  padding: 10px;
  margin-bottom: 12px;
  border-radius: 4px;
  font-weight: 600;
}

.mensaje-error {
  background: #fdecea;
  color: #b02a37;
  padding: 10px;
  margin-bottom: 12px;
  border-radius: 4px;
  font-weight: 600;
}

.input-porcentaje {
  width: 90px;
}

.sin-items {
  text-align: center;
  font-style: italic;
  color: #666;
}

.btn-guardar:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
