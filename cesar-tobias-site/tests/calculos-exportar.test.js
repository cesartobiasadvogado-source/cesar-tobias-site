// Roda com: node tests/calculos-exportar.test.js
// Exportacao da aba Calculos: traducao das formulas para o Excel, versao de impressao (PDF) e, se o ExcelJS estiver instalado
// (npm i exceljs, ou EXCELJS_PATH=caminho), o .xlsx gerado e lido de volta. Sem ExcelJS, so essa parte e pulada.
const assert = require('assert');
const M = require('../calculos-motor.js');
const MOD = require('../calculos-modelos.js');
const X = require('../calculos-exportar.js');

let falhas = 0;
function t(nome, fn) { try { fn(); console.log('ok  ' + nome); } catch (e) { falhas++; console.log('FALHA ' + nome + ': ' + e.message); } }

function casoPreenchido() {
  const p = MOD.criar('ir-doenca-grave');
  p.indices.SELIC.serie = { '2023-08': 1, '2023-09': 1, '2023-10': 1 }; // taxas ficticias de teste
  p.indices.SELIC.fonte = 'Tabela de teste'; p.indices.SELIC.consulta = '01/01/2026';
  p.abas[2].celulas.B5 = '01/08/2023'; p.abas[2].celulas.B6 = '01/10/2023';
  const ir = [1905.16, 1905.16, 3858.23];
  ir.forEach((v, i) => { p.abas[3].celulas['E' + (5 + i)] = String(v).replace('.', ','); p.abas[3].celulas['B' + (5 + i)] = '0' + (7 + i) + '/2023'; });
  p.abas[4].celulas.B7 = '20%';
  return p;
}

t('traducao de formulas: nomes em ingles, virgula como separador, ponto decimal, abas entre aspas', () => {
  assert.strictEqual(X.traduzirFormula('=SOMA(E5:E28)'), 'SUM(E5:E28)');
  assert.strictEqual(X.traduzirFormula('=SE(E5="";"";CONT.NUM(E$5:E5))'), 'IF(E5="","",COUNT(E$5:E5))');
  assert.strictEqual(X.traduzirFormula('=ARRED(B2*1,1104;2)'), 'ROUND(B2*1.1104,2)');
  assert.strictEqual(X.traduzirFormula('=C8*20%'), 'C8*20%');
  assert.strictEqual(X.traduzirFormula("='Memória Mensal'!G30"), "'Memória Mensal'!G30");
  assert.strictEqual(X.traduzirFormula('=Honorários!B6+1'), "'Honorários'!B6+1");
  assert.strictEqual(X.traduzirFormula('=SEERRO(1/0;"n/d")'), 'IFERROR(1/0,"n/d")');
  assert.strictEqual(X.traduzirFormula('=DATADIF(A1;A2;"M")&" meses"'), 'DATEDIF(A1,A2,"M")&" meses"');
  assert.strictEqual(X.traduzirFormula('=A1<>B1'), 'A1<>B1');
  assert.strictEqual(X.traduzirFormula('=$A$1+B$2+$C3'), '$A$1+B$2+$C3');
});

t('FATOR e TAXA nao existem no Excel: a celula sai como valor', () => {
  assert.strictEqual(X.traduzirFormula('=FATOR("SELIC";A1;A2)'), null);
  assert.strictEqual(X.traduzirFormula('=1+TAXA("SELIC";A1)'), null);
  assert.strictEqual(X.traduzirFormula('texto'), null);
});

t('todas as formulas do modelo se traduzem (exceto as que usam FATOR)', () => {
  const p = MOD.criar('ir-doenca-grave');
  p.abas.forEach(a => Object.keys(a.celulas).forEach(addr => {
    const f = a.celulas[addr];
    if (typeof f !== 'string' || f.charAt(0) !== '=') return;
    const tr = X.traduzirFormula(f);
    if (/FATOR|TAXA/.test(f)) assert.strictEqual(tr, null, a.nome + '!' + addr);
    else assert(tr && !/[;]/.test(tr), a.nome + '!' + addr + ' -> ' + tr);
  }));
});

t('nomes de aba para o Excel: limite de 31 caracteres e sem repeticao', () => {
  const longo = 'Memória de cálculo detalhada do processo principal';
  const nm = X.nomesExcel({ abas: [{ nome: longo }, { nome: longo + ' 2' }, { nome: 'a/b' }] });
  const nomes = Object.keys(nm.mapa).map(k => nm.mapa[k]);
  nomes.forEach(n => assert(n.length <= 31 && !/[\[\]:*?\/\\]/.test(n), n));
  assert.strictEqual(new Set(nomes.map(n => n.toLowerCase())).size, 3);
});

t('impressao: Times New Roman 12 / 1,5, valores formatados, escapa HTML, so as abas escolhidas', () => {
  const p = casoPreenchido();
  p.abas[1].celulas.B4 = '<b>Fulano</b> & Cia';
  const h = X.htmlImpressao(p);
  assert(/Times New Roman/.test(h) && /font-size: 12pt/.test(h) && /line-height: 1\.5/.test(h));
  assert(h.indexOf('R$ 1.905,16') >= 0 && h.indexOf('1,030301') >= 0);
  assert(h.indexOf('&lt;b&gt;Fulano&lt;/b&gt; &amp; Cia') >= 0 && h.indexOf('<b>Fulano') < 0);
  assert(/<section class="paisagem">/.test(h), 'memoria mensal (8 colunas) em paisagem');
  const so = X.htmlImpressao(p, { abas: [5] });
  assert(so.indexOf('Quadro-Resumo') >= 0 && so.indexOf('Demonstrativo Mensal') < 0);
});

let ExcelJS = null;
try { ExcelJS = require('exceljs'); } catch (e) { try { if (process.env.EXCELJS_PATH) ExcelJS = require(process.env.EXCELJS_PATH); } catch (e2) { /* sem ExcelJS */ } }

function fim() { console.log(falhas ? '\n' + falhas + ' falha(s)' : '\nTodos os testes passaram'); process.exit(falhas ? 1 : 0); }

if (!ExcelJS) { console.log('--  ExcelJS nao instalado: teste do .xlsx pulado'); fim(); }
else {
  (async () => {
    const p = casoPreenchido();
    const buf = await X.montarExcel(p, ExcelJS).xlsx.writeBuffer();
    const rd = new ExcelJS.Workbook();
    await rd.xlsx.load(buf);
    const k = M.criarCalculo(p);
    t('xlsx: abas, formulas em ingles com resultado em cache, estilos e formatos', () => {
      assert.deepStrictEqual(rd.worksheets.map(w => w.name), ['Leia-me', 'Identificação', 'Índices SELIC', 'Memória Mensal', 'Honorários', 'Resumo', 'Fundamentação', 'Como Usar', 'Documentos Necessários', 'Índice SELIC']);
      const mem = rd.getWorksheet('Memória Mensal');
      assert.strictEqual(mem.getCell('E30').value.formula, 'SUM(E5:E28)');
      assert.strictEqual(mem.getCell('G30').value.formula, 'SUM(G5:G28)');
      assert(Math.abs(mem.getCell('G30').value.result - k.valor('Memória Mensal', 'G30')) < 1e-9, 'resultado em cache = calculo do painel');
      assert.strictEqual(mem.getCell('A5').value.formula, 'IF(E5="","",COUNT(E$5:E5))');
      assert.strictEqual(mem.getCell('F5').value, k.valor('Memória Mensal', 'F5'), 'FATOR sai como valor');
      assert.strictEqual(mem.getCell('E5').value, 1905.16);
      assert.strictEqual(mem.getCell('E5').numFmt, '"R$" #,##0.00');
      assert.strictEqual(mem.getCell('E5').font.name, 'Times New Roman'); assert.strictEqual(mem.getCell('E5').font.size, 12);
      assert.strictEqual(mem.getCell('E5').fill.fgColor.argb, 'FFFFF2CC');
      assert(mem.getCell('B5').value instanceof Date && mem.getCell('B5').value.getUTCFullYear() === 2023 && mem.getCell('B5').value.getUTCMonth() === 6);
      assert.strictEqual(mem.getCell('B5').numFmt, 'mm/yyyy');
      assert.strictEqual(rd.getWorksheet('Honorários').getCell('B6').value.formula, "'Memória Mensal'!G30");
      assert.strictEqual(rd.getWorksheet('Honorários').getCell('B7').value, 0.2);
      assert.strictEqual(rd.getWorksheet('Resumo').getCell('B4').value.formula.indexOf("IF('Índices SELIC'!B9=2"), 0);
      const ind = rd.getWorksheet('Índice SELIC');
      assert.strictEqual(ind.getCell('B6').value, 1); assert(/Tabela de teste/.test(ind.getCell('A2').value));
    });
  })().catch(e => { falhas++; console.log('FALHA xlsx: ' + e.message); }).then(fim);
}
