// Sem dependencias: node --test tests/ux-confianca.test.js
// Exercita falhas reais de transporte e a recuperacao sem autenticar ou acessar APIs.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const fonte = fs.readFileSync(path.join(__dirname, '..', 'painel-app.js'), 'utf8');
const cadastro = fs.readFileSync(path.join(__dirname, '..', 'cadastro-advogado.html'), 'utf8');
function trecho(texto, inicio, fim) {
  const i = texto.indexOf(inicio), f = texto.indexOf(fim, i + inicio.length);
  assert(i >= 0 && f > i);
  return texto.slice(i, f);
}
const proximoTurno = () => new Promise(resolve => setImmediate(resolve));

function ambienteCarregamento() {
  const nos = new Map();
  const documento = { getElementById: id => nos.get(id) || null };
  function no(id, oculto = false) {
    const classes = new Set(oculto ? ['hidden'] : []);
    const n = {
      id, textContent: '', disabled: false, attrs: {}, eventos: {},
      classList: { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c) },
      setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; },
      querySelector(s) { return this.filhos[s]; },
      addEventListener(tipo, fn) { this.eventos[tipo] = fn; },
      prepend(el) { nos.set(el.id, el); },
      replaceChildren(el) { nos.set(el.id, el); },
      remove() { nos.delete(this.id); },
      focus() { documento.activeElement = this; },
    };
    nos.set(id, n);
    return n;
  }
  documento.documentElement = no('html');
  documento.createElement = () => { const n = no('temporario'); n.filhos = { span: no('span'), button: no('retry') }; return n; };
  documento.querySelector = () => no('area');
  const gate = no('gate'), shell = no('shell', true), senhaInput = no('senha');
  no('carregando-inicial');
  const sessao = new Map([['painel_token', 'ficticio-somente-local']]);
  let resposta = () => Promise.reject(new TypeError('offline'));
  let renderizacoes = 0;
  const carregarDados = new Function('document', 'sessionStorage', 'apiGet', 'gateError', 'gate', 'shell', 'senhaInput', 'PAGINA_ATUAL', 'renderPainel', 'conteudo', 'esc',
    trecho(fonte, '  function carregarDados() {', '\n  function carregarListaUsuarios()') + '; return carregarDados;'
  )(documento, { removeItem: k => sessao.delete(k) }, () => resposta(), no('gate-error'), gate, shell, senhaInput, 'financeiro_novo', () => renderizacoes++, no('conteudo'), String);
  return { carregarDados, documento, sessao, shell, gate, responder: fn => { resposta = fn; }, renderizacoes: () => renderizacoes };
}

test('falha de rede preserva sessao; tentar novamente recupera a tela', async () => {
  const a = ambienteCarregamento();
  a.carregarDados(); await proximoTurno();
  assert(a.sessao.has('painel_token'));
  assert(a.gate.classList.contains('hidden'));
  const aviso = a.documento.getElementById('falha-carregamento-painel');
  assert.match(aviso.querySelector('span').textContent, /sessão foi mantida/);
  assert.equal(aviso.querySelector('button').disabled, false);
  a.responder(() => Promise.resolve({ status: 200, ok: true, json: async () => ({}) }));
  aviso.querySelector('button').eventos.click(); await proximoTurno();
  assert.equal(a.renderizacoes(), 1);
  assert.equal(a.documento.getElementById('falha-carregamento-painel'), null);
  assert(!a.shell.classList.contains('hidden'));
});

test('HTTP 500 preserva dados visiveis e avisa que podem estar desatualizados', async () => {
  const a = ambienteCarregamento();
  a.shell.classList.remove('hidden');
  a.responder(() => Promise.resolve({ status: 500, ok: false }));
  a.carregarDados(); await proximoTurno();
  assert(a.sessao.has('painel_token'));
  assert(!a.shell.classList.contains('hidden'));
  assert.match(a.documento.getElementById('falha-carregamento-painel').querySelector('span').textContent, /desatualizados/);
});

test('somente HTTP 401 remove a sessao e retorna ao campo de senha', async () => {
  const a = ambienteCarregamento();
  a.responder(() => Promise.resolve({ status: 401, ok: false }));
  a.carregarDados(); await proximoTurno();
  assert(!a.sessao.has('painel_token'));
  assert(!a.gate.classList.contains('hidden'));
  assert.equal(a.documento.activeElement.id, 'senha');
});

test('cadastro devolve erro recuperavel em falha de rede ou resposta invalida', async () => {
  for (const fetch of [async () => { throw new TypeError('offline'); }, async () => ({ ok: true, json: async () => { throw new SyntaxError('JSON'); } })]) {
    const chamar = new Function('fetch', 'API', trecho(cadastro, '  async function chamar(', '\n  function renderBarraPassos()') + '; return chamar;')(fetch, '/api-ficticia');
    const resposta = await chamar('teste_sem_credenciais', {});
    assert.equal(resposta.ok, false);
    assert.match(resposta.dados.erro, /campos foram mantidos/);
  }
});

function luminancia(hex) {
  return [1, 3, 5].reduce((s, i, indice) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return s + (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4) * [0.2126, 0.7152, 0.0722][indice];
  }, 0);
}
const contraste = (a, b) => (Math.max(luminancia(a), luminancia(b)) + 0.05) / (Math.min(luminancia(a), luminancia(b)) + 0.05);
test('cor personalizada preserva contraste AA do texto branco do botao', () => {
  const cor = new Function(trecho(fonte, '  function corBotaoAcessivel(', '\n  var inputCorAccent') + '; return corBotaoAcessivel;')();
  for (const original of ['#ffffff', '#ffff00', '#00ff00', '#6c8cf0', '#000000', '#2c5ce0']) {
    assert(contraste('#ffffff', cor(original)) >= 4.5, original);
  }
});

test('tokens de texto secundario, avisos e botoes atingem 4,5:1 nos temas padrao', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'painel.css'), 'utf8');
  const base = trecho(css, ':root {', '\n  @media');
  const dark = trecho(css, ':root[data-theme="dark"] {', '\n  * {');
  const valores = bloco => Object.fromEntries([...bloco.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/g)].map(m => [m[1], m[2]]));
  for (const tema of [valores(base), { ...valores(base), ...valores(dark) }]) {
    for (const [a, b] of [['ink-faint', 'surface'], ['ink-faint', 'bg'], ['warn', 'warn-soft'], ['good', 'good-soft'], ['crit', 'crit-soft']]) {
      assert(contraste(tema[a], tema[b]) >= 4.5, `${a}/${b}`);
    }
    assert(contraste('#ffffff', tema['accent-fill']) >= 4.5);
    assert(contraste('#ffffff', tema['crit-fill']) >= 4.5);
  }
});

test('Tab e Shift+Tab ficam no modal; navegacao interna permanece nativa', () => {
  const primeiro = { focus() { doc.activeElement = this; } };
  const ultimo = { focus() { doc.activeElement = this; } };
  const meio = {};
  const doc = { activeElement: ultimo };
  const modal = { contains: el => [primeiro, meio, ultimo].includes(el) };
  const conterFoco = new Function('document', 'elementosFocaveis', trecho(fonte, '  function conterFoco(', '\n  // Os modais existentes') + '; return conterFoco;')(doc, () => [primeiro, meio, ultimo]);
  let impedido = false;
  const evento = shiftKey => ({ shiftKey, preventDefault() { impedido = true; } });
  conterFoco(evento(false), modal);
  assert(impedido); assert.equal(doc.activeElement, primeiro);
  impedido = false; conterFoco(evento(true), modal);
  assert(impedido); assert.equal(doc.activeElement, ultimo);
  impedido = false; doc.activeElement = meio; conterFoco(evento(false), modal);
  assert(!impedido); assert.equal(doc.activeElement, meio);
});
