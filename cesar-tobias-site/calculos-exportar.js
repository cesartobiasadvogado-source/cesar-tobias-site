/* Exportacao da aba "Calculos": Excel (.xlsx, com as formulas) e versao para impressao/PDF (Times New Roman 12, espacamento 1,5).
   Funciona no navegador (window.CalculosExportar) e no Node (testes). O Excel e gerado com a biblioteca ExcelJS, passada por quem chama. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(require('./calculos-motor.js'));
  else raiz.CalculosExportar = fabrica(raiz.CalculosMotor);
})(typeof self !== 'undefined' ? self : this, function (M) {
  'use strict';

  var FONTE = 'Times New Roman';
  // nomes das funcoes: portugues (e os apelidos em ingles que o motor aceita) -> Excel (formulas sao gravadas em ingles no arquivo)
  var FUNCOES_EXCEL = {
    'SOMA': 'SUM', 'SUM': 'SUM', 'MEDIA': 'AVERAGE', 'AVERAGE': 'AVERAGE', 'MIN': 'MIN', 'MAX': 'MAX', 'CONT.NUM': 'COUNT', 'COUNT': 'COUNT',
    'CONT.VALORES': 'COUNTA', 'COUNTA': 'COUNTA', 'SE': 'IF', 'IF': 'IF', 'SEERRO': 'IFERROR', 'IFERROR': 'IFERROR', 'E': 'AND', 'AND': 'AND',
    'OU': 'OR', 'OR': 'OR', 'NAO': 'NOT', 'NOT': 'NOT', 'ARRED': 'ROUND', 'ARREDONDAR': 'ROUND', 'ROUND': 'ROUND',
    'ARREDONDAR.PARA.CIMA': 'ROUNDUP', 'ROUNDUP': 'ROUNDUP', 'ARREDONDAR.PARA.BAIXO': 'ROUNDDOWN', 'ROUNDDOWN': 'ROUNDDOWN',
    'ABS': 'ABS', 'INT': 'INT', 'POTENCIA': 'POWER', 'POWER': 'POWER', 'SOMASE': 'SUMIF', 'SUMIF': 'SUMIF', 'DATA': 'DATE', 'DATE': 'DATE',
    'HOJE': 'TODAY', 'TODAY': 'TODAY', 'ANO': 'YEAR', 'YEAR': 'YEAR', 'MES': 'MONTH', 'MONTH': 'MONTH', 'DIA': 'DAY', 'DAY': 'DAY',
    'DATADIF': 'DATEDIF', 'DATEDIF': 'DATEDIF', 'CONCATENAR': 'CONCATENATE', 'CONCATENATE': 'CONCATENATE', 'CONCAT': 'CONCATENATE',
  };
  var ERROS_EXCEL = { '#DIV/0!': '#DIV/0!', '#N/D!': '#N/A', '#VALOR!': '#VALUE!', '#NOME?': '#NAME?', '#REF!': '#REF!', '#NUM!': '#NUM!' };
  var FORMATOS_EXCEL = {
    brl: '"R$" #,##0.00', numero: '#,##0.00', fator: '0.000000', pct: '0.00%', data: 'dd/mm/yyyy', mesano: 'mm/yyyy', texto: '@',
  };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  // formula do painel (portugues, ";" e virgula decimal) -> formula do Excel (sem o "=").
  // Devolve null quando nao ha equivalente no Excel (FATOR/TAXA usam a tabela de indices): nesse caso a celula sai como valor.
  function traduzirFormula(f, nomeAbaExcel) {
    if (typeof f !== 'string' || f.charAt(0) !== '=') return null;
    var toks;
    try { toks = M.tokenizar(f.slice(1)); } catch (e) { return null; }
    var out = '';
    for (var i = 0; i < toks.length; i++) {
      var t = toks[i];
      if (t.t === 'num') out += String(t.v);
      else if (t.t === 'str') out += '"' + t.v.replace(/"/g, '""') + '"';
      else if (t.t === 'bool') out += t.v ? 'TRUE' : 'FALSE';
      else if (t.t === 'func') {
        var nome = FUNCOES_EXCEL[t.v];
        if (!nome) return null;
        out += nome;
      } else if (t.t === 'ref') {
        if (t.aba) { var nm = nomeAbaExcel ? nomeAbaExcel(t.aba.nome) : t.aba.nome; out += "'" + nm.replace(/'/g, "''") + "'!"; }
        out += (t.colAbs ? '$' : '') + M.colParaLetra(t.col) + (t.rowAbs ? '$' : '') + t.row;
      } else out += t.v === ';' ? ',' : t.v;
    }
    return out;
  }

  function serialParaData(n) { return new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000); }

  // ---------- Excel ----------
  function nomesExcel(pasta) {
    var usados = {}, mapa = {};
    pasta.abas.forEach(function (a) {
      var base = a.nome.replace(/[\[\]:*?\/\\]/g, ' ').trim().slice(0, 31) || 'Aba', n = base, k = 2;
      while (usados[n.toLowerCase()]) { var suf = ' ' + k++; n = base.slice(0, 31 - suf.length) + suf; }
      usados[n.toLowerCase()] = true; mapa[a.nome.toLowerCase()] = n;
    });
    return { mapa: mapa, usados: usados };
  }

  function usado(a) {
    var maxC = 1, maxR = 1;
    [a.celulas, a.estilos].forEach(function (obj) {
      Object.keys(obj || {}).forEach(function (addr) {
        var p = M.parseEndereco(addr);
        if (!p) return;
        if (p.col > maxC) maxC = p.col; if (p.row > maxR) maxR = p.row;
      });
    });
    return { cols: maxC, rows: maxR };
  }

  function resultadoExcel(v) {
    if (v instanceof M.ErroCalc) return { error: ERROS_EXCEL[v.codigo] || '#VALUE!' };
    if (v === null || v === undefined) return '';
    return v;
  }

  function estiloCelula(cell, est, ehNumero) {
    var f = { name: FONTE, size: 12 }, al = { vertical: 'top' };
    if (est === 'titulo') { f.size = 14; f.bold = true; al.vertical = 'middle'; }
    else if (est === 'rotulo') { f.bold = true; al.wrapText = true; }
    else if (est === 'longo') { al.wrapText = true; }
    else if (est === 'cabecalho') {
      f.bold = true; al.wrapText = true; al.horizontal = 'center'; al.vertical = 'middle';
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
      cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
    } else if (est === 'total') { f.bold = true; cell.border = { top: { style: 'medium' } }; }
    else if (est === 'entrada') {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
      cell.border = { top: { style: 'hair' }, bottom: { style: 'hair' }, left: { style: 'hair' }, right: { style: 'hair' } };
      if (!ehNumero) al.wrapText = true;
    }
    cell.font = f; cell.alignment = al;
  }

  function montarExcel(pasta, ExcelJS) {
    var calc = M.criarCalculo(pasta), wb = new ExcelJS.Workbook(), nm = nomesExcel(pasta);
    wb.creator = 'Vero Jurídico'; wb.title = pasta.nome || 'Cálculo'; wb.created = new Date();
    var nomeDe = function (n) { return nm.mapa[String(n).toLowerCase()] || n; };

    pasta.abas.forEach(function (a) {
      var u = usado(a);
      var ws = wb.addWorksheet(nomeDe(a.nome), {
        pageSetup: { paperSize: 9, orientation: u.cols > 5 ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
          margins: { left: 0.6, right: 0.6, top: 0.8, bottom: 0.8, header: 0.3, footer: 0.3 } },
      });
      for (var c = 1; c <= u.cols; c++) ws.getColumn(c).width = Math.round(((a.larguras && a.larguras[c]) || 112) / 7);
      var enderecos = {};
      Object.keys(a.celulas || {}).forEach(function (k) { enderecos[k] = 1; });
      Object.keys(a.estilos || {}).forEach(function (k) { enderecos[k] = 1; });
      Object.keys(enderecos).forEach(function (addr) {
        if (!M.parseEndereco(addr)) return;
        var cell = ws.getCell(addr), raw = a.celulas ? a.celulas[addr] : undefined, fmt = a.formatos ? a.formatos[addr] : undefined, est = a.estilos ? a.estilos[addr] : undefined;
        var it = M.interpretar(raw, fmt), v = calc.valor(a.nome, addr), nf = fmt && fmt !== 'geral' ? fmt : it.fmtAuto;
        var ehData = nf === 'data' || nf === 'mesano', ehNumero = false;
        if (it.tipo === 'formula') {
          var tr = traduzirFormula(raw, nomeDe);
          if (tr !== null) cell.value = { formula: tr, result: resultadoExcel(v) };
          else cell.value = v instanceof M.ErroCalc ? { error: ERROS_EXCEL[v.codigo] || '#VALUE!' } : (v === null ? null : v);
          ehNumero = typeof v === 'number';
          if (ehData && typeof v === 'number' && tr === null) cell.value = serialParaData(v);
        } else if (it.tipo === 'num') {
          cell.value = ehData ? serialParaData(it.valor) : it.valor; ehNumero = true;
        } else if (it.tipo === 'texto') cell.value = it.valor;
        if (nf && FORMATOS_EXCEL[nf] && (ehNumero || nf === 'texto')) cell.numFmt = FORMATOS_EXCEL[nf];
        estiloCelula(cell, est, ehNumero);
      });
    });

    // tabelas de indices usadas (so como conferencia: as celulas com FATOR/TAXA saem como valor)
    Object.keys(pasta.indices || {}).sort().forEach(function (cod) {
      var ind = pasta.indices[cod], ks = Object.keys(ind.serie || {}).sort();
      if (!ks.length) return;
      var base = ('Índice ' + cod).slice(0, 31), n = base, k = 2;
      while (nm.usados[n.toLowerCase()]) n = base.slice(0, 28) + ' ' + k++;
      nm.usados[n.toLowerCase()] = true;
      var ws = wb.addWorksheet(n);
      ws.getColumn(1).width = 16; ws.getColumn(2).width = 18;
      ws.getCell('A1').value = 'Índice ' + cod + ' — taxas mensais (%)'; ws.getCell('A1').font = { name: FONTE, size: 14, bold: true };
      ws.getCell('A2').value = 'Fonte: ' + (ind.fonte || '(não informada)'); ws.getCell('A2').font = { name: FONTE, size: 12 };
      ws.getCell('A3').value = 'Consultada em: ' + (ind.consulta || '(não informada)'); ws.getCell('A3').font = { name: FONTE, size: 12 };
      ['Competência', 'Taxa mensal (%)'].forEach(function (h, i) { var c = ws.getCell(5, i + 1); c.value = h; c.font = { name: FONTE, size: 12, bold: true }; c.alignment = { horizontal: 'center' }; });
      ks.forEach(function (key, i) {
        var c1 = ws.getCell(6 + i, 1), c2 = ws.getCell(6 + i, 2);
        c1.value = new Date(Date.UTC(+key.slice(0, 4), +key.slice(5) - 1, 1)); c1.numFmt = 'mm/yyyy';
        c2.value = ind.serie[key]; c2.numFmt = '0.0000';
        c1.font = c2.font = { name: FONTE, size: 12 };
      });
    });
    return wb;
  }

  // ---------- impressao / PDF ----------
  function celulasDaAba(a, calc) {
    var u = usado(a), linhas = [];
    for (var r = 1; r <= u.rows; r++) {
      var row = [], vazia = true;
      for (var c = 1; c <= u.cols; c++) {
        var addr = M.endereco(c, r), raw = a.celulas ? a.celulas[addr] : undefined;
        var txt = raw !== undefined && raw !== '' ? calc.exibir(a.nome, addr) : '';
        var v = txt !== '' ? calc.valor(a.nome, addr) : null;
        if (txt !== '') vazia = false;
        row.push({ c: c, txt: txt, est: a.estilos ? a.estilos[addr] : undefined, num: typeof v === 'number', err: v instanceof M.ErroCalc });
      }
      if (!vazia) linhas.push({ r: r, cels: row });
    }
    return { linhas: linhas, cols: u.cols };
  }

  function htmlImpressao(pasta, opcoes) {
    opcoes = opcoes || {};
    var calc = M.criarCalculo(pasta), secoes = '';
    pasta.abas.forEach(function (a, i) {
      if (opcoes.abas && opcoes.abas.indexOf(i) < 0) return;
      var d = celulasDaAba(a, calc);
      if (!d.linhas.length) return;
      var titulo = '', corpo = '', colsUsadas = {};
      d.linhas.forEach(function (l) { l.cels.forEach(function (x) { if (x.txt !== '' && x.est !== 'titulo') colsUsadas[x.c] = 1; }); });
      var cols = Object.keys(colsUsadas).map(Number).sort(function (x, y) { return x - y; });
      var totalLarg = cols.reduce(function (s, c) { return s + ((a.larguras && a.larguras[c]) || 112); }, 0) || 1;
      corpo += '<colgroup>' + cols.map(function (c) { return '<col style="width:' + (100 * ((a.larguras && a.larguras[c]) || 112) / totalLarg).toFixed(1) + '%">'; }).join('') + '</colgroup>';
      d.linhas.forEach(function (l) {
        var tit = l.cels.filter(function (x) { return x.est === 'titulo' && x.txt !== ''; });
        if (tit.length) { titulo += '<h2>' + esc(tit[0].txt) + '</h2>'; return; }
        corpo += '<tr>' + cols.map(function (c) {
          var x = l.cels[c - 1], cls = [];
          if (x.est) cls.push('e-' + x.est);
          if (x.num) cls.push('num');
          if (x.err) cls.push('err');
          return '<td' + (cls.length ? ' class="' + cls.join(' ') + '"' : '') + '>' + esc(x.txt) + '</td>';
        }).join('') + '</tr>';
      });
      secoes += '<section class="' + (cols.length > 5 ? 'paisagem' : 'retrato') + '">' + (titulo || '<h2>' + esc(a.nome) + '</h2>') + '<table>' + corpo + '</table></section>';
    });
    return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>' + esc(pasta.nome || 'Cálculo') + '</title><style>' +
      '@page { size: A4 portrait; margin: 2cm 1.8cm; } @page paisagem { size: A4 landscape; margin: 1.6cm; }' +
      'body { font-family: "' + FONTE + '", Times, serif; font-size: 12pt; line-height: 1.5; color: #000; margin: 0; }' +
      'h1 { font-size: 14pt; margin: 0 0 6pt; } h2 { font-size: 13pt; margin: 0 0 8pt; }' +
      'section { page-break-after: always; } section:last-child { page-break-after: auto; } section.paisagem { page: paisagem; }' +
      'table { border-collapse: collapse; width: 100%; table-layout: fixed; }' +
      'td { border: 1px solid #555; padding: 1pt 5pt; vertical-align: top; white-space: pre-line; overflow-wrap: anywhere; }' +
      'td.num { text-align: right; white-space: nowrap; } td.err { font-weight: bold; }' +
      'td.e-rotulo, td.e-total { font-weight: bold; } td.e-cabecalho { font-weight: bold; text-align: center; vertical-align: middle; background: #e8e8e8; }' +
      'td.e-total { border-top: 2px solid #000; }' +
      '</style></head><body>' + secoes + '</body></html>';
  }

  return { traduzirFormula: traduzirFormula, montarExcel: montarExcel, htmlImpressao: htmlImpressao, nomesExcel: nomesExcel };
});
