/* Configuración del front.
 * API_BASE: URL donde corre el backend FastAPI (uvicorn main:app --reload).
 * También se puede cambiar desde la pantalla de login ("Servidor") sin editar este archivo.
 */
window.CONFIG = {
  API_BASE: "http://localhost:8000",

  // Prefijos tal como están definidos en el backend.
  EVAL_PREFIX: "/api/evalucacionnes",

  // Metadatos de las 6 variables que usa el modelo
  METRICS: [
    // ref = rango de referencia (mín–máx del dataset de entrenamiento defModelo.csv) para el gráfico de telaraña.
    // mult = factor de visualización (el backend guarda la reacción en segundos; el front la muestra en ms).
    { key: "cmj_promedio_cm",          label: "CMJ",             unit: "cm",  dec: 1, better: "high", ref: [24.5, 43.4],   desc: "Salto con contramovimiento" },
    { key: "sj_promedio_cm",           label: "SJ",              unit: "cm",  dec: 1, better: "high", ref: [20.3, 41.6],   desc: "Salto desde sentadilla" },
    { key: "rsi_dj_promedio",          label: "RSI DJ",          unit: "",    dec: 2, better: "high", ref: [0.59, 1.04],   desc: "Índice de fuerza reactiva (drop jump)" },
    { key: "rsi_mod_promedio",         label: "RSI mod",         unit: "m/s", dec: 2, better: "high", ref: [0.25, 0.52],   desc: "RSI modificado (CMJ)" },
    // OJO: es el tiempo de contacto INVERSO (1/s). Más alto = contacto más corto = mejor.
    { key: "contacto_dj_promedio",     label: "Contacto inv. DJ", unit: "1/s", dec: 2, better: "high", ref: [1.35, 2.14],  desc: "Tiempo de contacto inverso en drop jump (1/s): más alto = contacto más corto" },
    { key: "tiempo_reaccion_total_ms", label: "Reacción",        unit: "ms",  dec: 0, mult: 1000, better: "low", ref: [1.74, 2.48], desc: "Tiempo de reacción promedio (9 hits)" }
  ],


  CLUSTERS: {
    0: { name: "Explosivo",  long: "Mayor rendimiento explosivo, reactivo y de agilidad", cls: "c0" },
    1: { name: "No explosivo", long: "Menor rendimiento relativo en las capacidades evaluadas", cls: "c1" }
  }
};
