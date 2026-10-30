/* Motor de formulas da aba "Calculos" (planilhas de calculo judicial).
   Funciona no navegador (window.CalculosMotor) e no Node (testes em tests/calculos-motor.test.js).
   Convencoes (iguais ao Excel em portugues): separador de argumentos ";" e decimal ",".
   Datas sao guardadas como numero de dias (serial) e mostradas pelo formato da celula. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.CalculosMotor = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function ErroCalc(codigo) { this.codigo = codigo; }
  var MAX_COLS = 702;

  // ---------- enderecos ----------
  function letraParaCol(s) {
    var n = 0;
    s = String(s).toUpperCase();
    for (var i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64);
    return n;
  }
  function colParaLetra(n) {
    var s = '';
    while (n > 0) { var r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
    return s;
  }
  function endereco(col, row) { return colParaLetra(col) + row; }
  function parseEndereco(a) {
    var m = /^\$?([A-Za-z]{1,3})\$?(\d+)$/.exec(String(a));
    if (!m) return null;
    return { col: letraParaCol(m[1]), row: parseInt(m[2], 10) };
  }

  // ---------- datas (serial = dias desde 30/12/1899) ----------
  var BASE_UTC = Date.UTC(1899, 11, 30);
  function serialDe(a, m, d) { return Math.round((Date.UTC(a, m - 1, d) - BASE_UTC) / 86400000); }
  function dataDe(serial) { return new Date(BASE_UTC + Math.floor(serial) * 86400000); }
  function dataValida(a, m, d) {
    var dt = new Date(Date.UTC(a, m - 1, d));
    return dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }
  function hojeSerial() {
    var h = new Date();
    return serialDe(h.getFullYear(), h.getMonth() + 1, h.getDate());
  }
  function p2(n) { return (n < 10 ? '0' : '') + n; }

  // ---------- interpretar o que foi digitado ----------
  function numeroDeTexto(s) {
    s = String(s).trim().replace(/^R\$\s*/i, '');
    var neg = false;
    if (/^-/.test(s)) { neg = true; s = s.slice(1).trim(); }
    else if (/^\+/.test(s)) s = s.slice(1).trim();
    var v = null;
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) v = parseFloat(s.replace(/\./g, '').replace(',', '.'));
    else if (/^\d+(,\d+)?$/.test(s)) v = parseFloat(s.replace(',', '.'));
    else if (/^\d+\.\d+$/.test(s)) v = parseFloat(s);
    if (v === null || isNaN(v)) return null;
    return neg ? -v : v;
  }

  // retorna {tipo: vazio|num|texto|formula|bool, valor, fmtAuto}
  function interpretar(raw, fmt) {
    if (raw === undefined || raw === null || raw === '') return { tipo: 'vazio', valor: null };
    raw = String(raw);
    if (raw.charAt(0) === '=' && raw.length > 1) return { tipo: 'formula', valor: raw };
    if (fmt === 'texto') return { tipo: 'texto', valor: raw };
    var t = raw.trim();
    if (t === '') return { tipo: 'texto', valor: raw };
    var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
    if (m && dataValida(+m[3], +m[2], +m[1])) return { tipo: 'num', valor: serialDe(+m[3], +m[2], +m[1]), fmtAuto: 'data' };
    m = /^(\d{1,2})\/(\d{4})$/.exec(t);
    if (m && +m[1] >= 1 && +m[1] <= 12) return { tipo: 'num', valor: serialDe(+m[2], +m[1], 1), fmtAuto: 'mesano' };
    if (/%$/.test(t)) {
      var n1 = numeroDeTexto(t.slice(0, -1));
      if (n1 !== null) return { tipo: 'num', valor: n1 / 100, fmtAuto: 'pct' };
    }
    var n = numeroDeTexto(t);
    if (n !== null) return { tipo: 'num', valor: n, fmtAuto: /^R\$/i.test(t) ? 'brl' : undefined };
    return { tipo: 'texto', valor: raw };
  }

  // ---------- formatacao ----------
  function milhar(intStr) { return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function fmtNumero(n, casas) {
    var neg = n < 0;
    var s = Math.abs(n).toFixed(casas);
    var partes = s.split('.');
    var r = milhar(partes[0]) + (partes[1] ? ',' + partes[1] : '');
    if (neg && /[1-9]/.test(s)) r = '-' + r;
    return r;
  }
  function formatar(v, fmt, fmtAuto) {
    if (v instanceof ErroCalc) return v.codigo;
    if (v === null || v === undefined) return '';
    if (typeof v === 'boolean') return v ? 'VERDADEIRO' : 'FALSO';
    if (typeof v === 'string') return v;
    var f = fmt && fmt !== 'geral' ? fmt : (fmtAuto || 'geral');
    if (f === 'numero') return fmtNumero(v, 2);
    if (f === 'brl') return (v < 0 && /[1-9]/.test(Math.abs(v).toFixed(2)) ? '-R$ ' : 'R$ ') + fmtNumero(Math.abs(v), 2);
    if (f === 'pct') return fmtNumero(v * 100, 2) + '%';
    if (f === 'data') { var d = dataDe(v); return p2(d.getUTCDate()) + '/' + p2(d.getUTCMonth() + 1) + '/' + d.getUTCFullYear(); }
    if (f === 'mesano') { var d2 = dataDe(v); return p2(d2.getUTCMonth() + 1) + '/' + d2.getUTCFullYear(); }
    if (f === 'fator') return fmtNumero(v, 6);
    return String(parseFloat(v.toPrecision(12))).replace('.', ',');
  }

  // ---------- tabela de indices (taxas mensais em %) ----------
  // texto: uma linha por mes, "MM/AAAA;taxa" (aceita tabulacao/espaco no lugar de ";" e sinal de %)
  function parseSerieIndice(texto) {
    var serie = {}, erros = [];
    String(texto || '').split(/\r?\n/).forEach(function (linha, i) {
      var l = linha.trim();
      if (!l) return;
      var m = /^(\d{1,2})\/(\d{4})[\s;:]+(-?[\d.,]+)\s*%?$/.exec(l);
      var taxa = m ? numeroDeTexto(m[3]) : null;
      if (!m || taxa === null || +m[1] < 1 || +m[1] > 12) { erros.push('Linha ' + (i + 1) + ': "' + l + '" — use MM/AAAA;taxa (ex.: 07/2023;1,07)'); return; }
      var k = m[2] + '-' + p2(+m[1]);
      if (k in serie) { erros.push('Linha ' + (i + 1) + ': mês ' + p2(+m[1]) + '/' + m[2] + ' repetido'); return; }
      serie[k] = taxa;
    });
    return { serie: serie, erros: erros };
  }
  function textoSerieIndice(serie) {
    return Object.keys(serie || {}).sort().map(function (k) {
      return k.slice(5) + '/' + k.slice(0, 4) + ';' + String(serie[k]).replace('.', ',');
    }).join('\n');
  }
  // meses sem taxa entre o primeiro e o ultimo cadastrados ("MM/AAAA")
  function lacunasIndice(serie) {
    var ks = Object.keys(serie || {}).sort(), out = [];
    if (ks.length < 2) return out;
    var y = +ks[0].slice(0, 4), m = +ks[0].slice(5), yf = +ks[ks.length - 1].slice(0, 4), mf = +ks[ks.length - 1].slice(5);
    while (y < yf || (y === yf && m <= mf)) {
      if (!(y + '-' + p2(m) in serie)) out.push(p2(m) + '/' + y);
      if (++m > 12) { m = 1; y++; }
    }
    return out;
  }

  // ---------- tokenizador ----------
  var RE_REF = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)$/;
  var RE_IDENT = /^[A-Za-zÀ-ÿ_][A-Za-zÀ-ÿ_.0-9]*/;

  function tokenizar(src) {
    var toks = [], i = 0, n = src.length;
    function refDe(texto, prefixo, ini, fim) {
      var m = RE_REF.exec(texto);
      return { t: 'ref', aba: prefixo || null, prefixo: prefixo ? prefixo.texto : '', colAbs: !!m[1], col: letraParaCol(m[2]), rowAbs: !!m[3], row: parseInt(m[4], 10), ini: ini, fim: fim };
    }
    while (i < n) {
      var c = src.charAt(i);
      if (c === ' ' || c === '\t' || c === '\n') { i++; continue; }
      var ini = i;
      if (/[0-9]/.test(c)) {
        var mn = /^\d+(?:[.,]\d+)?/.exec(src.slice(i));
        i += mn[0].length;
        toks.push({ t: 'num', v: parseFloat(mn[0].replace(',', '.')), ini: ini, fim: i });
        continue;
      }
      if (c === '"') {
        var s = '';
        i++;
        while (i < n) {
          if (src.charAt(i) === '"') { if (src.charAt(i + 1) === '"') { s += '"'; i += 2; continue; } break; }
          s += src.charAt(i++);
        }
        if (i >= n) throw new ErroCalc('#ERRO!');
        i++;
        toks.push({ t: 'str', v: s, ini: ini, fim: i });
        continue;
      }
      if (c === "'") {
        var j = src.indexOf("'", i + 1);
        if (j < 0 || src.charAt(j + 1) !== '!') throw new ErroCalc('#ERRO!');
        var nomeAba = src.slice(i + 1, j);
        var mr = /^\$?[A-Za-z]{1,3}\$?\d+/.exec(src.slice(j + 2));
        if (!mr) throw new ErroCalc('#ERRO!');
        i = j + 2 + mr[0].length;
        toks.push(refDe(mr[0], { nome: nomeAba, texto: src.slice(ini, j + 2) }, ini, i));
        continue;
      }
      if (c === '$') {
        var m2 = /^\$?[A-Za-z]{1,3}\$?\d+/.exec(src.slice(i));
        if (!m2) throw new ErroCalc('#ERRO!');
        i += m2[0].length;
        toks.push(refDe(m2[0], null, ini, i));
        continue;
      }
      if (/[A-Za-zÀ-ÿ_]/.test(c)) {
        var mref = /^[A-Za-z]{1,3}\$?\d+/.exec(src.slice(i)); // referencia com linha fixa, ex.: E$5 (o $ nao cabe no identificador)
        if (mref && mref[0].indexOf('$') >= 0 && !/[A-Za-zÀ-ÿ_.0-9(!]/.test(src.charAt(i + mref[0].length))) {
          i += mref[0].length;
          toks.push(refDe(mref[0], null, ini, i));
          continue;
        }
        var id = RE_IDENT.exec(src.slice(i))[0];
        var depois = src.charAt(i + id.length);
        if (depois === '(') { i += id.length; toks.push({ t: 'func', v: id.toUpperCase(), ini: ini, fim: i }); continue; }
        if (depois === '!') {
          var mr2 = /^\$?[A-Za-z]{1,3}\$?\d+/.exec(src.slice(i + id.length + 1));
          if (!mr2) throw new ErroCalc('#ERRO!');
          i = i + id.length + 1 + mr2[0].length;
          toks.push(refDe(mr2[0], { nome: id, texto: src.slice(ini, ini + id.length + 1) }, ini, i));
          continue;
        }
        i += id.length;
        var up = id.toUpperCase();
        if (RE_REF.test(id)) { toks.push(refDe(id, null, ini, i)); continue; }
        if (up === 'VERDADEIRO' || up === 'TRUE') { toks.push({ t: 'bool', v: true, ini: ini, fim: i }); continue; }
        if (up === 'FALSO' || up === 'FALSE') { toks.push({ t: 'bool', v: false, ini: ini, fim: i }); continue; }
        throw new ErroCalc('#NOME?');
      }
      var dois = src.substr(i, 2);
      if (dois === '<>' || dois === '<=' || dois === '>=') { i += 2; toks.push({ t: 'op', v: dois, ini: ini, fim: i }); continue; }
      if ('+-*/^&=<>%();:'.indexOf(c) >= 0) { i++; toks.push({ t: 'op', v: c, ini: ini, fim: i }); continue; }
      throw new ErroCalc('#ERRO!');
    }
    return toks;
  }

  // ---------- parser ----------
  function parse(src) {
    var toks = tokenizar(src), p = 0;
    function ehOp(v) { return p < toks.length && toks[p].t === 'op' && toks[p].v === v; }
    function exigir(v) { if (!ehOp(v)) throw new ErroCalc('#ERRO!'); p++; }
    function cmp() {
      var l = concat();
      while (p < toks.length && toks[p].t === 'op' && ['=', '<>', '<', '>', '<=', '>='].indexOf(toks[p].v) >= 0) {
        var op = toks[p++].v; l = { k: 'bin', op: op, l: l, r: concat() };
      }
      return l;
    }
    function concat() { var l = soma(); while (ehOp('&')) { p++; l = { k: 'bin', op: '&', l: l, r: soma() }; } return l; }
    function soma() {
      var l = mult();
      while (ehOp('+') || ehOp('-')) { var op = toks[p++].v; l = { k: 'bin', op: op, l: l, r: mult() }; }
      return l;
    }
    function mult() {
      var l = pot();
      while (ehOp('*') || ehOp('/')) { var op = toks[p++].v; l = { k: 'bin', op: op, l: l, r: pot() }; }
      return l;
    }
    function pot() { var l = unario(); while (ehOp('^')) { p++; l = { k: 'bin', op: '^', l: l, r: unario() }; } return l; }
    function unario() {
      if (ehOp('-')) { p++; return { k: 'neg', e: unario() }; }
      if (ehOp('+')) { p++; return unario(); }
      var e = primario();
      while (ehOp('%')) { p++; e = { k: 'pct', e: e }; }
      return e;
    }
    function primario() {
      var t = toks[p];
      if (!t) throw new ErroCalc('#ERRO!');
      if (t.t === 'num') { p++; return { k: 'lit', v: t.v }; }
      if (t.t === 'str') { p++; return { k: 'lit', v: t.v }; }
      if (t.t === 'bool') { p++; return { k: 'lit', v: t.v }; }
      if (t.t === 'ref') {
        p++;
        if (ehOp(':')) {
          p++;
          var t2 = toks[p];
          if (!t2 || t2.t !== 'ref') throw new ErroCalc('#ERRO!');
          p++;
          return { k: 'faixa', aba: t.aba ? t.aba.nome : null, c1: Math.min(t.col, t2.col), r1: Math.min(t.row, t2.row), c2: Math.max(t.col, t2.col), r2: Math.max(t.row, t2.row) };
        }
        return { k: 'ref', aba: t.aba ? t.aba.nome : null, col: t.col, row: t.row };
      }
      if (t.t === 'func') {
        p++; exigir('(');
        var args = [];
        if (!ehOp(')')) {
          args.push(cmp());
          while (ehOp(';')) { p++; args.push(cmp()); }
        }
        exigir(')');
        return { k: 'func', nome: t.v, args: args };
      }
      if (ehOp('(')) { p++; var e = cmp(); exigir(')'); return e; }
      throw new ErroCalc('#ERRO!');
    }
    var arv = cmp();
    if (p < toks.length) throw new ErroCalc('#ERRO!');
    return arv;
  }

  // ---------- copiar formula (ajusta referencias relativas) ----------
  function deslocarFormula(f, dc, dr) {
    if (typeof f !== 'string' || f.charAt(0) !== '=') return f;
    var corpo = f.slice(1), toks;
    try { toks = tokenizar(corpo); } catch (e) { return f; }
    var out = '', pos = 0;
    toks.forEach(function (t) {
      if (t.t !== 'ref') return;
      out += corpo.slice(pos, t.ini);
      var col = t.colAbs ? t.col : t.col + dc;
      var row = t.rowAbs ? t.row : t.row + dr;
      if (col < 1 || row < 1 || col > MAX_COLS) out += '#REF!';
      else out += (t.prefixo || '') + (t.colAbs ? '$' : '') + colParaLetra(col) + (t.rowAbs ? '$' : '') + row;
      pos = t.fim;
    });
    return '=' + out + corpo.slice(pos);
  }

  // ---------- avaliacao ----------
  function paraNumero(v) {
    if (v instanceof ErroCalc) throw v;
    if (v === null || v === undefined) return 0;
    if (typeof v === 'number') return v;
    if (typeof v === 'boolean') return v ? 1 : 0;
    var n = numeroDeTexto(v);
    if (n === null) throw new ErroCalc('#VALOR!');
    return n;
  }
  function paraTexto(v) {
    if (v instanceof ErroCalc) throw v;
    if (v === null || v === undefined) return '';
    return formatar(v, 'geral');
  }
  function paraBool(v) {
    if (v instanceof ErroCalc) throw v;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string') {
      var u = v.toUpperCase();
      if (u === 'VERDADEIRO' || u === 'TRUE') return true;
      if (u === 'FALSO' || u === 'FALSE') return false;
      throw new ErroCalc('#VALOR!');
    }
    return paraNumero(v) !== 0;
  }
  function comparar(a, b) {
    if (a instanceof ErroCalc) throw a;
    if (b instanceof ErroCalc) throw b;
    if (a === null) a = typeof b === 'string' ? '' : (typeof b === 'boolean' ? false : 0);
    if (b === null) b = typeof a === 'string' ? '' : (typeof a === 'boolean' ? false : 0);
    var rank = function (x) { return typeof x === 'number' ? 0 : (typeof x === 'string' ? 1 : 2); };
    if (rank(a) !== rank(b)) return rank(a) < rank(b) ? -1 : 1;
    if (typeof a === 'string') { a = a.toLowerCase(); b = b.toLowerCase(); }
    return a < b ? -1 : (a > b ? 1 : 0);
  }
  // tira o ruido de ponto flutuante (0,1+0,2 = 0,30000000000000004) mantendo 15 digitos significativos
  function limpa(x) { return typeof x === 'number' && isFinite(x) ? parseFloat(x.toPrecision(15)) : x; }
  function arredondar(x, casas) {
    var f = Math.pow(10, casas);
    var y = Math.abs(x) * f;
    var r = Math.round(parseFloat((y + 1e-9 * Math.max(1, y)).toPrecision(15)));
    return (x < 0 ? -r : r) / f;
  }

  function criterio(c) {
    if (typeof c === 'number') return function (v) { return typeof v === 'number' && v === c; };
    var s = String(c), op = '=', m = /^(<>|<=|>=|=|<|>)(.*)$/.exec(s);
    if (m) { op = m[1]; s = m[2]; }
    var num = numeroDeTexto(s);
    return function (v) {
      if (v instanceof ErroCalc) return false;
      var cmpv;
      if (num !== null) { if (typeof v !== 'number') return op === '<>'; cmpv = v < num ? -1 : (v > num ? 1 : 0); }
      else { var vs = v === null ? '' : String(v).toLowerCase(); var ss = s.toLowerCase(); cmpv = vs < ss ? -1 : (vs > ss ? 1 : 0); }
      return op === '=' ? cmpv === 0 : op === '<>' ? cmpv !== 0 : op === '<' ? cmpv < 0 : op === '>' ? cmpv > 0 : op === '<=' ? cmpv <= 0 : cmpv >= 0;
    };
  }

  var ALIAS = { SUM: 'SOMA', AVERAGE: 'MEDIA', IF: 'SE', IFERROR: 'SEERRO', AND: 'E', OR: 'OU', NOT: 'NAO', ROUND: 'ARRED', ARREDONDAR: 'ARRED',
    COUNT: 'CONT.NUM', COUNTA: 'CONT.VALORES', TODAY: 'HOJE', YEAR: 'ANO', MONTH: 'MES', DAY: 'DIA', DATE: 'DATA', DATEDIF: 'DATADIF',
    POWER: 'POTENCIA', SUMIF: 'SOMASE', CONCATENATE: 'CONCATENAR', CONCAT: 'CONCATENAR', ROUNDUP: 'ARREDONDAR.PARA.CIMA', ROUNDDOWN: 'ARREDONDAR.PARA.BAIXO' };

  function criarFuncoes(ev, indices) {
    function valoresFaixa(nodes) { // achata faixas; escalares entram direto
      var out = [];
      nodes.forEach(function (nd) {
        var r = ev(nd);
        if (r && r.faixa) r.linhas.forEach(function (l) { l.forEach(function (x) { out.push({ v: x, dir: false }); }); });
        else out.push({ v: r, dir: true });
      });
      return out;
    }
    function numeros(nodes) {
      var out = [];
      valoresFaixa(nodes).forEach(function (o) {
        if (o.v instanceof ErroCalc) throw o.v;
        if (o.dir) { if (o.v !== null) out.push(paraNumero(o.v)); }
        else if (typeof o.v === 'number') out.push(o.v);
      });
      return out;
    }
    function exige(args, min, max) { if (args.length < min || args.length > max) throw new ErroCalc('#ERRO!'); }
    function n1(args) { exige(args, 1, 1); return paraNumero(ev(args[0])); }
    var F = {};
    F['SOMA'] = function (a) { return limpa(numeros(a).reduce(function (s, x) { return s + x; }, 0)); };
    F['MEDIA'] = function (a) { var n = numeros(a); if (!n.length) throw new ErroCalc('#DIV/0!'); return limpa(n.reduce(function (s, x) { return s + x; }, 0) / n.length); };
    F['MIN'] = function (a) { var n = numeros(a); return n.length ? Math.min.apply(null, n) : 0; };
    F['MAX'] = function (a) { var n = numeros(a); return n.length ? Math.max.apply(null, n) : 0; };
    F['CONT.NUM'] = function (a) { return valoresFaixa(a).filter(function (o) { return typeof o.v === 'number'; }).length; };
    F['CONT.VALORES'] = function (a) { return valoresFaixa(a).filter(function (o) { return o.v !== null && o.v !== ''; }).length; };
    F['SE'] = function (a) {
      exige(a, 2, 3);
      if (paraBool(ev(a[0]))) return ev(a[1]);
      return a.length > 2 ? ev(a[2]) : false;
    };
    F['SEERRO'] = function (a) {
      exige(a, 2, 2);
      try { var r = ev(a[0]); if (r instanceof ErroCalc) return ev(a[1]); return r; }
      catch (e) { if (e instanceof ErroCalc) return ev(a[1]); throw e; }
    };
    F['E'] = function (a) { exige(a, 1, 99); return valoresFaixa(a).every(function (o) { return paraBool(o.v); }); };
    F['OU'] = function (a) { exige(a, 1, 99); return valoresFaixa(a).some(function (o) { return paraBool(o.v); }); };
    F['NAO'] = function (a) { exige(a, 1, 1); return !paraBool(ev(a[0])); };
    F['ARRED'] = function (a) { exige(a, 2, 2); return arredondar(paraNumero(ev(a[0])), Math.trunc(paraNumero(ev(a[1])))); };
    F['ARREDONDAR.PARA.CIMA'] = function (a) {
      exige(a, 2, 2); var x = paraNumero(ev(a[0])), f = Math.pow(10, Math.trunc(paraNumero(ev(a[1]))));
      return (x < 0 ? -1 : 1) * Math.ceil(parseFloat((Math.abs(x) * f).toPrecision(14))) / f;
    };
    F['ARREDONDAR.PARA.BAIXO'] = function (a) {
      exige(a, 2, 2); var x = paraNumero(ev(a[0])), f = Math.pow(10, Math.trunc(paraNumero(ev(a[1]))));
      return (x < 0 ? -1 : 1) * Math.floor(parseFloat((Math.abs(x) * f).toPrecision(14))) / f;
    };
    F['ABS'] = function (a) { return Math.abs(n1(a)); };
    F['INT'] = function (a) { return Math.floor(n1(a)); };
    F['POTENCIA'] = function (a) { exige(a, 2, 2); return Math.pow(paraNumero(ev(a[0])), paraNumero(ev(a[1]))); };
    F['CONCATENAR'] = function (a) { return valoresFaixa(a).map(function (o) { return paraTexto(o.v); }).join(''); };
    F['HOJE'] = function (a) { exige(a, 0, 0); return hojeSerial(); };
    F['DATA'] = function (a) { exige(a, 3, 3); return serialDe(Math.trunc(paraNumero(ev(a[0]))), Math.trunc(paraNumero(ev(a[1]))), Math.trunc(paraNumero(ev(a[2])))); };
    F['ANO'] = function (a) { return dataDe(n1(a)).getUTCFullYear(); };
    F['MES'] = function (a) { return dataDe(n1(a)).getUTCMonth() + 1; };
    F['DIA'] = function (a) { return dataDe(n1(a)).getUTCDate(); };
    F['DATADIF'] = function (a) {
      exige(a, 3, 3);
      var i = paraNumero(ev(a[0])), f = paraNumero(ev(a[1])), u = paraTexto(ev(a[2])).toUpperCase();
      if (f < i) throw new ErroCalc('#NUM!');
      var d1 = dataDe(i), d2 = dataDe(f);
      if (u === 'D') return Math.floor(f) - Math.floor(i);
      var meses = (d2.getUTCFullYear() - d1.getUTCFullYear()) * 12 + d2.getUTCMonth() - d1.getUTCMonth();
      if (d2.getUTCDate() < d1.getUTCDate()) meses--;
      if (u === 'M') return meses;
      if (u === 'Y') return Math.floor(meses / 12);
      throw new ErroCalc('#NUM!');
    };
    function indiceDe(a0) {
      var ind = indices && indices[paraTexto(ev(a0)).toUpperCase().trim()];
      if (!ind || !ind.serie) throw new ErroCalc('#N/D!');
      return ind;
    }
    // FATOR(indice; inicio; fim): multiplica (1 + taxa/100) de cada mes de "inicio" a "fim", os dois meses inclusive.
    // Mes sem taxa cadastrada = #N/D! (nunca estima).
    F['FATOR'] = function (a) {
      exige(a, 3, 3);
      var ind = indiceDe(a[0]), i = paraNumero(ev(a[1])), f = paraNumero(ev(a[2]));
      if (f < i) throw new ErroCalc('#NUM!');
      var d1 = dataDe(i), d2 = dataDe(f), y = d1.getUTCFullYear(), m = d1.getUTCMonth() + 1, y2 = d2.getUTCFullYear(), m2 = d2.getUTCMonth() + 1;
      var prod = 1, n = 0;
      while (y < y2 || (y === y2 && m <= m2)) {
        var tx = ind.serie[y + '-' + p2(m)];
        if (typeof tx !== 'number') throw new ErroCalc('#N/D!');
        prod *= 1 + tx / 100;
        if (++n > 1200) throw new ErroCalc('#NUM!');
        if (++m > 12) { m = 1; y++; }
      }
      return limpa(prod);
    };
    // TAXA(indice; data): taxa do mes da data, em fracao (1,07% = 0,0107)
    F['TAXA'] = function (a) {
      exige(a, 2, 2);
      var ind = indiceDe(a[0]), d = dataDe(paraNumero(ev(a[1])));
      var tx = ind.serie[d.getUTCFullYear() + '-' + p2(d.getUTCMonth() + 1)];
      if (typeof tx !== 'number') throw new ErroCalc('#N/D!');
      return limpa(tx / 100);
    };
    F['SOMASE'] = function (a) {
      exige(a, 2, 3);
      var fa = ev(a[0]), cr = ev(a[1]), fs = a.length > 2 ? ev(a[2]) : fa;
      if (!fa.faixa || !fs.faixa) throw new ErroCalc('#VALOR!');
      var teste = criterio(cr), soma = 0;
      for (var r = 0; r < fa.linhas.length; r++) for (var c = 0; c < fa.linhas[r].length; c++) {
        if (teste(fa.linhas[r][c])) {
          var s = fs.linhas[r] && fs.linhas[r][c];
          if (s instanceof ErroCalc) throw s;
          if (typeof s === 'number') soma += s;
        }
      }
      return soma;
    };
    return F;
  }

  // ---------- planilha (calculo de uma pasta inteira) ----------
  // pasta = { abas: [ { nome, celulas: { A1: 'texto digitado' }, formatos: { A1: 'brl' } } ] }
  function criarCalculo(pasta) {
    var porNome = {};
    pasta.abas.forEach(function (a) { porNome[a.nome.toLowerCase()] = a; });
    var cache = {}, emCurso = {}, arvores = {};

    function arvoreDe(f) {
      if (!(f in arvores)) { try { arvores[f] = parse(f.slice(1)); } catch (e) { if (e instanceof ErroCalc) arvores[f] = e; else throw e; } }
      return arvores[f];
    }

    function valorCelula(aba, col, row) { // nunca lanca; erros voltam como ErroCalc
      var chave = aba.nome.toLowerCase() + '|' + col + '|' + row;
      if (chave in cache) return cache[chave];
      if (emCurso[chave]) return new ErroCalc('#CIRC!');
      var addr = endereco(col, row);
      var raw = aba.celulas ? aba.celulas[addr] : undefined;
      var fmt = aba.formatos ? aba.formatos[addr] : undefined;
      var it = interpretar(raw, fmt), v;
      if (it.tipo === 'formula') {
        emCurso[chave] = true;
        try {
          var arv = arvoreDe(it.valor);
          if (arv instanceof ErroCalc) v = arv;
          else {
            v = avaliar(arv, aba);
            if (v && v.faixa) v = v.linhas.length === 1 && v.linhas[0].length === 1 ? v.linhas[0][0] : new ErroCalc('#VALOR!');
          }
        } catch (e) { if (e instanceof ErroCalc) v = e; else throw e; }
        delete emCurso[chave];
      } else v = it.valor;
      cache[chave] = v;
      return v;
    }

    function abaDe(nome, atual) {
      if (!nome) return atual;
      var a = porNome[nome.toLowerCase()];
      if (!a) throw new ErroCalc('#REF!');
      return a;
    }

    function avaliar(arv, abaAtual) {
      var F = null;
      function ev(nd) {
        switch (nd.k) {
          case 'lit': return nd.v;
          case 'ref': { var v = valorCelula(abaDe(nd.aba, abaAtual), nd.col, nd.row); if (v instanceof ErroCalc) throw v; return v; }
          case 'faixa': {
            var ab = abaDe(nd.aba, abaAtual), linhas = [];
            for (var r = nd.r1; r <= nd.r2; r++) { var l = []; for (var c = nd.c1; c <= nd.c2; c++) l.push(valorCelula(ab, c, r)); linhas.push(l); }
            return { faixa: true, linhas: linhas };
          }
          case 'neg': return -paraNumero(esc(ev(nd.e)));
          case 'pct': return paraNumero(esc(ev(nd.e))) / 100;
          case 'bin': {
            var a = esc(ev(nd.l)), b = esc(ev(nd.r));
            switch (nd.op) {
              case '+': return limpa(paraNumero(a) + paraNumero(b));
              case '-': return limpa(paraNumero(a) - paraNumero(b));
              case '*': return limpa(paraNumero(a) * paraNumero(b));
              case '/': { var d = paraNumero(b); if (d === 0) throw new ErroCalc('#DIV/0!'); return limpa(paraNumero(a) / d); }
              case '^': { var pw = Math.pow(paraNumero(a), paraNumero(b)); if (!isFinite(pw)) throw new ErroCalc('#NUM!'); return pw; }
              case '&': return paraTexto(a) + paraTexto(b);
              case '=': return comparar(a, b) === 0;
              case '<>': return comparar(a, b) !== 0;
              case '<': return comparar(a, b) < 0;
              case '>': return comparar(a, b) > 0;
              case '<=': return comparar(a, b) <= 0;
              case '>=': return comparar(a, b) >= 0;
            }
            throw new ErroCalc('#ERRO!');
          }
          case 'func': {
            if (!F) F = criarFuncoes(ev, pasta.indices);
            var nome = ALIAS[nd.nome] || nd.nome;
            if (!F[nome]) throw new ErroCalc('#NOME?');
            var r2 = F[nome](nd.args);
            if (typeof r2 === 'number' && !isFinite(r2)) throw new ErroCalc('#NUM!');
            return r2;
          }
        }
        throw new ErroCalc('#ERRO!');
      }
      function esc(x) { // faixa de uma so celula vira escalar; faixa maior em conta e erro
        if (x && x.faixa) { if (x.linhas.length === 1 && x.linhas[0].length === 1) { var u = x.linhas[0][0]; if (u instanceof ErroCalc) throw u; return u; } throw new ErroCalc('#VALOR!'); }
        return x;
      }
      return ev(arv);
    }

    return {
      valor: function (nomeAba, addr) {
        var aba = porNome[String(nomeAba).toLowerCase()], p = parseEndereco(addr);
        if (!aba || !p) return null;
        return valorCelula(aba, p.col, p.row);
      },
      exibir: function (nomeAba, addr) {
        var aba = porNome[String(nomeAba).toLowerCase()], p = parseEndereco(addr);
        if (!aba || !p) return '';
        var v = valorCelula(aba, p.col, p.row);
        var raw = aba.celulas ? aba.celulas[addr] : undefined;
        var fmt = aba.formatos ? aba.formatos[addr] : undefined;
        var it = interpretar(raw, fmt);
        return formatar(v, fmt, it.fmtAuto);
      },
    };
  }

  return {
    ErroCalc: ErroCalc, MAX_COLS: MAX_COLS,
    letraParaCol: letraParaCol, colParaLetra: colParaLetra, endereco: endereco, parseEndereco: parseEndereco,
    interpretar: interpretar, formatar: formatar, numeroDeTexto: numeroDeTexto,
    deslocarFormula: deslocarFormula, criarCalculo: criarCalculo, serialDe: serialDe,
    tokenizar: tokenizar, parseSerieIndice: parseSerieIndice, textoSerieIndice: textoSerieIndice, lacunasIndice: lacunasIndice,
  };
});
