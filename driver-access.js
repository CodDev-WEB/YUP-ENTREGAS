(() => {
  const form = document.getElementById("driverCodeForm");
  const input = document.getElementById("driverCode");
  const button = document.getElementById("driverCodeButton");
  const message = document.getElementById("driverCodeMessage");
  form.addEventListener("submit", event => {
    event.preventDefault();
    message.textContent = "O portal visual está pronto, mas a validação segura do código ainda não foi ativada. Por segurança, nenhum código é aceito e nenhuma operação é enviada ao banco nesta versão.";
    message.className = "driver-message warning";
    input.value = "";
    button.disabled = true;
    button.textContent = "Aguardando ativação segura";
  });
})();