const telaLogin = document.getElementById('tela-login');
const telaPrincipal = document.getElementById('tela-principal');
const blocoAutorizarMicrofone = document.getElementById('bloco-autorizar-microfone');
const blocoParado = document.getElementById('bloco-parado');
const blocoGravando = document.getElementById('bloco-gravando');
const campoUsuario = document.getElementById('campo-usuario');
const campoSenha = document.getElementById('campo-senha');
const btnEntrar = document.getElementById('btn-entrar');
const btnAutorizarMicrofone = document.getElementById('btn-autorizar-microfone');
const btnIniciar = document.getElementById('btn-iniciar');
const btnFinalizar = document.getElementById('btn-finalizar');
const btnSair = document.getElementById('btn-sair');
const statusEl = document.getElementById('status');

let cronometroInterval = null;

function mostrarStatus(texto, tipo) {
  statusEl.textContent = texto || '';
  statusEl.className = 'status' + (tipo ? ' ' + tipo : '');
}

function formatarDuracao(ms) {
  const totalSeg = Math.floor(ms / 1000);
  const m = Math.floor(totalSeg / 60);
  const s = totalSeg % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function enviarComando(mensagem) {
  return chrome.runtime.sendMessage(mensagem).then((resposta) => {
    if (!resposta) throw new Error('Sem resposta da extensão.');
    if (!resposta.ok) throw new Error(resposta.erro || 'Falha desconhecida.');
    return resposta;
  });
}

function iniciarCronometro(iniciadoEm) {
  clearInterval(cronometroInterval);
  const cronometroEl = document.getElementById('cronometro');
  cronometroEl.textContent = formatarDuracao(Date.now() - iniciadoEm);
  cronometroInterval = setInterval(() => {
    cronometroEl.textContent = formatarDuracao(Date.now() - iniciadoEm);
  }, 1000);
}

function renderizarEstado(estado) {
  if (!estado.logado) {
    telaLogin.hidden = false;
    telaPrincipal.hidden = true;
    return;
  }
  telaLogin.hidden = true;
  telaPrincipal.hidden = false;

  if (estado.gravando) {
    blocoParado.hidden = true;
    blocoGravando.hidden = false;
    iniciarCronometro(estado.iniciadoEm || Date.now());
  } else {
    blocoParado.hidden = false;
    blocoGravando.hidden = true;
    clearInterval(cronometroInterval);
  }

  // Checagem de permissao do microfone -- so verifica o status, nao pede permissao aqui (o
  // popup e um documento "invisivel" pro Chrome, nao consegue mostrar esse pedido -- ver
  // permissoes.html). Nem todo navegador baseado em Chromium suporta consultar "microphone"
  // (ex: alguns builds do Edge) -- nesse caso so deixa escondido, sem travar o resto da tela.
  if (navigator.permissions && navigator.permissions.query) {
    navigator.permissions.query({ name: 'microphone' })
      .then((resultado) => { blocoAutorizarMicrofone.hidden = resultado.state === 'granted'; })
      .catch(() => { blocoAutorizarMicrofone.hidden = true; });
  }
}

function atualizarTela() {
  enviarComando({ tipo: 'obter_estado' }).then(renderizarEstado).catch(() => {});
}

btnEntrar.addEventListener('click', () => {
  const usuario = campoUsuario.value.trim();
  const senha = campoSenha.value;
  if (!usuario || !senha) {
    mostrarStatus('Preencha usuário e senha.', 'erro');
    return;
  }
  btnEntrar.disabled = true;
  mostrarStatus('Entrando…');
  enviarComando({ tipo: 'login', usuario, senha })
    .then(() => { mostrarStatus(''); campoSenha.value = ''; atualizarTela(); })
    .catch((e) => mostrarStatus(e.message, 'erro'))
    .finally(() => { btnEntrar.disabled = false; });
});

btnAutorizarMicrofone.addEventListener('click', () => {
  enviarComando({ tipo: 'abrir_permissao_microfone' })
    .then(() => mostrarStatus('Autorize na aba que abriu e volte aqui.', 'ok'))
    .catch((e) => mostrarStatus(e.message, 'erro'));
});

btnIniciar.addEventListener('click', () => {
  btnIniciar.disabled = true;
  mostrarStatus('Iniciando gravação…');
  enviarComando({ tipo: 'iniciar' })
    .then((resposta) => {
      mostrarStatus(resposta.avisoMic || '', resposta.avisoMic ? 'erro' : '');
      atualizarTela();
    })
    .catch((e) => mostrarStatus(e.message, 'erro'))
    .finally(() => { btnIniciar.disabled = false; });
});

btnFinalizar.addEventListener('click', () => {
  btnFinalizar.disabled = true;
  mostrarStatus('Enviando o áudio…');
  enviarComando({ tipo: 'finalizar' })
    .then(() => {
      // a partir daqui a transcricao (a parte de verdade demorada) roda sozinha, mesmo que essa
      // janela seja fechada -- um aviso do sistema chega quando estiver pronto.
      mostrarStatus('Áudio enviado! Pode fechar esta janela -- você recebe um aviso quando a transcrição estiver pronta.', 'ok');
      atualizarTela();
    })
    .catch((e) => { mostrarStatus(e.message, 'erro'); atualizarTela(); })
    .finally(() => { btnFinalizar.disabled = false; });
});

btnSair.addEventListener('click', () => {
  enviarComando({ tipo: 'sair' }).then(atualizarTela).catch(() => {});
});

atualizarTela();
