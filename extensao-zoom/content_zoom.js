// Roda dentro da própria página do Zoom (client web) -- observa quem está em destaque como
// "falando agora" e manda pro background, com o horário, pra trocar "Locutor A/B" pelo nome de
// verdade na transcrição final. Baseado na estrutura REAL do Zoom (inspecionada ao vivo numa
// reunião de teste): quando alguém fica em destaque, o nome aparece dentro de um elemento
// ".video-avatar__avatar-name" (ou, em outro layout, ".video-avatar__avatar-footer"), dentro de
// um container com a classe "speaker-active-container" -- essa classe é o próprio Zoom quem usa
// pra marcar quem está em foco como orador ativo.
//
// Isso é inerentemente frágil (depende do HTML que o Zoom decide usar, que pode mudar) -- se
// parar de detectar nomes, o pior caso é a transcrição voltar a sair como "Locutor A/B", igual
// já era antes desta extensão existir. Funciona melhor com o Zoom em "Visualização do orador".

(function () {
  var gravando = false;
  var ultimoNome = null;
  var observer = null;

  function extrairNomeDoContainer(container) {
    if (!container) return null;
    var elNome = container.querySelector('.video-avatar__avatar-name');
    if (elNome && elNome.textContent.trim()) return elNome.textContent.trim();
    var footer = container.querySelector('.video-avatar__avatar-footer');
    if (footer && footer.textContent.trim()) return footer.textContent.trim();
    return null;
  }

  function verificarFalante() {
    if (!gravando) return;
    var containers = document.querySelectorAll(
      '.speaker-active-container__wrap, .speaker-active-container__video-frame'
    );
    var nome = null;
    for (var i = 0; i < containers.length && !nome; i++) {
      nome = extrairNomeDoContainer(containers[i]);
    }
    if (nome && nome !== ultimoNome) {
      ultimoNome = nome;
      chrome.runtime.sendMessage({ tipo: 'falante_mudou', nome: nome, quando: Date.now() }).catch(function () {});
    }
  }

  observer = new MutationObserver(function () { verificarFalante(); });

  chrome.runtime.onMessage.addListener(function (mensagem) {
    if (mensagem.tipo !== 'gravacao_ativa') return;
    gravando = !!mensagem.ativa;
    if (gravando) {
      ultimoNome = null;
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
      verificarFalante();
    } else {
      observer.disconnect();
    }
  });
})();
