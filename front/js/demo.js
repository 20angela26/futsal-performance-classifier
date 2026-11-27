/* Datos de ejemplo para probar el front sin backend (botón "Probar con datos de ejemplo"). */
(function () {
  // PRNG determinista para que el demo sea siempre igual
  let s = 20260;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const between = (a, b) => a + (b - a) * rnd();
  const round = (v, d) => Number(v.toFixed(d));

  function makeEval(id, jugadorId, baseExplosive, step) {
    const k = baseExplosive + step * 0.04 + between(-0.05, 0.05);   // 0..1
    const cmj = round(26 + k * 14 + between(-1, 1), 4);
    const sj = round(cmj - between(1, 3), 4);
    const rsiDj = round(0.6 + k * 0.4 + between(-0.04, 0.04), 4);
    const rsiMod = round(0.25 + k * 0.27 + between(-0.02, 0.02), 4);
    const contacto = round(1.38 + k * 0.25 + between(-0.05, 0.05), 4);
    const react = round(2.45 - k * 0.65 + between(-0.05, 0.05), 4);
    const pExp = Math.min(0.99, Math.max(0.01, round(1 / (1 + Math.exp(-(k - 0.5) * 9)), 4)));
    const cluster = pExp >= 0.5 ? 0 : 1;
    const d = new Date(2026, 8 + Math.floor(step / 2), 3 + step * 9);
    return {
      id, jugador_id: jugadorId, entrenador_id: "demo",
      cmj_promedio_cm: cmj, sj_promedio_cm: sj, rsi_dj_promedio: rsiDj,
      tiempo_reaccion_total_ms: react, rsi_mod_promedio: rsiMod, contacto_dj_promedio: contacto,
      cluster_predicho: cluster,
      perfil_fisico: window.CONFIG.CLUSTERS[cluster].long,
      probabilidad_explosivo: pExp, probabilidad_no_explosivo: round(1 - pExp, 4),
      created_at: d.toISOString()
    };
  }

  const codigos = ["FSU1_2025_01","FSU1_2025_04","FSU1_2025_07","FSU1_2025_09","FSU1_2025_12","FSU1_2025_15",
    "FSU1_2025_18","FSU1_2025_21","FSU1_2025_23","FSU1_2025_26","FSU1_2025_28","FSU1_2025_31",
    "408","412","415","421","433","437"];

  let evalId = 1;
  const jugadores = codigos.map((c, i) => {
    const jid = 100 + i;
    const base = between(0.1, 0.9);
    const n = 1 + Math.floor(rnd() * 4);
    const evs = [];
    for (let k = 0; k < n; k++) evs.push(makeEval(evalId++, jid, base, k));
    return { id: jid, entrenador_id: "demo", jugador: c, masa_kg: round(between(62, 84), 1), evaluaciones: evs };
  });

  window.DEMO = {
    jugadores,
    nextEvalId: () => evalId++,
    makeEval
  };
})();
