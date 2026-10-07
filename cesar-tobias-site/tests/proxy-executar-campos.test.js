// Roda com: node tests/proxy-executar-campos.test.js
// O proxy da Vercel (api/painel.js, ação "executar") só repassa à Lambda os campos de uma lista.
// Campo novo que o formulário envia e não está na lista é DESCARTADO em silêncio (foi o que fez o
// "Serviço prestado" do contrato não chegar). Este teste garante que todo campo que os formulários
// do contrato mandam por "executar" está na lista.
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const proxy = fs.readFileSync(path.join(__dirname, '..', 'api', 'painel.js'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '..', 'painel-app.js'), 'utf8').replace(/\r\n/g, '\n');

const m = proxy.match(/var camposPermitidos = \[([^\]]*)\]/);
assert(m, 'lista camposPermitidos nao encontrada em api/painel.js');
const permitidos = new Set(m[1].split(',').map(x => x.trim().replace(/^'|'$/g, '')).filter(Boolean));

let falhas = 0;
function t(nome, fn) { try { fn(); console.log('ok  ' + nome); } catch (e) { falhas++; console.log('FALHA ' + nome + ': ' + e.message); } }

t('"servico" (Serviço prestado do novo contrato) está na lista do proxy', () => {
  assert(permitidos.has('servico'));
});

t('todo campo do corpo de financeiro_contrato_criar está na lista do proxy', () => {
  const i = app.indexOf("tipo: 'financeiro_contrato_criar'");
  assert(i > 0, 'corpo do contrato nao encontrado');
  const bloco = app.slice(i, app.indexOf('};', i));
  const campos = [...bloco.matchAll(/^\s+([a-z_]+):/gm)].map(x => x[1]);
  assert(campos.length >= 10, 'poucos campos lidos: ' + campos.join(','));
  const faltando = campos.filter(c => !permitidos.has(c));
  assert.deepStrictEqual(faltando, [], 'campos descartados pelo proxy: ' + faltando.join(', '));
});

if (falhas) { console.log('\n' + falhas + ' falha(s)'); process.exit(1); }
console.log('\ntodos passaram');
