// Roda com: node tests/servico-contrato.test.js
// Novo contrato de honorários: campo "Serviço prestado" (texto livre) depois do Tipo.
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const fonte = fs.readFileSync(path.join(__dirname, '..', 'painel-app.js'), 'utf8').replace(/\r\n/g, '\n');

let falhas = 0;
function t(nome, fn) { try { fn(); console.log('ok  ' + nome); } catch (e) { falhas++; console.log('FALHA ' + nome + ': ' + e.message); } }

t('o modal tem o campo "Serviço prestado" (texto, até 200 caracteres) logo depois do Tipo', () => {
  assert(fonte.includes('<label for="ncontrato-servico">Serviço prestado</label>'));
  assert(fonte.includes('<input type="text" id="ncontrato-servico" maxlength="200"'));
  assert(fonte.indexOf('id="ncontrato-tipo"') < fonte.indexOf('id="ncontrato-servico"'));
  assert(fonte.indexOf('id="ncontrato-servico"') < fonte.indexOf('id="ncontrato-campo-valor"'));
});

t('salvar envia o serviço digitado (sem espaços nas pontas)', () => {
  assert(fonte.includes("servico: document.getElementById('ncontrato-servico').value.trim(),"));
});

t('ao abrir o modal o campo vem vazio', () => {
  assert(fonte.includes("document.getElementById('ncontrato-servico').value = '';"));
});

t('o campo é opcional: o formulário não bloqueia o salvar quando está vazio', () => {
  const m = fonte.match(/btnSalvar\.addEventListener\('click', function \(\) \{\n\s+var nome = _resolverClienteContrato[\s\S]*?apiPost\('\/api\/painel\?acao=executar'/);
  assert(m, 'trecho do salvar nao encontrado');
  assert(!/ncontrato-servico[\s\S]*erroEl\.textContent/.test(m[0].split('var corpo')[0]), 'nao deve validar o servico antes de montar o corpo');
});

if (falhas) { console.log('\n' + falhas + ' falha(s)'); process.exit(1); }
console.log('\ntodos passaram');
