// Service worker: coordena a extensão. Não faz a gravação em si (Manifest V3 não deixa isso
// acontecer aqui de forma confiável -- o service worker pode ser encerrado pelo Chrome a
// qualquer momento) -- quem grava de verdade é o offscreen document (offscreen.js), que fica
// vivo enquanto o MediaRecorder estiver ativo.

const API_BASE = 'https://www.cesartobias.adv.br';
const CAMINHO_OFFSCREEN = 'offscreen.html';

async function garantirOffscreen() {
  const existentes = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (existentes.length > 0) return;
  await chrome.offscreen.createDocument({
    url: CAMINHO_OFFSCREEN,
    reasons: ['USER_MEDIA'],
    justification: 'Gravar o áudio da chamada (aba + microfone) durante a audiência.',
  });
}

async function obterAbaAtiva() {
  const [aba] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return aba;
}

const MENSAGEM_SESSAO_EXPIRADA = 'Sua sessão expirou. Clique em "Trocar de usuário" e entre de novo.';

async function sessaoAindaValida(token) {
  if (!token) return false;
  try {
    const resposta = await fetch(API_BASE + '/api/painel?acao=clientes', {
      headers: { 'Authorization': 'Bearer ' + token },
    });
    return resposta.status !== 401;
  } catch (e) {
    return true; // falha de rede nao e "sessao invalida" -- deixa tentar gravar mesmo assim
  }
}

async function fazerLogin(usuario, senha) {
  const resposta = await fetch(API_BASE + '/api/painel?acao=login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario, senha }),
  });
  const dados = await resposta.json();
  if (resposta.status !== 200 || !dados.token) {
    throw new Error(dados.erro === 'bloqueado' ? 'Muitas tentativas erradas. Tente mais tarde.' : 'Usuário ou senha incorretos.');
  }
  await chrome.storage.local.set({ token: dados.token, nome: dados.nome });
  return dados;
}

chrome.runtime.onMessage.addListener((mensagem, remetente, responder) => {
  if (mensagem.target === 'offscreen') return false; // nao e pra mim

  (async () => {
    try {
      if (mensagem.tipo === 'login') {
        const dados = await fazerLogin(mensagem.usuario, mensagem.senha);
        responder({ ok: true, nome: dados.nome });
        return;
      }

      if (mensagem.tipo === 'sair') {
        await chrome.storage.local.remove(['token', 'nome']);
        responder({ ok: true });
        return;
      }

      if (mensagem.tipo === 'abrir_permissao_microfone') {
        await chrome.tabs.create({ url: chrome.runtime.getURL('permissoes.html') });
        responder({ ok: true });
        return;
      }

      if (mensagem.tipo === 'obter_estado') {
        const armazenado = await chrome.storage.local.get(['token', 'nome', 'gravando', 'iniciadoEm']);
        responder({
          ok: true,
          logado: !!armazenado.token,
          nome: armazenado.nome || '',
          gravando: !!armazenado.gravando,
          iniciadoEm: armazenado.iniciadoEm || null,
        });
        return;
      }

      if (mensagem.tipo === 'iniciar') {
        const jaGravando = await chrome.storage.local.get(['token', 'gravando', 'idiomaAudiencia']);
        // trava contra iniciar duas gravacoes ao mesmo tempo (ex: clicou duas vezes rapido, ou
        // tem duas janelas do Chrome abertas) -- sem isso, a segunda chamada reaproveitava o
        // mesmo offscreen document e sobrescrevia a gravacao em andamento silenciosamente.
        if (jaGravando.gravando) {
          throw new Error('Já existe uma gravação em andamento. Finalize-a antes de iniciar outra.');
        }
        // agora que o botao de iniciar tambem existe direto na barra flutuante (sem precisar
        // abrir o popup), o primeiro uso pode acontecer antes de qualquer login -- avisa isso
        // com uma mensagem clara em vez de reaproveitar o texto de "sessao expirada".
        if (!jaGravando.token) {
          throw new Error('Você ainda não entrou na extensão. Clique no ícone dela na barra do Chrome e faça login primeiro.');
        }

        const aba = await obterAbaAtiva();
        if (!aba || !aba.id) throw new Error('Não encontrei a aba da chamada (Zoom ou Meet) em foco.');

        // A checagem de sessao (que depende do servidor "acordar", podendo levar varios
        // segundos -- ver MENSAGEM_SESSAO_EXPIRADA) rodava ANTES de tudo, fazendo o botao
        // "Iniciar" parecer travado esse tempo todo. Agora ela roda AO MESMO TEMPO que a captura
        // de aba e a criacao do offscreen document -- ainda protege contra sessao expirada (so
        // comeca a gravar de fato se a sessao vier valida), so nao faz mais o usuario esperar a
        // soma dos dois tempos, e sim o maior deles.
        const [streamId, sessaoValida] = await Promise.all([
          new Promise((resolve, reject) => {
            chrome.tabCapture.getMediaStreamId({ targetTabId: aba.id }, (id) => {
              if (chrome.runtime.lastError || !id) reject(new Error(chrome.runtime.lastError?.message || 'Não consegui capturar o áudio da aba.'));
              else resolve(id);
            });
          }),
          sessaoAindaValida(jaGravando.token),
          garantirOffscreen(),
        ]);

        if (!sessaoValida) throw new Error(MENSAGEM_SESSAO_EXPIRADA);

        await chrome.storage.local.set({
          gravando: true, iniciadoEm: Date.now(),
          abaZoomId: aba.id, falantesTimeline: [], capturas: [],
        });

        const respostaOffscreen = await chrome.runtime.sendMessage({
          target: 'offscreen', tipo: 'iniciar_gravacao', streamId, token: jaGravando.token,
          idioma: jaGravando.idiomaAudiencia || 'pt',
        });
        if (!respostaOffscreen || !respostaOffscreen.ok) {
          await chrome.storage.local.set({ gravando: false });
          throw new Error((respostaOffscreen && respostaOffscreen.erro) || 'Não consegui iniciar a gravação.');
        }

        // avisa o content script (roda dentro da aba do Zoom) pra comecar a observar quem esta
        // em destaque e mostrar a legenda ao vivo -- falha em avisar nao pode travar a gravacao
        // (o audio ja esta rodando), so significa que fica sem nome/legenda, como era antes.
        chrome.tabs.sendMessage(aba.id, { tipo: 'gravacao_ativa', ativa: true }).catch(() => {});

        responder({ ok: true, avisoMic: respostaOffscreen.avisoMic || null });
        return;
      }

      // Mensagem vinda do content script (content_zoom.js), avisando que o destaque de "falando
      // agora" mudou de pessoa -- so acumula enquanto a gravacao desta extensao estiver de fato
      // ativa (evita lixo de uma aba do Zoom que ficou aberta sem estar gravando).
      if (mensagem.tipo === 'falante_mudou') {
        const armazenado = await chrome.storage.local.get(['gravando', 'iniciadoEm', 'falantesTimeline']);
        if (armazenado.gravando && armazenado.iniciadoEm) {
          const timeline = armazenado.falantesTimeline || [];
          timeline.push({ segundo: (mensagem.quando - armazenado.iniciadoEm) / 1000, nome: mensagem.nome });
          await chrome.storage.local.set({ falantesTimeline: timeline });
        }
        responder({ ok: true });
        return;
      }

      // Pergunta do content script logo que ele carrega (roda de novo sempre que a pagina do
      // Zoom recarrega, ex: apos uma reconexao por internet instavel) -- sem isso, um reload no
      // meio da audiencia deixava a deteccao de nomes e a legenda ao vivo mudas pelo resto da
      // gravacao, ate clicar Finalizar/Iniciar de novo.
      if (mensagem.tipo === 'content_script_carregado') {
        const armazenado = await chrome.storage.local.get(['gravando', 'abaZoomId']);
        const abaId = remetente && remetente.tab && remetente.tab.id;
        responder({ ok: true, ativa: !!(armazenado.gravando && armazenado.abaZoomId === abaId) });
        return;
      }

      // Previa de transcricao de um pedaco (vinda do offscreen) -- so repassa pra legenda ao
      // vivo na aba do Zoom, sem guardar nada aqui (a transcricao definitiva vem depois, no
      // finalizar, com o audio completo -- ver painel.py).
      if (mensagem.tipo === 'previa_transcricao') {
        const armazenado = await chrome.storage.local.get(['abaZoomId']);
        if (armazenado.abaZoomId) {
          chrome.tabs.sendMessage(armazenado.abaZoomId, { tipo: 'previa_transcricao', texto: mensagem.texto }).catch(() => {});
        }
        responder({ ok: true });
        return;
      }

      // Pergunta feita na barra flutuante (durante a propria audiencia, ainda em andamento) --
      // diferente da pergunta que ja existe na aba Audiencias do painel (essa so funciona DEPOIS
      // que a audiencia termina e fica salva). O content script manda a transcricao parcial junto
      // (o que ja apareceu na legenda ao vivo ate agora), porque so ele tem esse texto.
      if (mensagem.tipo === 'perguntar_ao_vivo') {
        const armazenado = await chrome.storage.local.get(['token']);
        if (!armazenado.token) throw new Error('Você precisa estar logado na extensão.');
        const resposta = await fetch(API_BASE + '/api/painel?acao=audiencia_perguntar_ao_vivo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + armazenado.token },
          body: JSON.stringify({
            transcricao_parcial: mensagem.transcricaoParcial || '', pergunta: mensagem.pergunta,
          }),
        });
        const dados = await resposta.json();
        if (!resposta.ok) throw new Error(dados.erro || 'Não consegui responder agora.');
        responder({ ok: true, resposta: dados.resposta });
        return;
      }

      // Print de tela (barra flutuante, botao 📷) -- tira uma captura da propria aba da chamada
      // e guarda com o horario (em segundos desde o inicio da gravacao), pra entrar no documento
      // final da audiencia no lugar certo (ver _montar_docx_audiencia_com_capturas no backend).
      if (mensagem.tipo === 'tirar_print') {
        const armazenado = await chrome.storage.local.get(['gravando', 'iniciadoEm', 'abaZoomId', 'capturas']);
        if (!armazenado.gravando || !armazenado.abaZoomId) {
          throw new Error('Não tem gravação em andamento.');
        }
        const aba = await chrome.tabs.get(armazenado.abaZoomId);
        const dataUrl = await new Promise((resolve, reject) => {
          chrome.tabs.captureVisibleTab(aba.windowId, { format: 'jpeg', quality: 70 }, (url) => {
            if (chrome.runtime.lastError || !url) reject(new Error(chrome.runtime.lastError?.message || 'Falha ao capturar a tela.'));
            else resolve(url);
          });
        });
        const capturas = armazenado.capturas || [];
        capturas.push({
          segundo: (Date.now() - armazenado.iniciadoEm) / 1000,
          imagem_base64: dataUrl.split(',')[1] || '',
        });
        await chrome.storage.local.set({ capturas });
        responder({ ok: true });
        return;
      }

      if (mensagem.tipo === 'finalizar') {
        const armazenado = await chrome.storage.local.get(['token', 'abaZoomId', 'falantesTimeline', 'capturas']);
        if (armazenado.abaZoomId) {
          chrome.tabs.sendMessage(armazenado.abaZoomId, { tipo: 'gravacao_ativa', ativa: false }).catch(() => {});
        }
        // O offscreen agora responde em 2 etapas: primeiro so confirma que o audio ja subiu
        // inteiro pro Drive (rapido) -- so DEPOIS disso, sozinho, ele transcreve pela IA (a parte
        // que de verdade demora, sem como acelerar) e avisa aqui quando terminar, atraves da
        // mensagem 'audiencia_pronta' mais abaixo. Assim a pessoa ja pode fechar a janela da
        // extensao logo que o audio termina de subir, sem precisar esperar a transcricao inteira.
        const respostaOffscreen = await chrome.runtime.sendMessage({
          target: 'offscreen', tipo: 'finalizar_gravacao', token: armazenado.token,
          falantesTimeline: armazenado.falantesTimeline || [], capturas: armazenado.capturas || [],
        });
        await chrome.storage.local.set({
          gravando: false, iniciadoEm: null, abaZoomId: null, falantesTimeline: [], capturas: [],
        });
        // NAO fecha o offscreen document aqui -- ele continua vivo processando a transcricao em
        // segundo plano. So fecha quando 'audiencia_pronta' avisar que a fase 2 terminou.
        if (!respostaOffscreen || !respostaOffscreen.ok) {
          throw new Error((respostaOffscreen && respostaOffscreen.erro) || 'Não consegui enviar a gravação.');
        }
        responder({ ok: true, enviado: true });
        return;
      }

      // Avisa que a fase 2 (transcricao pela IA, rodando sozinha no offscreen desde o
      // 'finalizar_gravacao' acima) terminou -- ou falhou. A essa altura o popup provavelmente ja
      // foi fechado (a pessoa nao precisa mais ficar esperando), entao o aviso vira uma
      // notificacao do sistema em vez de uma resposta pro popup.
      if (mensagem.tipo === 'audiencia_pronta') {
        const armazenado = await chrome.storage.local.get(['gravando']);
        // so fecha o offscreen se nao tiver uma gravacao NOVA rodando nele nesse meio-tempo
        // (ex: a pessoa ja comecou outra audiencia enquanto essa ainda transcrevia).
        if (!armazenado.gravando) chrome.offscreen.closeDocument().catch(() => {});

        if (mensagem.ok) {
          chrome.notifications.create('', {
            type: 'basic', iconUrl: 'icons/icon128.png', title: 'Audiência pronta!',
            message: (mensagem.resposta || 'Sua audiência foi transcrita.').slice(0, 250),
          });
        } else {
          chrome.notifications.create('', {
            type: 'basic', iconUrl: 'icons/icon128.png', title: 'Falha ao processar a audiência',
            message: mensagem.erro || 'Não consegui terminar de processar. O áudio já está salvo no Drive.',
          });
        }
        responder({ ok: true });
        return;
      }

      responder({ ok: false, erro: 'Comando desconhecido.' });
    } catch (e) {
      responder({ ok: false, erro: e.message || String(e) });
    }
  })();

  return true; // resposta assincrona
});
