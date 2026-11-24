/* Shell de la aplicación: sesión, navegación por hash y carga de datos. */
const App = {
  state: { jugadores: [], session: null },
  root: null,

  ROUTES: {
    panel:     { label: "Panel",       icon: "M3 13h8V3H3zm0 8h8v-6H3zm10 0h8V11h-8zm0-18v6h8V3z", fn: "panel" },
    jugadores: { label: "Jugadores",   icon: "M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM4 21a8 8 0 0 1 16 0", fn: "jugadores" },
    clusters:  { label: "Por perfil",  icon: "M12 3a9 9 0 1 0 9 9h-9z M15 3.5A9 9 0 0 1 20.5 9H15z", fn: "clusters" },
    comparar:  { label: "Comparar",    icon: "M4 20V10m6 10V4m6 16v-7m6 7H2", fn: "comparar" },
    evaluar:   { label: "Evaluar",     icon: "M12 5v14M5 12h14", fn: "evaluar" }
  },

  init() {
    this.root = document.getElementById("root");
    window.addEventListener("hashchange", () => this.route());
    window.addEventListener("fl:unauthorized", () => { if (this.state.session) { U.toast("Tu sesión expiró. Inicia sesión de nuevo.", "error"); this.logout(); } });
    const s = Api.loadSession();
    if (s) this.start(s); else Auth.render(this.root);
  },

  async start(session) {
    this.state.session = session;
    Api.saveSession(session);
    this.shell();
    const main = U.$("#main");
    main.innerHTML = `<div class="loading">Cargando datos…</div>`;
    try {
      await this.refresh(true);
    } catch (e) {
      main.innerHTML = `<div class="empty"><p>${U.esc(e.message)}</p><button class="btn primary" id="retry">Reintentar</button></div>`;
      U.$("#retry").addEventListener("click", () => this.start(session));
      return;
    }
    if (!location.hash || location.hash === "#/") location.hash = "#/panel"; else this.route();
  },

  async refresh(silent) {
    this.state.jugadores = await Api.jugadores();
    if (!silent) this.route(true);
  },

  logout() {
    Api.clearSession();
    this.state = { jugadores: [], session: null };
    U.destroyCharts();
    location.hash = "";
    Auth.mode = "login";
    Auth.render(this.root);
  },

  shell() {
    const s = this.state.session;
    const nav = Object.entries(this.ROUTES).map(([k, r]) =>
      `<a href="#/${k}" data-r="${k}"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="${r.icon}"/></svg><span>${r.label}</span></a>`).join("");
    this.root.innerHTML = `
    <div class="shell">
      <aside class="side no-print">
        ${Auth.logo()}
        <nav aria-label="Principal">${nav}</nav>
        <div class="side-foot">
          ${s.demo ? `<span class="demo-pill">Modo demo</span>` : ""}
          <div class="who"><span class="avatar">${U.esc((s.email || "?")[0].toUpperCase())}</span><span class="mail" title="${U.esc(s.email)}">${U.esc(s.email)}</span></div>
          <button class="btn ghost block" id="logout">Cerrar sesión</button>
        </div>
      </aside>
      <main id="main" class="main" tabindex="-1"></main>
    </div>`;
    U.$("#logout").addEventListener("click", () => this.logout());
  },

  async route() {
    if (!this.state.session) return;
    const [name, ...params] = (location.hash.replace(/^#\//, "") || "panel").split("/");
    const key = name === "jugador" ? "jugadores" : name;
    const page = Pages[name];
    const main = U.$("#main");
    if (!page || !main) { location.hash = "#/panel"; return; }
    U.$$(".side nav a").forEach(a => a.classList.toggle("active", a.dataset.r === key));
    U.destroyCharts();
    const rid = this._rid = (this._rid || 0) + 1;   // identifica esta navegación
    document.title = `${(this.ROUTES[key]?.label || "Jugador")} · FutsalLab`;
    try {
      await page.call(Pages, main, params);
    } catch (e) {
      console.error(e);
      if (rid !== this._rid) return;   // el usuario ya cambió de página: ignora el error viejo
      main.innerHTML = `<div class="empty"><p>${U.esc(e.message || "Error al cargar el reporte")}</p><button class="btn primary" onclick="App.route()">Reintentar</button></div>`;
    }
    window.scrollTo(0, 0);
  }
};

document.addEventListener("DOMContentLoaded", () => App.init());
