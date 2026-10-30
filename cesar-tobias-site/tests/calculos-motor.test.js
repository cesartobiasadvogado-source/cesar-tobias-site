// Roda com: node tests/calculos-motor.test.js
// Motor de formulas da aba "Calculos": interpretacao do que se digita, formulas, datas, formatos, copia de formulas e o caso-modelo (IR retido x fator).
const assert = require('assert');
const M = require('../calculos-motor.js');

let falhas = 0;
function t(nome, fn) { try { fn(); console.log('ok  ' + nome); } catch (e) { falhas++; console.log('FALHA ' + nome + ': ' + e.message); } }

function calc(celulas, formatos, extras) {
  const abas = [{ nome: 'Plan1', celulas: celulas || {}, formatos: formatos || {} }].concat(extras || []);
  return M.criarCalculo({ abas });
}
const ex = (c, a, aba) => calc(c).exibir(aba || 'Plan1', a);

t('enderecos A, Z, AA, AB', () => {
  assert.strictEqual(M.colParaLetra(1), 'A'); assert.strictEqual(M.colParaLetra(26), 'Z');
  assert.strictEqual(M.colParaLetra(27), 'AA'); assert.strictEqual(M.letraParaCol('AB'), 28);
  assert.deepStrictEqual(M.parseEndereco('$C$12'), { col: 3, row: 12 });
});

t('numeros digitados no padrao brasileiro', () => {
  assert.strictEqual(M.interpretar('1905,16').valor, 1905.16);
  assert.strictEqual(M.interpretar('10.359,71').valor, 10359.71);
  assert.strictEqual(M.interpretar('1.234').valor, 1234);
  assert.strictEqual(M.interpretar('10359.71').valor, 10359.71);
  assert.strictEqual(M.interpretar('R$ 3.858,23').valor, 3858.23);
  assert.strictEqual(M.interpretar('-5,5').valor, -5.5);
  assert.strictEqual(M.interpretar('20%').valor, 0.2);
  assert.strictEqual(M.interpretar('Aposentadoria 2023').tipo, 'texto');
  assert.strictEqual(M.interpretar('016.942.942-34').tipo, 'texto', 'CPF nao pode virar numero');
  assert.strictEqual(M.interpretar('1018519-76.2025.4.01.3100').tipo, 'texto', 'numero de processo nao pode virar numero');
});

t('formato texto impede conversao em numero', () => {
  assert.strictEqual(M.interpretar('0123', 'texto').tipo, 'texto');
});

t('datas e competencias', () => {
  assert.strictEqual(ex({ A1: '07/10/2026' }, 'A1'), '07/10/2026');
  assert.strictEqual(ex({ A1: '07/2023' }, 'A1'), '07/2023');
  assert.strictEqual(M.interpretar('31/02/2026').tipo, 'texto', 'data inexistente fica texto');
  assert.strictEqual(ex({ A1: '01/01/2024', A2: '=A1+31' }, 'A2'), String(M.serialDe(2024, 2, 1)), 'soma de dias devolve o serial (formate a celula como Data)');
});

t('aritmetica e precedencia', () => {
  assert.strictEqual(ex({ A1: '=2+3*4' }, 'A1'), '14');
  assert.strictEqual(ex({ A1: '=(2+3)*4' }, 'A1'), '20');
  assert.strictEqual(ex({ A1: '=2^3^2' }, 'A1'), '64', 'potencia associa a esquerda como no Excel');
  assert.strictEqual(ex({ A1: '=-2^2' }, 'A1'), '4', 'menos unario antes da potencia como no Excel');
  assert.strictEqual(ex({ A1: '=20%*50' }, 'A1'), '10');
  assert.strictEqual(ex({ A1: '=1,5*2' }, 'A1'), '3');
  assert.strictEqual(ex({ A1: '=0,1+0,2' }, 'A1'), '0,3', 'sem ruido de ponto flutuante');
});

t('referencias e faixas', () => {
  const c = { A1: '10', A2: '20,5', A3: '30', B1: '=A1+A2', B2: '=SOMA(A1:A3)', B3: '=MEDIA(A1:A3)', B4: '=MIN(A1:A3)', B5: '=MAX(A1:A3)', B6: '=CONT.NUM(A1:A3)' };
  const k = calc(c);
  assert.strictEqual(k.exibir('Plan1', 'B1'), '30,5');
  assert.strictEqual(k.exibir('Plan1', 'B2'), '60,5');
  assert.strictEqual(k.exibir('Plan1', 'B3'), '20,1666666667');
  assert.strictEqual(k.exibir('Plan1', 'B4'), '10');
  assert.strictEqual(k.exibir('Plan1', 'B5'), '30');
  assert.strictEqual(k.exibir('Plan1', 'B6'), '3');
});

t('referencia mista com linha fixa (E$5) e coluna fixa ($E5)', () => {
  const k = calc({ E5: '1', E6: '2', E7: '3', A7: '=CONT.NUM(E$5:E7)', A8: '=SOMA($E5:$E6)' });
  assert.strictEqual(k.exibir('Plan1', 'A7'), '3');
  assert.strictEqual(k.exibir('Plan1', 'A8'), '3');
  assert.strictEqual(M.deslocarFormula('=CONT.NUM(E$5:E5)', 0, 2), '=CONT.NUM(E$5:E7)');
});

t('SOMA ignora texto e vazio dentro da faixa', () => {
  assert.strictEqual(ex({ A1: '5', A2: 'abc', B1: '=SOMA(A1:A5)' }, 'B1'), '5');
});

t('SE, E, OU, NAO, SEERRO', () => {
  assert.strictEqual(ex({ A1: '5', B1: '=SE(A1>3;"alto";"baixo")' }, 'B1'), 'alto');
  assert.strictEqual(ex({ A1: '5', B1: '=SE(E(A1>3;A1<10);1;0)' }, 'B1'), '1');
  assert.strictEqual(ex({ A1: '5', B1: '=SE(OU(A1>9;A1<1);1;0)' }, 'B1'), '0');
  assert.strictEqual(ex({ B1: '=SEERRO(1/0;"n/d")' }, 'B1'), 'n/d');
  assert.strictEqual(ex({ B1: '=SE(NAO(FALSO);"sim";"nao")' }, 'B1'), 'sim');
  assert.strictEqual(ex({ B1: '=IF(1=1;"a";"b")' }, 'B1'), 'a', 'nomes em ingles tambem');
});

t('erros: divisao por zero, nome, referencia, circular, sintaxe', () => {
  assert.strictEqual(ex({ A1: '=1/0' }, 'A1'), '#DIV/0!');
  assert.strictEqual(ex({ A1: '=FOO(1)' }, 'A1'), '#NOME?');
  assert.strictEqual(ex({ A1: '=Outra!A1' }, 'A1'), '#REF!');
  assert.strictEqual(ex({ A1: '=B1', B1: '=A1' }, 'A1'), '#CIRC!');
  assert.strictEqual(ex({ A1: '=2+' }, 'A1'), '#ERRO!');
  assert.strictEqual(ex({ A1: '="a"+1' }, 'A1'), '#VALOR!');
  assert.strictEqual(ex({ A1: '=1/0', B1: '=A1+1' }, 'B1'), '#DIV/0!', 'erro se propaga');
});

t('texto: concatenar e comparar', () => {
  assert.strictEqual(ex({ A1: 'Otni', B1: '=A1&" - "&"2023"' }, 'B1'), 'Otni - 2023');
  assert.strictEqual(ex({ A1: 'abc', B1: '=A1="ABC"' }, 'B1'), 'VERDADEIRO');
});

t('ARRED (meio centavo sobe, como na calculadora judicial)', () => {
  assert.strictEqual(ex({ A1: '=ARRED(2,675;2)' }, 'A1'), '2,68');
  assert.strictEqual(ex({ A1: '=ARRED(1,005;2)' }, 'A1'), '1,01');
  assert.strictEqual(ex({ A1: '=ARRED(-2,5;0)' }, 'A1'), '-3');
  assert.strictEqual(ex({ A1: '=ARREDONDAR.PARA.CIMA(1,231;2)' }, 'A1'), '1,24');
  assert.strictEqual(ex({ A1: '=ARREDONDAR.PARA.BAIXO(1,239;2)' }, 'A1'), '1,23');
});

t('datas: DATA, ANO, MES, DIA, DATADIF', () => {
  assert.strictEqual(ex({ A1: '=DATA(2023;7;1)' }, 'A1', 'Plan1'), String(M.serialDe(2023, 7, 1)));
  assert.strictEqual(ex({ A1: '15/03/2024', B1: '=ANO(A1)', B2: '=MES(A1)', B3: '=DIA(A1)' }, 'B1'), '2024');
  assert.strictEqual(ex({ A1: '31/01/2023', A2: '30/04/2023', B1: '=DATADIF(A1;A2;"M")' }, 'B1'), '2');
  assert.strictEqual(ex({ A1: '31/01/2023', A2: '01/03/2024', B1: '=DATADIF(A1;A2;"Y")' }, 'B1'), '1');
  assert.strictEqual(ex({ A1: '01/01/2023', A2: '11/01/2023', B1: '=DATADIF(A1;A2;"D")' }, 'B1'), '10');
});

t('SOMASE com criterios', () => {
  const c = { A1: 'a', A2: 'b', A3: 'a', B1: '10', B2: '20', B3: '30', C1: '=SOMASE(A1:A3;"a";B1:B3)', C2: '=SOMASE(B1:B3;">10")' };
  const k = calc(c);
  assert.strictEqual(k.exibir('Plan1', 'C1'), '40');
  assert.strictEqual(k.exibir('Plan1', 'C2'), '50');
});

t('referencia entre abas (com e sem aspas)', () => {
  const k = calc({ A1: "='Memória Mensal'!B2*2", A2: '=Outra!B2+1' }, {}, [
    { nome: 'Memória Mensal', celulas: { B2: '21' } },
    { nome: 'Outra', celulas: { B2: '9' } },
  ]);
  assert.strictEqual(k.exibir('Plan1', 'A1'), '42');
  assert.strictEqual(k.exibir('Plan1', 'A2'), '10');
});

t('formatos: R$, numero, %, fator', () => {
  const k = calc({ A1: '1234567,891', A2: '0,2', A3: '-1234,5', A4: '1,1104' }, { A1: 'brl', A2: 'pct', A3: 'brl', A4: 'fator' });
  assert.strictEqual(k.exibir('Plan1', 'A1'), 'R$ 1.234.567,89');
  assert.strictEqual(k.exibir('Plan1', 'A2'), '20,00%');
  assert.strictEqual(k.exibir('Plan1', 'A3'), '-R$ 1.234,50');
  assert.strictEqual(k.exibir('Plan1', 'A4'), '1,110400');
  assert.strictEqual(calc({ A1: '1234,5' }, { A1: 'numero' }).exibir('Plan1', 'A1'), '1.234,50');
});

t('copiar formula para baixo ajusta relativas e preserva absolutas', () => {
  assert.strictEqual(M.deslocarFormula('=E5*F5', 0, 1), '=E6*F6');
  assert.strictEqual(M.deslocarFormula('=E5*$F$1', 0, 3), '=E8*$F$1');
  assert.strictEqual(M.deslocarFormula('=SOMA(A1:A3)', 1, 0), '=SOMA(B1:B3)');
  assert.strictEqual(M.deslocarFormula("='Memória Mensal'!G18+1", 0, 1), "='Memória Mensal'!G19+1");
  assert.strictEqual(M.deslocarFormula('=A1', 0, -1), '=#REF!');
  assert.strictEqual(M.deslocarFormula('texto', 0, 1), 'texto');
});

t('caso-modelo IR doenca grave: IR retido x fator, total, honorarios', () => {
  // valores do demonstrativo do caso (competencias 07 a 12/2023 de uma matricula), fator unico SELIC 1,1104
  const ir = [1905.16, 1905.16, 1905.16, 1905.16, 3858.23, 1944.36];
  const c = { H1: '1,1104' };
  ir.forEach((v, i) => { const r = i + 2; c['B' + r] = String(v).replace('.', ','); c['C' + r] = '=ARRED(B' + r + '*$H$1;2)'; });
  c.B8 = '=SOMA(B2:B7)'; c.C8 = '=SOMA(C2:C7)';
  c.C9 = '=ARRED(C8*20%;2)'; c.C10 = '=C8-C9';
  const k = calc(c, { B2: 'brl', C8: 'brl' });
  const somaIr = ir.reduce((s, x) => s + x, 0);
  assert.strictEqual(k.exibir('Plan1', 'B8'), '13423,23');
  assert.strictEqual(k.valor('Plan1', 'B8'), Math.round(somaIr * 100) / 100);
  const atualizado = ir.reduce((s, x) => s + Math.round(x * 1.1104 * 100) / 100, 0);
  assert.strictEqual(k.valor('Plan1', 'C8'), Math.round(atualizado * 100) / 100);
  assert.strictEqual(k.valor('Plan1', 'C10'), Math.round((k.valor('Plan1', 'C8') - k.valor('Plan1', 'C9')) * 100) / 100);
});

console.log(falhas ? '\n' + falhas + ' falha(s)' : '\nTodos os testes passaram');
process.exit(falhas ? 1 : 0);
