/* Pantallas de autenticación: login, registro y recuperación por pregunta de seguridad. */
const Auth = {
  mode: "login", // login | registro | recuperar
  recup: { email: "", pregunta: "" },

  logo() {
    return `<div class="brand"><span class="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 32 32" width="30" height="30"><circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" stroke-width="2"/>
      <path d="M16 8l5.5 4-2 6.5h-7L10.5 12z" fill="currentColor"/><path d="M16 8V3M21.5 12l5-2M19.5 18.5l3 5M12.5 18.5l-3 5M10.5 12l-5-2" stroke="currentColor" stroke-width="1.6" fill="none"/></svg>
    </span><span class="brand-name">FutsalLab</span></div>`;
  },

  render(root) {
    const m = this.mode;
    root.innerHTML = `
    <div class="auth">
      <aside class="auth-hero">
        ${this.logo()}
        <div class="hero-copy">
          <h1>Rendimiento físico,<br>leído con datos.</h1>
          <p>Consulta reportes de saltos, reactividad y perfil de cada jugador. El modelo clasifica a tu plantilla en perfiles <b>explosivo</b> y <b>posicional</b>.</p>
        </div>
        <ul class="hero-stats">
          <li><b>6</b><span>variables evaluadas</span></li>
          <li><b>3×3</b><span>saltos y hits de reacción</span></li>
          <li><b>2</b><span>perfiles físicos</span></li>
        </ul>
      </aside>
      <main class="auth-card">
        ${m === "login" ? this.loginForm() : m === "registro" ? this.registroForm() : this.recuperarForm()}
        <details class="server">
          <summary>Servidor: <code>${U.esc(Api.base)}</code></summary>
          <div class="field"><label for="apiurl">URL del backend</label>
            <div class="inline"><input id="apiurl" value="${U.esc(Api.base)}" placeholder="http://localhost:8000">
            <button type="button" class="btn ghost" id="saveApi">Guardar</button></div></div>
        </details>
      </main>
    </div>`;
    this.bind(root);
  },

  loginForm() {
    return `
      <h2>Iniciar sesión</h2>
      <p class="sub">Accede a tu panel de entrenador.</p>
      <form id="f-login" novalidate>
        <div class="field"><label for="email">Correo</label><input id="email" type="email" autocomplete="email" required placeholder="entrenador@equipo.com"></div>
        <div class="field"><label for="pass">Contraseña</label><input id="pass" type="password" autocomplete="current-password" required></div>
        <div class="err" id="err" role="alert"></div>
        <button class="btn primary block" type="submit">Entrar</button>
      </form>
      <div class="links"><a href="#" data-go="recuperar">¿Olvidaste tu contraseña?</a><a href="#" data-go="registro">Crear cuenta</a></div>
      <div class="divider"><span>o</span></div>
      <button class="btn ghost block" id="demo" type="button">Probar con datos de ejemplo</button>`;
  },

  registroForm() {
    return `
      <h2>Crear cuenta</h2>
      <p class="sub">Registro de entrenador.</p>
      <form id="f-reg" novalidate>
        <div class="field"><label for="nombre">Nombre completo</label><input id="nombre" required></div>
        <div class="grid2">
          <div class="field"><label for="email">Correo</label><input id="email" type="email" required></div>
          <div class="field"><label for="equipo">Equipo</label><input id="equipo" required></div>
        </div>
        <div class="field"><label for="pass">Contraseña</label><input id="pass" type="password" minlength="6" autocomplete="new-password" required></div>
        <div class="field"><label for="preg">Pregunta de seguridad</label><input id="preg" required placeholder="¿Nombre de tu primer club?"></div>
        <div class="field"><label for="resp">Respuesta</label><input id="resp" required></div>
        <div class="err" id="err" role="alert"></div>
        <button class="btn primary block" type="submit">Registrarme</button>
      </form>
      <div class="links"><a href="#" data-go="login">← Volver a iniciar sesión</a></div>`;
  },

  recuperarForm() {
    const paso2 = !!this.recup.pregunta;
    return `
      <h2>Recuperar contraseña</h2>
      <p class="sub">${paso2 ? "Responde tu pregunta de seguridad y elige una contraseña nueva." : "Ingresa tu correo para ver tu pregunta de seguridad."}</p>
      <form id="f-rec" novalidate>
        <div class="field"><label for="email">Correo</label><input id="email" type="email" required value="${U.esc(this.recup.email)}" ${paso2 ? "readonly" : ""}></div>
        ${paso2 ? `
        <div class="field"><label>Pregunta</label><div class="question">${U.esc(this.recup.pregunta)}</div></div>
        <div class="field"><label for="resp">Respuesta</label><input id="resp" required></div>
        <div class="field"><label for="pass">Nueva contraseña</label><input id="pass" type="password" minlength="6" autocomplete="new-password" required>
          <small>No puede repetir ninguna contraseña anterior.</small></div>` : ""}
        <div class="err" id="err" role="alert"></div>
        <button class="btn primary block" type="submit">${paso2 ? "Restablecer contraseña" : "Continuar"}</button>
      </form>
      <div class="links"><a href="#" data-go="login">← Volver a iniciar sesión</a></div>`;
  },

  bind(root) {
    const $ = s => U.$(s, root);
    const err = m => { const e = $("#err"); if (e) e.textContent = m || ""; };

    U.$$("[data-go]", root).forEach(a => a.addEventListener("click", ev => {
      ev.preventDefault();
      this.mode = a.dataset.go;
      if (this.mode !== "recuperar") this.recup = { email: "", pregunta: "" };
      this.render(root);
    }));

    $("#saveApi").addEventListener("click", () => {
      const v = $("#apiurl").value.trim();
      if (!/^https?:\/\//.test(v)) return U.toast("La URL debe iniciar con http:// o https://", "error");
      Api.setBase(v); U.toast("Servidor guardado", "ok"); this.render(root);
    });

    const login = $("#f-login");
    if (login) {
      login.addEventListener("submit", async ev => {
        ev.preventDefault(); err();
        const email = $("#email").value.trim(), pass = $("#pass").value;
        if (!email || !pass) return err("Ingresa correo y contraseña.");
        await U.withBusy(login.querySelector("button[type=submit]"), async () => {
          try {
            Api.demo = false;
            const r = await Api.login(email, pass);
            App.start({ access_token: r.access_token, user_id: r.user_id, email: r.email });
          } catch (e) { err(e.message); }
        });
      });
      $("#demo").addEventListener("click", async () => {
        Api.demo = true;
        const r = await Api.login("entrenador@demo.com", "");
        App.start({ access_token: r.access_token, user_id: r.user_id, email: r.email, demo: true });
      });
    }

    const reg = $("#f-reg");
    if (reg) reg.addEventListener("submit", async ev => {
      ev.preventDefault(); err();
      const d = {
        nombre_completo: $("#nombre").value.trim(), email: $("#email").value.trim(), equipo: $("#equipo").value.trim(),
        password: $("#pass").value, pregunta_seguridad: $("#preg").value.trim(), respuesta_seguridad: $("#resp").value.trim()
      };
      if (Object.values(d).some(v => !v)) return err("Completa todos los campos.");
      if (d.password.length < 6) return err("La contraseña debe tener al menos 6 caracteres.");
      await U.withBusy(reg.querySelector("button[type=submit]"), async () => {
        try {
          await Api.registro(d);
          U.toast("Cuenta creada. Ya puedes iniciar sesión.", "ok");
          this.mode = "login"; this.render(root);
        } catch (e) { err(e.message); }
      });
    });

    const rec = $("#f-rec");
    if (rec) rec.addEventListener("submit", async ev => {
      ev.preventDefault(); err();
      const email = $("#email").value.trim();
      if (!email) return err("Ingresa tu correo.");
      await U.withBusy(rec.querySelector("button[type=submit]"), async () => {
        try {
          if (!this.recup.pregunta) {
            const r = await Api.preguntaSeguridad(email);
            this.recup = { email, pregunta: r.pregunta_seguridad };
            this.render(root);
          } else {
            const resp = $("#resp").value.trim(), np = $("#pass").value;
            if (!resp || np.length < 6) return err("Completa la respuesta y una contraseña de mínimo 6 caracteres.");
            await Api.restablecer({ email, respuesta_seguridad: resp, nueva_password: np });
            U.toast("Contraseña actualizada. Inicia sesión.", "ok");
            this.recup = { email: "", pregunta: "" }; this.mode = "login"; this.render(root);
          }
        } catch (e) { err(e.message); }
      });
    });
  }
};
