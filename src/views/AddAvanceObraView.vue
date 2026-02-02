<template>
  <div class="add-cert-view">
    <h2 class="titulo">Nuevo Avance de Obra</h2>

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
          <th>Avance (%)</th>
        </tr>
      </thead>

      <tbody>
        <tr v-for="item in avanceItems" :key="item.pliego_item_id">
          <td>{{ item.numeroItem }}</td>
          <td>{{ item.descripcion }}</td>
          <td>{{ item.unidad }}</td>
          <td>{{ mostrar(item.cantidad) }}</td>

          <td>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              v-model.number="item.avance_porcentaje"
              class="input-porcentaje"
            />
          </td>
        </tr>
      </tbody>
    </table>

    <button class="btn-guardar" @click="guardarAvance">
      Guardar Avance de Obra
    </button>
  </div>
</template>

<script>
import api from "../config/axios.Config.js";

export default {
  name: "AddAvanceObraView",
  props: ["obraId"],

  data() {
    return {
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

    // ✅ % global ponderado por costoParcial (igual criterio que certificaciones)
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
      const res = await api.get(`/obras/${this.obraId}/pliego`);

      this.avanceItems = (res.data || []).map((it) => ({
        pliego_item_id: it.id,
        numeroItem: it.numeroItem,
        descripcion: it.ItemGeneral?.descripcion || it.descripcionItem,
        unidad: it.ItemGeneral?.unidad || it.unidadMedida,
        cantidad: it.cantidad,
        costoParcial: Number(it.costoParcial || 0), // ✅ clave para ponderar
        avance_porcentaje: 0,
      }));
    },

    async guardarAvance() {
      if (!this.avance.numero_avance || !this.avance.fecha_avance) {
        alert("Completá N° de avance y Fecha.");
        return;
      }

      const payload = {
        ...this.avance,
        items: this.avanceItems.map((i) => ({
          pliego_item_id: i.pliego_item_id,
          avance_porcentaje: Math.max(0, Math.min(100, Number(i.avance_porcentaje || 0))),
        })),
      };

      const res = await api.post(`/obras/${this.obraId}/avances`, payload);

      const msgExtra =
        res?.data?.avance_periodo_ponderado != null
          ? `\nAvance ponderado período: ${Number(res.data.avance_periodo_ponderado).toFixed(2)}%`
          : "";

      alert("Avance de obra guardado correctamente" + msgExtra);
      this.$router.back();
    },
  },

  mounted() {
    this.cargarPliego();
  },
};
</script>

<style scoped>
.add-cert-view {
  padding: 20px;
}

/* ---------- CABECERA ---------- */
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

/* ---------- RESUMEN ---------- */
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

.ok {
  color: #bef264;
}

.bad {
  color: #fb7185;
}

/* ---------- TABLA ---------- */
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

/* -------- BOTÓN -------- */
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
