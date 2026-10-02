// Roda com: node tests/whatsapp-conexao.test.js
// Testa as funcoes puras e o controlador do WhatsApp (QR em linha, polling, expiracao) contra um
// DOM falso minimo -- o codigo testado e extraido de painel-app.js entre marcadores.
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const fonte = fs.readFileSync(path.join(__dirname, '..', 'painel-app.js'), 'utf8');
function trecho(nome) {
  const ini = fonte.indexOf('// ' + nome + ':inicio');
  const fim = fonte.indexOf('// ' + nome + ':fim');
  assert(ini > 0 && fim > ini, 'marcadores ' + nome + ' nao encontrados');
  return fonte.slice(ini, fim);
}
const puras = new Function(trecho('WHATSAPP-CONEXAO') + '; return { _chipEstadoWhatsApp, _qrWhatsAppValido };')();
const codigoControlador = trecho('WHATSAPP-CONTROLADOR');

let falhas = 0;
const pendentes = [];
function t(nome, fn) { pendentes.push([nome, fn]); }

// ---------- DOM falso ----------
function el(id) {
  return {
    id, children: [], style: {}, className: '', _texto: '', disabled: false, handlers: {}, src: '', alt: '',
    get textContent() { return this._texto; },
    set textContent(v) { this._texto = String(v); if (v === '' || v === null) this.children = []; },
    appendChild(c) { this.children.push(c); return c; },
    addEventListener(ev, fn) { this.handlers[ev] = fn; },
    click() { return this.handlers.click.call(this); },
  };
}

function montar({ ids, respostas }) {
  const elementos = {};
  ids.forEach(i => { elementos[i] = el(i); });
  const doc = {
    getElementById: i => elementos[i] || null,
    createElement: tag => el(tag),
  };
  const chamadas = [];
  const apiGetJson = url => {
    chamadas.push(url);
    const r = respostas(url, chamadas);
    return r instanceof Error ? Promise.reject(r) : Promise.resolve(r);
  };
  const timers = { ativos: new Map(), prox: 1 };
  const setInterval_ = (fn, ms) => { const id = timers.prox++; timers.ativos.set(id, { fn, ms }); return id; };
  const clearInterval_ = id => { timers.ativos.delete(id); };
  const relogio = { agora: 1000000 };
  const Date_ = { now: () => relogio.agora };
  const fabrica = new Function(
    'document', 'apiGetJson', 'setInterval', 'clearInterval', 'Date', '_chipEstadoWhatsApp', '_qrWhatsAppValido',
    codigoControlador + '; return { iniciarQrWa, verificarWhatsApp, pararQrWa };'
  );
  const api = fabrica(doc, apiGetJson, setInterval_, clearInterval_, Date_, puras._chipEstadoWhatsApp, puras._qrWhatsAppValido);
  return { api, elementos, chamadas, timers, relogio, doc };
}
const flush = () => new Promise(r => setImmediate(r));
const IDS = ['conexao-status-wa', 'conexao-erro-wa', 'conexao-wa-qr', 'btn-conexao-wa-qr', 'btn-conexao-wa-verificar'];
const QR = 'data:image/png;base64,AAAA';

// ---------- puras ----------
t('chip: open/connecting/close/desconhecido/indefinido', () => {
  assert.deepStrictEqual(puras._chipEstadoWhatsApp('open'), { texto: 'Conectado', classe: 'chip good' });
  assert.strictEqual(puras._chipEstadoWhatsApp('connecting').texto, 'Aguardando conexão');
  assert.deepStrictEqual(puras._chipEstadoWhatsApp('close'), { texto: 'Desconectado', classe: 'chip warn' });
  assert.strictEqual(puras._chipEstadoWhatsApp('desconhecido').texto, 'Não foi possível checar');
  assert.strictEqual(puras._chipEstadoWhatsApp(undefined).texto, 'Não foi possível checar');
});
t('qr valido so aceita data URL de imagem', () => {
  assert(puras._qrWhatsAppValido('data:image/png;base64,AAA'));
  ['javascript:alert(1)', 'http://x/y.png', '<img onerror=x>', '', null, undefined, 5, {}].forEach(v =>
    assert.strictEqual(puras._qrWhatsAppValido(v), false, String(v)));
});

// ---------- controlador ----------
t('ao carregar, pinta o chip com o estado (desconectado)', async () => {
  const c = montar({ ids: IDS, respostas: () => ({ estado: 'close', conectado: false }) });
  await c.api.verificarWhatsApp(); await flush();
  assert.strictEqual(c.elementos['conexao-status-wa'].textContent, 'Desconectado');
  assert.strictEqual(c.elementos['conexao-status-wa'].className, 'chip warn');
  assert(c.chamadas[0].includes('acao=whatsapp_estado'));
});
t('falha ao checar o estado: chip "nao foi possivel checar", sem quebrar', async () => {
  const c = montar({ ids: IDS, respostas: () => new Error('502') });
  const r = await c.api.verificarWhatsApp();
  assert.strictEqual(r, null);
  assert.strictEqual(c.elementos['conexao-status-wa'].textContent, 'Não foi possível checar');
});
t('clicar em conectar desenha o QR como <img> (nunca innerHTML) e agenda renovacao + checagem', async () => {
  const c = montar({ ids: IDS, respostas: url => url.includes('whatsapp_qr') ? { conectado: false, qr: QR } : { estado: 'connecting', conectado: false } });
  c.elementos['btn-conexao-wa-qr'].click(); await flush(); await flush();
  const area = c.elementos['conexao-wa-qr'];
  assert.strictEqual(area.children[0].src, QR);
  assert.strictEqual(area.children[0].id, 'img');
  assert.deepStrictEqual([...c.timers.ativos.values()].map(x => x.ms).sort((a, b) => a - b), [3000, 25000]);
});
t('QR invalido (nao e data URL de imagem) nao e desenhado e mostra aviso', async () => {
  const c = montar({ ids: IDS, respostas: () => ({ conectado: false, qr: 'javascript:alert(1)' }) });
  c.elementos['btn-conexao-wa-qr'].click(); await flush(); await flush();
  assert(!c.elementos['conexao-wa-qr'].children.some(x => x.src === 'javascript:alert(1)'));
  assert(c.elementos['conexao-erro-wa'].children[0].textContent.includes('Tentando de novo'));
});
t('erro devolvido pelo backend aparece como texto (textContent)', async () => {
  const c = montar({ ids: IDS, respostas: () => ({ conectado: false, qr: null, erro: '<b>falhou</b>' }) });
  c.elementos['btn-conexao-wa-qr'].click(); await flush(); await flush();
  assert.strictEqual(c.elementos['conexao-erro-wa'].children[0].textContent, '<b>falhou</b>');
});
t('detecta a conexao durante a checagem: para os timers e mostra sucesso', async () => {
  let conectado = false;
  const c = montar({ ids: IDS, respostas: url => url.includes('whatsapp_qr') ? { conectado: false, qr: QR } : { estado: conectado ? 'open' : 'connecting', conectado } });
  c.elementos['btn-conexao-wa-qr'].click(); await flush(); await flush();
  conectado = true;
  [...c.timers.ativos.values()].find(x => x.ms === 3000).fn(); await flush(); await flush();
  assert.strictEqual(c.timers.ativos.size, 0);
  assert.strictEqual(c.elementos['conexao-status-wa'].textContent, 'Conectado');
  assert.strictEqual(c.elementos['conexao-wa-qr'].children.length, 0);
  assert.strictEqual(c.elementos['conexao-erro-wa'].children[0].textContent, 'WhatsApp conectado com sucesso.');
});
t('se ja estava conectado, o pedido de QR responde conectado e nao desenha nada', async () => {
  const c = montar({ ids: IDS, respostas: () => ({ conectado: true, qr: null }) });
  c.elementos['btn-conexao-wa-qr'].click(); await flush(); await flush();
  assert.strictEqual(c.elementos['conexao-status-wa'].textContent, 'Conectado');
  assert.strictEqual(c.timers.ativos.size, 0);
});
t('expira apos 5 minutos: para tudo, limpa o QR e orienta a gerar outro', async () => {
  const c = montar({ ids: IDS, respostas: url => url.includes('whatsapp_qr') ? { conectado: false, qr: QR } : { estado: 'close', conectado: false } });
  c.elementos['btn-conexao-wa-qr'].click(); await flush(); await flush();
  c.relogio.agora += 5 * 60 * 1000 + 1;
  [...c.timers.ativos.values()].find(x => x.ms === 3000).fn(); await flush(); await flush();
  assert.strictEqual(c.timers.ativos.size, 0);
  assert.strictEqual(c.elementos['conexao-wa-qr'].children.length, 0);
  assert(c.elementos['conexao-erro-wa'].children[0].textContent.includes('expirou'));
});
t('se o usuario sai da tela (elemento some), os timers param sozinhos', async () => {
  const c = montar({ ids: IDS, respostas: url => url.includes('whatsapp_qr') ? { conectado: false, qr: QR } : { estado: 'close', conectado: false } });
  c.elementos['btn-conexao-wa-qr'].click(); await flush(); await flush();
  delete c.elementos['conexao-wa-qr'];
  [...c.timers.ativos.values()].find(x => x.ms === 3000).fn(); await flush(); await flush();
  assert.strictEqual(c.timers.ativos.size, 0);
});
t('clicar de novo nao acumula timers', async () => {
  const c = montar({ ids: IDS, respostas: url => url.includes('whatsapp_qr') ? { conectado: false, qr: QR } : { estado: 'close', conectado: false } });
  c.elementos['btn-conexao-wa-qr'].click(); await flush(); await flush();
  c.elementos['btn-conexao-wa-qr'].click(); await flush(); await flush();
  assert.strictEqual(c.timers.ativos.size, 2);
});
t('falha de rede ao pedir o QR mostra aviso e continua tentando (timers ativos)', async () => {
  const c = montar({ ids: IDS, respostas: () => new Error('rede') });
  c.elementos['btn-conexao-wa-qr'].click(); await flush(); await flush();
  assert(c.elementos['conexao-erro-wa'].children[0].textContent.includes('Tentando de novo'));
  assert.strictEqual(c.timers.ativos.size, 2);
});
t('botao Verificar: conectado, desconectado e falha', async () => {
  for (const [resp, trechoEsperado] of [
    [{ estado: 'open', conectado: true }, 'WhatsApp conectado.'],
    [{ estado: 'close', conectado: false }, 'não está conectado'],
    [new Error('x'), 'Não foi possível checar agora'],
  ]) {
    const c = montar({ ids: IDS, respostas: () => resp });
    await c.elementos['btn-conexao-wa-verificar'].click(); await flush(); await flush();
    assert(c.elementos['conexao-erro-wa'].children[0].textContent.includes(trechoEsperado), trechoEsperado);
    assert.strictEqual(c.elementos['btn-conexao-wa-verificar'].disabled, false);
  }
});
t('sem a secao na tela (conta nao-admin), nada quebra', async () => {
  const c = montar({ ids: [], respostas: () => ({ estado: 'open', conectado: true }) });
  await c.api.verificarWhatsApp(); c.api.iniciarQrWa(); await flush(); await flush();
  c.api.pararQrWa();
});

(async () => {
  for (const [nome, fn] of pendentes) {
    try { await fn(); console.log('ok  ' + nome); } catch (e) { falhas++; console.log('FALHA ' + nome + ': ' + e.message); }
  }
  if (falhas) { console.log(falhas + ' falha(s)'); process.exit(1); }
  console.log('todos os testes passaram');
})();
