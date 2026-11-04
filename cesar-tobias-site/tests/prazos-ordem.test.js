// Roda com: node tests/prazos-ordem.test.js
// Lista de prazos: pendentes e vencidos em cima, cumpridos embaixo (nas duas listas: pagina Prazos e ficha do processo).
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const fonte = fs.readFileSync(path.join(__dirname, '..', 'painel-app.js'), 'utf8').replace(/\r\n/g, '\n');
let falhas = 0;
function t(nome, fn) { try { fn(); console.log('ok  ' + nome); } catch (e) { falhas++; console.log('FALHA ' + nome + ': ' + e.message); } }

const ini = fonte.indexOf('function prazosPendentesPrimeiro');
assert(ini > 0, 'funcao nao encontrada');
const fim = fonte.indexOf('function wireListaPrazos');
const ordenar = new Function(fonte.slice(ini, fim) + '\nreturn prazosPendentesPrimeiro;')();

t('cumpridos vao pra baixo; vencidos e pendentes ficam em cima, na ordem original', () => {
  const r = ordenar([
    { id: 1, status: 'cumprido' }, { id: 2, status: 'cumprido' }, { id: 3, status: 'vencido' },
    { id: 4, status: 'pendente' }, { id: 5, status: 'cumprido' }, { id: 6, status: 'pendente' },
  ]);
  assert.deepStrictEqual(r.map(p => p.id), [3, 4, 6, 1, 2, 5]);
});

t('lista vazia ou ausente nao quebra e a lista original nao e alterada', () => {
  assert.deepStrictEqual(ordenar(undefined), []);
  const orig = [{ id: 1, status: 'cumprido' }, { id: 2, status: 'pendente' }];
  ordenar(orig);
  assert.deepStrictEqual(orig.map(p => p.id), [1, 2]);
});

t('as duas listas (pagina Prazos e ficha do processo) usam a ordenacao', () => {
  assert(fonte.includes('prazosCarregados = prazosPendentesPrimeiro(dados.prazos)'));
  assert(fonte.includes('prazosCarregadosFicha = prazosPendentesPrimeiro(dados.prazos)'));
});

if (falhas) { console.log('\n' + falhas + ' falha(s)'); process.exit(1); }
console.log('\ntudo ok');
