(() => {
  const $ = id => document.getElementById(id);
  let appLoaded = false;
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(error => {
        console.warn("YUP-ENTREGAS: não foi possível registrar o service worker", error);
      });
    }, { once: true });
  }
  function explainAuthError(raw) {
    const detail = String(raw || "");
    const lower = detail.toLowerCase();
    if (lower.includes("invalid login credentials") || lower.includes("invalid email or password") || lower.includes("user not found")) return "E-mail ou senha incorretos.";
    if (lower.includes("email not confirmed")) return "Este e-mail ainda não foi confirmado no Supabase. Confirme o endereço ou ajuste a confirmação de e-mail nas configurações de autenticação.";
    if (lower.includes("fetch") || lower.includes("network") || lower.includes("failed to") || lower.includes("load failed")) return "Não foi possível conectar ao Supabase. Verifique a internet, a URL/chave pública e se o projeto está ativo.";
    if (lower.includes("profiles") || lower.includes("permission denied") || lower.includes("row-level security") || lower.includes("schema cache")) return "O login ou a leitura do perfil falhou no banco. Verifique se o esquema SQL foi aplicado e se as políticas RLS de public.profiles estão configuradas. Detalhe: " + detail;
    return "Falha no login: " + (detail || "o Supabase não retornou detalhes") + ".";
  }
  function message(text, type = "") {
    const el = $("authMessage");
    el.textContent = text;
    el.className = "auth-message" + (type ? " " + type : "");
  }
  function gate() {
    document.body.classList.add("login-mode");
    $("authGate").classList.remove("hidden");
    $("appLayout").classList.add("hidden");
    $("logoutButton").classList.add("hidden");
  }
  function applyRole(profile) {
    const role = profile.role;
    const isManager = ["admin","manager"].includes(role);
    const isSales = role === "sales";
    document.body.classList.toggle("sales-mode", isSales);
    document.body.classList.toggle("driver-mode", role === "driver");
    document.querySelectorAll('[data-view="painel"],[data-view="rotas"]').forEach(el => el.classList.toggle("hidden", !isManager));
    document.querySelectorAll('[data-view="manutencao"]').forEach(el => el.classList.toggle("hidden", role !== "admin"));
    document.querySelectorAll('[data-sales-view]').forEach(el => el.classList.toggle("hidden", !isSales));
    document.querySelectorAll('[data-view="entregador"]').forEach(el => el.classList.toggle("hidden", isSales));
    document.querySelectorAll('[data-view="combustivel"]').forEach(el => el.classList.toggle("hidden", isSales || role === "driver"));
    document.querySelectorAll(".nav").forEach(el => {
      if (role === "driver") el.classList.toggle("hidden", el.dataset.view !== "entregador");
    });
    if (isSales) {
      ["entregador","painel","rotas","combustivel","manutencao"].forEach(name => document.getElementById("view-"+name)?.classList.add("hidden"));
      document.querySelectorAll(".nav").forEach(el => el.classList.remove("active"));
      return;
    }
    if (!isManager) {
      document.getElementById("view-painel").classList.add("hidden");
      document.getElementById("view-entregador").classList.remove("hidden");
      document.getElementById("view-vendas").classList.add("hidden");
    } else {
      document.getElementById("view-vendas").classList.add("hidden");
    }
    if (role !== "admin") document.getElementById("view-manutencao").classList.add("hidden");
    document.querySelectorAll(".nav").forEach(el => {
      if (el.classList.contains("hidden") && el.classList.contains("active")) el.classList.remove("active");
    });
  }
  function startApp(profile) {
    document.body.classList.remove("login-mode");
    document.body.classList.toggle("driver-mode", profile.role === "driver");
    $("authGate").classList.add("hidden");
    $("appLayout").classList.remove("hidden");
    $("logoutButton").classList.remove("hidden");
    $("authIdentity").textContent = (profile.display_name && profile.display_name.toLowerCase() !== profile.role.toLowerCase()) ? (profile.display_name + " · " + profile.role) : profile.role;
    const driverAreaLink = $("driverAreaLink");
    if (driverAreaLink) driverAreaLink.classList.toggle("hidden", ["admin","manager"].includes(profile.role));
    applyRole(profile);
    message("", "");
    if (profile.role === "sales") {
      if (!window.salesPortalLoaded) {
        window.salesPortalLoaded = true;
        const salesScript = document.createElement("script");
        salesScript.src = "sales-portal.js?v=4";
        salesScript.onerror = () => message("Não foi possível carregar a área de vendas. Atualize a página e tente novamente.", "error");
        document.body.appendChild(salesScript);
      }
      return;
    }
    if (!appLoaded) {
      appLoaded = true;
      const script = document.createElement("script");
      script.src = "app.js?v=37";
      script.onerror = () => message("Não foi possível carregar o aplicativo. Atualize a página e tente novamente.", "error");
      if (profile.role === "driver") {
        const styles = document.createElement("link");
        styles.rel = "stylesheet";
        styles.href = "driver-mobile.css?v=6";
        styles.onerror = () => console.warn("YUP-ENTREGAS: estilos visuais adicionais indisponíveis; mantendo os estilos principais.");
        document.head.appendChild(styles);
        script.addEventListener("load", () => {
          const mobile = document.createElement("script");
          mobile.src = "driver-mobile.js?v=4";
          mobile.onerror = () => message("Não foi possível carregar a interface móvel do entregador. Atualize a página.", "error");
          document.body.appendChild(mobile);
        }, { once: true });
      }
      document.body.appendChild(script);
    }
  }
  async function init() {
    gate();
    if (!window.YupBackend) {
      message("Adaptador de acesso não carregado. Verifique a conexão e os arquivos publicados.", "error");
      return;
    }
    try {
      const result = await window.YupBackend.getSessionProfile();
      if (result.reason === "missing-config") {
        message("Configuração pendente: crie supabase-config.js a partir do modelo e informe a URL do projeto e a chave pública.", "warning");
        return;
      }
      if (result.ok && result.authenticated) {
        startApp(result.profile);
        return;
      }
      message("Entre com sua conta individual.");
    } catch (error) {
      message("Não foi possível validar a sessão: " + (error?.message || "erro desconhecido") + ". Confira o projeto Supabase e as políticas RLS.", "error");
    }
  }
  $("loginForm").addEventListener("submit", async event => {
    event.preventDefault();
    $("loginButton").disabled = true;
    message("Validando acesso…");
    try {
      const result = await window.YupBackend.signIn($("loginEmail").value.trim(), $("loginPassword").value);
      if (result.reason === "missing-config") {
        message("Configuração pendente: crie supabase-config.js a partir do modelo antes de entrar.", "warning");
      } else if (!result.ok) {
        message(result.reason === "profile-inactive" ? "Não foi possível acessar esta conta. Procure a administração." : result.reason === "auth-error" ? explainAuthError(result.message) : "Não foi possível entrar. Verifique seus dados e tente novamente.", "error");
      } else {
        startApp(result.profile);
      }
    } catch (error) {
      message(explainAuthError(error?.message || error), "error");
    } finally {
      $("loginButton").disabled = false;
    }
  });
  $("logoutButton").addEventListener("click", async () => {
    await window.YupBackend.signOut();
    location.reload();
  });
  init();
})();
