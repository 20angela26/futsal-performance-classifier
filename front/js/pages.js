/* Páginas / reportes. Cada página: async render(el, params) */
const M = CONFIG.METRICS;
const metricCell = (m, v) => `${U.num(v, m.dec)}${m.unit ? `<span class="unit"> ${m.unit}</span>` : ""}`;

function pageHead(title, sub, actions = "") {
  return `<header class="page-head"><div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ""}</div><div class="actions no-print">${actions}</div></header>`;
}
function empty(msg, cta = "") {
  return `<div class="empty"><svg viewBox="0 0 48 48" width="44" height="44" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="24" cy="24" r="19"/><path d="M24 14l7 5-2.6 8h-8.8L17 19z"/></svg><p>${msg}</p>${cta}</div>`;
}
function probBar(p) {
  const e = (p ?? 0) * 100;
  return `<div class="prob" title="Explosivo ${e.toFixed(1)}% · Posicional ${(100 - e).toFixed(1)}%">
    <i class="c0" style="width:${e}%"></i><i class="c1" style="width:${100 - e}%"></i></div>`;
}
const radarOpts = () => ({
  responsive: true, maintainAspectRatio: false,
  scales: { r: { min: 0, max: 100, ticks: { display: false, stepSize: 25 }, pointLabels: { font: { size: 12, weight: 600 } }, grid: { color: U.color("line") }, angleLines: { color: U.color("line") } } },
  plugins: { legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 8 } },
    tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${c.parsed.r.toFixed(0)} / 100` } } }
});
const radarNote = `<p class="note">Cada eje va de 0 a 100 según el rango del equipo. En <b>Reacción</b> y <b>Contacto DJ</b> el eje está invertido: más afuera = más rápido.</p>`;

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
      <div class="kpi"><span>Reacción promedio</span><b>${U.num(react, 0)}<em> ms</em></b><small>menor es mejor</small></div>
    </section>

    <section class="grid-2">
      <article class="card"><h3>Distribución de perfiles</h3>
        <div class="chart-box short"><canvas id="ch-dist"></canvas></div>
        <div class="legend-row"><span><i class="dot c0"></i>Explosivo · ${nExp}</span><span><i class="dot c1"></i>Posicional · ${nPos}</span></div>
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
      data: { labels: ["Explosivo", "Posicional"], datasets: [{ data: [nExp, nPos], backgroundColor: [U.color("c0"), U.color("c1")], borderWidth: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: "68%", plugins: { legend: { display: false } } }
    });

    const rg = U.ranges(lat.map(x => x.e));
    const avg = c => U.metricAvg(lat.filter(x => x.e.cluster_predicho === c).map(x => x.e));
    const a0 = avg(0), a1 = avg(1);
    U.chart(U.$("#ch-cl"), {
      type: "radar",
      data: { labels: M.map(m => m.label), datasets: [
        { label: "Explosivo", data: M.map(m => U.norm(m, a0[m.key], rg)), borderColor: U.color("c0"), backgroundColor: U.hexA(U.color("c0"), .18), pointRadius: 3 },
        { label: "Posicional", data: M.map(m => U.norm(m, a1[m.key], rg)), borderColor: U.color("c1"), backgroundColor: U.hexA(U.color("c1"), .18), pointRadius: 3 }
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
        ${[["all", "Todos"], ["0", "Explosivo"], ["1", "Posicional"]].map(([v, l]) => `<button class="chip ${st.cluster === v ? "on" : ""}" data-c="${v}">${l}</button>`).join("")}
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
        ["Jugador", "Masa kg", "N evaluaciones", "Perfil", ...M.map(m => `${m.label} (${m.unit || "idx"})`), "P. explosivo", "P. posicional"],
        (Pages._jrows || []).map(({ j, e }) => [j.jugador, j.masa_kg, (j.evaluaciones || []).length, e ? CONFIG.CLUSTERS[e.cluster_predicho]?.name : "",
          ...M.map(m => e ? e[m.key] : ""), e?.probabilidad_explosivo ?? "", e?.probabilidad_posicional ?? ""]));
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
        if (Math.abs(d) > 1e-9) delta = `<em class="delta ${good ? "up" : "down"}">${d > 0 ? "▲" : "▼"} ${U.num(Math.abs(d), m.dec)}</em>`;
      }
      return `<div class="tile"><span title="${U.esc(m.desc)}">${m.label}</span><b>${metricCell(m, v)}</b>${delta}
        <small>Equipo: ${U.num(teamAvg[m.key], m.dec)}</small></div>`;
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
        <div class="pp r"><span>Posicional</span><b>${U.pct(last.probabilidad_posicional)}</b></div>
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
        data: { labels, datasets: sets.map((s, i) => ({ label: s.label, data: evs.map(e => e[s.key]), borderColor: U.color(U.SERIES[i].slice(2)), backgroundColor: U.color(U.SERIES[i].slice(2)), tension: .25, pointRadius: 4, borderWidth: 2 })) },
        options: { responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
          scales: { y: { title: { display: true, text: ytitle } }, x: { grid: { display: false } } },
          plugins: { legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 8 } } } }
      });
      line("#ch-ev1", [{ label: "CMJ", key: "cmj_promedio_cm" }, { label: "SJ", key: "sj_promedio_cm" }], "cm");
      line("#ch-ev2", [{ label: "Reacción", key: "tiempo_reaccion_total_ms" }], "ms (menor es mejor)");
    }

    U.$("#b-print", el).addEventListener("click", () => window.print());
    U.$("#b-csv", el).addEventListener("click", () => U.csv(`jugador_${j.jugador}.csv`,
      ["Evaluación", "Fecha", "Perfil", ...M.map(m => m.label), "P. explosivo", "P. posicional"],
      evs.map((e, i) => [i + 1, U.date(e.created_at) || "", CONFIG.CLUSTERS[e.cluster_predicho]?.name, ...M.map(m => e[m.key]), e.probabilidad_explosivo, e.probabilidad_posicional])));
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
          <table class="tbl compact"><thead><tr><th>Variable</th><th class="num">Explosivo</th><th class="num">Posicional</th><th class="num">Dif.</th></tr></thead><tbody>
          ${M.map(m => { const a = avgs[0][m.key], b = avgs[1][m.key]; const d = a != null && b != null && b !== 0 ? (a - b) / b : null;
            return `<tr><td><b>${m.label}</b> <span class="unit">${m.unit}</span></td><td class="num">${U.num(a, m.dec)}</td><td class="num">${U.num(b, m.dec)}</td><td class="num ${d == null ? "" : ((d > 0) === (m.better === "high") ? "pos" : "neg")}">${d == null ? "—" : (d > 0 ? "+" : "") + (d * 100).toFixed(0) + "%"}</td></tr>`; }).join("")}
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
      ["Perfil", "Jugador", "Masa kg", ...M.map(m => m.label), "P. explosivo", "P. posicional"],
      all.map(e => [CONFIG.CLUSTERS[e.cluster_predicho]?.name, e.jugadores?.jugador, e.jugadores?.masa_kg, ...M.map(m => e[m.key]), e.probabilidad_explosivo, e.probabilidad_posicional])));
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
            return `<tr><td><b>${m.label}</b> <span class="unit">${m.unit}</span></td>${vals.map(v => `<td class="num ${v === best ? "best" : ""}">${U.num(v, m.dec)}</td>`).join("")}</tr>`; }).join("")}
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
          <span>3 repeticiones de UN solo jugador</span>
        </label>
        <details class="req"><summary>Columnas requeridas</summary>
          <p><code>deportista</code> (formato <code>codigo.repeticion</code>) <i>o</i> <code>Jugador</code> + <code>repeticion</code>, y:</p>
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
          <p class="note">Formato: 3 filas (intentos) × 3 columnas (hits), o 9 valores en cualquier orden. Puede traer encabezado y/o una primera columna con el nombre del intento.
            <a href="#" id="tpl">Descargar plantilla</a></p>
        </div>
        ${hits}
        <div class="err" id="err" role="alert"></div>
        <button class="btn primary" type="submit">Evaluar y guardar</button>
      </form>
      <aside id="result" class="card result"><h3>Resultado</h3>${empty("Aquí verás la clasificación del jugador cuando envíes el formulario.")}</aside>
    </div>`;

    const file = U.$("#file", el), drop = U.$("#drop", el);
    const setName = () => U.$("#fname", el).textContent = file.files[0]?.name || "Arrastra el .csv / .xlsx o haz clic";
    file.addEventListener("change", setName);
    ["dragover", "dragenter"].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add("over"); }));
    ["dragleave", "drop"].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove("over"); }));
    drop.addEventListener("drop", e => { if (e.dataTransfer.files[0]) { file.files = e.dataTransfer.files; setName(); } });

    /* ---- hits: manual o desde archivo ---- */
    const showMode = m => {
      U.$$(".seg button", el).forEach(b => b.classList.toggle("on", b.dataset.mode === m));
      U.$("#hits-file", el).hidden = m !== "file";
    };
    U.$$(".seg button", el).forEach(b => b.addEventListener("click", () => showMode(b.dataset.mode)));

    const parseHits = async f => {
      let rows;
      if (/\.(xlsx|xls)$/i.test(f.name)) {
        const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
        rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: "" });
      } else {
        const txt = (await f.text()).replace(/^﻿/, "");
        const sep = txt.includes(";") ? ";" : txt.includes("\t") ? "\t" : ",";
        // si el separador es ";" las comas son decimales; si es "," los decimales deben venir con punto
        rows = txt.split(/\r?\n/).filter(l => l.trim()).map(l => l.split(sep));
      }
      const toNum = c => {
        if (typeof c === "number") return c;
        const s = String(c ?? "").trim().replace(",", ".");
        return s !== "" && /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null;
      };
      let nums = rows.map(r => r.map(toNum).filter(v => v !== null)).filter(r => r.length);
      // columna índice 1,2,3 al inicio de cada fila (3 filas x 4 números)
      if (nums.length === 3 && nums.every((r, i) => r.length === 4 && r[0] === i + 1)) nums = nums.map(r => r.slice(1));
      const flat = nums.flat();
      if (flat.length !== 9) throw new Error(`Se esperaban 9 valores numéricos y se encontraron ${flat.length}.`);
      if (flat.some(v => v <= 0)) throw new Error("Todos los hits deben ser mayores que cero (ms).");
      return flat;
    };
    const loadHits = async f => {
      if (!f) return;
      try {
        const v = await parseHits(f);
        v.forEach((x, k) => { U.$(`#i${Math.floor(k / 3) + 1}h${(k % 3) + 1}`, el).value = x; });
        U.$("#hname", el).textContent = f.name;
        U.toast("9 hits cargados. Revísalos antes de guardar.", "ok");
        showMode("manual"); U.$("#err", el).textContent = "";
      } catch (e) { U.toast(e.message, "error", 6000); }
    };
    const hf = U.$("#hfile", el), d2 = U.$("#drop2", el);
    hf.addEventListener("change", () => { loadHits(hf.files[0]); hf.value = ""; });
    ["dragover", "dragenter"].forEach(t => d2.addEventListener(t, e => { e.preventDefault(); d2.classList.add("over"); }));
    ["dragleave", "drop"].forEach(t => d2.addEventListener(t, e => { e.preventDefault(); d2.classList.remove("over"); }));
    d2.addEventListener("drop", e => loadHits(e.dataTransfer.files[0]));
    U.$("#tpl", el).addEventListener("click", e => {
      e.preventDefault();
      U.csv("plantilla_hits.csv", ["Intento", "Hit 1 (ms)", "Hit 2 (ms)", "Hit 3 (ms)"],
        [["Intento 1", 420, 435, 410], ["Intento 2", 428, 415, 440], ["Intento 3", 432, 421, 418]]);
    });

    const form = U.$("#f-eval", el), err = m => U.$("#err", el).textContent = m || "";
    form.addEventListener("submit", async ev => {
      ev.preventDefault(); err();
      if (!file.files[0]) return err("Selecciona el archivo de saltos.");
      if (!/\.(csv|xlsx|xls)$/i.test(file.files[0].name)) return err("El archivo debe ser .csv, .xlsx o .xls");
      const fd = new FormData();
      fd.append("file", file.files[0]);
      fd.append("jugador", U.$("#jug", el).value.trim());
      for (let i = 1; i <= 3; i++) for (let h = 1; h <= 3; h++) {
        const v = parseFloat(U.$(`#i${i}h${h}`, el).value.replace(",", "."));
        if (!(v > 0)) return err(`Intento ${i}, hit ${h}: ingresa un valor positivo en milisegundos.`);
        fd.append(`intento${i}_hit${h}`, v);
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
      <p class="muted">${U.esc(r.perfil_fisico)}</p>
      <div class="profile-prob stack"><div class="pp"><span>Explosivo</span><b>${U.pct(r.probabilidad_explosivo)}</b></div>${probBar(r.probabilidad_explosivo)}<div class="pp r"><span>Posicional</span><b>${U.pct(r.probabilidad_posicional)}</b></div></div>
      <dl class="res-list">${M.map(m => `<div><dt>${m.label}</dt><dd>${metricCell(m, r[m.key])}</dd></div>`).join("")}</dl>
      <a class="btn primary block" href="#/jugadores">Ver en reportes</a>`;
  }
};
