<template>
  <div class="obra-detalle-view">
    <h2 class="titulo-obra" v-if="obra.nombre">
      {{ obra.nombre }}
    </h2>

    <div class="acciones-container">
      <button
        v-if="authStore.canModify"
        @click="goToCargarPliego"
        class="btn-primary btn-success btn-lg action-btn"
      >
        ➕ Cargar / Editar Ítems del Pliego
      </button>

      <button
        v-if="authStore.canModify"
        @click="goToAddCertificacion"
        class="btn-primary btn-warning btn-lg action-btn"
      >
        Agregar Certificación
      </button>

      <button
        v-if="authStore.canModify"
        @click="goToAddAvanceObra"
        class="btn-primary btn-dark btn-lg action-btn"
      >
        ➕ Agregar Avance de Obra
      </button>

      <button
        v-if="itemsPliego.length > 0"
        @click="$router.push({ name: 'VerPliego', params: { obraId: route.params.obraId } })"
        class="btn-primary btn-info btn-lg action-btn"
      >
        Ver Pliego Completo
      </button>

      <button
        v-if="authStore.canModify"
        @click="goToProyeccionObra"
        class="btn-primary btn-success btn-lg action-btn"
      >
        Proyección de Obra
      </button>
    </div>

    <div class="panel-avance">
      <div class="panel panel-curva">
        <h3>Curva de Avance</h3>
        <div class="chart-wrap">
          <canvas ref="curvaChart"></canvas>
        </div>
      </div>

      <div class="panel panel-resumen" v-if="resumenCurva.length > 0">
        <h3>Resumen de Curva</h3>

        <table class="tabla-resumen">
          <thead>
            <tr>
              <th>Período</th>
              <th class="th-plan">% Plan (período)</th>
              <th class="th-plan th-sep-right">% Plan (acum.)</th>
              <th class="th-cert">% Cert (período)</th>
              <th class="th-cert th-sep-right">% Cert (acum.)</th>
              <th class="th-real">% Real (período)</th>
              <th class="th-real th-sep-right">% Real (acum.)</th>
              <th>Desvío acum. (Real - Plan)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, idx) in resumenCurva" :key="idx">
              <td class="col-periodo">{{ r.periodo }}</td>
              <td class="td-plan">{{ formatPercent(r.planPer) }}</td>
              <td class="td-plan td-sep-right">{{ formatPercent(r.planAc) }}</td>
              <td class="td-cert">{{ formatPercent(r.certPer) }}</td>
              <td class="td-cert td-sep-right">{{ formatPercent(r.certAc) }}</td>
              <td class="td-real">{{ formatPercent(r.avPer) }}</td>
              <td class="td-real td-sep-right">{{ formatPercent(r.avAc) }}</td>
              <td :class="r.desvio >= 0 ? 'pos' : 'neg'">
                {{ formatPercent(r.desvio) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="panel panel-items">
        <h3>Avance certificado por Ítem (acumulado)</h3>
        <div
          v-for="item in avanceItems"
          :key="item.pliego_item_id"
          class="item-avance"
        >
          <div class="item-header">
            <span>{{ item.descripcion }}</span>
            <strong>{{ formatPercent(item.avance_acumulado) }}</strong>
          </div>
          <div class="barra">
            <div
              class="barra-progreso"
              :style="{ width: (item.avance_acumulado || 0) + '%' }"
            ></div>
          </div>
        </div>
        <p v-if="avanceItems.length === 0" class="text-muted">
          No hay avances registrados
        </p>
      </div>

      <div class="panel panel-certificaciones">
        <h3>Historial de Certificaciones</h3>
        <table
          v-if="certsHistorial.length > 0"
          class="tabla-certificaciones"
        >
          <thead>
            <tr>
              <th>N° Cert.</th>
              <th>Período</th>
              <th>Fecha Emisión</th>
              <th>Avance Cert.</th>
              <th>Avance Acum.</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="cert in certsHistorial" :key="cert.id">
              <td>{{ cert.numero_certificado }}</td>
              <td>{{ formatPeriodo(cert) }}</td>
              <td>{{ formatDate(cert.fecha_certificacion) }}</td>
              <td>{{ formatPercent(cert.avance_mensual) }}</td>
              <td>{{ formatPercent(cert.avance_acumulado) }}</td>
              <td>
                <button class="btn-detalle" @click="verDetalleCert(cert.id)">
                  Ver detalle
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="text-muted">No hay certificaciones registradas</p>
      </div>
    </div>
  </div>
</template>

<script>
import api from "../config/axios.Config.js";
import { useAuthStore } from "../stores/authStore";
import { useRoute } from "vue-router";
import Chart from "chart.js/auto";

export default {
  name: "ObraDetalleView",
  setup() {
    const authStore = useAuthStore();
    const route = useRoute();
    return { authStore, route };
  },
  data() {
    return {
      obra: {},
      itemsPliego: [],
      avanceItems: [],
      curvaChartInstance: null,
      certNumerosPorPeriodo: [],
      certsHistorial: [],
      financiero: [],
      financieroMontos: [],
      curvaLabels: [],
      curvaPlanAcum: [],
      curvaCertAcum: [],
      curvaAvanceAcum: [],
    };
  },
  computed: {
    esAdmin() {
      return (
        this.authStore.user &&
        this.authStore.user.rol &&
        this.authStore.user.rol.toLowerCase().trim() === "administrador"
      );
    },

    // ✅ RESUMEN CORTADO POR FECHA ACTUAL (solo períodos cerrados)
    resumenCurva() {
      const labels = this.curvaLabels || [];
      const planA = this.curvaPlanAcum || [];
      const certA = this.curvaCertAcum || [];
      const avA = this.curvaAvanceAcum || [];
      if (!labels.length) return [];

      // Hoy al inicio del día para comparar
      const hoy = new Date();
      const hoyStart = new Date(
        hoy.getFullYear(),
        hoy.getMonth(),
        hoy.getDate()
      ).getTime();

      // labels: "YYYY-MM-DD → YYYY-MM-DD"
      const parseHasta = (label) => {
        if (!label || label === "Inicio") return null;
        const parts = String(label).split("→");
        if (parts.length !== 2) return null;
        const hastaStr = parts[1].trim();
        const t = new Date(hastaStr).getTime();
        return Number.isFinite(t) ? t : null;
      };

      // último período cerrado: hasta < hoyStart
      let lastIdx = 0; // incluye "Inicio"
      for (let i = 1; i < labels.length; i++) {
        const hastaTime = parseHasta(labels[i]);
        if (hastaTime != null && hastaTime < hoyStart) {
          lastIdx = i;
        }
      }

      const L = labels.slice(0, lastIdx + 1);
      const P = planA.slice(0, lastIdx + 1);
      const C = certA.slice(0, lastIdx + 1);
      const A = avA.slice(0, lastIdx + 1);

      return L.map((periodo, i) => {
        const planPrev = i === 0 ? 0 : Number(P[i - 1] || 0);
        const certPrev = i === 0 ? 0 : Number(C[i - 1] || 0);
        const avPrev = i === 0 ? 0 : Number(A[i - 1] || 0);

        const planAc = Number(P[i] || 0);
        const certAc = Number(C[i] || 0);
        const avAc = Number(A[i] || 0);

        return {
          periodo,
          planPer: planAc - planPrev,
          planAc,
          certPer: certAc - certPrev,
          certAc,
          avPer: avAc - avPrev,
          avAc,
          desvio: avAc - planAc,
        };
      });
    },
  },

  // ✅ FIX: cuando cambia obraId, recargamos todo (Vue reutiliza el componente)
  watch: {
    "route.params.obraId": {
      immediate: true,
      async handler() {
        this.obra = {};
        this.itemsPliego = [];
        this.avanceItems = [];
        this.certsHistorial = [];
        this.curvaLabels = [];
        this.curvaPlanAcum = [];
        this.curvaCertAcum = [];
        this.curvaAvanceAcum = [];
        this.certNumerosPorPeriodo = [];
        this.financiero = [];
        this.financieroMontos = [];

        if (this.curvaChartInstance) {
          this.curvaChartInstance.destroy();
          this.curvaChartInstance = null;
        }

        await this.fetchData();
      },
    },
  },

  methods: {
    async fetchData() {
      try {
        const obraId = this.route.params.obraId;
        if (!obraId) return;

        const [obraRes, pliegoRes] = await Promise.all([
          api.get(`/obras/${obraId}`),
          api.get(`/obras/${obraId}/pliego`),
        ]);

        this.obra = obraRes.data;
        this.itemsPliego = pliegoRes.data;

        await this.cargarAvances();
        await this.cargarCurva();
        await this.cargarHistorialCertificaciones();
      } catch (err) {
        console.error("Error cargando detalle de obra:", err);
      }
    },

    async cargarAvances() {
      const obraId = this.route.params.obraId;
      try {
        const res = await api.get(`/obras/${obraId}/items-certificados`);
        this.avanceItems = res.data || [];
      } catch (e) {
        console.error("Error cargando items certificados:", e);
        this.avanceItems = [];
      }
    },

    async cargarCurva() {
      const obraId = this.route.params.obraId;
      const res = await api.get(`/obras/${obraId}/curva-avance`);

      const {
        labels,
        planificado,
        certificado,
        avance,
        financiero,
        financieroMontos,
        certNumerosPorPeriodo,
      } = res.data;

      if (!labels || labels.length === 0) return;

      this.certNumerosPorPeriodo = certNumerosPorPeriodo || [];
      this.financiero = financiero || [];
      this.financieroMontos = financieroMontos || [];

      this.curvaLabels = labels || [];
      this.curvaPlanAcum = planificado || [];
      this.curvaCertAcum = certificado || [];
      this.curvaAvanceAcum = avance || [];

      this.renderCurva(labels, planificado, certificado, avance, this.financiero);
    },

    async cargarHistorialCertificaciones() {
      const obraId = this.route.params.obraId;
      const res = await api.get(`/obras/${obraId}/certificaciones`);
      this.certsHistorial = res.data || [];
    },

    // Corta después del último cambio real (evita línea plana)
    cutAfterLastChange(series) {
      if (!Array.isArray(series) || series.length === 0) return [];
      const EPS = 0.0001;
      const s = series.map((v) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
      });
      let lastChange = 0;
      let firstNonZero = -1;
      for (let i = 0; i < s.length; i++) {
        if (firstNonZero === -1 && Math.abs(s[i]) > EPS) firstNonZero = i;
        if (i > 0 && Math.abs(s[i] - s[i - 1]) > EPS) lastChange = i;
      }
      let lastIdx = lastChange;
      if (lastIdx === 0 && firstNonZero > 0) lastIdx = firstNonZero;
      return s.map((v, i) => (i <= lastIdx ? v : null));
    },

    renderCurva(labels, planificado, certificado, avance, financiero) {
      if (!this.$refs.curvaChart) return;

      if (this.curvaChartInstance) {
        this.curvaChartInstance.destroy();
      }

      const self = this;
      const certPlot = this.cutAfterLastChange(certificado || []);
      const realPlot = this.cutAfterLastChange(avance || []);

      const dsPlan = {
        label: "Planificado",
        data: (planificado || []).map((v) => Number(v ?? 0)),
        borderColor: "rgba(56, 189, 248, 0.25)",
        borderWidth: 16,
        tension: 0.28,
        pointRadius: 0,
        fill: false,
        order: 10,
      };

      const dsCert = {
        label: "Certificado",
        data: certPlot,
        borderColor: "rgba(34, 197, 94, 1)",
        borderWidth: 8,
        tension: 0.25,
        pointRadius: 5,
        pointBackgroundColor: "rgba(34, 197, 94, 1)",
        pointBorderColor: "#ffffff",
        pointBorderWidth: 2,
        fill: false,
        order: 5,
      };

      const dsReal = {
        label: "Avance de Obra",
        data: realPlot,
        borderColor: "rgba(255, 0, 0, 1)",
        borderWidth: 3,
        tension: 0.22,
        pointRadius: 6,
        pointBackgroundColor: "rgba(255, 0, 0, 1)",
        pointBorderColor: "#ffffff",
        pointBorderWidth: 2,
        fill: false,
        order: 1,
      };

      const datasets = [dsPlan, dsCert, dsReal];

      if (this.esAdmin && financiero && financiero.length) {
        datasets.push({
          label: "Avance financiero",
          data: (financiero || []).map((v) => Number(v ?? 0)),
          borderColor: "rgba(168, 85, 247, 0.95)",
          borderWidth: 5,
          tension: 0.25,
          pointRadius: 4,
          borderDash: [10, 4],
          fill: false,
          order: 7,
        });
      }

      this.curvaChartInstance = new Chart(this.$refs.curvaChart, {
        type: "line",
        data: { labels, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: { position: "bottom" },
            tooltip: {
              callbacks: {
                label(context) {
                  const labelBase = context.dataset.label || "";
                  const value = context.parsed.y ?? 0;
                  const idx = context.dataIndex;

                  if (labelBase === "Certificado") {
                    const numsArr =
                      (self.certNumerosPorPeriodo &&
                        self.certNumerosPorPeriodo[idx]) ||
                      [];
                    const numText =
                      numsArr.length > 0 ? ` (N° ${numsArr.join(", ")})` : "";
                    return `${labelBase}${numText}: ${value.toFixed(2)}%`;
                  }

                  if (labelBase === "Avance financiero") {
                    const monto =
                      (self.financieroMontos && self.financieroMontos[idx]) || 0;
                    const montoStr = Number(monto).toLocaleString("es-AR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    });
                    return `${labelBase}: ${value.toFixed(2)}% - $${montoStr}`;
                  }

                  return `${labelBase}: ${value.toFixed(2)}%`;
                },
              },
            },
          },
          scales: {
            y: {
              min: 0,
              suggestedMax: 100,
              ticks: { callback: (v) => v + "%" },
            },
          },
        },
      });
    },

    formatDate(dateStr) {
      if (!dateStr) return "";
      const d = new Date(dateStr);
      return isNaN(d) ? dateStr : d.toLocaleDateString("es-AR");
    },

    formatPeriodo(cert) {
      if (!cert.periodo_desde || !cert.periodo_hasta) return "";
      return `${this.formatDate(cert.periodo_desde)} → ${this.formatDate(
        cert.periodo_hasta
      )}`;
    },

    formatPercent(value) {
      return `${Number(value || 0).toFixed(2)}%`;
    },

    verDetalleCert(certId) {
      if (!this.esAdmin) {
        alert("Solo un administrador puede ver el detalle de la certificación");
        return;
      }

      this.$router.push({
        name: "DetalleCertificacion",
        params: {
          obraId: this.route.params.obraId,
          certId,
        },
      });
    },

    goToCargarPliego() {
      this.$router.push({
        name: "CargarPliego",
        params: { obraId: this.route.params.obraId },
      });
    },

    goToAddCertificacion() {
      this.$router.push({
        name: "AddCertificacion",
        params: { obraId: this.route.params.obraId },
      });
    },

    goToAddAvanceObra() {
      this.$router.push({
        name: "AddAvanceObra",
        params: { obraId: this.route.params.obraId },
      });
    },

    goToProyeccionObra() {
      this.$router.push({
        name: "ProyeccionObra",
        params: { obraId: this.route.params.obraId },
      });
    },
  },
};
</script>

<style scoped>
.obra-detalle-view { padding: 20px; }
.titulo-obra { text-align: center; font-size: 2rem; margin-bottom: 20px; }
.acciones-container { display: flex; justify-content: center; gap: 12px; flex-wrap: wrap; margin-bottom: 25px; }
.action-btn { width: auto !important; flex: 0 0 auto; }
.panel-avance { display: flex; flex-direction: column; gap: 20px; }
.panel { background: #ffffff; padding: 16px; border-radius: 10px; border: 1px solid #9ca3af; box-shadow: 0 8px 18px rgba(15, 23, 42, 0.15); }
.panel-curva { min-height: 320px; }
.chart-wrap { height: 340px; width: 100%; position: relative; }

.panel-resumen { background: #020617; border: 1px solid #22c55e; color: #e5e7eb; }
.panel-resumen h3 { font-size: 1.1rem; margin-bottom: 10px; font-weight: 800; color: #bbf7d0; text-transform: uppercase; letter-spacing: 0.06em; }

.tabla-resumen { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
.tabla-resumen th, .tabla-resumen td { border: 1px solid #4b5563; padding: 8px 10px; text-align: center; }
.tabla-resumen th { background: linear-gradient(90deg, #047857, #22c55e); color: #f9fafb; font-weight: 800; text-transform: uppercase; font-size: 0.78rem; }

.th-plan { background: linear-gradient(90deg, #1d4ed8, #3b82f6) !important; }
.th-cert { background: linear-gradient(90deg, #047857, #22c55e) !important; }
.th-real { background: linear-gradient(90deg, #b91c1c, #ef4444) !important; }

.td-plan { background: rgba(59, 130, 246, 0.10); }
.td-cert { background: rgba(34, 197, 94, 0.08); }
.td-real { background: rgba(239, 68, 68, 0.10); }

.th-sep-right, .td-sep-right { border-right: 3px solid rgba(255, 255, 255, 0.22) !important; }

.tabla-resumen tbody tr:nth-child(odd) { background: #0b1120; }
.tabla-resumen tbody tr:nth-child(even) { background: #020617; }

.pos { color: #bef264; font-weight: 800; }
.neg { color: #fb7185; font-weight: 800; }

.panel-items { background: #020617; color: #e5e7eb; border-color: #0ea5e9; }
.item-avance { margin-bottom: 14px; }
.item-header { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 0.9rem; }
.barra { height: 16px; background: #1f2937; border-radius: 999px; overflow: hidden; }
.barra-progreso { height: 100%; background: #22c55e; box-shadow: 0 0 10px rgba(34, 197, 94, 0.9); transition: width 0.4s ease; }

.panel-certificaciones { margin-top: 10px; background: #020617; border: 1px solid #22c55e; color: #e5e7eb; }
.tabla-certificaciones { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
.tabla-certificaciones th, .tabla-certificaciones td { border: 1px solid #4b5563; padding: 8px 10px; text-align: center; }
.tabla-certificaciones th { background: linear-gradient(90deg, #047857, #22c55e); color: #f9fafb; }

.btn-detalle { padding: 4px 12px; background: #22c55e; color: #022c22; border: none; border-radius: 999px; cursor: pointer; font-weight: 700; }
.text-muted { color: #9ca3af; font-size: 0.9rem; }
</style>
