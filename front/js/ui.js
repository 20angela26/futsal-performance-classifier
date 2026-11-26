/* Utilidades de UI, formato, estadística y gráficos. */
const U = {
  esc(v) {
    return String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  },
  $(sel, el = document) { return el.querySelector(sel); },
  $$(sel, el = document) { return [...el.querySelectorAll(sel)]; },

  num(v, dec = 2) {
    if (v === null || v === undefined || isNaN(v)) return "—";
    return Number(v).toLocaleString("es-CO", { minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: dec > 0 });
  },
  /* probabilidad de 'no explosivo': el backend nuevo usa probabilidad_no_explosivo; el anterior, probabilidad_posicional */
  pNo(e) { return e ? (e.probabilidad_no_explosivo ?? e.probabilidad_posicional ?? (e.probabilidad_explosivo != null ? 1 - e.probabilidad_explosivo : null)) : null; },
  pct(v) { return v == null ? "—" : (v * 100).toLocaleString("es-CO", { maximumFractionDigits: 1 }) + "%"; },
  date(iso) {
    if (!iso) return null;
    const d = new Date(iso);
    return isNaN(d) ? null : d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
  },

  toast(msg, type = "info", ms = 4500) {
    const el = document.createElement("div");
    el.className = "toast " + type;
    el.textContent = msg;
    U.$("#toasts").appendChild(el);
    setTimeout(() => el.classList.add("out"), ms);
    setTimeout(() => el.remove(), ms + 400);
  },

  badge(cluster) {
    const c = CONFIG.CLUSTERS[cluster];
    return c ? `<span class="badge ${c.cls}">${c.name}</span>` : `<span class="badge">—</span>`;
  },

  /* ---------- datos derivados ---------- */
  latest(j) {
    const ev = (j.evaluaciones || []).slice().sort((a, b) => a.id - b.id);
    return ev.length ? ev[ev.length - 1] : null;
  },
  sortedEvals(j) { return (j.evaluaciones || []).slice().sort((a, b) => a.id - b.id); },

  mean(arr) { const a = arr.filter(v => v != null && !isNaN(v)); return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null; },

  /* min/max de cada métrica sobre un conjunto de evaluaciones → normalización 0-100 (invierte las "menor es mejor") */
  ranges(evals) {
    const r = {};
    CONFIG.METRICS.forEach(m => {
      const v = evals.map(e => e[m.key]).filter(x => x != null);
      r[m.key] = { min: Math.min(...v), max: Math.max(...v) };
    });
    return r;
  },
  /* Normaliza a 0-100. Usa el rango de referencia del entrenamiento (m.ref) para que el gráfico no cambie
     según cuántos jugadores haya cargados; si no existe, usa el rango observado. Invierte las "menor es mejor". */
  norm(m, value, ranges) {
    if (value == null || isNaN(value)) return 50;
    const [min, max] = m.ref || [(ranges[m.key] || {}).min, (ranges[m.key] || {}).max];
    if (max === undefined || !isFinite(min) || max === min) return 50;
    let p = Math.min(100, Math.max(0, (value - min) / (max - min) * 100));
    return m.better === "low" ? 100 - p : p;
  },

  metricAvg(evals) {
    const o = {};
    CONFIG.METRICS.forEach(m => o[m.key] = U.mean(evals.map(e => e[m.key])));
    return o;
  },

  /* ---------- exportación ---------- */
  csv(filename, headers, rows) {
    const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const text = "﻿" + [headers.map(q).join(","), ...rows.map(r => r.map(q).join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  },

  /* ---------- gráficos ---------- */
  _charts: [],
  destroyCharts() { U._charts.forEach(c => c.destroy()); U._charts = []; },
  chart(canvas, cfg) {
    const css = getComputedStyle(document.documentElement);
    Chart.defaults.font.family = "Inter, system-ui, sans-serif";
    Chart.defaults.color = css.getPropertyValue("--muted").trim() || "#64748b";
    Chart.defaults.borderColor = css.getPropertyValue("--line").trim() || "#e2e8f0";
    const c = new Chart(canvas, cfg);
    U._charts.push(c);
    return c;
  },
  color(name) { return getComputedStyle(document.documentElement).getPropertyValue("--" + name).trim(); },
  hexA(hex, a) {
    const h = hex.replace("#", "");
    const n = parseInt(h.length === 3 ? h.split("").map(x => x + x).join("") : h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  },
  SERIES: ["--s1", "--s2", "--s3", "--s4"],

  async withBusy(btn, fn) {
    const txt = btn.innerHTML;
    btn.disabled = true; btn.classList.add("busy");
    try { return await fn(); }
    finally { btn.disabled = false; btn.classList.remove("busy"); btn.innerHTML = txt; }
  }
};
