const telaLogin = document.getElementById('tela-login');
const telaPrincipal = document.getElementById('tela-principal');
const blocoParado = document.getElementById('bloco-parado');
const blocoGravando = document.getElementById('bloco-gravando');
const campoUsuario = document.getElementById('campo-usuario');
const campoSenha = document.getElementById('campo-senha');
const campoCliente = document.getElementById('campo-cliente');
const btnEntrar = document.getElementById('btn-entrar');
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

btnIniciar.addEventListener('click', () => {
  const cliente = campoCliente.value.trim();
  if (!cliente) {
    mostrarStatus('Informe o nome do cliente antes de iniciar.', 'erro');
    return;
  }
  btnIniciar.disabled = true;
  mostrarStatus('Iniciando gravação (autorize o microfone se o Chrome pedir)…');
  enviarComando({ tipo: 'iniciar', cliente })
    .then(() => { mostrarStatus(''); atualizarTela(); })
    .catch((e) => mostrarStatus(e.message, 'erro'))
    .finally(() => { btnIniciar.disabled = false; });
});

btnFinalizar.addEventListener('click', () => {
  btnFinalizar.disabled = true;
  mostrarStatus('Enviando e transcrevendo (pode levar alguns minutos, pode fechar esta janela)…');
  enviarComando({ tipo: 'finalizar' })
    .then((resposta) => {
      mostrarStatus(resposta.resposta || 'Áudio processado.', 'ok');
      campoCliente.value = '';
      atualizarTela();
    })
    .catch((e) => mostrarStatus(e.message, 'erro'))
    .finally(() => { btnFinalizar.disabled = false; });
});

btnSair.addEventListener('click', () => {
  enviarComando({ tipo: 'sair' }).then(atualizarTela).catch(() => {});
});

atualizarTela();
