// Roda com: node tests/acoes-status-processo.test.js
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const fonte = fs.readFileSync(path.join(__dirname, '..', 'painel-app.js'), 'utf8');
const ini = fonte.indexOf('// ACOES-STATUS-PROCESSO:inicio');
const fim = fonte.indexOf('// ACOES-STATUS-PROCESSO:fim');
assert(ini > 0 && fim > ini, 'marcadores nao encontrados em painel-app.js');
const acoes = new Function(fonte.slice(ini, fim) + '; return _acoesStatusProcesso;')();

let falhas = 0;
function t(nome, fn) { try { fn(); console.log('ok  ' + nome); } catch (e) { falhas++; console.log('FALHA ' + nome + ': ' + e.message); } }

t('arquivado so oferece Desarquivar, que volta pra Em andamento', () => {
  assert.deepStrictEqual(acoes('Arquivado'), [{ rotulo: 'Desarquivar', status: 'Em andamento' }]);
});
['Em andamento', 'Suspenso', 'Finalizado'].forEach(st => t('"' + st + '" oferece Encerrar e Arquivar', () => {
  assert.deepStrictEqual(acoes(st), [{ rotulo: 'Encerrar', status: 'Finalizado' }, { rotulo: 'Arquivar', status: 'Arquivado' }]);
}));
t('status vazio ou desconhecido cai no menu normal (nunca em Desarquivar)', () => {
  [undefined, null, '', 'arquivado', 'xyz'].forEach(v => {
    assert(!acoes(v).some(a => a.rotulo === 'Desarquivar'), String(v));
    assert.strictEqual(acoes(v).length, 2);
  });
});
t('todo status de destino e um dos 4 status validos do cadastro', () => {
  const validos = ['Em andamento', 'Suspenso', 'Finalizado', 'Arquivado'];
  ['Arquivado', 'Em andamento', 'Suspenso', 'Finalizado', undefined].forEach(v =>
    acoes(v).forEach(a => assert(validos.includes(a.status), a.status)));
});
t('os dois menus (lista e ficha) usam a mesma funcao', () => {
  assert.strictEqual((fonte.match(/_acoesStatusProcesso\(p\.status\)/g) || []).length, 2);
  assert(!fonte.includes('data-procficha-status="Arquivado">Arquivar'), 'botao Arquivar fixo ainda existe na ficha');
  assert(!fonte.includes('data-procman-status-acao="Arquivado" data-procman-indice="\' + indice + \'">Arquivar'), 'botao Arquivar fixo ainda existe na lista');
});

if (falhas) { console.log(falhas + ' falha(s)'); process.exit(1); }
console.log('todos os testes passaram');
