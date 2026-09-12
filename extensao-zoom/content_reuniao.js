// Roda dentro da própria página da chamada (Zoom ou Google Meet). Duas coisas, iguais nas duas
// plataformas:
// 1) Observa quem está falando/em destaque e manda pro background, com o horário, pra trocar
//    "Locutor A/B" pelo nome de verdade na transcrição final.
// 2) Mostra uma legenda flutuante (parecida com o Tactiq) por cima da chamada, com o texto
//    aparecendo aos poucos conforme a transcrição prévia de cada pedaço chega do background.
//
// O que muda entre as duas plataformas é só COMO acha o nome de quem fala agora (ver
// verificarFalanteZoom/verificarFalanteMeet) -- o resto (legenda, mensagens) é comum.
//
// ZOOM: baseado na estrutura REAL do Zoom (inspecionada ao vivo numa reunião de teste): quando
// alguém fica em destaque, o nome aparece dentro de ".video-avatar__avatar-name" (ou, em outro
// layout, ".video-avatar__avatar-footer"), dentro de um container com a classe
// "speaker-active-container" -- essa classe é o próprio Zoom quem usa pra marcar o orador ativo.
//
// MEET: usa a legenda ao vivo NATIVA do Google Meet (precisa estar ligada -- tecla "c" ou botão
// "Ativar legendas"), que já vem com o nome de cada um. Baseado em vários projetos de código
// aberto que fazem a mesma captura (não testado ao vivo por mim -- o Meet exige login numa conta
// Google pra criar uma sala, o que eu não tenho aqui): a área de legendas é
// `[role="region"][aria-label="Captions"]` (ou "Legendas" em português), e dentro de cada bloco
// de fala o primeiro <span> é o nome de quem fala.
//
// Os dois jeitos são inerentemente frágeis (dependem do HTML que a Zoom/Google decidem usar, que
// pode mudar) -- se parar de detectar nomes, o pior caso é a transcrição voltar a sair como
// "Locutor A/B", igual já era antes desta extensão existir.

(function () {
  var ehMeet = location.hostname.indexOf('meet.google.com') !== -1;

  var gravando = false;
  var ultimoNome = null;
  var observer = null;
  var timerVerificar = null;
  var overlayHost = null;
  var overlayBody = null;
  var overlayMinimizado = false;
  var avisouLegendaMeet = false;

  // ---------- deteccao de quem esta falando: Zoom ----------

  function nomeDoContainerZoom(container) {
    if (!container) return null;
    var elNome = container.querySelector('.video-avatar__avatar-name');
    if (elNome && elNome.textContent.trim()) return elNome.textContent.trim();
    var footer = container.querySelector('.video-avatar__avatar-footer');
    if (footer && footer.textContent.trim()) return footer.textContent.trim();
    return null;
  }

  function extrairNomeZoom() {
    // 1) Visualização do orador (confirmado ao vivo numa reunião de teste): o Zoom marca quem
    // está em destaque com esse container próprio.
    var containers = document.querySelectorAll(
      '.speaker-active-container__wrap, .speaker-active-container__video-frame'
    );
    for (var i = 0; i < containers.length; i++) {
      var nome = nomeDoContainerZoom(containers[i]);
      if (nome) return nome;
    }

    // 2) Fallback pra outros modos (ex: Galeria) -- AINDA NÃO TESTADO AO VIVO (pra comparar de
    // verdade precisaria de duas pessoas falando ao mesmo tempo numa reunião real, o que não dá
    // pra simular sozinho numa sala de teste). A ideia: em qualquer layout, o Zoom sempre marca
    // quem está falando agora com uma classe que contém "speaking"/"talking"/"active-speaker" --
    // então procura por isso em vez de depender do container específico da Visualização do
    // orador. Se não achar nada aqui, cai pro "Locutor A/B" de sempre (nada quebra).
    var indicadores = document.querySelectorAll(
      '[class*="speaking"], [class*="talking"], [class*="active-speaker"]'
    );
    for (var j = 0; j < indicadores.length; j++) {
      var origem = indicadores[j].closest('[class*="video"], [class*="participant"], [class*="avatar"]')
        || indicadores[j].parentElement;
      var nome2 = nomeDoContainerZoom(origem);
      if (nome2) return nome2;
    }
    return null;
  }

  // ---------- deteccao de quem esta falando: Google Meet (via legenda nativa) ----------

  function extrairNomeMeet() {
    var regiao = document.querySelector(
      '[role="region"][aria-label="Captions"], [role="region"][aria-label="Closed captions"], ' +
      '[role="region"][aria-label="Legendas"], [role="region"][aria-label="Legendas ocultas"]'
    );
    if (!regiao) {
      if (gravando && !avisouLegendaMeet) {
        avisouLegendaMeet = true;
        adicionarPreviaTexto('⚠️ Ative a legenda do Meet (tecla "c") pra eu saber o nome de quem fala.');
      }
      return null;
    }
    var blocos = regiao.children;
    if (!blocos.length) return null;
    var ultimoBloco = blocos[blocos.length - 1];
    var span = ultimoBloco.querySelector('span');
    return span && span.textContent.trim() ? span.textContent.trim() : null;
  }

  function verificarFalanteAgora() {
    if (!gravando) return;
    var nome = ehMeet ? extrairNomeMeet() : extrairNomeZoom();
    if (nome && nome !== ultimoNome) {
      ultimoNome = nome;
      chrome.runtime.sendMessage({ tipo: 'falante_mudou', nome: nome, quando: Date.now() }).catch(function () {});
    }
  }

  function verificarFalante() {
    // debounce -- a pagina muda o DOM o tempo todo (relogio, contadores, animacoes), e checar a
    // cada mutacao sem pausa pesava desnecessariamente durante uma audiencia longa.
    if (timerVerificar) return;
    timerVerificar = setTimeout(function () {
      timerVerificar = null;
      verificarFalanteAgora();
    }, 400);
  }

  observer = new MutationObserver(verificarFalante);

  // ---------- legenda flutuante (estilo Tactiq) ----------

  function criarOverlay() {
    if (overlayHost) return;
    overlayHost = document.createElement('div');
    overlayHost.style.cssText = 'position:fixed; top:16px; right:16px; z-index:2147483647; width:300px;';
    document.documentElement.appendChild(overlayHost);

    var shadow = overlayHost.attachShadow({ mode: 'closed' });
    var estilo = document.createElement('style');
    estilo.textContent =
      ':host { all: initial; }' +
      '.caixa { font-family: -apple-system, Arial, sans-serif; background: rgba(24,24,30,0.92); color: #f2f2f5;' +
      '  border-radius: 10px; box-shadow: 0 8px 28px rgba(0,0,0,.4); overflow: hidden; }' +
      '.cabecalho { display: flex; align-items: center; justify-content: space-between; cursor: move;' +
      '  font-size: 11px; font-weight: 600; letter-spacing: .03em; text-transform: uppercase; color: #cfcfe0;' +
      '  padding: 8px 10px; user-select: none; }' +
      '.ponto { width: 7px; height: 7px; border-radius: 999px; background: #ff4d4f; display: inline-block;' +
      '  margin-right: 6px; animation: pulsar 1.2s infinite; }' +
      '@keyframes pulsar { 0%, 100% { opacity: 1; } 50% { opacity: .3; } }' +
      '.botoes button { cursor: pointer; background: none; border: none; color: inherit; opacity: .75; font-size: 13px; padding: 2px 4px; }' +
      '.botoes button:hover { opacity: 1; }' +
      '.corpo { font-size: 12.5px; line-height: 1.5; max-height: 200px; overflow-y: auto; padding: 0 10px 10px; }' +
      '.corpo div { margin-bottom: 6px; white-space: pre-wrap; }' +
      '.corpo.escondido { display: none; }';
    shadow.appendChild(estilo);

    var caixa = document.createElement('div');
    caixa.className = 'caixa';
    caixa.innerHTML =
      '<div class="cabecalho"><span><span class="ponto"></span>Transcrevendo</span>' +
      '<span class="botoes"><button type="button" data-acao="minimizar" title="Minimizar/expandir">—</button></span></div>' +
      '<div class="corpo"></div>';
    shadow.appendChild(caixa);
    overlayBody = caixa.querySelector('.corpo');

    caixa.querySelector('[data-acao="minimizar"]').addEventListener('click', function () {
      overlayMinimizado = !overlayMinimizado;
      overlayBody.classList.toggle('escondido', overlayMinimizado);
    });

    // arrastar pela barra de titulo
    var cabecalho = caixa.querySelector('.cabecalho');
    var arrastando = false, offX = 0, offY = 0;
    cabecalho.addEventListener('mousedown', function (ev) {
      arrastando = true;
      offX = ev.clientX - overlayHost.getBoundingClientRect().left;
      offY = ev.clientY - overlayHost.getBoundingClientRect().top;
      ev.preventDefault();
    });
    document.addEventListener('mousemove', function (ev) {
      if (!arrastando) return;
      overlayHost.style.left = (ev.clientX - offX) + 'px';
      overlayHost.style.top = (ev.clientY - offY) + 'px';
      overlayHost.style.right = 'auto';
    });
    document.addEventListener('mouseup', function () { arrastando = false; });
  }

  function removerOverlay() {
    if (overlayHost && overlayHost.parentNode) overlayHost.parentNode.removeChild(overlayHost);
    overlayHost = null;
    overlayBody = null;
  }

  function adicionarPreviaTexto(texto) {
    if (!overlayBody || !texto) return;
    var linha = document.createElement('div');
    linha.textContent = texto;
    overlayBody.appendChild(linha);
    overlayBody.scrollTop = overlayBody.scrollHeight;
    while (overlayBody.children.length > 30) overlayBody.removeChild(overlayBody.firstChild);
  }

  // ---------- liga tudo ----------

  function ativar() {
    gravando = true;
    ultimoNome = null;
    avisouLegendaMeet = false;
    criarOverlay();
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    verificarFalanteAgora();
  }

  function desativar() {
    gravando = false;
    observer.disconnect();
    removerOverlay();
  }

  chrome.runtime.onMessage.addListener(function (mensagem) {
    if (mensagem.tipo === 'gravacao_ativa') {
      if (mensagem.ativa) ativar(); else desativar();
    }
    if (mensagem.tipo === 'previa_transcricao') {
      adicionarPreviaTexto(mensagem.texto);
    }
  });

  // Pergunta ao background se essa aba deveria estar gravando -- cobre o caso da pagina recarregar
  // no meio da audiencia (reconexao por internet instavel, por exemplo): sem isso, o content
  // script recem-carregado nao saberia que precisa reativar a deteccao/legenda.
  chrome.runtime.sendMessage({ tipo: 'content_script_carregado' }).then(function (resposta) {
    if (resposta && resposta.ativa) ativar();
  }).catch(function () {});
})();
