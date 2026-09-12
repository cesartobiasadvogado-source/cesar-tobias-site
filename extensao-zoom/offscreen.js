// Documento invisível onde a gravação de verdade acontece -- exigência do Manifest V3 (o
// service worker, background.js, não pode segurar um MediaStream vivo por muito tempo).
// Reaproveita os MESMOS 3 endpoints que a aba Audiências do painel já usa pra subir um áudio
// gravado (iniciar_upload_audiencia / audiencia_chunk / finalizar_upload_audiencia) -- pra quem
// olha o backend, essa gravação chega exatamente como se fosse um arquivo enviado por lá.

const API_BASE = 'https://www.cesartobias.adv.br';
const DURACAO_PEDACO_MS = 20000;

let audioContext = null;
let tabStream = null;
let micStream = null;
let mediaRecorder = null;
let todosPedacos = [];
let tokenGravacaoAtual = null;

function pararTudo() {
  if (tabStream) tabStream.getTracks().forEach((t) => t.stop());
  if (micStream) micStream.getTracks().forEach((t) => t.stop());
  if (audioContext) audioContext.close().catch(() => {});
  tabStream = null; micStream = null; audioContext = null; mediaRecorder = null;
  tokenGravacaoAtual = null;
}

async function iniciarGravacao(streamId, token) {
  // trava contra chamar iniciar de novo enquanto ja esta gravando -- sem isso, um segundo
  // "iniciar" (ex: clique duplo) sobrescrevia tudo por baixo do pano, silenciosamente.
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    throw new Error('Já existe uma gravação em andamento neste documento.');
  }

  tokenGravacaoAtual = token;
  todosPedacos = [];

  tabStream = await navigator.mediaDevices.getUserMedia({
    audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } },
  });

  var avisoMic = null;
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    // segue so com o audio da aba (sem a voz do proprio advogado) -- geralmente por falta da
    // permissao de microfone, que so pode ser concedida numa aba visivel (ver permissoes.html),
    // nao aqui dentro do offscreen document.
    micStream = null;
    avisoMic = 'Gravando sem o seu microfone (' + (e.message || e.name) + ') -- sua fala pode não aparecer na transcrição.';
    console.warn('Falha ao capturar o microfone:', e);
  }

  audioContext = new AudioContext();
  const destino = audioContext.createMediaStreamDestination();

  // reconecta o áudio da aba na saída de som normal -- sem isso, capturar o áudio da aba MUTA
  // ela pro usuário (o advogado deixaria de ouvir a própria audiência).
  const fonteAba = audioContext.createMediaStreamSource(tabStream);
  fonteAba.connect(audioContext.destination);
  fonteAba.connect(destino);

  if (micStream) {
    const fonteMic = audioContext.createMediaStreamSource(micStream);
    fonteMic.connect(destino);
  }

  mediaRecorder = new MediaRecorder(destino.stream, { mimeType: 'audio/webm;codecs=opus' });
  mediaRecorder.addEventListener('dataavailable', (ev) => {
    if (!ev.data || ev.data.size === 0) return;
    todosPedacos.push(ev.data);
    enviarPreviaPedaco(ev.data); // legenda ao vivo -- best-effort, nunca trava a gravacao
  });
  mediaRecorder.start(DURACAO_PEDACO_MS);
  return avisoMic;
}

function pararMediaRecorder() {
  return new Promise((resolve) => {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') { resolve(); return; }
    mediaRecorder.addEventListener('stop', () => resolve(), { once: true });
    mediaRecorder.stop();
  });
}

function arrayBufferParaBase64(buffer) {
  let binario = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) binario += String.fromCharCode(bytes[i]);
  return btoa(binario);
}

async function enviarPreviaPedaco(blob) {
  // Legenda ao vivo (igual o Tactiq mostra por cima da chamada) -- reaproveita o MESMO endpoint
  // sem estado que a transcricao ao vivo por microfone do painel ja usa
  // (audiencia_pedaco_ao_vivo): so transcreve esse pedaco curto isolado e devolve o texto, sem
  // guardar nada -- a transcricao definitiva sai depois, no finalizar, do audio completo.
  if (!tokenGravacaoAtual) return;
  try {
    const buffer = await blob.arrayBuffer();
    const dados = await apiPost('/api/painel?acao=audiencia_pedaco_ao_vivo', {
      dados_base64: arrayBufferParaBase64(buffer), mimetype: blob.type || 'audio/webm',
    }, tokenGravacaoAtual);
    if (dados.texto) {
      chrome.runtime.sendMessage({ tipo: 'previa_transcricao', texto: dados.texto }).catch(() => {});
    }
  } catch (e) {
    // uma falha na previa nunca pode travar a gravacao -- so fica sem legenda nesse trecho.
    console.warn('Falha ao gerar prévia da legenda ao vivo:', e);
  }
}

async function apiPost(caminho, corpo, token) {
  const resposta = await fetch(API_BASE + caminho, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify(corpo),
  });
  const dados = await resposta.json();
  if (!resposta.ok) {
    // "sessao_invalida" e o codigo cru que o backend devolve -- troca por uma mensagem que faz
    // sentido pra quem esta vendo (ver tambem a checagem preventiva em background.js, que evita
    // isso acontecer so aqui no final, depois de gravar a audiencia inteira).
    if (dados.erro === 'sessao_invalida') {
      throw new Error('Sua sessão expirou. Clique em "Trocar de usuário" e entre de novo -- a gravação desta vez não foi salva.');
    }
    throw new Error(dados.erro || 'falha na requisição');
  }
  return dados;
}

async function enviarPedacosParaDrive(arquivo, uploadId, tamanhoChunk, token) {
  let offset = 0;
  while (offset < arquivo.size) {
    const pedaco = arquivo.slice(offset, offset + tamanhoChunk);
    const buffer = await pedaco.arrayBuffer();
    await apiPost('/api/painel?acao=audiencia_chunk', {
      upload_id: uploadId, dados_base64: arrayBufferParaBase64(buffer),
    }, token);
    offset += tamanhoChunk;
  }
  return uploadId;
}

async function finalizarEEnviar(token, falantesTimeline) {
  await pararMediaRecorder();
  pararTudo();

  const blobCompleto = new Blob(todosPedacos, { type: 'audio/webm' });
  todosPedacos = [];
  if (blobCompleto.size === 0) throw new Error('Nada foi gravado.');

  if (!token) throw new Error('Sessão expirada -- entre de novo na extensão.');

  // sem nome de cliente (a extensao nao pede isso antes de gravar) -- o nome do arquivo usa so
  // data/hora, e tudo cai na pasta compartilhada de transcricoes (pasta_compartilhada: true),
  // nunca dentro da pasta de um cliente especifico.
  const agora = new Date();
  const carimbo = agora.toLocaleString('pt-BR').replace(/[\/,:]/g, '-').replace(/\s+/g, ' ');
  const nomeArquivo = 'Audiencia ' + carimbo + '.webm';

  const iniciado = await apiPost('/api/painel?acao=audiencias', {
    op: 'iniciar_upload_audiencia', pasta_compartilhada: true, nome_arquivo: nomeArquivo,
    mimetype: 'audio/webm', tamanho_total: blobCompleto.size,
  }, token);

  await enviarPedacosParaDrive(blobCompleto, iniciado.upload_id, iniciado.tamanho_chunk, token);

  // endpoint proprio (corpo em vez de query string) porque falantesTimeline pode ficar grande
  // demais pra uma URL numa audiencia longa -- ver handle_painel_audiencia_finalizar_com_falantes.
  const finalizado = await apiPost('/api/painel?acao=audiencia_finalizar_com_falantes', {
    upload_id: iniciado.upload_id, falantes_timeline: falantesTimeline || [],
  }, token);

  return finalizado.resposta || 'Áudio processado.';
}

chrome.runtime.onMessage.addListener((mensagem, remetente, responder) => {
  if (mensagem.target !== 'offscreen') return false;

  if (mensagem.tipo === 'iniciar_gravacao') {
    iniciarGravacao(mensagem.streamId, mensagem.token)
      .then((avisoMic) => responder({ ok: true, avisoMic }))
      .catch((e) => responder({ ok: false, erro: e.message || String(e) }));
    return true;
  }

  if (mensagem.tipo === 'finalizar_gravacao') {
    finalizarEEnviar(mensagem.token, mensagem.falantesTimeline)
      .then((resposta) => responder({ ok: true, resposta }))
      .catch((e) => { pararTudo(); responder({ ok: false, erro: e.message || String(e) }); });
    return true;
  }

  return false;
});
