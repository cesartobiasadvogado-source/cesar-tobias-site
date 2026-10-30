// Roda com: node tests/calculos-atualizacao.test.js
// Modelo "Atualizacao de valores": o usuario so informa indice, mes final e (data, valor); fator e valor corrigido saem sozinhos.
// Taxas FICTICIAS (so para teste): 1% ao mes de 2023-08 a 2023-10 e 0,5% em 2023-11.
const assert = require('assert');
const M = require('../calculos-motor.js');
const MOD = require('../calculos-modelos.js');

let falhas = 0;
function t(nome, fn) { try { fn(); console.log('ok  ' + nome); } catch (e) { falhas++; console.log('FALHA ' + nome + ': ' + e.message); } }
const perto = (a, b) => assert(Math.abs(a - b) < 1e-9, a + ' != ' + b);

function caso(extra) {
  const p = MOD.criar('atualizacao-valores');
  p.indices.SELIC.serie = { '2023-08': 1, '2023-09': 1, '2023-10': 1, '2023-11': 0.5 };
  const a = p.abas[0];
  a.celulas.B4 = '10/2023';
  Object.assign(a.celulas, extra || {});
  return { p, k: () => M.criarCalculo(p) };
}

t('o modelo esta na lista, com o layout fixo usado pelo formulario', () => {
  assert(MOD.lista.some(m => m.id === 'atualizacao-valores'));
  assert.deepStrictEqual(MOD.layoutAtualizacao, { aba: 'Atualização', indice: 'B3', ate: 'B4', regra: 'B5', primeira: 8, ultima: 47, totalLinha: 50 });
});

t('modelo vazio: sem erro em nenhuma celula e totais zerados', () => {
  const p = MOD.criar('atualizacao-valores'), k = M.criarCalculo(p);
  Object.keys(p.abas[0].celulas).forEach(addr => assert(!/^#/.test(k.exibir('Atualização', addr)), addr));
  assert.strictEqual(k.valor('Atualização', 'D50'), 0);
});

t('regra 1 (mes seguinte): valor de 07/2023 corrigido por ago, set e out', () => {
  const { k } = caso({ A8: '07/2023', B8: '1000' });
  const c = k();
  perto(c.valor('Atualização', 'C8'), 1.030301);
  perto(c.valor('Atualização', 'D8'), 1030.301);
  assert.strictEqual(c.exibir('Atualização', 'D8'), 'R$ 1.030,30');
});

t('regra 0 (proprio mes): o mesmo valor ganha mais um mes de correcao', () => {
  const { k } = caso({ A8: '08/2023', B8: '1000', B5: '0' });
  perto(k().valor('Atualização', 'C8'), 1.030301); // ago, set e out
  const { k: k1 } = caso({ A8: '08/2023', B8: '1000', B5: '1' });
  perto(k1().valor('Atualização', 'C8'), 1.0201); // set e out
});

t('aceita data completa (dia/mes/ano) e mes/ano; valor no formato brasileiro', () => {
  const { k } = caso({ A8: '15/09/2023', B8: '1.905,16', A9: '09/2023', B9: 'R$ 1.905,16' });
  const c = k();
  perto(c.valor('Atualização', 'B8'), 1905.16);
  perto(c.valor('Atualização', 'C8'), 1.01); // so out
  perto(c.valor('Atualização', 'C9'), 1.01);
});

t('valor do proprio mes final ou depois dele nao e corrigido (fator 1)', () => {
  const { k } = caso({ A8: '10/2023', B8: '500', A9: '12/2023', B9: '500' });
  const c = k();
  assert.strictEqual(c.valor('Atualização', 'C8'), 1);
  assert.strictEqual(c.valor('Atualização', 'C9'), 1);
  assert.strictEqual(c.valor('Atualização', 'D9'), 500);
});

t('totais: original, corrigido e diferenca', () => {
  const { k } = caso({ A8: '07/2023', B8: '1000', A9: '08/2023', B9: '2000' });
  const c = k();
  perto(c.valor('Atualização', 'B50'), 3000);
  perto(c.valor('Atualização', 'D50'), 1000 * 1.030301 + 2000 * 1.0201);
  perto(c.valor('Atualização', 'D51'), c.valor('Atualização', 'D50') - 3000);
});

t('falta de taxa nunca e estimada: erro visivel (#N/D!) e o total tambem acusa', () => {
  const { p, k } = caso({ A8: '07/2023', B8: '1000' });
  p.indices.SELIC.serie = { '2023-08': 1 }; // faltam set e out
  const c = k();
  assert.strictEqual(c.exibir('Atualização', 'C8'), '#N/D!');
  assert.strictEqual(c.exibir('Atualização', 'D50'), '#N/D!');
});

t('sem informar ate que mes corrigir: erro, nao correcao silenciosa', () => {
  const { p, k } = caso({ A8: '07/2023', B8: '1000' });
  delete p.abas[0].celulas.B4;
  assert(/^#/.test(k().exibir('Atualização', 'C8')));
});

t('outro indice escolhido pelo nome (IPCA) e indice inexistente', () => {
  const { p, k } = caso({ A8: '07/2023', B8: '1000' });
  p.indices.IPCA = { fonte: '', consulta: '', serie: { '2023-08': 0.5, '2023-09': 0.5, '2023-10': 0.5 } };
  p.abas[0].celulas.B3 = 'ipca';
  perto(k().valor('Atualização', 'C8'), 1.005 ** 3);
  p.abas[0].celulas.B3 = 'XYZ';
  assert.strictEqual(k().exibir('Atualização', 'C8'), '#N/D!');
});

t('linha com so a data ou so o valor fica em branco (nao da erro)', () => {
  const { k } = caso({ A8: '07/2023', B9: '300' });
  const c = k();
  assert.strictEqual(c.exibir('Atualização', 'C8'), '');
  assert.strictEqual(c.exibir('Atualização', 'D9'), '');
});

t('Excel: as formulas se traduzem (FATOR sai como valor) e o modelo nao traz dado de cliente', () => {
  const X = require('../calculos-exportar.js');
  const p = MOD.criar('atualizacao-valores');
  const f = p.abas[0].celulas;
  assert.strictEqual(X.traduzirFormula(f.D8), 'IF(C8="","",B8*C8)');
  assert.strictEqual(X.traduzirFormula(f.C8), null);
  assert.strictEqual(X.traduzirFormula(f.B50), 'SUM(B8:B47)');
});

console.log(falhas ? '\n' + falhas + ' falha(s)' : '\nTodos os testes passaram');
process.exit(falhas ? 1 : 0);
