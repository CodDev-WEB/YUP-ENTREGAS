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
    if (lower.includes("invalid login credentials")) return "E-mail ou senha incorretos. Confirme que o usuário foi criado em Supabase → Authentication → Users.";
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
    $("authGate").classList.remove("hidden");
    $("appLayout").classList.add("hidden");
    $("logoutButton").classList.add("hidden");
  }
  function applyRole(profile) {
    const role = profile.role;
    document.querySelectorAll('[data-view="painel"]').forEach(el => el.classList.toggle("hidden", !["admin","manager"].includes(role)));
    document.querySelectorAll('[data-view="rotas"]').forEach(el => el.classList.toggle("hidden", !["admin","manager"].includes(role)));
    document.querySelectorAll('[data-view="manutencao"]').forEach(el => el.classList.toggle("hidden", role !== "admin"));
    if (!["admin","manager"].includes(role)) {
      document.getElementById("view-painel").classList.add("hidden");
      document.getElementById("view-entregador").classList.remove("hidden");
    }
    if (role !== "admin") document.getElementById("view-manutencao").classList.add("hidden");
    document.querySelectorAll(".nav").forEach(el => {
      if (el.classList.contains("hidden") && el.classList.contains("active")) el.classList.remove("active");
    });
  }
  function startApp(profile) {
    document.body.classList.toggle("driver-mode", profile.role === "driver");
    $("authGate").classList.add("hidden");
    $("appLayout").classList.remove("hidden");
    $("logoutButton").classList.remove("hidden");
    $("authIdentity").textContent = (profile.display_name || profile.role) + " · " + profile.role;
    applyRole(profile);
    message("Acesso autenticado. Jornadas e entregas usam Supabase; combustível e manutenção ainda são locais. Confira a migração de segurança e os cadastros antes do uso operacional.", "warning");
    if (!appLoaded) {
      appLoaded = true;
      const script = document.createElement("script");
      script.src = "app.js";
      script.onerror = () => message("Não foi possível carregar o aplicativo. Atualize a página e tente novamente.", "error");
      if (profile.role === "driver") {
        const styles = document.createElement("link");
        styles.rel = "stylesheet";
        styles.href = "driver-mobile.css?v=2";
        styles.onerror = () => console.warn("YUP-ENTREGAS: estilos visuais adicionais indisponíveis; mantendo os estilos principais.");
        document.head.appendChild(styles);
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
      message("Entre com sua conta individual do Supabase.");
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
        message(result.reason === "profile-inactive" ? "O login foi aceito, mas a conta não possui perfil ativo em public.profiles. Peça à administração para conferir o usuário no Supabase." : result.reason === "auth-error" ? explainAuthError(result.message) : "Não foi possível entrar. Motivo: " + (result.reason || "erro desconhecido") + ". Confira a configuração do Supabase.", "error");
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
