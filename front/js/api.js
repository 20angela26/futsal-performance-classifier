/* Capa de acceso a la API (FastAPI). Si Api.demo === true usa window.DEMO. */
const Api = {
  demo: false,
  _token: null,

  /* ---------- configuración / sesión ---------- */
  get base() {
    try { return (localStorage.getItem("fl_api") || CONFIG.API_BASE).replace(/\/+$/, ""); }
    catch { return CONFIG.API_BASE; }
  },
  setBase(url) { try { localStorage.setItem("fl_api", url.trim()); } catch {} },

  loadSession() {
    try {
      const raw = localStorage.getItem("fl_session");
      if (!raw) return null;
      const s = JSON.parse(raw);
      this._token = s.access_token;
      this.demo = !!s.demo;
      return s;
    } catch { return null; }
  },
  saveSession(s) {
    this._token = s.access_token;
    try { localStorage.setItem("fl_session", JSON.stringify(s)); } catch {}
  },
  clearSession() {
    this._token = null; this.demo = false;
    try { localStorage.removeItem("fl_session"); } catch {}
  },

  /* ---------- HTTP ---------- */
  async req(path, { method = "GET", json, form, auth = true } = {}) {
    const headers = {};
    if (auth && this._token) headers["Authorization"] = "Bearer " + this._token;
    let body;
    if (json) { headers["Content-Type"] = "application/json"; body = JSON.stringify(json); }
    if (form) body = form;

    let res;
    try {
      res = await fetch(this.base + path, { method, headers, body });
    } catch (e) {
      throw new ApiError(0, `No se pudo conectar con el servidor (${this.base}). ¿Está corriendo el backend?`);
    }
    let data = null;
    try { data = await res.json(); } catch {}
    if (!res.ok) {
      let msg = data && data.detail;
      if (Array.isArray(msg)) msg = msg.map(d => d.msg || JSON.stringify(d)).join(" · ");
      if (res.status === 401 && auth) { window.dispatchEvent(new Event("fl:unauthorized")); }
      throw new ApiError(res.status, msg || `Error ${res.status}`);
    }
    return data;
  },

  /* ---------- Auth ---------- */
  async login(email, password) {
    if (this.demo) return { access_token: "demo", user_id: "demo", email: email || "entrenador@demo.com", demo: true };
    return this.req("/api/auth/login", { method: "POST", json: { email, password }, auth: false });
  },
  registro(d) { return this.req("/api/auth/registro", { method: "POST", json: d, auth: false }); },
  preguntaSeguridad(email) { return this.req("/api/auth/recuperar-pregunta", { method: "POST", json: { email }, auth: false }); },
  restablecer(d) { return this.req("/api/auth/restablecer-password", { method: "POST", json: d, auth: false }); },

  /* ---------- Consultas (reportes) ---------- */
  async jugadores() {
    if (this.demo) return structuredClone(DEMO.jugadores);
    return this.req("/api/consultas/jugadores");
  },
  async porCluster(id) {
    if (this.demo) {
      const out = [];
      DEMO.jugadores.forEach(j => j.evaluaciones.forEach(e => {
        if (e.cluster_predicho === id) out.push({ ...e, jugadores: { jugador: j.jugador, masa_kg: j.masa_kg } });
      }));
      return out.sort((a, b) => b.id - a.id);
    }
    return this.req(`/api/consultas/por-cluster/${id}`);
  },
  async buscar(q) {
    if (this.demo) {
      const r = DEMO.jugadores.filter(j => j.jugador.toLowerCase().includes(q.toLowerCase()));
      if (!r.length) throw new ApiError(404, `No se encontraron jugadores con '${q}'.`);
      return structuredClone(r);
    }
    return this.req("/api/consultas/buscar?jugador=" + encodeURIComponent(q));
  },

  /* ---------- Evaluación ---------- */
  async evaluar(formData) {
    if (this.demo) {
      await new Promise(r => setTimeout(r, 700));
      const code = (formData.get("jugador") || "").trim() || "DEMO_" + Math.floor(rnd100());
      let j = DEMO.jugadores.find(x => x.jugador === code);
      if (!j) { j = { id: 900 + DEMO.jugadores.length, entrenador_id: "demo", jugador: code, masa_kg: 72, evaluaciones: [] }; DEMO.jugadores.push(j); }
      const hits = ["1","2","3"].flatMap(i => ["1","2","3"].map(h => Number(formData.get(`intento${i}_hit${h}`))));
      const react = hits.reduce((a, b) => a + b, 0) / 9;
      const k = Math.min(1, Math.max(0, (560 - react) / 150));
      const ev = DEMO.makeEval(DEMO.nextEvalId(), j.id, k, 0);
      ev.tiempo_reaccion_total_ms = Number(react.toFixed(4));
      ev.created_at = new Date().toISOString();
      j.evaluaciones.push(ev);
      return {
        message: "Jugador evaluado y guardado correctamente en un solo paquete (DEMO)",
        resultado: { jugador: code, masa_kg: j.masa_kg, ...ev, perfil_fisico: ev.perfil_fisico }
      };
    }
    return this.req(CONFIG.EVAL_PREFIX + "/evaluar-jugador", { method: "POST", form: formData });
  }
};
function rnd100() { return Math.random() * 100; }

class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
