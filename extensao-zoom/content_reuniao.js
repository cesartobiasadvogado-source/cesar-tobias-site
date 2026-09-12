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
  var avisouLegendaMeet = false;
  var flyoutAberto = null; // null | 'legenda' | 'chat' | 'idioma'
  var idiomaAtual = 'pt';

  var IDIOMAS = [
    { codigo: 'pt', rotulo: 'Português' },
    { codigo: 'en', rotulo: 'English' },
    { codigo: 'es', rotulo: 'Español' },
    { codigo: 'auto', rotulo: 'Detecção automática' }
  ];

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

  // ---------- barra flutuante (estilo Tactiq): legenda, pergunta pra IA e idioma ----------

  function criarOverlay() {
    if (overlayHost) return;
    overlayHost = document.createElement('div');
    overlayHost.style.cssText = 'position:fixed; top:16px; right:16px; z-index:2147483647;';
    document.documentElement.appendChild(overlayHost);

    var shadow = overlayHost.attachShadow({ mode: 'closed' });
    var estilo = document.createElement('style');
    estilo.textContent =
      ':host { all: initial; }' +
      '* { box-sizing: border-box; font-family: -apple-system, Arial, sans-serif; }' +
      '.contentor { position: relative; }' +
      '.barra { display: flex; flex-direction: column; align-items: center; gap: 4px;' +
      '  background: rgba(24,24,30,0.92); border-radius: 22px; padding: 8px 6px; box-shadow: 0 8px 28px rgba(0,0,0,.4); }' +
      '.grip { width: 22px; height: 14px; cursor: move; display: flex; align-items: center; justify-content: center;' +
      '  color: #8b8b96; font-size: 12px; user-select: none; }' +
      '.botao-barra { width: 32px; height: 32px; border-radius: 999px; border: none; background: rgba(255,255,255,0.08);' +
      '  color: #f2f2f5; font-size: 15px; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; }' +
      '.botao-barra:hover { background: rgba(255,255,255,0.18); }' +
      '.botao-barra.ativo { background: #3b4ee0; }' +
      '.ponto-gravando { width: 7px; height: 7px; border-radius: 999px; background: #ff4d4f; display: inline-block;' +
      '  animation: pulsar 1.2s infinite; margin-top: 2px; }' +
      '@keyframes pulsar { 0%, 100% { opacity: 1; } 50% { opacity: .3; } }' +
      '.painel { position: absolute; top: 0; right: 48px; width: 280px; background: rgba(24,24,30,0.95); color: #f2f2f5;' +
      '  border-radius: 10px; box-shadow: 0 8px 28px rgba(0,0,0,.4); overflow: hidden; }' +
      '.painel.escondido { display: none; }' +
      '.painel-cabecalho { font-size: 11px; font-weight: 600; letter-spacing: .03em; text-transform: uppercase;' +
      '  color: #cfcfe0; padding: 10px 12px 6px; }' +
      '.painel-corpo { font-size: 12.5px; line-height: 1.5; padding: 0 12px 12px; }' +
      '.legenda-linhas { max-height: 200px; overflow-y: auto; }' +
      '.legenda-linhas div { margin-bottom: 6px; white-space: pre-wrap; }' +
      '.chat-resposta { white-space: pre-wrap; margin-bottom: 8px; max-height: 160px; overflow-y: auto; color: #dcdce6; }' +
      '.chat-linha { display: flex; gap: 6px; }' +
      '.chat-linha input { flex: 1; min-width: 0; border-radius: 6px; border: 1px solid rgba(255,255,255,0.15);' +
      '  background: rgba(255,255,255,0.06); color: #fff; padding: 6px 8px; font-size: 12.5px; }' +
      '.chat-linha button { border: none; border-radius: 6px; background: #3b4ee0; color: #fff; padding: 0 10px; cursor: pointer; font-size: 12.5px; }' +
      '.chat-linha button:disabled { opacity: .6; cursor: default; }' +
      '.item-idioma { display: block; width: 100%; text-align: left; background: none; border: none; color: #f2f2f5;' +
      '  padding: 6px 4px; font-size: 12.5px; cursor: pointer; border-radius: 6px; }' +
      '.item-idioma:hover { background: rgba(255,255,255,0.1); }' +
      '.item-idioma.selecionado { color: #8f9dff; font-weight: 600; }';
    shadow.appendChild(estilo);

    // Monta tudo via createElement/textContent, nunca via innerHTML: o Google Meet (diferente do
    // Zoom) ativa uma protecao do navegador chamada "Trusted Types", que BLOQUEIA silenciosamente
    // qualquer "elemento.innerHTML = string" vindo de uma extensao -- foi por isso que a barra
    // aparecia certinho no Zoom mas nunca aparecia no Meet (a criacao inteira do overlay parava
    // no meio, sem erro visivel, na hora que tentava usar innerHTML).
    function criarBotaoIcone(icone, flyout, titulo, ativoInicial) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'botao-barra' + (ativoInicial ? ' ativo' : '');
      b.setAttribute('data-flyout', flyout);
      b.title = titulo;
      b.textContent = icone;
      return b;
    }

    function criarPainel(nome, tituloTexto, corpoEl, escondidoInicial) {
      var painel = document.createElement('div');
      painel.className = 'painel' + (escondidoInicial ? ' escondido' : '');
      painel.setAttribute('data-painel', nome);
      var cabecalho = document.createElement('div');
      cabecalho.className = 'painel-cabecalho';
      cabecalho.textContent = tituloTexto;
      var corpo = document.createElement('div');
      corpo.className = 'painel-corpo';
      corpo.appendChild(corpoEl);
      painel.appendChild(cabecalho);
      painel.appendChild(corpo);
      return painel;
    }

    var contentor = document.createElement('div');
    contentor.className = 'contentor';

    var grip = document.createElement('div');
    grip.className = 'grip';
    grip.title = 'Arrastar';
    grip.textContent = '⠿';
    var pontoGravando = document.createElement('span');
    pontoGravando.className = 'ponto-gravando';

    var barra = document.createElement('div');
    barra.className = 'barra';
    barra.appendChild(grip);
    barra.appendChild(pontoGravando);
    barra.appendChild(criarBotaoIcone('💬', 'legenda', 'Mostrar/esconder legenda', true));
    barra.appendChild(criarBotaoIcone('✨', 'chat', 'Perguntar para a IA', false));
    barra.appendChild(criarBotaoIcone('🌐', 'idioma', 'Idioma da transcrição', false));

    var corpoLegenda = document.createElement('div');
    corpoLegenda.className = 'legenda-linhas';
    var painelLegenda = criarPainel('legenda', 'Transcrevendo', corpoLegenda, false);

    var corpoChat = document.createElement('div');
    var respostaChatEl = document.createElement('div');
    respostaChatEl.className = 'chat-resposta';
    var linhaChat = document.createElement('div');
    linhaChat.className = 'chat-linha';
    var campoChatEl = document.createElement('input');
    campoChatEl.type = 'text';
    campoChatEl.placeholder = 'Pergunte sobre a reunião...';
    var botaoPerguntarEl = document.createElement('button');
    botaoPerguntarEl.type = 'button';
    botaoPerguntarEl.textContent = 'Perguntar';
    linhaChat.appendChild(campoChatEl);
    linhaChat.appendChild(botaoPerguntarEl);
    corpoChat.appendChild(respostaChatEl);
    corpoChat.appendChild(linhaChat);
    var painelChat = criarPainel('chat', 'Perguntar à IA', corpoChat, true);

    var corpoIdioma = document.createElement('div');
    IDIOMAS.forEach(function (i) {
      var itemIdioma = document.createElement('button');
      itemIdioma.type = 'button';
      itemIdioma.className = 'item-idioma';
      itemIdioma.setAttribute('data-idioma', i.codigo);
      itemIdioma.textContent = i.rotulo;
      corpoIdioma.appendChild(itemIdioma);
    });
    var painelIdioma = criarPainel('idioma', 'Idioma da transcrição', corpoIdioma, true);

    contentor.appendChild(barra);
    contentor.appendChild(painelLegenda);
    contentor.appendChild(painelChat);
    contentor.appendChild(painelIdioma);
    shadow.appendChild(contentor);

    overlayBody = corpoLegenda;
    var painelPorNome = { legenda: painelLegenda, chat: painelChat, idioma: painelIdioma };

    function marcarIdiomaSelecionado() {
      contentor.querySelectorAll('.item-idioma').forEach(function (btn) {
        btn.classList.toggle('selecionado', btn.getAttribute('data-idioma') === idiomaAtual);
      });
    }
    marcarIdiomaSelecionado();

    function abrirFlyout(nome) {
      flyoutAberto = (flyoutAberto === nome) ? null : nome;
      Object.keys(painelPorNome).forEach(function (chave) {
        painelPorNome[chave].classList.toggle('escondido', chave !== flyoutAberto);
      });
      contentor.querySelectorAll('[data-flyout]').forEach(function (btn) {
        btn.classList.toggle('ativo', btn.getAttribute('data-flyout') === flyoutAberto);
      });
    }
    // legenda comeca aberta (comportamento de antes, quando so existia a caixa de legenda)
    contentor.querySelector('[data-flyout="legenda"]').classList.add('ativo');
    flyoutAberto = 'legenda';

    contentor.querySelectorAll('[data-flyout]').forEach(function (btn) {
      btn.addEventListener('click', function () { abrirFlyout(btn.getAttribute('data-flyout')); });
    });

    contentor.querySelectorAll('[data-idioma]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        idiomaAtual = btn.getAttribute('data-idioma');
        marcarIdiomaSelecionado();
        // guarda a escolha e avisa o offscreen na hora (se ja estiver gravando, passa a valer a
        // partir do proximo pedaco/da finalizacao) -- sem precisar do popup pra isso.
        chrome.storage.local.set({ idiomaAudiencia: idiomaAtual });
        chrome.runtime.sendMessage({ target: 'offscreen', tipo: 'atualizar_idioma', idioma: idiomaAtual }).catch(function () {});
      });
    });

    var campoChat = campoChatEl;
    var botaoPerguntar = botaoPerguntarEl;
    var respostaChat = respostaChatEl;
    function enviarPergunta() {
      var pergunta = (campoChat.value || '').trim();
      if (!pergunta) return;
      var textoOriginal = botaoPerguntar.textContent;
      botaoPerguntar.disabled = true;
      botaoPerguntar.textContent = '...';
      respostaChat.textContent = '';
      chrome.runtime.sendMessage({
        tipo: 'perguntar_ao_vivo', pergunta: pergunta, transcricaoParcial: overlayBody.innerText || ''
      }).then(function (resp) {
        if (!resp || !resp.ok) throw new Error((resp && resp.erro) || 'Não consegui responder agora.');
        respostaChat.textContent = resp.resposta || '';
      }).catch(function (e) {
        respostaChat.textContent = 'Erro: ' + (e.message || e);
      }).finally(function () {
        botaoPerguntar.disabled = false;
        botaoPerguntar.textContent = textoOriginal;
      });
    }
    botaoPerguntar.addEventListener('click', enviarPergunta);
    campoChat.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') enviarPergunta(); });

    // arrastar pelo "grip" no topo da barra
    var grip = contentor.querySelector('.grip');
    var arrastando = false, offX = 0, offY = 0;
    grip.addEventListener('mousedown', function (ev) {
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
    flyoutAberto = null;
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
    chrome.storage.local.get(['idiomaAudiencia']).then(function (armazenado) {
      idiomaAtual = armazenado.idiomaAudiencia || 'pt';
      criarOverlay();
    }).catch(function () { criarOverlay(); });
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
