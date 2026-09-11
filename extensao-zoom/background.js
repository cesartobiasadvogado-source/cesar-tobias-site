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

      if (mensagem.tipo === 'obter_estado') {
        const armazenado = await chrome.storage.local.get(['token', 'nome', 'gravando', 'cliente', 'iniciadoEm']);
        responder({
          ok: true,
          logado: !!armazenado.token,
          nome: armazenado.nome || '',
          gravando: !!armazenado.gravando,
          cliente: armazenado.cliente || '',
          iniciadoEm: armazenado.iniciadoEm || null,
        });
        return;
      }

      if (mensagem.tipo === 'iniciar') {
        const aba = await obterAbaAtiva();
        if (!aba || !aba.id) throw new Error('Não encontrei a aba do Zoom em foco.');

        const streamId = await new Promise((resolve, reject) => {
          chrome.tabCapture.getMediaStreamId({ targetTabId: aba.id }, (id) => {
            if (chrome.runtime.lastError || !id) reject(new Error(chrome.runtime.lastError?.message || 'Não consegui capturar o áudio da aba.'));
            else resolve(id);
          });
        });

        await garantirOffscreen();
        await chrome.storage.local.set({ gravando: true, cliente: mensagem.cliente, iniciadoEm: Date.now() });

        const respostaOffscreen = await chrome.runtime.sendMessage({
          target: 'offscreen', tipo: 'iniciar_gravacao', streamId,
        });
        if (!respostaOffscreen || !respostaOffscreen.ok) {
          await chrome.storage.local.set({ gravando: false });
          throw new Error((respostaOffscreen && respostaOffscreen.erro) || 'Não consegui iniciar a gravação.');
        }
        responder({ ok: true });
        return;
      }

      if (mensagem.tipo === 'finalizar') {
        const armazenado = await chrome.storage.local.get(['token', 'cliente']);
        const respostaOffscreen = await chrome.runtime.sendMessage({
          target: 'offscreen', tipo: 'finalizar_gravacao', token: armazenado.token, cliente: armazenado.cliente,
        });
        await chrome.storage.local.set({ gravando: false, cliente: '', iniciadoEm: null });
        if (!respostaOffscreen || !respostaOffscreen.ok) {
          throw new Error((respostaOffscreen && respostaOffscreen.erro) || 'Não consegui processar a gravação.');
        }
        responder({ ok: true, resposta: respostaOffscreen.resposta });
        return;
      }

      responder({ ok: false, erro: 'Comando desconhecido.' });
    } catch (e) {
      responder({ ok: false, erro: e.message || String(e) });
    }
  })();

  return true; // resposta assincrona
});
