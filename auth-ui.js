(() => {
  const $ = id => document.getElementById(id);
  let appLoaded = false;
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
      message("Não foi possível validar a sessão. Confira o projeto Supabase e as políticas RLS.", "error");
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
        message(result.reason === "profile-inactive" ? "Conta sem perfil ativo. Peça à administração para verificar o cadastro." : "Não foi possível entrar. Confira e-mail e senha ou a configuração do Supabase.", "error");
      } else {
        startApp(result.profile);
      }
    } catch (error) {
      message("Falha de conexão. Verifique a configuração do Supabase e tente novamente.", "error");
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
