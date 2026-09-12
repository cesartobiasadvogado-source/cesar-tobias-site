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
// MEET: confirmado ao vivo com o usuário (via Console do Chrome): o indicador de volume/áudio de
// cada participante usa a classe "IisKdb", que muda toda vez que há áudio detectado ali -- subindo
// alguns níveis a partir dele, acha o nome dentro de ".XEazBc.adnwBd" (ou variações parecidas). Não
// depende de nenhum recurso do Google que possa estar indisponível (diferente da legenda nativa do
// Meet, que na prática às vezes fica "temporariamente indisponível" -- essa vira só um plano B).
//
// Os dois jeitos são inerentemente frágeis (dependem do HTML que a Zoom/Google decidem usar, que
// pode mudar) -- se parar de detectar nomes, o pior caso é a transcrição voltar a sair como
// "Locutor A/B", igual já era antes desta extensão existir.

(function () {
  var ehMeet = location.hostname.indexOf('meet.google.com') !== -1;
  // O Zoom (fora do zoom.us/test) renderiza a reuniao de verdade DENTRO de um iframe -- por isso
  // o content script agora roda em todos os frames da pagina (all_frames no manifest.json), pra
  // conseguir enxergar o nome de quem fala ali dentro. Mas a barra flutuante em si (visual) so
  // pode ser criada UMA vez, no frame de cima -- senao apareceria uma barra empilhada por cima da
  // outra pra cada iframe (o iframe da reuniao, o do chat de IA do Zoom, paginas vazias etc.).
  var ehFrameTopo = (window.top === window.self);

  var gravando = false;
  var ultimoNome = null;
  var observer = null;
  var timerVerificar = null;
  var overlayHost = null;
  var overlayBody = null;
  var avisouLegendaMeet = false;
  var flyoutAberto = null; // null | 'legenda' | 'chat' | 'idioma'
  var idiomaAtual = 'pt';
  var refBotaoGravar = null;
  var refBotoesSoGravando = []; // chat/print -- so fazem sentido com a gravacao ativa

  var PERGUNTAS_SUGERIDAS = [
    'Quais são os pontos principais até agora?',
    'Já foi concedido algum prazo?',
    'Liste as tarefas combinadas até agora'
  ];

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
    // 1) Visualização do orador. Existem pelo menos DOIS nomes de classe diferentes pro mesmo
    // container, dependendo do layout da chamada -- "speaker-active-container" foi confirmado
    // numa reunião de teste (zoom.us/test) e "speaker-bar-container" numa reunião real (sala
    // pessoal, sem câmera), diagnosticado ao vivo com o usuário via o Console do Chrome.
    var containers = document.querySelectorAll(
      '.speaker-active-container__wrap, .speaker-active-container__video-frame,' +
      '.speaker-bar-container__wrap, .speaker-bar-container__video-frame,' +
      '.speaker-bar-container__horizontal-view-wrap'
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

  // ---------- deteccao de quem esta falando: Google Meet ----------
  //
  // 1) Indicador de volume/audio (classe "IisKdb", confirmado ao vivo com o usuario via Console
  // do Chrome: essa classe muda toda vez que ha audio detectado naquele participante) -- nao
  // depende de nenhum recurso do Google que possa estar indisponivel (diferente da legenda
  // nativa, que na pratica costuma dar "temporariamente indisponivel").
  // 2) Legenda nativa do Meet, como plano B (se a IA anterior nao achar nada) -- so funciona se a
  // pessoa tiver ativado a legenda do proprio Meet (tecla "c").
  function extrairNomeMeet() {
    var nomePorIndicador = extrairNomeMeetPorIndicadorDeAudio();
    if (nomePorIndicador) return nomePorIndicador;
    return extrairNomeMeetPorLegenda();
  }

  function pareceNomeDeIcone(texto) {
    // os icones do Google (Material Symbols) usam o proprio nome em snake_case como texto puro
    // (ex: "keyboard_arrow_up", "mic_off") -- nunca e assim que um nome de pessoa aparece. Pegou
    // um desses uma vez porque o seletor ".notranslate" era grande demais e incluia icones.
    return /^[a-z]+(_[a-z]+)+$/.test(texto);
  }

  function extrairNomeMeetPorIndicadorDeAudio() {
    var indicadores = document.querySelectorAll('[class*="IisKdb"]');
    for (var i = 0; i < indicadores.length; i++) {
      var container = indicadores[i];
      for (var subida = 0; subida < 10 && container; subida++) {
        // confirmado ao vivo com o usuario -- deliberadamente especifico (nao um seletor
        // generico tipo ".notranslate", que acaba pegando icones da interface tambem).
        var nomeEl = container.querySelector('.XEazBc.adnwBd');
        var texto = nomeEl && nomeEl.textContent.trim();
        if (texto && !pareceNomeDeIcone(texto)) return texto;
        container = container.parentElement;
      }
    }
    return null;
  }

  function extrairNomeMeetPorLegenda() {
    var regiao = document.querySelector(
      '[role="region"][aria-label="Captions"], [role="region"][aria-label="Closed captions"], ' +
      '[role="region"][aria-label="Legendas"], [role="region"][aria-label="Legendas ocultas"]'
    );
    if (!regiao) {
      if (gravando && !avisouLegendaMeet) {
        avisouLegendaMeet = true;
        adicionarPreviaTexto('ℹ️ Dica: ativar a legenda do Meet (tecla "c") pode ajudar a identificar melhor quem fala.');
      }
      return null;
    }
    var blocos = regiao.children;
    if (!blocos.length) return null;
    var ultimoBloco = blocos[blocos.length - 1];
    var span = ultimoBloco.querySelector('span');
    var texto = span && span.textContent.trim();
    return texto && !pareceNomeDeIcone(texto) ? texto : null;
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
      '.botao-barra:disabled { opacity: .3; cursor: not-allowed; }' +
      '.botao-barra:disabled:hover { background: rgba(255,255,255,0.08); }' +
      '.botao-gravar { color: #ff4d4f; font-size: 13px; }' +
      '.botao-gravar.gravando { background: #ff4d4f; color: #fff; animation: pulsar 1.2s infinite; }' +
      '@keyframes pulsar { 0%, 100% { opacity: 1; } 50% { opacity: .55; } }' +
      '.painel { position: absolute; top: 0; right: 48px; width: 280px; background: rgba(24,24,30,0.95); color: #f2f2f5;' +
      '  border-radius: 10px; box-shadow: 0 8px 28px rgba(0,0,0,.4); overflow: hidden; }' +
      '.painel.escondido { display: none; }' +
      '.painel-cabecalho { font-size: 11px; font-weight: 600; letter-spacing: .03em; text-transform: uppercase;' +
      '  color: #cfcfe0; padding: 10px 12px 6px; }' +
      '.painel-corpo { font-size: 12.5px; line-height: 1.5; padding: 0 12px 12px; }' +
      // Painel unificado (Transcrição + Perguntar à IA, com abas) -- bem mais alto que os
      // flyouts pequenos de antes, pra parecer um painel lateral encaixado (estilo Tactiq), sem
      // depender da API oficial de side panel do Chrome (que só abre por um clique direto, não a
      // partir de um botão dentro da própria página -- não serviria pro nosso caso).
      '.painel-unificado { position: absolute; top: 0; right: 48px; width: 300px; height: min(72vh, 560px);' +
      '  background: rgba(20,20,26,0.97); color: #f2f2f5; border-radius: 12px; box-shadow: 0 8px 28px rgba(0,0,0,.45);' +
      '  display: flex; flex-direction: column; overflow: hidden; }' +
      '.painel-unificado.escondido { display: none; }' +
      '.abas-cabecalho { display: flex; flex-shrink: 0; border-bottom: 1px solid rgba(255,255,255,0.1); }' +
      '.aba-btn { flex: 1; background: none; border: none; color: #9a9aa6; font-size: 12.5px; font-weight: 600;' +
      '  padding: 12px 8px; cursor: pointer; border-bottom: 2px solid transparent; }' +
      '.aba-btn:hover { color: #dcdce6; }' +
      '.aba-btn.ativo-aba { color: #fff; border-bottom-color: #3b4ee0; }' +
      '.aba-conteudo { flex: 1; min-height: 0; overflow-y: auto; padding: 12px; }' +
      '.aba-conteudo.escondido { display: none; }' +
      '.legenda-linhas div { margin-bottom: 8px; white-space: pre-wrap; }' +
      '.chat-sugestoes { display: flex; flex-direction: column; gap: 5px; margin-bottom: 8px; }' +
      '.chat-sugestao { text-align: left; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);' +
      '  color: #dcdce6; border-radius: 6px; padding: 6px 8px; font-size: 12px; cursor: pointer; }' +
      '.chat-sugestao:hover { background: rgba(255,255,255,0.14); }' +
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

    var botaoGravar = document.createElement('button');
    botaoGravar.type = 'button';
    botaoGravar.className = 'botao-barra botao-gravar';
    botaoGravar.title = 'Iniciar transcrição';
    botaoGravar.textContent = '⏺';

    var botaoLegenda = criarBotaoIcone('💬', 'legenda', 'Mostrar/esconder legenda', true);
    var botaoChat = criarBotaoIcone('✨', 'chat', 'Perguntar para a IA', false);
    var botaoIdioma = criarBotaoIcone('🌐', 'idioma', 'Idioma da transcrição', false);

    var barra = document.createElement('div');
    barra.className = 'barra';
    barra.appendChild(grip);
    barra.appendChild(botaoGravar);
    barra.appendChild(botaoLegenda);
    barra.appendChild(botaoChat);
    barra.appendChild(botaoIdioma);
    var botaoPrint = document.createElement('button');
    botaoPrint.type = 'button';
    botaoPrint.className = 'botao-barra';
    botaoPrint.title = 'Tirar print e salvar na transcrição';
    botaoPrint.textContent = '📷';
    barra.appendChild(botaoPrint);

    // Painel unificado (Transcrição + Perguntar à IA, com abas) -- os botões 💬 e ✨ da barra
    // abrem o MESMO painel, só trocando qual aba fica visível.
    var abaBtnLegenda = document.createElement('button');
    abaBtnLegenda.type = 'button';
    abaBtnLegenda.className = 'aba-btn';
    abaBtnLegenda.textContent = 'Transcrição';
    var abaBtnChat = document.createElement('button');
    abaBtnChat.type = 'button';
    abaBtnChat.className = 'aba-btn';
    abaBtnChat.textContent = 'Perguntar à IA';
    var abasCabecalho = document.createElement('div');
    abasCabecalho.className = 'abas-cabecalho';
    abasCabecalho.appendChild(abaBtnLegenda);
    abasCabecalho.appendChild(abaBtnChat);

    var corpoLegenda = document.createElement('div');
    corpoLegenda.className = 'legenda-linhas';
    var abaConteudoLegenda = document.createElement('div');
    abaConteudoLegenda.className = 'aba-conteudo';
    abaConteudoLegenda.appendChild(corpoLegenda);

    var corpoChat = document.createElement('div');
    var sugestoesChat = document.createElement('div');
    sugestoesChat.className = 'chat-sugestoes';
    PERGUNTAS_SUGERIDAS.forEach(function (texto) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chat-sugestao';
      chip.textContent = texto;
      sugestoesChat.appendChild(chip);
    });
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
    corpoChat.appendChild(sugestoesChat);
    corpoChat.appendChild(respostaChatEl);
    corpoChat.appendChild(linhaChat);
    var abaConteudoChat = document.createElement('div');
    abaConteudoChat.className = 'aba-conteudo escondido';
    abaConteudoChat.appendChild(corpoChat);

    var painelUnificado = document.createElement('div');
    painelUnificado.className = 'painel-unificado';
    painelUnificado.appendChild(abasCabecalho);
    painelUnificado.appendChild(abaConteudoLegenda);
    painelUnificado.appendChild(abaConteudoChat);

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
    contentor.appendChild(painelUnificado);
    contentor.appendChild(painelIdioma);
    shadow.appendChild(contentor);

    overlayBody = corpoLegenda;

    function marcarIdiomaSelecionado() {
      contentor.querySelectorAll('.item-idioma').forEach(function (btn) {
        btn.classList.toggle('selecionado', btn.getAttribute('data-idioma') === idiomaAtual);
      });
    }
    marcarIdiomaSelecionado();

    // flyoutAberto: null | 'painel' | 'idioma'. abaPainelAtiva: 'legenda' | 'chat' (so importa
    // quando o painel unificado esta aberto).
    var abaPainelAtiva = 'legenda';
    flyoutAberto = 'painel'; // comeca aberto na aba Transcricao, igual era antes

    function sincronizarVisualFlyouts() {
      painelUnificado.classList.toggle('escondido', flyoutAberto !== 'painel');
      painelIdioma.classList.toggle('escondido', flyoutAberto !== 'idioma');
      botaoLegenda.classList.toggle('ativo', flyoutAberto === 'painel' && abaPainelAtiva === 'legenda');
      botaoChat.classList.toggle('ativo', flyoutAberto === 'painel' && abaPainelAtiva === 'chat');
      botaoIdioma.classList.toggle('ativo', flyoutAberto === 'idioma');
      abaConteudoLegenda.classList.toggle('escondido', abaPainelAtiva !== 'legenda');
      abaConteudoChat.classList.toggle('escondido', abaPainelAtiva !== 'chat');
      abaBtnLegenda.classList.toggle('ativo-aba', abaPainelAtiva === 'legenda');
      abaBtnChat.classList.toggle('ativo-aba', abaPainelAtiva === 'chat');
    }
    sincronizarVisualFlyouts();

    // clicar no icone da barra (💬 ou ✨): se o painel ja estiver aberto NESSA aba, fecha; senao
    // abre (ou so troca de aba, se ja estiver aberto na outra).
    function abrirPainelNaAba(aba) {
      if (flyoutAberto === 'painel' && abaPainelAtiva === aba) {
        flyoutAberto = null;
      } else {
        flyoutAberto = 'painel';
        abaPainelAtiva = aba;
      }
      sincronizarVisualFlyouts();
    }
    // usado quando um erro/aviso precisa aparecer na legenda (ex: sessao expirada) -- garante que
    // a aba Transcricao fique visivel, sem fechar se ja estiver aberta noutra aba por engano.
    function garantirFlyoutAberto(nome) {
      if (nome === 'idioma') {
        flyoutAberto = 'idioma';
      } else {
        flyoutAberto = 'painel';
        abaPainelAtiva = 'legenda';
      }
      sincronizarVisualFlyouts();
    }

    botaoLegenda.addEventListener('click', function () { abrirPainelNaAba('legenda'); });
    botaoChat.addEventListener('click', function () { abrirPainelNaAba('chat'); });
    abaBtnLegenda.addEventListener('click', function () { abaPainelAtiva = 'legenda'; sincronizarVisualFlyouts(); });
    abaBtnChat.addEventListener('click', function () { abaPainelAtiva = 'chat'; sincronizarVisualFlyouts(); });
    botaoIdioma.addEventListener('click', function () {
      flyoutAberto = (flyoutAberto === 'idioma') ? 'painel' : 'idioma';
      sincronizarVisualFlyouts();
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

    sugestoesChat.querySelectorAll('.chat-sugestao').forEach(function (chip) {
      chip.addEventListener('click', function () {
        campoChat.value = chip.textContent;
        enviarPergunta();
      });
    });

    // botao de Iniciar/Parar direto na barra -- assim a pessoa nao precisa mais abrir o popup da
    // extensao toda vez, so pra clicar em "Iniciar transcricao"/"Finalizar audiencia" (o popup
    // continua existindo, pro login inicial e pra autorizar o microfone).
    botaoGravar.addEventListener('click', function () {
      botaoGravar.disabled = true;
      var comando = gravando ? 'finalizar' : 'iniciar';
      chrome.runtime.sendMessage({ tipo: comando }).then(function (resp) {
        if (!resp || !resp.ok) throw new Error((resp && resp.erro) || 'Não consegui.');
        if (comando === 'finalizar') {
          adicionarPreviaTexto('✅ Áudio enviado! A transcrição continua em segundo plano -- um aviso chega quando estiver pronta.');
        } else if (resp.avisoMic) {
          garantirFlyoutAberto('legenda');
          adicionarPreviaTexto('⚠️ ' + resp.avisoMic);
        }
      }).catch(function (e) {
        garantirFlyoutAberto('legenda');
        adicionarPreviaTexto('⚠️ ' + (e.message || e));
      }).finally(function () {
        botaoGravar.disabled = false;
      });
    });

    refBotaoGravar = botaoGravar;
    refBotoesSoGravando = [botaoPerguntarEl, botaoPrint];
    atualizarUiGravando();

    botaoPrint.addEventListener('click', function () {
      var textoOriginal = botaoPrint.textContent;
      botaoPrint.disabled = true;
      botaoPrint.textContent = '…';
      chrome.runtime.sendMessage({ tipo: 'tirar_print' }).then(function (resp) {
        adicionarPreviaTexto(resp && resp.ok ? '📷 Print salvo na transcrição.' : '⚠️ Não consegui tirar o print (' + ((resp && resp.erro) || 'erro desconhecido') + ').');
      }).catch(function () {
        adicionarPreviaTexto('⚠️ Não consegui tirar o print agora.');
      }).finally(function () {
        botaoPrint.disabled = false;
        botaoPrint.textContent = textoOriginal;
      });
    });

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

  function adicionarPreviaTexto(texto) {
    if (!overlayBody || !texto) return;
    var linha = document.createElement('div');
    linha.textContent = texto;
    overlayBody.appendChild(linha);
    overlayBody.scrollTop = overlayBody.scrollHeight;
    while (overlayBody.children.length > 30) overlayBody.removeChild(overlayBody.firstChild);
  }

  // ---------- liga tudo ----------

  function atualizarUiGravando() {
    if (!refBotaoGravar) return; // so existe no frame de cima, onde a barra e criada
    refBotaoGravar.classList.toggle('gravando', gravando);
    refBotaoGravar.textContent = gravando ? '⏹' : '⏺';
    refBotaoGravar.title = gravando ? 'Finalizar audiência' : 'Iniciar transcrição';
    refBotoesSoGravando.forEach(function (btn) { btn.disabled = !gravando; });
  }

  function ativar() {
    gravando = true;
    ultimoNome = null;
    avisouLegendaMeet = false;
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    verificarFalanteAgora();
    atualizarUiGravando();
  }

  function desativar() {
    gravando = false;
    observer.disconnect();
    atualizarUiGravando();
  }

  chrome.runtime.onMessage.addListener(function (mensagem) {
    if (mensagem.tipo === 'gravacao_ativa') {
      if (mensagem.ativa) ativar(); else desativar();
    }
    if (mensagem.tipo === 'previa_transcricao') {
      adicionarPreviaTexto(mensagem.texto);
    }
  });

  // A barra flutuante agora fica SEMPRE visivel em qualquer chamada do Zoom/Meet (nao so depois
  // de iniciar uma gravacao) -- ela mesma tem o botao de Iniciar/Parar. So criada no frame de
  // cima (ver ehFrameTopo), senao apareceria uma barra empilhada por iframe.
  if (ehFrameTopo) {
    chrome.storage.local.get(['idiomaAudiencia']).then(function (armazenado) {
      idiomaAtual = armazenado.idiomaAudiencia || 'pt';
      criarOverlay();
    }).catch(function () { criarOverlay(); });
  }

  // Pergunta ao background se essa aba ja deveria estar gravando, e repete isso a cada poucos
  // segundos (nao so uma vez no carregamento) -- o Zoom, numa reuniao de verdade, cria a "sala"
  // de dentro (um iframe) as vezes DEPOIS que a pagina de fora ja carregou, ou a recria numa
  // reconexao; se isso acontecer bem na hora de iniciar a gravacao, uma pergunta unica poderia
  // chegar cedo demais (o iframe daquele instante ainda nao existe) e a deteccao de nome ficaria
  // muda pelo resto da audiencia. Perguntar de novo a cada 3s corrige isso sozinho, sem depender
  // de acertar esse timing.
  function sincronizarComBackground() {
    chrome.runtime.sendMessage({ tipo: 'content_script_carregado' }).then(function (resposta) {
      var deveEstarAtivo = !!(resposta && resposta.ativa);
      if (deveEstarAtivo && !gravando) ativar();
      else if (!deveEstarAtivo && gravando) desativar();
    }).catch(function () {});
  }
  sincronizarComBackground();
  setInterval(sincronizarComBackground, 3000);
})();
