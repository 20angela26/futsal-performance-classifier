/* Configuración del front.
 * API_BASE: URL donde corre el backend FastAPI (uvicorn main:app --reload).
 * También se puede cambiar desde la pantalla de login ("Servidor") sin editar este archivo.
 */
window.CONFIG = {
  API_BASE: "http://localhost:8000",

  // Prefijos tal como están definidos en el backend.
  // OJO: en evaluaciones.py el prefijo está escrito "/api/evalucacionnes" (con typo).
  // Si lo corriges en el backend, cambia también esta línea.
  EVAL_PREFIX: "/api/evalucacionnes",

  // Metadatos de las 6 variables que usa el modelo
  METRICS: [
    { key: "cmj_promedio_cm",          label: "CMJ",               unit: "cm", dec: 1, better: "high", desc: "Salto con contramovimiento" },
    { key: "sj_promedio_cm",           label: "SJ",                unit: "cm", dec: 1, better: "high", desc: "Salto desde sentadilla" },
    { key: "rsi_dj_promedio",          label: "RSI DJ",            unit: "",   dec: 2, better: "high", desc: "Índice de fuerza reactiva (drop jump)" },
    { key: "rsi_mod_promedio",         label: "RSI mod",           unit: "m/s",dec: 2, better: "high", desc: "RSI modificado (CMJ)" },
    { key: "contacto_dj_promedio",     label: "Contacto DJ",       unit: "s",  dec: 3, better: "low",  desc: "Tiempo de contacto en drop jump" },
    { key: "tiempo_reaccion_total_ms", label: "Reacción",          unit: "ms", dec: 0, better: "low",  desc: "Tiempo de reacción promedio (9 hits)" }
  ],

  CLUSTERS: {
    0: { name: "Explosivo",  long: "Mayor rendimiento explosivo, reactivo y de agilidad", cls: "c0" },
    1: { name: "No explosivo", long: "Menor rendimiento relativo en las capacidades evaluadas", cls: "c1" }
  }
};
