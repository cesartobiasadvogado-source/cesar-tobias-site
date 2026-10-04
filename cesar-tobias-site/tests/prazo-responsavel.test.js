// Roda com: node tests/prazo-responsavel.test.js
// Responsável (usuário do painel, opcional) no modal de prazo e nas listas de prazos.
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const fonte = fs.readFileSync(path.join(__dirname, '..', 'painel-app.js'), 'utf8').replace(/\r\n/g, '\n');

let falhas = 0;
function t(nome, fn) { try { fn(); console.log('ok  ' + nome); } catch (e) { falhas++; console.log('FALHA ' + nome + ': ' + e.message); } }

const iniModal = fonte.indexOf('function _garantirModalPrazo()');
const fimModal = fonte.indexOf('function abrirModalPrazo(');
assert(iniModal > 0 && fimModal > iniModal, 'modal de prazo nao encontrado');
const modal = fonte.slice(iniModal, fimModal);

t('o modal de prazo tem o campo Responsável (opcional, "Selecione") antes da Prioridade', () => {
  assert(modal.includes('<label>Responsável</label>'));
  assert(modal.includes('id="prazo-form-responsavel"'));
  assert(modal.includes('<option value="">Selecione</option>'));
  assert(modal.indexOf('prazo-form-tipo') < modal.indexOf('prazo-form-responsavel'));
  assert(modal.indexOf('prazo-form-responsavel') < modal.indexOf('prazo-form-prioridade'));
});

t('salvar envia o responsável (criar e editar usam o mesmo corpo)', () => {
  assert(modal.includes("responsavel: document.getElementById('prazo-form-responsavel').value,"));
});

t('ao abrir: carrega os usuários do painel (mesma fonte das tarefas); editar traz o do prazo', () => {
  assert(modal.includes("apiGetJson('/api/painel?acao=usuarios_nomes')"));
  assert(modal.includes("selectRespPrazo.value = prazoExistente ? (prazoExistente.responsavel || '') : '';"));
  assert(modal.includes("'<option value=\"\">Selecione</option>' +\n          usuarios.map("));
});

t('as duas listas de prazo mostram o responsável ao lado do título', () => {
  assert.strictEqual(fonte.split("'</strong>' + _htmlResponsavelPrazo(pz)").length - 1, 2);
});

t('o responsável só aparece quando existe (prazo antigo não mostra nada)', () => {
  const m = fonte.match(/function _htmlResponsavelPrazo\(pz\) \{\n\s+return (.*);\n\s+\}/);
  assert(m, 'funcao nao encontrada');
  const esc = (x) => String(x);
  const f = new Function('esc', 'return function (pz) { return ' + m[1] + '; };')(esc);
  assert.strictEqual(f({ responsavel: null }), '');
  assert.strictEqual(f({}), '');
  assert(f({ responsavel: 'ana' }).includes('· ana'));
});

if (falhas) { console.log('\n' + falhas + ' falha(s)'); process.exit(1); }
console.log('\ntodos passaram');
