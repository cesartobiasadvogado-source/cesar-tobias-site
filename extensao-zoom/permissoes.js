// Pagina normal (aba visivel de verdade) so pra conseguir o pedido de permissao do microfone
// aparecer -- documentos invisiveis da extensao (offscreen, popup) NAO conseguem mostrar esse
// aviso do Chrome. Uma vez concedida aqui, a permissao fica valendo pra extensao inteira (mesma
// origem chrome-extension://...), inclusive pro offscreen document usar na hora de gravar.

var btn = document.getElementById('btn-autorizar');
var statusEl = document.getElementById('status');

btn.addEventListener('click', function () {
  btn.disabled = true;
  statusEl.textContent = 'Pedindo permissão…';
  statusEl.className = '';

  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(function (stream) {
      stream.getTracks().forEach(function (t) { t.stop(); });
      statusEl.textContent = 'Permissão concedida! Pode fechar esta aba e voltar pra chamada.';
      statusEl.className = 'ok';
    })
    .catch(function (e) {
      statusEl.textContent = 'Não foi possível autorizar (' + (e.message || e.name) + '). Verifique se o microfone não está bloqueado nas configurações do Chrome.';
      statusEl.className = 'erro';
      btn.disabled = false;
    });
});
