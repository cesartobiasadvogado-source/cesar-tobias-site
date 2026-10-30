// Roda com: node tests/calculos-modelo-ir.test.js
// Modelo "Restituicao de IR - isencao por doenca grave" da aba Calculos: vazio nao da erro, nao traz dado de cliente,
// e preenchido com os valores de um caso real reproduz os totais da planilha original do escritorio (R$ 25.292,12 -> 28.084,37).
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const M = require('../calculos-motor.js');
const MOD = require('../calculos-modelos.js');

let falhas = 0;
function t(nome, fn) { try { fn(); console.log('ok  ' + nome); } catch (e) { falhas++; console.log('FALHA ' + nome + ': ' + e.message); } }
const perto = (a, b) => assert(Math.abs(a - b) < 1e-6, a + ' != ' + b);

t('o modelo existe na lista e e criado como copia independente', () => {
  assert(MOD.lista.some(m => m.id === 'ir-doenca-grave'));
  const a = MOD.criar('ir-doenca-grave'), b = MOD.criar('ir-doenca-grave');
  a.abas[1].celulas.B4 = 'x';
  assert.strictEqual(b.abas[1].celulas.B4, undefined);
  assert.strictEqual(MOD.criar('nao-existe'), null);
});

t('abas esperadas, nomes unicos', () => {
  const p = MOD.criar('ir-doenca-grave');
  assert.deepStrictEqual(p.abas.map(a => a.nome), ['Leia-me', 'Identificação', 'Índices SELIC', 'Memória Mensal', 'Honorários', 'Resumo', 'Fundamentação', 'Como Usar', 'Documentos Necessários']);
});

t('modelo vazio: nenhuma celula mostra erro', () => {
  const p = MOD.criar('ir-doenca-grave'), k = M.criarCalculo(p);
  p.abas.forEach(a => Object.keys(a.celulas).forEach(addr => {
    const txt = k.exibir(a.nome, addr);
    assert(!/^#/.test(txt), a.nome + '!' + addr + ' = ' + txt);
  }));
  assert.strictEqual(k.valor('Memória Mensal', 'E30'), 0);
  assert.strictEqual(k.exibir('Memória Mensal', 'A5'), '');
  assert.strictEqual(k.exibir('Memória Mensal', 'G5'), '');
});

t('nenhum dado de cliente dentro do modelo', () => {
  const fonte = fs.readFileSync(path.join(__dirname, '..', 'calculos-modelos.js'), 'utf8');
  for (const proibido of [/Otni/i, /Marizete/i, /SIAPE/i, /016\.942/, /1018519/, /DECIPEX/i]) assert(!proibido.test(fonte), 'achou ' + proibido);
});

t('preenchido com um caso real reproduz os totais da planilha original', () => {
  const p = MOD.criar('ir-doenca-grave');
  const mem = p.abas[3], ind = p.abas[2], hon = p.abas[4];
  ind.celulas.B8 = '1,1104';
  const ir = [1905.16, 1905.16, 1905.16, 1905.16, 3858.23, 1944.36, 1693.68, 1693.68, 1693.68, 1693.68, 3394.57, 1699.6];
  ir.forEach((v, i) => { mem.celulas['E' + (5 + i)] = String(v).replace('.', ','); });
  hon.celulas.B7 = '20%';
  const k = M.criarCalculo(p);
  perto(k.valor('Memória Mensal', 'E30'), 25292.12);
  perto(k.valor('Memória Mensal', 'G30'), 28084.370048);
  perto(k.valor('Honorários', 'B8'), 5616.8740096);
  perto(k.valor('Honorários', 'B9'), 22467.4960384);
  assert.strictEqual(k.exibir('Memória Mensal', 'G30'), 'R$ 28.084,37');
  assert.strictEqual(k.exibir('Resumo', 'B3'), 'R$ 25.292,12');
  assert.strictEqual(k.exibir('Resumo', 'B4'), '1,110400');
  assert.strictEqual(k.exibir('Resumo', 'B8'), 'R$ 22.467,50');
  assert.strictEqual(k.exibir('Memória Mensal', 'A16'), '12', 'numeracao sequencial');
  assert.strictEqual(k.exibir('Memória Mensal', 'A17'), '', 'linha vazia fica em branco');
});

t('sem fator informado, o valor atualizado fica em branco (nao calcula com fator zero)', () => {
  const p = MOD.criar('ir-doenca-grave');
  p.abas[3].celulas.E5 = '100';
  const k = M.criarCalculo(p);
  assert.strictEqual(k.exibir('Memória Mensal', 'G5'), '');
  assert.strictEqual(k.valor('Memória Mensal', 'G30'), 0);
});

t('fator calculado pela tabela de indices: fator unico e por competencia (taxas ficticias de 1% ao mes, so de teste)', () => {
  const p = MOD.criar('ir-doenca-grave');
  assert(p.indices && p.indices.SELIC, 'o modelo traz a tabela SELIC (vazia) para ser preenchida');
  p.indices.SELIC.serie = { '2023-08': 1, '2023-09': 1, '2023-10': 1 };
  const ind = p.abas[2], mem = p.abas[3];
  ind.celulas.B5 = '01/08/2023'; ind.celulas.B6 = '01/10/2023';
  mem.celulas.B5 = '07/2023'; mem.celulas.E5 = '100';
  mem.celulas.B6 = '09/2023'; mem.celulas.E6 = '100';
  let k = M.criarCalculo(p);
  perto(k.valor('Índices SELIC', 'B8'), 1.030301);
  perto(k.valor('Memória Mensal', 'G5'), 103.0301); perto(k.valor('Memória Mensal', 'G6'), 103.0301);
  ind.celulas.B9 = '2'; // por competencia: mes seguinte a retencao ate a data-base
  k = M.criarCalculo(p);
  perto(k.valor('Memória Mensal', 'G5'), 103.0301); // 07/2023 -> ago, set, out
  perto(k.valor('Memória Mensal', 'G6'), 101);       // 09/2023 -> so out
  assert.strictEqual(k.exibir('Resumo', 'B4'), 'Por competência');
  p.indices.SELIC.serie = { '2023-08': 1 }; // faltam meses: erro visivel, nunca estimativa
  k = M.criarCalculo(p);
  assert.strictEqual(k.exibir('Memória Mensal', 'G5'), '#N/D!');
  ind.celulas.B8 = '1,1104'; ind.celulas.B9 = ''; // digitar o fator continua valendo
  k = M.criarCalculo(p);
  perto(k.valor('Memória Mensal', 'G5'), 111.04);
});

console.log(falhas ? '\n' + falhas + ' falha(s)' : '\nTodos os testes passaram');
process.exit(falhas ? 1 : 0);
