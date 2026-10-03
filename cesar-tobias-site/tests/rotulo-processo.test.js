// Roda com: node tests/rotulo-processo.test.js
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const fonte = fs.readFileSync(path.join(__dirname, '..', 'painel-app.js'), 'utf8');
const ini = fonte.indexOf('// ROTULO-PROCESSO:inicio');
const fim = fonte.indexOf('// ROTULO-PROCESSO:fim');
assert(ini > 0 && fim > ini, 'marcadores nao encontrados em painel-app.js');
const rotulo = new Function(fonte.slice(ini, fim) + '; return _rotuloProcessoParaSelect;')();

let falhas = 0;
function t(nome, fn) { try { fn(); console.log('ok  ' + nome); } catch (e) { falhas++; console.log('FALHA ' + nome + ': ' + e.message); } }

t('numero e cliente juntos', () => assert.strictEqual(rotulo({ numero_cnj: '6016743-14.2026.8.03.0001', cliente_nome: 'Gustavo Gabriel de Souza Neves' }), '6016743-14.2026.8.03.0001 — Gustavo Gabriel de Souza Neves'));
t('so numero (cliente vazio, nulo ou ausente)', () => {
  [{ numero_cnj: '123', cliente_nome: '' }, { numero_cnj: '123', cliente_nome: null }, { numero_cnj: '123' }].forEach(p => assert.strictEqual(rotulo(p), '123'));
});
t('so cliente (processo sem numero)', () => {
  [{ numero_cnj: '', cliente_nome: 'Fulano' }, { numero_cnj: null, cliente_nome: 'Fulano' }, { cliente_nome: 'Fulano' }].forEach(p => assert.strictEqual(rotulo(p), 'Fulano'));
});
t('sem nada: texto fixo, nunca opcao em branco', () => {
  [{}, { numero_cnj: '', cliente_nome: '' }, null, undefined].forEach(p => assert.strictEqual(rotulo(p), 'Processo sem número'));
});
t('os 3 seletores (prazo, tarefa, agenda) usam o rotulo e nenhum mostra so o numero', () => {
  assert.strictEqual((fonte.match(/esc\(_rotuloProcessoParaSelect\(p\)\)/g) || []).length, 3);
  assert(!/<option value="' \+ p\.id \+ '">' \+ esc\(p\.numero_cnj \|\| p\.cliente_nome\)/.test(fonte), 'ainda existe seletor so com o numero');
});

t('prazos: cartao, resultado da busca e modal usam o rotulo; a busca global acha pelo nome do cliente', () => {
  assert((fonte.match(/_rotuloProcessoParaSelect\(pz\)/g) || []).length >= 2, 'cartao e busca global');
  assert(fonte.includes("'Processo: ' + _rotuloProcessoParaSelect(processoFixo)"), 'modal do prazo');
  assert(fonte.includes("(pz.cliente_nome || '').toLowerCase().indexOf(termoLower) !== -1"), 'busca por cliente');
  assert(fonte.includes('cliente_nome: pz.cliente_nome }, pz, carregar'), 'editar passa o cliente ao modal');
});

if (falhas) { console.log(falhas + ' falha(s)'); process.exit(1); }
console.log('todos os testes passaram');
