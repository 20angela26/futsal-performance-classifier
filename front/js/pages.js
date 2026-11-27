/* Páginas / reportes. Cada página: async render(el, params) */
const M = CONFIG.METRICS;
const mult = m => m.mult || 1;                       // reacción: el backend usa segundos, el front muestra ms
const mval = (m, v) => v == null ? null : v * mult(m);
const mcsv = (m, e) => (e && e[m.key] != null) ? Number((e[m.key] * mult(m)).toFixed(4)) : "";
const metricCell = (m, v) => `${U.num(mval(m, v), m.dec)}${m.unit ? `<span class="unit"> ${m.unit}</span>` : ""}`;

function pageHead(title, sub, actions = "") {
  return `<header class="page-head"><div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ""}</div><div class="actions no-print">${actions}</div></header>`;
}
function empty(msg, cta = "") {
  return `<div class="empty"><svg viewBox="0 0 48 48" width="44" height="44" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="24" cy="24" r="19"/><path d="M24 14l7 5-2.6 8h-8.8L17 19z"/></svg><p>${msg}</p>${cta}</div>`;
}
function probBar(p) {
  const e = (p ?? 0) * 100;
  return `<div class="prob" title="Explosivo ${e.toFixed(1)}% · No explosivo ${(100 - e).toFixed(1)}%">
    <i class="c0" style="width:${e}%"></i><i class="c1" style="width:${100 - e}%"></i></div>`;
}
const radarOpts = () => ({
  responsive: true, maintainAspectRatio: false,
  scales: { r: { min: 0, max: 100, ticks: { display: false, stepSize: 25 }, pointLabels: { font: { size: 12, weight: 600 } }, grid: { color: U.color("line") }, angleLines: { color: U.color("line") } } },
  plugins: { legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 8 } },
    tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${c.parsed.r.toFixed(0)} / 100` } } }
});
const radarNote = `<p class="note">Cada eje va de 0 a 100 según el rango del dataset de entrenamiento del modelo. En <b>Reacción</b> el eje está invertido: más afuera = más rápido. <b>Contacto inv.</b> es 1/tiempo de contacto: más afuera = contacto más corto.</p>`;

const Pages = {

  /* =================== PANEL =================== */
  async panel(el) {
    const js = App.state.jugadores;
    const lat = js.map(j => ({ j, e: U.latest(j) })).filter(x => x.e);
    const allEv = js.flatMap(j => U.sortedEvals(j).map(e => ({ ...e, _j: j })));
    if (!js.length) { el.innerHTML = pageHead("Panel", "Resumen de tu plantilla") + empty("Aún no tienes jugadores evaluados.", `<a class="btn primary" href="#/evaluar">Evaluar primer jugador</a>`); return; }

    const nExp = lat.filter(x => x.e.cluster_predicho === 0).length;
    const nPos = lat.length - nExp;
    const react = U.mean(lat.map(x => x.e.tiempo_reaccion_total_ms));
    const cmj = U.mean(lat.map(x => x.e.cmj_promedio_cm));

    const top = lat.slice().sort((a, b) => b.e.probabilidad_explosivo - a.e.probabilidad_explosivo).slice(0, 5);
    const recent = allEv.sort((a, b) => b.id - a.id).slice(0, 6);

    el.innerHTML = pageHead("Panel", "Resumen de tu plantilla según la última evaluación de cada jugador",
      `<a class="btn primary" href="#/evaluar">+ Nueva evaluación</a>`) + `
    <section class="kpis">
      <div class="kpi"><span>Jugadores</span><b>${js.length}</b><small>${allEv.length} evaluaciones en total</small></div>
      <div class="kpi"><span>Perfil explosivo</span><b>${U.pct(nExp / lat.length)}</b><small>${nExp} de ${lat.length} jugadores</small></div>
      <div class="kpi"><span>CMJ promedio</span><b>${U.num(cmj, 1)}<em> cm</em></b><small>última evaluación</small></div>
      <div class="kpi"><span>Reacción promedio</span><b>${U.num(react * 1000, 0)}<em> ms</em></b><small>menor es mejor</small></div>
    </section>

    <section class="grid-2">
      <article class="card"><h3>Distribución de perfiles</h3>
        <div class="chart-box short"><canvas id="ch-dist"></canvas></div>
        <div class="legend-row"><span><i class="dot c0"></i>Explosivo · ${nExp}</span><span><i class="dot c1"></i>No explosivo · ${nPos}</span></div>
      </article>
      <article class="card"><h3>Perfil promedio por clúster</h3>
        <div class="chart-box short"><canvas id="ch-cl"></canvas></div>
        ${radarNote}
      </article>
    </section>

    <section class="grid-2">
      <article class="card"><h3>Más explosivos <small>mayor probabilidad del modelo</small></h3>
        <table class="tbl compact"><tbody>
          ${top.map((x, i) => `<tr class="row-link" data-id="${x.j.id}"><td class="rank">${i + 1}</td><td><b>${U.esc(x.j.jugador)}</b></td><td style="width:42%">${probBar(x.e.probabilidad_explosivo)}</td><td class="num">${U.pct(x.e.probabilidad_explosivo)}</td></tr>`).join("")}
        </tbody></table>
      </article>
      <article class="card"><h3>Evaluaciones recientes</h3>
        <table class="tbl compact"><tbody>
          ${recent.map(e => `<tr class="row-link" data-id="${e._j.id}"><td><b>${U.esc(e._j.jugador)}</b></td><td>${U.badge(e.cluster_predicho)}</td><td class="num">CMJ ${U.num(e.cmj_promedio_cm, 1)} cm</td><td class="num muted">${U.date(e.created_at) || "#" + e.id}</td></tr>`).join("")}
        </tbody></table>
      </article>
    </section>`;

    U.$$(".row-link", el).forEach(r => r.addEventListener("click", () => location.hash = "#/jugador/" + r.dataset.id));

    U.chart(U.$("#ch-dist"), {
      type: "doughnut",
      data: { labels: ["Explosivo", "No explosivo"], datasets: [{ data: [nExp, nPos], backgroundColor: [U.color("c0"), U.color("c1")], borderWidth: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: "68%", plugins: { legend: { display: false } } }
    });

    const rg = U.ranges(lat.map(x => x.e));
    const avg = c => U.metricAvg(lat.filter(x => x.e.cluster_predicho === c).map(x => x.e));
    const a0 = avg(0), a1 = avg(1);
    U.chart(U.$("#ch-cl"), {
      type: "radar",
      data: { labels: M.map(m => m.label), datasets: [
        { label: "Explosivo", data: M.map(m => U.norm(m, a0[m.key], rg)), borderColor: U.color("c0"), backgroundColor: U.hexA(U.color("c0"), .18), pointRadius: 3 },
        { label: "No explosivo", data: M.map(m => U.norm(m, a1[m.key], rg)), borderColor: U.color("c1"), backgroundColor: U.hexA(U.color("c1"), .18), pointRadius: 3 }
      ] },
      options: radarOpts()
    });
  },

  /* =================== JUGADORES =================== */
  async jugadores(el) {
    const st = Pages._jst || (Pages._jst = { q: "", cluster: "all", sort: "jugador", dir: 1 });
    el.innerHTML = pageHead("Jugadores", "Consulta de jugadores con su última evaluación",
      `<button class="btn ghost" id="b-csv">Exportar CSV</button><button class="btn ghost" id="b-print">Imprimir</button>`) + `
    <div class="toolbar no-print">
      <div class="search"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input id="q" type="search" placeholder="Buscar por código o nombre…" value="${U.esc(st.q)}" aria-label="Buscar jugador"></div>
      <div class="chips" role="group" aria-label="Filtrar por perfil">
        ${[["all", "Todos"], ["0", "Explosivo"], ["1", "No explosivo"]].map(([v, l]) => `<button class="chip ${st.cluster === v ? "on" : ""}" data-c="${v}">${l}</button>`).join("")}
      </div>
    </div>
    <div class="card flush"><div class="tbl-wrap" id="tbl"></div></div>`;

    let list = App.state.jugadores;
    const draw = () => {
      let rows = list.map(j => ({ j, e: U.latest(j) }));
      if (st.cluster !== "all") rows = rows.filter(r => r.e && String(r.e.cluster_predicho) === st.cluster);
      const val = r => ({
        jugador: r.j.jugador.toLowerCase(), masa: r.j.masa_kg, n: (r.j.evaluaciones || []).length,
        perfil: r.e?.cluster_predicho ?? 9, prob: r.e?.probabilidad_explosivo ?? -1
      }[st.sort] ?? r.e?.[st.sort] ?? -Infinity);
      rows.sort((a, b) => { const x = val(a), y = val(b); return (x > y ? 1 : x < y ? -1 : 0) * st.dir; });
      Pages._jrows = rows;

      const th = (k, label, cls = "") => `<th class="${cls} sortable ${st.sort === k ? "sorted" : ""}" data-s="${k}" aria-sort="${st.sort === k ? (st.dir > 0 ? "ascending" : "descending") : "none"}">${label}<span class="arr">${st.sort === k ? (st.dir > 0 ? "▲" : "▼") : ""}</span></th>`;
      const tblBox = U.$("#tbl", el);
      if (!tblBox) return;   // página ya cambiada
      tblBox.innerHTML = rows.length ? `
      <table class="tbl"><thead><tr>
        ${th("jugador", "Jugador")}${th("masa", "Masa", "num")}${th("n", "Eval.", "num")}${th("perfil", "Perfil")}
        ${M.map(m => th(m.key, m.label, "num")).join("")}${th("prob", "P. explosivo")}</tr></thead>
        <tbody>${rows.map(({ j, e }) => `<tr class="row-link" data-id="${j.id}">
          <td><b>${U.esc(j.jugador)}</b></td><td class="num">${U.num(j.masa_kg, 1)} <span class="unit">kg</span></td>
          <td class="num">${(j.evaluaciones || []).length}</td>
          <td>${e ? U.badge(e.cluster_predicho) : '<span class="muted">Sin evaluar</span>'}</td>
          ${M.map(m => `<td class="num">${e ? metricCell(m, e[m.key]) : "—"}</td>`).join("")}
          <td style="min-width:120px">${e ? probBar(e.probabilidad_explosivo) + `<span class="tiny">${U.pct(e.probabilidad_explosivo)}</span>` : ""}</td></tr>`).join("")}
        </tbody></table>` : empty("No hay jugadores que coincidan con tu búsqueda.");
      U.$$(".row-link", el).forEach(r => r.addEventListener("click", () => location.hash = "#/jugador/" + r.dataset.id));
      U.$$("th.sortable", el).forEach(t => t.addEventListener("click", () => {
        st.dir = st.sort === t.dataset.s ? -st.dir : 1; st.sort = t.dataset.s; draw();
      }));
    };

    // Búsqueda: usa el endpoint /consultas/buscar (con debounce); vacío → lista completa en caché
    let timer;
    U.$("#q", el).addEventListener("input", ev => {
      st.q = ev.target.value;
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const q = st.q.trim();
        if (!q) { list = App.state.jugadores; return draw(); }
        try { list = await Api.buscar(q); } catch (e) { if (e.status === 404) list = []; else U.toast(e.message, "error"); }
        draw();
      }, 280);
    });
    U.$$(".chip", el).forEach(c => c.addEventListener("click", () => { st.cluster = c.dataset.c; U.$$(".chip", el).forEach(x => x.classList.toggle("on", x === c)); draw(); }));

    U.$("#b-print", el).addEventListener("click", () => window.print());
    U.$("#b-csv", el).addEventListener("click", () => {
      U.csv("jugadores_futsal.csv",
        ["Jugador", "Masa kg", "N evaluaciones", "Perfil", ...M.map(m => `${m.label} (${m.unit || "idx"})`), "P. explosivo", "P. no explosivo"],
        (Pages._jrows || []).map(({ j, e }) => [j.jugador, j.masa_kg, (j.evaluaciones || []).length, e ? CONFIG.CLUSTERS[e.cluster_predicho]?.name : "",
          ...M.map(m => mcsv(m, e)), e?.probabilidad_explosivo ?? "", (e ? U.pNo(e) : "")]));
    });

    // Si hay búsqueda previa guardada, la reaplica
    if (st.q.trim()) { try { list = await Api.buscar(st.q.trim()); } catch { list = []; } }
    draw();
  },

  /* =================== DETALLE DE JUGADOR =================== */
  async jugador(el, [id]) {
    const j = App.state.jugadores.find(x => String(x.id) === String(id));
    if (!j) { el.innerHTML = pageHead("Jugador no encontrado") + empty("No existe ese jugador.", `<a class="btn primary" href="#/jugadores">Volver</a>`); return; }
    const evs = U.sortedEvals(j);
    const last = evs[evs.length - 1], prev = evs[evs.length - 2];
    if (!last) { el.innerHTML = pageHead(U.esc(j.jugador)) + empty("Este jugador aún no tiene evaluaciones."); return; }

    const team = App.state.jugadores.map(U.latest).filter(Boolean);
    const rg = U.ranges(team.concat(evs));
    const teamAvg = U.metricAvg(team);

    const tile = m => {
      const v = last[m.key], p = prev ? prev[m.key] : null;
      let delta = "";
      if (p != null) {
        const d = v - p, good = m.better === "high" ? d > 0 : d < 0;
        if (Math.abs(d) > 1e-9) delta = `<em class="delta ${good ? "up" : "down"}">${d > 0 ? "▲" : "▼"} ${U.num(Math.abs(d) * mult(m), m.dec)}</em>`;
      }
      return `<div class="tile"><span title="${U.esc(m.desc)}">${m.label}</span><b>${metricCell(m, v)}</b>${delta}
        <small>Equipo: ${U.num(mval(m, teamAvg[m.key]), m.dec)}</small></div>`;
    };

    el.innerHTML = `
    <a class="back no-print" href="#/jugadores">← Jugadores</a>
    ${pageHead(U.esc(j.jugador), `Masa corporal ${U.num(j.masa_kg, 1)} kg · ${evs.length} evaluación${evs.length > 1 ? "es" : ""}`,
      `<button class="btn ghost" id="b-csv">Exportar CSV</button><button class="btn ghost" id="b-print">Imprimir</button>`)}
    <section class="card profile">
      <div class="profile-main">${U.badge(last.cluster_predicho)}<h2>${U.esc(CONFIG.CLUSTERS[last.cluster_predicho]?.long || last.perfil_fisico)}</h2>
        <p class="muted">Última evaluación${U.date(last.created_at) ? " · " + U.date(last.created_at) : ""}</p></div>
      <div class="profile-prob">
        <div class="pp"><span>Explosivo</span><b>${U.pct(last.probabilidad_explosivo)}</b></div>
        ${probBar(last.probabilidad_explosivo)}
        <div class="pp r"><span>No explosivo</span><b>${U.pct(U.pNo(last))}</b></div>
      </div>
    </section>

    <section class="tiles">${M.map(tile).join("")}</section>
    <p class="note">▲▼ comparan contra la evaluación anterior; verde = mejora, rojo = empeora.</p>

    <section class="grid-2">
      <article class="card"><h3>Perfil vs. equipo</h3><div class="chart-box"><canvas id="ch-radar"></canvas></div>${radarNote}</article>
      <article class="card"><h3>Evolución</h3>
        ${evs.length < 2 ? `<p class="muted pad">Se necesitan al menos 2 evaluaciones para ver la evolución.</p>` :
          `<div class="chart-box half"><canvas id="ch-ev1"></canvas></div><div class="chart-box half"><canvas id="ch-ev2"></canvas></div>`}
      </article>
    </section>

    <section class="card flush"><h3 class="pad">Historial de evaluaciones</h3><div class="tbl-wrap">
      <table class="tbl"><thead><tr><th>#</th><th>Fecha</th><th>Perfil</th>${M.map(m => `<th class="num">${m.label}</th>`).join("")}<th>P. explosivo</th></tr></thead>
      <tbody>${evs.slice().reverse().map((e, i) => `<tr><td>${evs.length - i}</td><td>${U.date(e.created_at) || "—"}</td><td>${U.badge(e.cluster_predicho)}</td>
        ${M.map(m => `<td class="num">${metricCell(m, e[m.key])}</td>`).join("")}<td>${U.pct(e.probabilidad_explosivo)}</td></tr>`).join("")}</tbody></table></div></section>`;

    U.chart(U.$("#ch-radar"), {
      type: "radar",
      data: { labels: M.map(m => m.label), datasets: [
        { label: j.jugador, data: M.map(m => U.norm(m, last[m.key], rg)), borderColor: U.color("s1"), backgroundColor: U.hexA(U.color("s1"), .2), pointRadius: 3 },
        { label: "Promedio del equipo", data: M.map(m => U.norm(m, teamAvg[m.key], rg)), borderColor: U.color("muted"), borderDash: [5, 4], backgroundColor: "transparent", pointRadius: 0 }
      ] },
      options: radarOpts()
    });

    if (evs.length > 1) {
      const labels = evs.map((e, i) => U.date(e.created_at) || "Eval. " + (i + 1));
      const line = (id, sets, ytitle) => U.chart(U.$(id), {
        type: "line",
        data: { labels, datasets: sets.map((s, i) => ({ label: s.label, data: evs.map(e => e[s.key] * (s.mult || 1)), borderColor: U.color(U.SERIES[i].slice(2)), backgroundColor: U.color(U.SERIES[i].slice(2)), tension: .25, pointRadius: 4, borderWidth: 2 })) },
        options: { responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
          scales: { y: { title: { display: true, text: ytitle } }, x: { grid: { display: false } } },
          plugins: { legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 8 } } } }
      });
      line("#ch-ev1", [{ label: "CMJ", key: "cmj_promedio_cm" }, { label: "SJ", key: "sj_promedio_cm" }], "cm");
      line("#ch-ev2", [{ label: "Reacción", key: "tiempo_reaccion_total_ms", mult: 1000 }], "ms (menor es mejor)");
    }

    U.$("#b-print", el).addEventListener("click", () => window.print());
    U.$("#b-csv", el).addEventListener("click", () => U.csv(`jugador_${j.jugador}.csv`,
      ["Evaluación", "Fecha", "Perfil", ...M.map(m => m.label), "P. explosivo", "P. no explosivo"],
      evs.map((e, i) => [i + 1, U.date(e.created_at) || "", CONFIG.CLUSTERS[e.cluster_predicho]?.name, ...M.map(m => mcsv(m, e)), e.probabilidad_explosivo, U.pNo(e)])));
  },

  /* =================== POR CLÚSTER =================== */
  async clusters(el) {
    el.innerHTML = pageHead("Reporte por perfil", "Evaluaciones agrupadas según el clúster predicho por el modelo",
      `<button class="btn ghost" id="b-csv">Exportar CSV</button><button class="btn ghost" id="b-print">Imprimir</button>`) + `<div id="cl-body"><div class="loading">Cargando…</div></div>`;
    const [c0, c1] = await Promise.all([Api.porCluster(0), Api.porCluster(1)]);
    if (!U.$("#cl-body", el)) return;   // el usuario ya salió de esta página
    const sets = [c0, c1];
    const all = c0.concat(c1);
    if (!all.length) { U.$("#cl-body", el).innerHTML = empty("No hay evaluaciones registradas todavía."); return; }
    const rg = U.ranges(all);
    const avgs = sets.map(s => U.metricAvg(s));
    const uniq = s => new Set(s.map(e => e.jugador_id)).size;

    U.$("#cl-body", el).innerHTML = `
      <section class="grid-2">
        ${sets.map((s, c) => `<article class="card cl-card ${CONFIG.CLUSTERS[c].cls}">
          <div class="cl-top">${U.badge(c)}<b class="big">${s.length}</b><span class="muted">evaluaciones · ${uniq(s)} jugadores</span></div>
          <p>${CONFIG.CLUSTERS[c].long}</p></article>`).join("")}
      </section>
      <section class="grid-2">
        <article class="card"><h3>Perfil medio</h3><div class="chart-box"><canvas id="ch-cmp"></canvas></div>${radarNote}</article>
        <article class="card flush"><h3 class="pad">Promedios por variable</h3>
          <table class="tbl compact"><thead><tr><th>Variable</th><th class="num">Explosivo</th><th class="num">No explosivo</th><th class="num">Dif.</th></tr></thead><tbody>
          ${M.map(m => { const a = avgs[0][m.key], b = avgs[1][m.key]; const d = a != null && b != null && b !== 0 ? (a - b) / b : null;
            return `<tr><td><b>${m.label}</b> <span class="unit">${m.unit}</span></td><td class="num">${U.num(mval(m, a), m.dec)}</td><td class="num">${U.num(mval(m, b), m.dec)}</td><td class="num ${d == null ? "" : ((d > 0) === (m.better === "high") ? "pos" : "neg")}">${d == null ? "—" : (d > 0 ? "+" : "") + (d * 100).toFixed(0) + "%"}</td></tr>`; }).join("")}
          </tbody></table></article>
      </section>
      ${sets.map((s, c) => `<section class="card flush"><h3 class="pad">${U.badge(c)} Evaluaciones <small>${s.length}</small></h3>
        ${s.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Jugador</th><th class="num">Masa</th>${M.map(m => `<th class="num">${m.label}</th>`).join("")}<th>P. explosivo</th></tr></thead><tbody>
        ${s.map(e => `<tr class="row-link" data-id="${e.jugador_id}"><td><b>${U.esc(e.jugadores?.jugador ?? e.jugador_id)}</b></td><td class="num">${U.num(e.jugadores?.masa_kg, 1)} <span class="unit">kg</span></td>
          ${M.map(m => `<td class="num">${metricCell(m, e[m.key])}</td>`).join("")}<td>${U.pct(e.probabilidad_explosivo)}</td></tr>`).join("")}</tbody></table></div>` : empty("Sin evaluaciones en este perfil.")}</section>`).join("")}`;

    U.$$(".row-link", el).forEach(r => r.addEventListener("click", () => location.hash = "#/jugador/" + r.dataset.id));
    U.chart(U.$("#ch-cmp"), {
      type: "radar",
      data: { labels: M.map(m => m.label), datasets: [0, 1].map(c => ({
        label: CONFIG.CLUSTERS[c].name, data: M.map(m => U.norm(m, avgs[c][m.key], rg)),
        borderColor: U.color("c" + c), backgroundColor: U.hexA(U.color("c" + c), .18), pointRadius: 3 })) },
      options: radarOpts()
    });
    U.$("#b-print", el).addEventListener("click", () => window.print());
    U.$("#b-csv", el).addEventListener("click", () => U.csv("reporte_por_perfil.csv",
      ["Perfil", "Jugador", "Masa kg", ...M.map(m => m.label), "P. explosivo", "P. no explosivo"],
      all.map(e => [CONFIG.CLUSTERS[e.cluster_predicho]?.name, e.jugadores?.jugador, e.jugadores?.masa_kg, ...M.map(m => mcsv(m, e)), e.probabilidad_explosivo, U.pNo(e)])));
  },

  /* =================== COMPARAR =================== */
  async comparar(el) {
    const js = App.state.jugadores.filter(j => U.latest(j));
    const sel = Pages._sel || (Pages._sel = []);
    Pages._sel = sel.filter(id => js.some(j => j.id === id));
    el.innerHTML = pageHead("Comparar jugadores", "Elige de 2 a 4 jugadores para comparar su última evaluación") + (js.length < 2 ? empty("Necesitas al menos 2 jugadores evaluados.") : `
      <div class="card"><div class="picker no-print" id="picker">
        ${js.map(j => `<label class="pick"><input type="checkbox" value="${j.id}" ${Pages._sel.includes(j.id) ? "checked" : ""}><span>${U.esc(j.jugador)}</span></label>`).join("")}</div></div>
      <div id="cmp"></div>`);
    if (js.length < 2) return;

    const draw = () => {
      U.destroyCharts();
      const chosen = Pages._sel.map(id => js.find(j => j.id === id)).filter(Boolean);
      const box = U.$("#cmp", el);
      if (chosen.length < 2) { box.innerHTML = `<p class="muted center pad">Selecciona al menos dos jugadores.</p>`; return; }
      const rg = U.ranges(js.map(U.latest));
      box.innerHTML = `<section class="grid-2">
        <article class="card"><h3>Radar</h3><div class="chart-box"><canvas id="ch-cmp2"></canvas></div>${radarNote}</article>
        <article class="card flush"><h3 class="pad">Valores</h3><div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Variable</th>${chosen.map((j, i) => `<th class="num"><i class="dot" style="background:${U.color(U.SERIES[i].slice(2))}"></i>${U.esc(j.jugador)}</th>`).join("")}</tr></thead><tbody>
          <tr><td>Perfil</td>${chosen.map(j => `<td class="num">${U.badge(U.latest(j).cluster_predicho)}</td>`).join("")}</tr>
          ${M.map(m => { const vals = chosen.map(j => U.latest(j)[m.key]); const best = m.better === "high" ? Math.max(...vals) : Math.min(...vals);
            return `<tr><td><b>${m.label}</b> <span class="unit">${m.unit}</span></td>${vals.map(v => `<td class="num ${v === best ? "best" : ""}">${U.num(mval(m, v), m.dec)}</td>`).join("")}</tr>`; }).join("")}
          <tr><td>P. explosivo</td>${chosen.map(j => `<td class="num">${U.pct(U.latest(j).probabilidad_explosivo)}</td>`).join("")}</tr>
        </tbody></table></div><p class="note pad">Resaltado = mejor valor del grupo.</p></article></section>`;
      U.chart(U.$("#ch-cmp2"), {
        type: "radar",
        data: { labels: M.map(m => m.label), datasets: chosen.map((j, i) => { const c = U.color(U.SERIES[i].slice(2)); return {
          label: j.jugador, data: M.map(m => U.norm(m, U.latest(j)[m.key], rg)), borderColor: c, backgroundColor: U.hexA(c, .12), pointRadius: 3 }; }) },
        options: radarOpts()
      });
    };

    U.$$("#picker input", el).forEach(cb => cb.addEventListener("change", () => {
      const id = isNaN(cb.value) ? cb.value : Number(cb.value);
      if (cb.checked) {
        if (Pages._sel.length >= 4) { cb.checked = false; return U.toast("Máximo 4 jugadores.", "info"); }
        Pages._sel.push(id);
      } else Pages._sel = Pages._sel.filter(x => x !== id);
      draw();
    }));
    draw();
  },

  /* =================== NUEVA EVALUACIÓN =================== */
  async evaluar(el) {
    const hits = [1, 2, 3].map(i => `
      <fieldset class="hits"><legend>Intento ${i}</legend>
        ${[1, 2, 3].map(h => `<div class="field"><label for="i${i}h${h}">Hit ${h} <small>ms</small></label>
          <input id="i${i}h${h}" name="intento${i}_hit${h}" type="number" min="1" step="any" inputmode="decimal" required></div>`).join("")}
      </fieldset>`).join("");

    el.innerHTML = pageHead("Nueva evaluación", "Sube el archivo de saltos de un jugador e ingresa sus 9 hits de reacción") + `
    <div class="grid-eval">
      <form class="card" id="f-eval" novalidate>
        <h3>1 · Archivo de saltos</h3>
        <label class="drop" id="drop" for="file">
          <input type="file" id="file" accept=".csv,.xlsx,.xls" hidden>
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 16V4m0 0L7 9m5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>
          <b id="fname">Arrastra el .csv / .xlsx o haz clic</b>
          <span>Tu Excel de saltos (una fila por jugador) o un archivo de un solo jugador</span>
        </label>
        <div id="jump-pick" class="pick-box" hidden></div>
        <details class="req"><summary>Formatos aceptados</summary>
          <p><b>Tu Excel de saltos:</b> una fila por jugador con <code>Jugador</code>, <code>Masa (kg)</code> y, por cada repetición, <code>Altura CMJ</code>, <code>RSI mod</code>, <code>Tiempo de contacto inverso de DJ (1/s)</code>, <code>RSI DJ</code> y <code>Altura SJ</code>. Si trae varios jugadores eliges uno.</p>
          <p><b>Formato del backend (un jugador):</b> <code>deportista</code> (formato <code>codigo.repeticion</code>) <i>o</i> <code>Jugador</code> + <code>repeticion</code>, y:</p>
          <p><code>masa_kg</code> · <code>jump_height_impdis_cm_cmj</code> · <code>rsi_mod_m/s_cmj</code> · <code>contact_time_s_dj</code> · <code>rsi_ratio_dj</code> · <code>jump_height_impdis_cm_sj</code></p></details>
        <div class="field"><label for="jug">Código del jugador <small>(opcional, usa el del archivo si se deja vacío)</small></label><input id="jug" name="jugador" placeholder="ej. FSU1_2025_28"></div>
        <h3>2 · Hits de reacción (ms)</h3>
        <div class="seg no-print" role="tablist" aria-label="Forma de ingresar los hits">
          <button type="button" class="on" data-mode="manual" role="tab">Digitar manualmente</button>
          <button type="button" data-mode="file" role="tab">Subir archivo</button>
        </div>
        <div id="hits-file" hidden>
          <label class="drop small" id="drop2" for="hfile">
            <input type="file" id="hfile" accept=".csv,.txt,.xlsx,.xls" hidden>
            <b id="hname">Arrastra el archivo de hits (.csv / .xlsx) o haz clic</b>
            <span>Se leen los 9 valores y se rellenan abajo para que los revises</span>
          </label>
          <div id="pick-box" class="pick-box" hidden></div>
          <p class="note">Formatos: tu Excel de agilidad (una fila por jugador, columnas <code>Rep. N Hit k</code>; si trae varios jugadores eliges uno) o una tabla simple de 3×3 / 9 valores de un jugador. Si los valores vienen como 2,10 se convierten a 2100 ms.
            <a href="#" id="tpl">Descargar plantilla</a></p>
        </div>
        ${hits}
        <div class="err" id="err" role="alert"></div>
        <button class="btn primary" type="submit">Evaluar y guardar</button>
      </form>
      <aside id="result" class="card result"><h3>Resultado</h3>${empty("Aquí verás la clasificación del jugador cuando envíes el formulario.")}</aside>
    </div>`;

    const toNum = c => {
      if (typeof c === "number") return c;
      const s = String(c ?? "").trim().replace(",", ".");
      return s !== "" && /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null;
    };
    const file = U.$("#file", el), drop = U.$("#drop", el);
    let jump = null;          // tabla ancha de saltos: { players: [{ id, masa, reps }], chosen }

    /* ---- saltos: acepta (a) el formato del backend (1 jugador) o (b) tu Excel "Saltos_def" (una fila por jugador) ---- */
    const parseJumps = async f => {
      if (!/\.(xlsx|xls|csv)$/i.test(f.name)) return null;
      let rows;
      if (/\.csv$/i.test(f.name)) {
        const t = (await f.text()).replace(/^\ufeff/, "");
        if (!/rep\.?\s*\d/i.test(t.slice(0, 800))) return null;
        const wbc = XLSX.read(t, { type: "string" });
        rows = XLSX.utils.sheet_to_json(wbc.Sheets[wbc.SheetNames[0]], { header: 1, raw: true, defval: "" });
      } else {
        const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
        rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: "" });
      }
      const head = (rows[0] || []).map(c => String(c ?? "").replace(/\s+/g, " ").trim());
      const find = (r, re) => head.findIndex(h => new RegExp("^rep\\.? ?" + r + "\\b", "i").test(h) && re.test(h));
      const cols = [1, 2, 3].map(r => ({
        cmj: find(r, /altura cmj/i), rsiMod: find(r, /rsi mod/i), inv: find(r, /contacto/i), rsiDj: find(r, /rsi dj/i), sj: find(r, /altura sj/i)
      }));
      if (cols.some(c => Object.values(c).some(i => i < 0))) return null;      // no es el formato ancho
      const masaC = head.findIndex(h => /^masa/i.test(h));
      let idC = head.findIndex(h => /^(jugador|deportista|c[oó]digo)/i.test(h)); if (idC < 0) idC = 0;
      const players = [];
      rows.slice(1).forEach(r => {
        const reps = cols.map(c => ({ cmj: toNum(r[c.cmj]), rsiMod: toNum(r[c.rsiMod]), inv: toNum(r[c.inv]), rsiDj: toNum(r[c.rsiDj]), sj: toNum(r[c.sj]) }));
        const masa = toNum(r[masaC]);
        if (masa === null || reps.some(x => Object.values(x).some(v => v === null))) return;
        players.push({ id: String(r[idC] ?? "").trim(), masa, reps });
      });
      if (!players.length) throw new Error("No se encontraron jugadores con las 3 repeticiones completas.");
      return { players, chosen: players.length === 1 ? players[0] : null };
    };
    /* Convierte al jugador elegido al formato que valida el backend (columna deportista = codigo.repeticion) */
    const jumpToFile = pl => {
      const csv = ["deportista,masa_kg,jump_height_impdis_cm_cmj,rsi_mod_m/s_cmj,contact_time_s_dj,rsi_ratio_dj,jump_height_impdis_cm_sj",
        ...pl.reps.map((r, i) => [`${pl.id}.${i + 1}`, pl.masa, r.cmj, r.rsiMod, r.inv, r.rsiDj, r.sj].join(","))].join("\n");
      return new File([csv], `saltos_${pl.id}.csv`, { type: "text/csv" });
    };
    const jbox = U.$("#jump-pick", el);
    const setJumpChoice = pl => {
      jump.chosen = pl; jbox.hidden = false;
      jbox.innerHTML = `<span>Jugador del archivo de saltos: <b>${U.esc(pl.id)}</b> · ${U.num(pl.masa, 1)} kg · CMJ prom. ${U.num(U.mean(pl.reps.map(r => r.cmj)), 1)} cm</span>${jump.players.length > 1 ? ` <a href="#" id="jump-change">cambiar</a>` : ""}`;
      const ch = U.$("#jump-change", el); if (ch) ch.addEventListener("click", e => { e.preventDefault(); askJumpPlayer(); });
    };
    const askJumpPlayer = () => {
      jbox.hidden = false;
      jbox.innerHTML = `<label for="jump-sel"><b>El archivo trae ${jump.players.length} jugadores.</b> Elige el de esta evaluación:</label>
        <div class="inline"><select id="jump-sel">${jump.players.map((pl, i) => `<option value="${i}" ${jump.chosen === pl ? "selected" : ""}>${U.esc(pl.id)}</option>`).join("")}</select>
        <button type="button" class="btn primary" id="jump-go">Usar este jugador</button></div>`;
      U.$("#jump-go", el).addEventListener("click", () => setJumpChoice(jump.players[Number(U.$("#jump-sel", el).value)]));
    };
    const onJumpFile = async () => {
      const f = file.files[0];
      U.$("#fname", el).textContent = f?.name || "Arrastra el .csv / .xlsx o haz clic";
      jump = null; jbox.hidden = true; jbox.innerHTML = "";
      if (!f) return;
      try {
        jump = await parseJumps(f);
        if (!jump) return;                                       // formato del backend: se envía tal cual
        if (jump.chosen) setJumpChoice(jump.chosen); else askJumpPlayer();
      } catch (e) { jump = null; U.toast(e.message, "error", 7000); }
    };
    file.addEventListener("change", onJumpFile);
    ["dragover", "dragenter"].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add("over"); }));
    ["dragleave", "drop"].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove("over"); }));
    drop.addEventListener("drop", e => { if (e.dataTransfer.files[0]) { file.files = e.dataTransfer.files; onJumpFile(); } });

    /* ---- hits: manual o desde archivo ---- */
    const showMode = m => {
      U.$$(".seg button", el).forEach(b => b.classList.toggle("on", b.dataset.mode === m));
      U.$("#hits-file", el).hidden = m !== "file";
    };
    U.$$(".seg button", el).forEach(b => b.addEventListener("click", () => showMode(b.dataset.mode)));

    /* Lee el archivo de hits. Devuelve { players: [{ id, hits: [9 valores en ms] }], converted }.
       Formatos: (a) tabla ancha: una fila por jugador con columnas "Rep. N Hit k (ms)";
                 (b) 3x3 o 9 valores sueltos de un solo jugador. */
    const parseWide = rows => {
      const head = (rows[0] || []).map(c => String(c ?? "").replace(/\s+/g, " ").trim());
      const idx = {};
      head.forEach((h, c) => {
        const m = /rep\.?\s*(\d)\b.*?\bhit\s*(\d)\b/i.exec(h);
        if (m && !/promedio/i.test(h)) idx[`${m[1]}-${m[2]}`] = c;
      });
      const keys = [1, 2, 3].flatMap(i => [1, 2, 3].map(h => `${i}-${h}`));
      if (!keys.every(k => k in idx)) return null;
      let idc = head.findIndex(h => /^(jugador|deportista|c[oó]digo)/i.test(h)); if (idc < 0) idc = 0;
      const players = [];
      rows.slice(1).forEach(r => {
        const hits = keys.map(k => toNum(r[idx[k]]));
        if (hits.some(v => v === null)) return;                 // fila vacía / incompleta
        players.push({ id: String(r[idc] ?? "").trim(), hits });
      });
      if (!players.length) throw new Error("No se encontraron filas con los 9 hits completos.");
      const all = players.flatMap(pl => pl.hits);
      if (all.some(v => v <= 0)) throw new Error("Todos los hits deben ser mayores que cero.");
      const secs = all.every(v => v < 50), mixed = !secs && all.some(v => v < 50);
      if (mixed) throw new Error("El archivo mezcla valores en segundos y en milisegundos.");
      if (secs) players.forEach(pl => pl.hits = pl.hits.map(v => Number((v * 1000).toFixed(3))));   // 2,10 → 2100 ms
      return { players, converted: secs };
    };
    const parseHits = async f => {
      let rows, text = null;
      if (/\.(xlsx|xls)$/i.test(f.name)) {
        const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
        const sh = wb.SheetNames.find(n => /5-10-5|hit|agilidad/i.test(n)) || wb.SheetNames[0];
        rows = XLSX.utils.sheet_to_json(wb.Sheets[sh], { header: 1, raw: true, defval: "" });
      } else {
        text = (await f.text()).replace(/^﻿/, "");
        if (/rep\.?\s*\d/i.test(text.slice(0, 600)) && /hit/i.test(text.slice(0, 600))) {
          const wb = XLSX.read(text, { type: "string" });
          rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: "" });
        } else {
          const sep = text.includes(";") ? ";" : text.includes("\t") ? "\t" : ",";
          rows = text.split(/\r?\n/).filter(l => l.trim()).map(l => l.split(sep));
        }
      }
      const wide = parseWide(rows);
      if (wide) return wide;

      let nums = rows.map(r => r.map(toNum).filter(v => v !== null)).filter(r => r.length);
      // columna índice 1,2,3 al inicio de cada fila (3 filas x 4 números)
      if (nums.length === 3 && nums.every((r, i) => r.length === 4 && r[0] === i + 1)) nums = nums.map(r => r.slice(1));
      const flat = nums.flat();
      if (flat.length !== 9) throw new Error(`No se reconoció el formato: se esperaban 9 valores de un jugador (o una tabla con columnas "Rep. N Hit k") y se encontraron ${flat.length} números.`);
      if (flat.some(v => v <= 0)) throw new Error("Todos los hits deben ser mayores que cero (en ms).");
      if (flat.some(v => v < 50)) throw new Error("Los hits parecen estar en segundos. Deben ir en milisegundos (ej. 1840).");
      return { players: [{ id: null, hits: flat }], converted: false };
    };

    const fillHits = (pl, f, converted) => {
      pl.hits.forEach((x, k) => { U.$(`#i${Math.floor(k / 3) + 1}h${(k % 3) + 1}`, el).value = x; });
      U.$("#hname", el).textContent = f.name;
      U.$("#pick-box", el).hidden = true;
      U.toast(`9 hits cargados${pl.id ? " de " + pl.id : ""}${converted ? " (convertidos de s a ms)" : ""}. Revísalos antes de guardar.`, "ok");
      showMode("manual"); U.$("#err", el).textContent = "";
    };
    const loadHits = async f => {
      if (!f) return;
      try {
        const { players, converted } = await parseHits(f);
        if (players.length === 1) return fillHits(players[0], f, converted);

        // Varios jugadores: intenta elegir por el código escrito o por el nombre del archivo de saltos
        const code = (jump?.chosen?.id || U.$("#jug", el).value).trim().toLowerCase();
        const jfile = (file.files[0]?.name || "").toLowerCase();
        const exact = players.filter(pl => pl.id && code && pl.id.toLowerCase() === code);       // 1) jugador elegido / código escrito
        const byName = players.filter(pl => pl.id && new RegExp("(^|[^a-z0-9])" + pl.id.toLowerCase().replace(/[^a-z0-9]/g, "") + "([^a-z0-9]|$)").test(jfile));
        const hit = exact.length === 1 ? exact : (!code && byName.length === 1 ? byName : []);   // 2) nombre del archivo, solo si es inequívoco
        if (hit.length === 1) return fillHits(hit[0], f, converted);

        // si no se puede deducir, el usuario elige
        const box = U.$("#pick-box", el);
        box.innerHTML = `<label for="pick-sel"><b>El archivo trae ${players.length} jugadores.</b> Elige el de esta evaluación:</label>
          <div class="inline"><select id="pick-sel">${players.map((pl, i) => `<option value="${i}">${U.esc(pl.id)}</option>`).join("")}</select>
          <button type="button" class="btn primary" id="pick-go">Cargar hits</button></div>`;
        box.hidden = false;
        U.$("#hname", el).textContent = f.name;
        U.$("#pick-go", el).addEventListener("click", () => fillHits(players[Number(U.$("#pick-sel", el).value)], f, converted));
      } catch (e) { U.toast(e.message, "error", 7000); }
    };
    const hf = U.$("#hfile", el), d2 = U.$("#drop2", el);
    hf.addEventListener("change", () => { loadHits(hf.files[0]); hf.value = ""; });
    ["dragover", "dragenter"].forEach(t => d2.addEventListener(t, e => { e.preventDefault(); d2.classList.add("over"); }));
    ["dragleave", "drop"].forEach(t => d2.addEventListener(t, e => { e.preventDefault(); d2.classList.remove("over"); }));
    d2.addEventListener("drop", e => loadHits(e.dataTransfer.files[0]));
    U.$("#tpl", el).addEventListener("click", e => {
      e.preventDefault();
      U.csv("plantilla_hits.csv", ["Intento", "Hit 1 (ms)", "Hit 2 (ms)", "Hit 3 (ms)"],
        [["Intento 1", 1740, 2380, 1380], ["Intento 2", 1790, 2410, 1410], ["Intento 3", 1710, 2350, 1360]]);
    });

    const form = U.$("#f-eval", el), err = m => U.$("#err", el).textContent = m || "";
    form.addEventListener("submit", async ev => {
      ev.preventDefault(); err();
      if (!file.files[0]) return err("Selecciona el archivo de saltos.");
      if (!/\.(csv|xlsx|xls)$/i.test(file.files[0].name)) return err("El archivo debe ser .csv, .xlsx o .xls");
      if (jump && !jump.chosen) return err("El archivo de saltos trae varios jugadores: elige uno.");
      const fd = new FormData();
      fd.append("file", jump ? jumpToFile(jump.chosen) : file.files[0]);   // Excel ancho → archivo de un solo jugador
      fd.append("jugador", U.$("#jug", el).value.trim() || (jump ? jump.chosen.id : ""));
      for (let i = 1; i <= 3; i++) for (let h = 1; h <= 3; h++) {
        const v = parseFloat(U.$(`#i${i}h${h}`, el).value.replace(",", "."));
        if (!(v > 0)) return err(`Intento ${i}, hit ${h}: ingresa un valor positivo en milisegundos (ej. 1840).`);
        if (v < 50) return err(`Intento ${i}, hit ${h}: ${v} parece estar en segundos. Ingrésalo en milisegundos (ej. 1840).`);
        fd.append(`intento${i}_hit${h}`, Number((v / 1000).toFixed(6)));   // el modelo trabaja con la escala 1,84 → se envía en esa escala
      }
      await U.withBusy(U.$("button[type=submit]", form), async () => {
        try {
          const r = await Api.evaluar(fd);
          U.toast("Evaluación guardada", "ok");
          await App.refresh(true);
          const rb = U.$("#result", el);
          if (rb) Pages.showResult(rb, r.resultado);
        } catch (e) { err(e.message); }
      });
    });
  },

  showResult(box, r) {
    const c = r.cluster_predicho;
    box.innerHTML = `<h3>Resultado</h3>
      <div class="res-head">${U.badge(c)}<h2>${U.esc(r.jugador)}</h2></div>
      <p class="muted">${U.esc(CONFIG.CLUSTERS[r.cluster_predicho]?.long || r.perfil_fisico)}</p>
      <div class="profile-prob stack"><div class="pp"><span>Explosivo</span><b>${U.pct(r.probabilidad_explosivo)}</b></div>${probBar(r.probabilidad_explosivo)}<div class="pp r"><span>No explosivo</span><b>${U.pct(U.pNo(r))}</b></div></div>
      <dl class="res-list">${M.map(m => `<div><dt>${m.label}</dt><dd>${metricCell(m, r[m.key])}</dd></div>`).join("")}</dl>
      <a class="btn primary block" href="#/jugadores">Ver en reportes</a>`;
  }
};
