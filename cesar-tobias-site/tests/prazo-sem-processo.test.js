// Roda com: node tests/prazo-sem-processo.test.js
// Prazo avulso: o modal de prazo nao exige mais processo (campo opcional).
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

t('o campo Processo e opcional e a opcao vazia e "Sem processo (prazo avulso)"', () => {
  assert(modal.includes('(opcional)'));
  assert.strictEqual(modal.split('<option value="">Sem processo (prazo avulso)</option>').length - 1, 2);
  assert(!modal.includes('Selecione o processo'));
});

t('salvar nao bloqueia quando nao ha processo', () => {
  assert(!modal.includes("erroDiv.innerHTML = '<div class=\"aviso-tenant\">Selecione o processo.</div>'"));
  assert(modal.includes("var processoId = processoFixo ? processoFixo.id : document.getElementById('prazo-form-processo').value;"));
});

t('editar prazo avulso mostra "Prazo avulso (sem processo)" em vez de "Processo: ..."', () => {
  assert(modal.includes("processoFixo.id ? 'Processo: ' + _rotuloProcessoParaSelect(processoFixo) : 'Prazo avulso (sem processo)'"));
});

if (falhas) { console.log('\n' + falhas + ' falha(s)'); process.exit(1); }
console.log('\ntudo ok');
