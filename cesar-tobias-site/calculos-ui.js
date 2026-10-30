/* Aba "Calculos": editor de planilha (grade + formulas) para calculos judiciais.
   Depende de calculos-motor.js (window.CalculosMotor). Fatia 1: roda so no navegador; o rascunho fica no
   localStorage deste navegador e pode ser exportado/importado em arquivo .json. */
(function () {
  'use strict';
  var M = window.CalculosMotor;
  // ExcelJS (gera o .xlsx) so e baixado quando se clica em "Excel"; o hash garante que e exatamente o arquivo conferido
  var URL_EXCELJS = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
  var SRI_EXCELJS = 'sha384-Pqp51FUN2/qzfxZxBCtF0stpc9ONI6MYZpVqmo8m20SoaQCzf+arZvACkLkirlPz';
  var SEM_PDF_POR_PADRAO = /^(leia-me|como usar|documentos necess)/i;
  // Rascunho e copia local dos indices ficam no navegador, separados por escritorio (o token de um escritorio parceiro comeca por "tenant:")
  function escopo() {
    try { var t = sessionStorage.getItem('painel_token') || '', i = t.indexOf(':'); return i > 0 ? t.slice(0, i) : '__cesar__'; } catch (e) { return '__cesar__'; }
  }
  function chaveRascunho() { return 'calculos_rascunho_v1:' + escopo(); }
  function chaveBiblioteca() { return 'calculos_indices_v1:' + escopo(); }

  // ---- chamadas ao servidor (mesmo padrao do painel-app.js: token da sessao no cabecalho) ----
  function respostaJson(r) {
    return r.json().catch(function () { return {}; }).then(function (d) {
      if (!r.ok) { var e = new Error((d && d.erro) || ('Erro ' + r.status)); e.status = r.status; e.dados = d || {}; throw e; }
      return d;
    });
  }
  function apiGet(url) {
    var t = ''; try { t = sessionStorage.getItem('painel_token') || ''; } catch (e) { /* sem sessao */ }
    return fetch(url, { cache: 'no-store', headers: { 'Authorization': 'Bearer ' + t } }).then(respostaJson);
  }
  function apiPost(url, corpo) {
    var t = ''; try { t = sessionStorage.getItem('painel_token') || ''; } catch (e) { /* sem sessao */ }
    return fetch(url, { method: 'POST', cache: 'no-store', headers: { 'Authorization': 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify(corpo || {}) }).then(respostaJson);
  }
  function fmtDataHora(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    function p2(n) { return (n < 10 ? '0' : '') + n; }
    return p2(d.getDate()) + '/' + p2(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes());
  }
  var MAX_LINHAS_ABA = 2000, MAX_TEXTO_CELULA = 5000, MAX_BYTES_CONTEUDO = 2000000;
  var COLS = 26, LINHAS_PADRAO = 60, LARGURA_PADRAO = 112, MAX_DESFAZER = 60;
  var FORMATOS = [
    ['geral', 'Geral'], ['brl', 'R$ (moeda)'], ['numero', 'Número (2 casas)'], ['fator', 'Fator (6 casas)'],
    ['pct', 'Porcentagem'], ['data', 'Data'], ['mesano', 'Mês/ano'], ['texto', 'Texto'],
  ];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function vinculoVazio() { return { id: null, versao: null, cliente_id: null, cliente_nome: '', processo_id: null, processo_numero: '', modelo: '', hash: '' }; }
  // impressao curta (FNV-1a) do ultimo estado sincronizado com o servidor; fica no rascunho para saber, depois de recarregar a pagina, se ha alteracao pendente
  function hashTexto(t) {
    var h = 2166136261;
    for (var i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return t.length + '-' + h.toString(16);
  }
  function inteiroOuNull(v) { var n = parseInt(v, 10); return isFinite(n) && n > 0 ? n : null; }
  function textoCurto(v, max) { return typeof v === 'string' ? v.slice(0, max) : ''; }
  function pastaVazia() {
    return { nome: 'Novo cálculo', abas: [{ nome: 'Cálculo', celulas: {}, formatos: {}, estilos: {}, larguras: {}, linhas: LINHAS_PADRAO }] };
  }
  function pastaValida(p) {
    if (!p || typeof p !== 'object' || !Array.isArray(p.abas) || !p.abas.length) return false;
    return p.abas.every(function (a) { return a && typeof a.nome === 'string' && a.nome && a.celulas && typeof a.celulas === 'object'; });
  }
  function lerBiblioteca() {
    try { var b = JSON.parse(localStorage.getItem(chaveBiblioteca()) || '{}'); return b && typeof b === 'object' ? b : {}; } catch (e) { return {}; }
  }
  function gravarBiblioteca(codigo, ind) {
    try { var b = lerBiblioteca(); b[codigo] = ind; localStorage.setItem(chaveBiblioteca(), JSON.stringify(b)); } catch (e) { /* sem armazenamento */ }
  }
  function indiceLimpo(ind) {
    var o = { fonte: '', consulta: '', serie: {} };
    if (!ind || typeof ind !== 'object') return o;
    o.fonte = typeof ind.fonte === 'string' ? ind.fonte : '';
    o.consulta = typeof ind.consulta === 'string' ? ind.consulta : '';
    if (ind.serie && typeof ind.serie === 'object') Object.keys(ind.serie).forEach(function (k) { if (/^\d{4}-\d{2}$/.test(k) && typeof ind.serie[k] === 'number' && isFinite(ind.serie[k])) o.serie[k] = ind.serie[k]; });
    return o;
  }
  function normalizar(p) {
    var bib = lerBiblioteca(), ind = {};
    Object.keys(p.indices && typeof p.indices === 'object' ? p.indices : {}).forEach(function (c) { ind[c.toUpperCase()] = indiceLimpo(p.indices[c]); });
    Object.keys(bib).forEach(function (c) { // indice vazio no calculo = usa a ultima tabela cadastrada neste navegador
      var cod = c.toUpperCase();
      if (!ind[cod] || !Object.keys(ind[cod].serie).length) ind[cod] = indiceLimpo(bib[c]);
    });
    if (!ind.SELIC) ind.SELIC = indiceLimpo(null);
    p.indices = ind;
    var v = p.vinculo && typeof p.vinculo === 'object' ? p.vinculo : {};
    p.vinculo = { id: inteiroOuNull(v.id), versao: inteiroOuNull(v.versao), cliente_id: inteiroOuNull(v.cliente_id), cliente_nome: textoCurto(v.cliente_nome, 200),
      processo_id: inteiroOuNull(v.processo_id), processo_numero: textoCurto(v.processo_numero, 60), modelo: textoCurto(v.modelo, 40), hash: textoCurto(v.hash, 40) };
    p.nome = typeof p.nome === 'string' ? p.nome : 'Novo cálculo';
    p.abas.forEach(function (a) {
      a.formatos = a.formatos && typeof a.formatos === 'object' ? a.formatos : {};
      a.larguras = a.larguras && typeof a.larguras === 'object' ? a.larguras : {};
      a.estilos = a.estilos && typeof a.estilos === 'object' ? a.estilos : {};
      a.linhas = Math.max(20, parseInt(a.linhas, 10) || LINHAS_PADRAO);
    });
    return p;
  }
  function lerRascunho() {
    try { var s = localStorage.getItem(chaveRascunho()); if (s) { var p = JSON.parse(s); if (pastaValida(p)) return normalizar(p); } } catch (e) { /* sem armazenamento: segue em branco */ }
    return null;
  }

  function montar(raiz) {
    if (!raiz || !M) return;
    var pasta = lerRascunho() || normalizar(pastaVazia());
    var ativa = 0;
    var sel = { ac: 1, ar: 1, c1: 1, r1: 1, c2: 1, r2: 1 }; // ac/ar = celula ativa; c1..r2 = retangulo selecionado
    var editando = null; // {valorOriginal}
    var desfazer = [], refazer = [];
    var copiaInterna = null; // {texto, c, r}
    var calc = null;
    var arrastando = false;

    raiz.innerHTML =
      '<div class="panel calc">' +
        '<div class="calc-topo">' +
          '<input type="text" class="calc-nome" id="calc-nome" maxlength="120" aria-label="Nome do cálculo" placeholder="Nome do cálculo (ex.: Otni — IR doença grave)">' +
          '<div class="calc-topo-botoes">' +
            '<button type="button" class="btn-secundario" id="calc-btn-desfazer" title="Desfazer (Ctrl+Z)">↶ Desfazer</button>' +
            '<button type="button" class="btn-secundario" id="calc-btn-refazer" title="Refazer (Ctrl+Y)">↷ Refazer</button>' +
            '<button type="button" class="btn-secundario" id="calc-btn-indices" aria-expanded="false" title="Tabelas mensais de SELIC/IPCA usadas pela função FATOR">Índices</button>' +
            '<button type="button" class="btn-secundario" id="calc-btn-excel" title="Baixar como planilha do Excel, com as fórmulas">Excel (.xlsx)</button>' +
            '<button type="button" class="btn-secundario" id="calc-btn-pdf" title="Imprimir ou salvar em PDF (Times New Roman 12, espaçamento 1,5)">PDF / Imprimir</button>' +
            '<button type="button" class="btn-secundario" id="calc-btn-exportar" title="Guarda uma cópia editável deste cálculo">Salvar cópia (.json)</button>' +
            '<button type="button" class="btn-secundario" id="calc-btn-importar" title="Abre uma cópia salva antes">Abrir cópia (.json)</button>' +
            '<select id="calc-modelo" class="btn-secundario" aria-label="Começar de um modelo"><option value="">Usar modelo…</option>' + (window.CalculosModelos ? window.CalculosModelos.lista.map(function (m) { return '<option value="' + esc(m.id) + '">' + esc(m.nome) + '</option>'; }).join('') : '') + '</select>' +
            '<button type="button" class="btn-secundario" id="calc-btn-novo">Novo cálculo</button>' +
            '<input type="file" id="calc-arquivo" accept=".json,application/json" class="hidden">' +
          '</div>' +
        '</div>' +
        '<div class="calc-sistema" id="calc-sistema">' +
          '<div class="calc-sistema-info" id="calc-sistema-info" aria-live="polite"></div>' +
          '<div class="calc-sistema-botoes">' +
            '<button type="button" class="btn-secundario" id="calc-btn-vincular" title="Escolher a quem este cálculo pertence">Cliente / processo…</button>' +
            '<button type="button" class="btn-secundario calc-ind-aplicar" id="calc-btn-salvar-sistema" title="Guardar no sistema do escritório">Salvar no sistema</button>' +
            '<button type="button" class="btn-secundario" id="calc-btn-salvar-novo" title="Guardar uma nova versão independente">Salvar como novo</button>' +
            '<button type="button" class="btn-secundario" id="calc-btn-lista" aria-expanded="false" title="Abrir um cálculo já salvo">Cálculos salvos</button>' +
          '</div>' +
        '</div>' +
        '<div class="calc-lista hidden" id="calc-lista">' +
          '<div class="calc-ind-linha"><label class="calc-ind-grande">Buscar <input type="text" id="calc-lista-busca" maxlength="100" placeholder="Nome do cálculo, cliente ou nº do processo"></label>' +
            '<button type="button" class="btn-secundario" id="calc-lista-fechar">Fechar</button></div>' +
          '<div class="calc-lista-corpo" id="calc-lista-corpo"></div>' +
        '</div>' +
        '<div class="calc-indices hidden" id="calc-indices">' +
          '<div class="calc-ind-linha"><label>Índice <select id="calc-ind-sel"></select></label><button type="button" class="btn-secundario" id="calc-ind-novo">+ Novo índice</button></div>' +
          '<div class="calc-ind-linha"><label class="calc-ind-grande">Fonte oficial <input type="text" id="calc-ind-fonte" maxlength="200" placeholder="Ex.: Receita Federal — tabela SELIC / BACEN"></label>' +
            '<label>Consultada em <input type="text" id="calc-ind-consulta" maxlength="20" placeholder="dd/mm/aaaa"></label></div>' +
          '<label class="calc-ind-bloco">Taxas mensais em %, uma por linha: <b>MM/AAAA;taxa</b> (ex.: 07/2023;1,07). Pode colar do Excel.' +
            '<textarea id="calc-ind-texto" rows="9" spellcheck="false"></textarea></label>' +
          '<div class="calc-ind-resumo" id="calc-ind-resumo" aria-live="polite"></div>' +
          '<div class="calc-ind-linha"><button type="button" class="btn-secundario calc-ind-aplicar" id="calc-ind-aplicar">Aplicar índice</button>' +
            '<button type="button" class="btn-secundario" id="calc-ind-escritorio" title="Troca as taxas deste cálculo pela tabela atual do escritório">Usar a tabela do escritório</button>' +
            '<button type="button" class="btn-secundario" id="calc-ind-fechar">Fechar</button></div>' +
          '<p class="calc-aviso">O sistema não traz índices prontos, de propósito: cole a tabela oficial (Receita Federal/BACEN) e registre a fonte. Se faltar um mês, o cálculo mostra <b>#N/D!</b> em vez de estimar. Ao aplicar, a tabela vale para <b>todo o escritório</b> (novos cálculos já nascem com ela). Cada cálculo salvo guarda uma cópia das taxas que usou, para não mudar sozinho depois.</p>' +
        '</div>' +
        '<div class="calc-barra">' +
          '<span class="calc-ref" id="calc-ref">A1</span>' +
          '<select id="calc-formato" aria-label="Formato da célula">' + FORMATOS.map(function (f) { return '<option value="' + f[0] + '">' + f[1] + '</option>'; }).join('') + '</select>' +
          '<span class="calc-fx">fx</span>' +
          '<input type="text" id="calc-formula" class="calc-formula" autocomplete="off" spellcheck="false" placeholder="Digite um valor ou uma fórmula, ex.: =SOMA(B2:B7)">' +
        '</div>' +
        '<div class="calc-grade-wrap" id="calc-wrap" tabindex="0" aria-label="Planilha"></div>' +
        '<div class="calc-rodape">' +
          '<div class="calc-abas" id="calc-abas"></div>' +
          '<div class="calc-status" id="calc-status"></div>' +
        '</div>' +
        '<details class="calc-ajuda"><summary>Como usar fórmulas</summary>' +
          '<ul>' +
            '<li>Comece com <b>=</b>. Separe argumentos com <b>;</b> e use <b>vírgula</b> nos decimais: <code>=ARRED(B2*1,1104;2)</code>.</li>' +
            '<li>Funções: SOMA, MEDIA, MIN, MAX, CONT.NUM, SE, E, OU, NAO, SEERRO, ARRED, ARREDONDAR.PARA.CIMA/BAIXO, ABS, INT, POTENCIA, SOMASE, DATA, HOJE, ANO, MES, DIA, DATADIF(ini;fim;"D"|"M"|"Y"), CONCATENAR.</li>' +
            '<li><b>Índices:</b> <code>=FATOR("SELIC";inicio;fim)</code> multiplica 1 + taxa de cada mês, do mês de <i>inicio</i> ao de <i>fim</i> (os dois inclusive), usando a tabela do botão <b>Índices</b>; <code>=TAXA("SELIC";data)</code> devolve a taxa do mês.</li>' +
            '<li>Outra aba: <code>=\'Memória Mensal\'!G18</code>. Fixar referência: <code>$H$1</code>.</li>' +
            '<li>Datas: digite <b>07/10/2026</b> ou <b>07/2023</b>. Valores: <b>1.905,16</b> ou <b>R$ 1.905,16</b>. Percentual: <b>20%</b>.</li>' +
            '<li>Atalhos: Enter/Tab movem; F2 edita; Delete limpa; <b>Ctrl+D</b> preenche para baixo (ajusta as referências); <b>Ctrl+R</b> para a direita; copiar/colar funciona com o Excel.</li>' +
          '</ul>' +
          '<p class="calc-aviso">Nesta versão o cálculo fica salvo apenas neste navegador (rascunho). Use <b>Exportar arquivo</b> para guardar uma cópia. O salvamento no cadastro do cliente/processo vem em uma próxima etapa.</p>' +
        '</details>' +
      '</div>';

    var wrap = raiz.querySelector('#calc-wrap');
    var elNome = raiz.querySelector('#calc-nome');
    var elRef = raiz.querySelector('#calc-ref');
    var elFormula = raiz.querySelector('#calc-formula');
    var elFormato = raiz.querySelector('#calc-formato');
    var elAbas = raiz.querySelector('#calc-abas');
    var elStatus = raiz.querySelector('#calc-status');
    var tabela = null, entrada = null;

    function aba() { return pasta.abas[ativa]; }
    function salvar() {
      try { localStorage.setItem(chaveRascunho(), JSON.stringify(pasta)); } catch (e) { /* sem armazenamento */ }
      if (typeof atualizarInfoSistema === 'function') atualizarInfoSistema();
    }
    function snapshot() { return JSON.stringify(pasta); }
    function antesDeMudar() { desfazer.push(snapshot()); if (desfazer.length > MAX_DESFAZER) desfazer.shift(); refazer = []; }
    function restaurar(s) {
      pasta = normalizar(JSON.parse(s));
      if (ativa >= pasta.abas.length) ativa = pasta.abas.length - 1;
      elNome.value = pasta.nome;
      desenharAbas(); desenharGrade(); salvar();
    }

    // ---------- grade ----------
    function larg(c) { return aba().larguras[c] || LARGURA_PADRAO; }
    function desenharGrade() {
      var a = aba(), h = '<table class="calc-tabela"><colgroup><col style="width:46px">';
      var c, r;
      for (c = 1; c <= COLS; c++) h += '<col style="width:' + larg(c) + 'px">';
      h += '</colgroup><thead><tr><th class="calc-canto"></th>';
      for (c = 1; c <= COLS; c++) h += '<th data-col="' + c + '">' + M.colParaLetra(c) + '<span class="calc-rz" data-rz="' + c + '"></span></th>';
      h += '</tr></thead><tbody>';
      for (r = 1; r <= a.linhas; r++) {
        h += '<tr><th class="calc-linha" data-lin="' + r + '">' + r + '</th>';
        for (c = 1; c <= COLS; c++) { var est = a.estilos[M.endereco(c, r)]; h += '<td' + (est ? ' class="calc-e-' + esc(est) + '"' : '') + ' data-c="' + c + '" data-r="' + r + '"></td>'; }
        h += '</tr>';
      }
      h += '</tbody></table>';
      wrap.innerHTML = h + '<input type="text" class="calc-entrada hidden" id="calc-entrada" autocomplete="off" spellcheck="false">';
      tabela = wrap.querySelector('table');
      entrada = wrap.querySelector('#calc-entrada');
      entrada.addEventListener('keydown', teclaEntrada);
      entrada.addEventListener('input', function () { elFormula.value = entrada.value; });
      entrada.addEventListener('blur', function () { if (editando) confirmarEdicao(0, 0); });
      atualizarValores();
      pintarSelecao();
    }

    function tdDe(c, r) { return tabela.querySelector('td[data-c="' + c + '"][data-r="' + r + '"]'); }

    function atualizarValores() {
      calc = M.criarCalculo(pasta);
      var a = aba(), tds = tabela.querySelectorAll('td');
      for (var i = 0; i < tds.length; i++) {
        var td = tds[i], c = +td.getAttribute('data-c'), r = +td.getAttribute('data-r');
        var addr = M.endereco(c, r), raw = a.celulas[addr];
        var txt = '', cls = '';
        if (raw !== undefined && raw !== '') {
          txt = calc.exibir(a.nome, addr);
          var v = calc.valor(a.nome, addr);
          if (v instanceof M.ErroCalc) cls = 'calc-err';
          else if (typeof v === 'number') cls = 'calc-num';
          else if (typeof v === 'boolean') cls = 'calc-bool';
        }
        if (td.textContent !== txt) td.textContent = txt;
        var alvo = cls;
        if (td.getAttribute('data-k') !== alvo) { td.setAttribute('data-k', alvo); td.className = (td.className.replace(/\bcalc-(err|num|bool)\b/g, '') + ' ' + alvo).trim(); }
      }
      atualizarStatus();
    }

    function limites() { return { c1: Math.min(sel.c1, sel.c2), c2: Math.max(sel.c1, sel.c2), r1: Math.min(sel.r1, sel.r2), r2: Math.max(sel.r1, sel.r2) }; }

    function pintarSelecao() {
      var l = limites(), tds = tabela.querySelectorAll('td'), i;
      for (i = 0; i < tds.length; i++) {
        var td = tds[i], c = +td.getAttribute('data-c'), r = +td.getAttribute('data-r');
        var dentro = c >= l.c1 && c <= l.c2 && r >= l.r1 && r <= l.r2;
        td.classList.toggle('calc-sel', dentro);
        td.classList.toggle('calc-ativa', c === sel.ac && r === sel.ar);
      }
      var ths = tabela.querySelectorAll('th[data-col]');
      for (i = 0; i < ths.length; i++) ths[i].classList.toggle('calc-th-sel', +ths[i].getAttribute('data-col') >= l.c1 && +ths[i].getAttribute('data-col') <= l.c2);
      var lins = tabela.querySelectorAll('th[data-lin]');
      for (i = 0; i < lins.length; i++) lins[i].classList.toggle('calc-th-sel', +lins[i].getAttribute('data-lin') >= l.r1 && +lins[i].getAttribute('data-lin') <= l.r2);
      var addr = M.endereco(sel.ac, sel.ar);
      elRef.textContent = (l.c1 !== l.c2 || l.r1 !== l.r2) ? M.endereco(l.c1, l.r1) + ':' + M.endereco(l.c2, l.r2) : addr;
      if (!editando) elFormula.value = aba().celulas[addr] || '';
      elFormato.value = aba().formatos[addr] || 'geral';
      atualizarStatus();
    }

    function atualizarStatus() {
      var l = limites(), a = aba(), n = 0, soma = 0, cont = 0;
      if (l.c1 === l.c2 && l.r1 === l.r2) { elStatus.textContent = ''; return; }
      for (var c = l.c1; c <= l.c2; c++) for (var r = l.r1; r <= l.r2; r++) {
        var v = calc ? calc.valor(a.nome, M.endereco(c, r)) : null;
        if (v !== null && v !== undefined && v !== '') cont++;
        if (typeof v === 'number') { n++; soma += v; }
      }
      elStatus.textContent = n ? 'Soma: ' + M.formatar(parseFloat(soma.toPrecision(15)), 'numero') + ' · Média: ' + M.formatar(soma / n, 'numero') + ' · Contagem: ' + cont : 'Contagem: ' + cont;
    }

    // ---------- edicao ----------
    function definir(c, r, raw) {
      var a = aba(), addr = M.endereco(c, r);
      if (raw === '' || raw == null) delete a.celulas[addr]; else a.celulas[addr] = raw;
    }
    function posicionarEntrada(c, r) {
      var td = tdDe(c, r);
      entrada.style.left = td.offsetLeft + 'px'; entrada.style.top = td.offsetTop + 'px';
      entrada.style.width = Math.max(td.offsetWidth, 160) + 'px'; entrada.style.height = td.offsetHeight + 'px';
    }
    function iniciarEdicao(textoInicial) {
      var addr = M.endereco(sel.ac, sel.ar), atual = aba().celulas[addr] || '';
      editando = { c: sel.ac, r: sel.ar };
      posicionarEntrada(sel.ac, sel.ar);
      entrada.classList.remove('hidden');
      entrada.value = textoInicial != null ? textoInicial : atual;
      elFormula.value = entrada.value;
      entrada.focus();
      if (textoInicial == null) entrada.setSelectionRange(entrada.value.length, entrada.value.length);
    }
    function confirmarEdicao(dc, dr) {
      if (!editando) return;
      var e = editando, novo = entrada.value, antigo = aba().celulas[M.endereco(e.c, e.r)] || '';
      editando = null;
      entrada.classList.add('hidden');
      if (novo !== antigo) { antesDeMudar(); definir(e.c, e.r, novo); salvar(); atualizarValores(); }
      if (dc || dr) mover(dc, dr, false); else pintarSelecao();
      wrap.focus();
    }
    function cancelarEdicao() {
      editando = null; entrada.classList.add('hidden'); pintarSelecao(); wrap.focus();
    }
    function teclaEntrada(e) {
      if (e.key === 'Enter') { e.preventDefault(); confirmarEdicao(0, e.shiftKey ? -1 : 1); }
      else if (e.key === 'Tab') { e.preventDefault(); confirmarEdicao(e.shiftKey ? -1 : 1, 0); }
      else if (e.key === 'Escape') { e.preventDefault(); cancelarEdicao(); }
    }

    function garantirVisivel(c, r) {
      var td = tdDe(c, r); if (!td) return;
      var w = wrap, t = td.offsetTop, b = t + td.offsetHeight, l = td.offsetLeft, rg = l + td.offsetWidth;
      if (t < w.scrollTop + 26) w.scrollTop = Math.max(0, t - 26);
      else if (b > w.scrollTop + w.clientHeight) w.scrollTop = b - w.clientHeight;
      if (l < w.scrollLeft + 46) w.scrollLeft = Math.max(0, l - 46);
      else if (rg > w.scrollLeft + w.clientWidth) w.scrollLeft = rg - w.clientWidth;
    }
    function mover(dc, dr, estender) {
      var c = Math.min(COLS, Math.max(1, (estender ? sel.c2 : sel.ac) + dc));
      var r = Math.min(aba().linhas, Math.max(1, (estender ? sel.r2 : sel.ar) + dr));
      if (estender) { sel.c2 = c; sel.r2 = r; }
      else { sel.ac = sel.c1 = sel.c2 = c; sel.ar = sel.r1 = sel.r2 = r; }
      pintarSelecao(); garantirVisivel(c, r);
    }

    // ---------- mouse ----------
    wrap.addEventListener('mousedown', function (e) {
      var rz = e.target.closest ? e.target.closest('.calc-rz') : null;
      if (rz) { iniciarRedimensionar(e, +rz.getAttribute('data-rz')); return; }
      var td = e.target.closest ? e.target.closest('td[data-c]') : null;
      var thc = e.target.closest ? e.target.closest('th[data-col]') : null;
      var thl = e.target.closest ? e.target.closest('th[data-lin]') : null;
      if (editando && e.target !== entrada) confirmarEdicao(0, 0);
      if (td) {
        var c = +td.getAttribute('data-c'), r = +td.getAttribute('data-r');
        if (e.shiftKey) { sel.c2 = c; sel.r2 = r; }
        else { sel.ac = sel.c1 = sel.c2 = c; sel.ar = sel.r1 = sel.r2 = r; }
        arrastando = true; pintarSelecao();
      } else if (thc) {
        var cc = +thc.getAttribute('data-col');
        sel.ac = cc; sel.ar = 1; sel.c1 = sel.c2 = cc; sel.r1 = 1; sel.r2 = aba().linhas; pintarSelecao();
      } else if (thl) {
        var rr = +thl.getAttribute('data-lin');
        sel.ac = 1; sel.ar = rr; sel.c1 = 1; sel.c2 = COLS; sel.r1 = sel.r2 = rr; pintarSelecao();
      }
    });
    wrap.addEventListener('mouseover', function (e) {
      if (!arrastando) return;
      var td = e.target.closest ? e.target.closest('td[data-c]') : null;
      if (!td) return;
      sel.c2 = +td.getAttribute('data-c'); sel.r2 = +td.getAttribute('data-r'); pintarSelecao();
    });
    document.addEventListener('mouseup', function () { arrastando = false; });
    wrap.addEventListener('dblclick', function (e) {
      if (e.target.closest && e.target.closest('td[data-c]')) iniciarEdicao(null);
    });

    function iniciarRedimensionar(e, col) {
      e.preventDefault();
      var x0 = e.clientX, w0 = larg(col), colEl = tabela.querySelectorAll('col')[col];
      function mv(ev) { var w = Math.max(40, Math.min(600, w0 + ev.clientX - x0)); colEl.style.width = w + 'px'; aba().larguras[col] = w; }
      function up() { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); salvar(); }
      document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
    }

    // ---------- teclado ----------
    wrap.addEventListener('keydown', function (e) {
      if (editando) return;
      var ctrl = e.ctrlKey || e.metaKey;
      if (ctrl) {
        var k = e.key.toLowerCase();
        if (k === 'z') { e.preventDefault(); if (e.shiftKey) fazerRefazer(); else fazerDesfazer(); }
        else if (k === 'y') { e.preventDefault(); fazerRefazer(); }
        else if (k === 'd') { e.preventDefault(); preencher('baixo'); }
        else if (k === 'r') { e.preventDefault(); preencher('direita'); }
        return; // c/v/x tratados pelos eventos copy/paste/cut
      }
      switch (e.key) {
        case 'ArrowDown': e.preventDefault(); mover(0, 1, e.shiftKey); return;
        case 'ArrowUp': e.preventDefault(); mover(0, -1, e.shiftKey); return;
        case 'ArrowLeft': e.preventDefault(); mover(-1, 0, e.shiftKey); return;
        case 'ArrowRight': e.preventDefault(); mover(1, 0, e.shiftKey); return;
        case 'Enter': e.preventDefault(); mover(0, e.shiftKey ? -1 : 1, false); return;
        case 'Tab': e.preventDefault(); mover(e.shiftKey ? -1 : 1, 0, false); return;
        case 'F2': e.preventDefault(); iniciarEdicao(null); return;
        case 'Delete': case 'Backspace': e.preventDefault(); limparSelecao(); return;
      }
      if (e.key.length === 1 && !e.altKey) { e.preventDefault(); iniciarEdicao(e.key); }
    });

    function limparSelecao() {
      var l = limites(); antesDeMudar();
      for (var c = l.c1; c <= l.c2; c++) for (var r = l.r1; r <= l.r2; r++) definir(c, r, '');
      salvar(); atualizarValores(); pintarSelecao();
    }
    function preencher(sentido) {
      var l = limites(), a = aba(), mudou = false;
      if (sentido === 'baixo' && l.r1 === l.r2) { if (l.r1 < 2) return; l.r1--; } // uma celula so: copia a de cima
      if (sentido === 'direita' && l.c1 === l.c2) { if (l.c1 < 2) return; l.c1--; } // uma celula so: copia a da esquerda
      antesDeMudar();
      var c, r, orig, destino, novo;
      if (sentido === 'baixo') {
        for (c = l.c1; c <= l.c2; c++) {
          orig = M.endereco(c, l.r1);
          for (r = l.r1 + 1; r <= l.r2; r++) {
            destino = M.endereco(c, r); novo = M.deslocarFormula(a.celulas[orig] || '', 0, r - l.r1);
            definir(c, r, novo); if (a.formatos[orig]) a.formatos[destino] = a.formatos[orig]; else delete a.formatos[destino]; mudou = true;
          }
        }
      } else {
        for (r = l.r1; r <= l.r2; r++) {
          orig = M.endereco(l.c1, r);
          for (c = l.c1 + 1; c <= l.c2; c++) {
            destino = M.endereco(c, r); novo = M.deslocarFormula(a.celulas[orig] || '', c - l.c1, 0);
            definir(c, r, novo); if (a.formatos[orig]) a.formatos[destino] = a.formatos[orig]; else delete a.formatos[destino]; mudou = true;
          }
        }
      }
      if (!mudou) { desfazer.pop(); return; }
      salvar(); atualizarValores(); pintarSelecao();
    }

    // ---------- copiar / colar ----------
    function textoSelecao() {
      var l = limites(), a = aba(), linhas = [];
      for (var r = l.r1; r <= l.r2; r++) {
        var cols = [];
        for (var c = l.c1; c <= l.c2; c++) cols.push((a.celulas[M.endereco(c, r)] || '').replace(/[\t\r\n]+/g, ' '));
        linhas.push(cols.join('\t'));
      }
      return linhas.join('\n');
    }
    wrap.addEventListener('copy', function (e) {
      if (editando) return;
      var t = textoSelecao(), l = limites();
      e.clipboardData.setData('text/plain', t); e.preventDefault();
      copiaInterna = { texto: t, c: l.c1, r: l.r1 };
    });
    wrap.addEventListener('cut', function (e) {
      if (editando) return;
      var t = textoSelecao(), l = limites();
      e.clipboardData.setData('text/plain', t); e.preventDefault();
      copiaInterna = { texto: t, c: l.c1, r: l.r1 };
      limparSelecao();
    });
    wrap.addEventListener('paste', function (e) {
      if (editando) return;
      var t = (e.clipboardData && e.clipboardData.getData('text/plain')) || '';
      if (!t) return;
      e.preventDefault();
      var linhas = t.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n').map(function (ln) { return ln.split('\t'); });
      var l = limites(), a = aba();
      var interna = copiaInterna && copiaInterna.texto === t.replace(/\r\n/g, '\n').replace(/\n$/, '');
      antesDeMudar();
      linhas.forEach(function (cols, i) {
        cols.forEach(function (v, j) {
          var c = l.c1 + j, r = l.r1 + i;
          if (c > COLS) return;
          while (r > a.linhas) a.linhas += 20;
          if (interna) v = M.deslocarFormula(v, l.c1 - copiaInterna.c, l.r1 - copiaInterna.r);
          definir(c, r, v);
        });
      });
      if (linhas.length > 1 || linhas[0].length > 1) { sel.c2 = Math.min(COLS, l.c1 + linhas[0].length - 1); sel.r2 = l.r1 + linhas.length - 1; }
      salvar(); desenharGrade();
    });

    function fazerDesfazer() { if (!desfazer.length) return; refazer.push(snapshot()); restaurar(desfazer.pop()); }
    function fazerRefazer() { if (!refazer.length) return; desfazer.push(snapshot()); restaurar(refazer.pop()); }

    // ---------- barra de formula / formato ----------
    elFormula.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        var addr = M.endereco(sel.ac, sel.ar);
        if (elFormula.value !== (aba().celulas[addr] || '')) { antesDeMudar(); definir(sel.ac, sel.ar, elFormula.value); salvar(); atualizarValores(); }
        wrap.focus(); mover(0, 1, false);
      } else if (e.key === 'Escape') { elFormula.value = aba().celulas[M.endereco(sel.ac, sel.ar)] || ''; wrap.focus(); }
    });
    elFormato.addEventListener('change', function () {
      var l = limites(), a = aba(), v = elFormato.value;
      antesDeMudar();
      for (var c = l.c1; c <= l.c2; c++) for (var r = l.r1; r <= l.r2; r++) {
        var addr = M.endereco(c, r);
        if (v === 'geral') delete a.formatos[addr]; else a.formatos[addr] = v;
      }
      salvar(); atualizarValores(); wrap.focus();
    });

    // ---------- abas internas ----------
    function desenharAbas() {
      if (typeof sincronizarIndices === 'function') sincronizarIndices();
      elAbas.innerHTML = pasta.abas.map(function (a, i) {
        return '<button type="button" class="calc-aba' + (i === ativa ? ' ativa' : '') + '" data-i="' + i + '" title="Duplo clique para renomear">' + esc(a.nome) + '</button>';
      }).join('') +
        '<button type="button" class="calc-aba-mais" id="calc-aba-mais" title="Nova aba">+</button>' +
        '<button type="button" class="calc-aba-mais" id="calc-aba-menos" title="Excluir aba atual">🗑</button>' +
        '<button type="button" class="calc-aba-mais" id="calc-mais-linhas" title="Adicionar 20 linhas">+20 linhas</button>';
    }
    function nomeLivre(base, ignorar) {
      var n = base, k = 2;
      while (pasta.abas.some(function (a, i) { return i !== ignorar && a.nome.toLowerCase() === n.toLowerCase(); })) n = base + ' ' + k++;
      return n;
    }
    function trocarAba(i) {
      if (editando) confirmarEdicao(0, 0);
      ativa = i; sel = { ac: 1, ar: 1, c1: 1, r1: 1, c2: 1, r2: 1 };
      desenharAbas(); desenharGrade();
    }
    function renomearAba(i) {
      var atual = pasta.abas[i].nome;
      var novo = window.prompt('Novo nome da aba:', atual);
      if (novo == null) return;
      novo = novo.replace(/['!\[\]:*?\/\\]/g, '').trim().slice(0, 40);
      if (!novo || novo === atual) return;
      novo = nomeLivre(novo, i);
      antesDeMudar();
      // atualiza as formulas que apontavam para o nome antigo
      var reAntigo = new RegExp("(^|[^A-Za-zÀ-ÿ0-9_.'])(?:'" + atual.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "'|" + atual.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ")!", 'gi');
      var prefixoNovo = "'" + novo + "'!";
      pasta.abas.forEach(function (a) {
        Object.keys(a.celulas).forEach(function (k) {
          var v = a.celulas[k];
          if (typeof v === 'string' && v.charAt(0) === '=') a.celulas[k] = v.replace(reAntigo, function (_m, pre) { return pre + prefixoNovo; });
        });
      });
      pasta.abas[i].nome = novo;
      salvar(); desenharAbas(); atualizarValores();
    }
    elAbas.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button') : null;
      if (!b) return;
      if (b.id === 'calc-aba-mais') {
        antesDeMudar();
        pasta.abas.push({ nome: nomeLivre('Aba ' + (pasta.abas.length + 1), -1), celulas: {}, formatos: {}, estilos: {}, larguras: {}, linhas: LINHAS_PADRAO });
        salvar(); trocarAba(pasta.abas.length - 1);
      } else if (b.id === 'calc-aba-menos') {
        if (pasta.abas.length < 2) { window.alert('O cálculo precisa ter pelo menos uma aba.'); return; }
        if (!window.confirm('Excluir a aba "' + aba().nome + '" e tudo o que há nela?')) return;
        antesDeMudar(); pasta.abas.splice(ativa, 1); salvar(); trocarAba(Math.max(0, ativa - 1));
      } else if (b.id === 'calc-mais-linhas') {
        if (aba().linhas >= MAX_LINHAS_ABA) { window.alert('Limite de ' + MAX_LINHAS_ABA + ' linhas por aba.'); return; }
        antesDeMudar(); aba().linhas = Math.min(MAX_LINHAS_ABA, aba().linhas + 20); salvar(); desenharGrade();
      } else if (b.hasAttribute('data-i')) trocarAba(+b.getAttribute('data-i'));
    });
    elAbas.addEventListener('dblclick', function (e) {
      var b = e.target.closest ? e.target.closest('.calc-aba') : null;
      if (b) renomearAba(+b.getAttribute('data-i'));
    });

    // ---------- painel de indices ----------
    var elInd = raiz.querySelector('#calc-indices'), indSel = raiz.querySelector('#calc-ind-sel'), indFonte = raiz.querySelector('#calc-ind-fonte');
    var indConsulta = raiz.querySelector('#calc-ind-consulta'), indTexto = raiz.querySelector('#calc-ind-texto'), indResumo = raiz.querySelector('#calc-ind-resumo');
    var indAtual = 'SELIC', indJson = '';
    function codigosIndices() { return Object.keys(pasta.indices).sort(); }
    function carregarIndice(cod) {
      if (!pasta.indices[cod]) cod = codigosIndices()[0];
      indAtual = cod;
      var ind = pasta.indices[cod];
      indSel.innerHTML = codigosIndices().map(function (c) { return '<option value="' + esc(c) + '"' + (c === cod ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('');
      indFonte.value = ind.fonte; indConsulta.value = ind.consulta; indTexto.value = M.textoSerieIndice(ind.serie);
      indJson = JSON.stringify(pasta.indices);
      resumirIndice(false);
    }
    function resumirIndice(aplicado) {
      var r = M.parseSerieIndice(indTexto.value), ks = Object.keys(r.serie).sort(), h = '';
      if (ks.length) {
        h += '<b>' + ks.length + '</b> mês(es), de ' + ks[0].slice(5) + '/' + ks[0].slice(0, 4) + ' a ' + ks[ks.length - 1].slice(5) + '/' + ks[ks.length - 1].slice(0, 4) + '.';
        var lac = M.lacunasIndice(r.serie);
        if (lac.length) h += ' <span class="calc-ind-alerta">Faltam: ' + esc(lac.slice(0, 12).join(', ')) + (lac.length > 12 ? ' … (+' + (lac.length - 12) + ')' : '') + '.</span>';
      } else h += 'Nenhuma taxa cadastrada.';
      if (r.erros.length) h += '<div class="calc-ind-alerta">' + r.erros.slice(0, 3).map(esc).join('<br>') + (r.erros.length > 3 ? '<br>… e mais ' + (r.erros.length - 3) + ' linha(s).' : '') + '</div>';
      else if (aplicado) h += ' <span class="calc-ind-ok">Índice aplicado.</span>';
      indResumo.innerHTML = h;
    }
    function sincronizarIndices() { // chamado quando a pasta e trocada (desfazer, importar, modelo...)
      if (elInd.classList.contains('hidden') || JSON.stringify(pasta.indices) === indJson) return;
      carregarIndice(indAtual);
    }
    raiz.querySelector('#calc-btn-indices').addEventListener('click', function () {
      var abrir = elInd.classList.contains('hidden');
      elInd.classList.toggle('hidden', !abrir);
      this.setAttribute('aria-expanded', abrir ? 'true' : 'false');
      if (abrir) carregarIndice(indAtual);
    });
    raiz.querySelector('#calc-ind-escritorio').addEventListener('click', function () {
      var cod = indAtual;
      apiGet('/api/painel?acao=calculo_indices_listar').then(function (d) {
        var i = (d.indices || []).filter(function (x) { return x.codigo === cod; })[0];
        if (!i) { window.alert('O escritório ainda não tem a tabela ' + cod + ' cadastrada.'); return; }
        if (!window.confirm('Trocar as taxas ' + cod + ' deste cálculo pela tabela atual do escritório? Os valores do cálculo podem mudar.')) return;
        antesDeMudar();
        pasta.indices[cod] = { fonte: i.fonte || '', consulta: i.consulta || '', serie: i.serie || {} };
        gravarBiblioteca(cod, pasta.indices[cod]);
        salvar(); atualizarValores(); carregarIndice(cod);
      }).catch(function (e) { window.alert('Não consegui consultar o escritório: ' + (e.message || 'sem conexão')); });
    });
    raiz.querySelector('#calc-ind-fechar').addEventListener('click', function () { elInd.classList.add('hidden'); raiz.querySelector('#calc-btn-indices').setAttribute('aria-expanded', 'false'); });
    indSel.addEventListener('change', function () { carregarIndice(indSel.value); });
    indTexto.addEventListener('input', function () { resumirIndice(false); });
    raiz.querySelector('#calc-ind-novo').addEventListener('click', function () {
      var nome = window.prompt('Nome do índice (ex.: IPCA, INPC, TR):', '');
      if (nome == null) return;
      nome = nome.toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 12);
      if (!nome) return;
      if (!pasta.indices[nome]) { antesDeMudar(); pasta.indices[nome] = indiceLimpo(null); salvar(); }
      carregarIndice(nome);
    });
    raiz.querySelector('#calc-ind-aplicar').addEventListener('click', function () {
      var r = M.parseSerieIndice(indTexto.value);
      if (r.erros.length) { resumirIndice(false); window.alert('Corrija as linhas com problema antes de aplicar (veja o aviso abaixo da tabela).'); return; }
      antesDeMudar();
      pasta.indices[indAtual] = { fonte: indFonte.value.trim(), consulta: indConsulta.value.trim(), serie: r.serie };
      gravarBiblioteca(indAtual, pasta.indices[indAtual]);
      salvar(); atualizarValores();
      indJson = JSON.stringify(pasta.indices);
      resumirIndice(true);
      var codigo = indAtual, ind = pasta.indices[indAtual];
      apiPost('/api/painel?acao=calculo_indice_salvar', { codigo: codigo, fonte: ind.fonte, consulta: ind.consulta, serie: ind.serie })
        .then(function () { indResumo.insertAdjacentHTML('beforeend', ' <span class="calc-ind-ok">Salvo para todo o escritório.</span>'); })
        .catch(function (e) { indResumo.insertAdjacentHTML('beforeend', ' <span class="calc-ind-alerta">Não consegui salvar para o escritório (' + esc(e.message || 'sem conexão') + '); vale só neste cálculo.</span>'); });
    });

    // ---------- salvar no sistema / cálculos salvos ----------
    var elSistemaInfo = raiz.querySelector('#calc-sistema-info');
    function retratoServidor() {
      return JSON.stringify({ nome: pasta.nome, abas: pasta.abas, indices: pasta.indices, c: pasta.vinculo.cliente_id, p: pasta.vinculo.processo_id });
    }
    function atualizarInfoSistema() {
      var v = pasta.vinculo, h = '';
      h += '<span class="calc-chip' + (v.cliente_id ? '' : ' vazio') + '">' + (v.cliente_id ? 'Cliente: <b>' + esc(v.cliente_nome || ('#' + v.cliente_id)) + '</b>' : 'Sem cliente') + '</span>';
      h += '<span class="calc-chip' + (v.processo_id ? '' : ' vazio') + '">' + (v.processo_id ? 'Processo: <b>' + esc(v.processo_numero || ('#' + v.processo_id)) + '</b>' : 'Sem processo') + '</span>';
      if (v.id) {
        var sujo = !!v.hash && hashTexto(retratoServidor()) !== v.hash;
        h += '<span class="calc-estado' + (sujo ? ' pendente' : ' ok') + '">' + (sujo ? 'Alterações não salvas no sistema' : 'Salvo no sistema') + ' · versão ' + v.versao + '</span>';
      } else h += '<span class="calc-estado pendente">Ainda não salvo no sistema</span>';
      elSistemaInfo.innerHTML = h;
    }
    function dadosParaSalvar(comoNovo) {
      var maior = 0;
      pasta.abas.forEach(function (a) { Object.keys(a.celulas).forEach(function (k) { if (a.celulas[k].length > maior) maior = a.celulas[k].length; }); });
      if (maior > MAX_TEXTO_CELULA) throw new Error('Há uma célula com mais de ' + MAX_TEXTO_CELULA + ' caracteres. Reduza o texto antes de salvar.');
      var conteudo = { abas: pasta.abas, indices: pasta.indices };
      if (JSON.stringify(conteudo).length > MAX_BYTES_CONTEUDO) throw new Error('O cálculo está grande demais para salvar (limite de 2 MB).');
      var nome = (pasta.nome || '').trim();
      if (!nome) throw new Error('Dê um nome ao cálculo (campo no topo) antes de salvar.');
      var v = pasta.vinculo, corpo = { nome: nome, modelo: v.modelo || null, cliente_id: v.cliente_id, processo_id: v.processo_id, conteudo: conteudo };
      if (v.id && !comoNovo) { corpo.id = v.id; corpo.versao = v.versao; }
      return corpo;
    }
    var salvandoSistema = false;
    function salvarNoSistema(comoNovo) {
      if (salvandoSistema) return;
      if (editando) confirmarEdicao(0, 0);
      var corpo;
      try { corpo = dadosParaSalvar(comoNovo); } catch (e) { window.alert(e.message); return; }
      var botoes = raiz.querySelectorAll('#calc-btn-salvar-sistema, #calc-btn-salvar-novo');
      salvandoSistema = true; botoes.forEach(function (b) { b.disabled = true; });
      apiPost('/api/painel?acao=calculo_salvar', corpo)
        .then(function (d) {
          pasta.vinculo.id = d.id; pasta.vinculo.versao = d.versao;
          pasta.vinculo.hash = hashTexto(retratoServidor()); salvar();
          elSistemaInfo.insertAdjacentHTML('beforeend', ' <span class="calc-ind-ok">Salvo.</span>');
        })
        .catch(function (e) {
          if (e.status === 409) {
            if (window.confirm('Outra pessoa (ou outra aba) alterou este cálculo depois que você o abriu, então não é seguro sobrescrever.\n\nSalvar o seu trabalho como um NOVO cálculo?')) { salvandoSistema = false; botoes.forEach(function (b) { b.disabled = false; }); salvarNoSistema(true); return; }
          } else window.alert('Não foi possível salvar: ' + (e.message || 'erro de conexão') + '\nSeu trabalho continua guardado como rascunho neste navegador.');
        })
        .then(function () { salvandoSistema = false; botoes.forEach(function (b) { b.disabled = false; }); });
    }
    raiz.querySelector('#calc-btn-salvar-sistema').addEventListener('click', function () { salvarNoSistema(false); });
    raiz.querySelector('#calc-btn-salvar-novo').addEventListener('click', function () { salvarNoSistema(true); });

    // lista de calculos salvos
    var elLista = raiz.querySelector('#calc-lista'), elListaCorpo = raiz.querySelector('#calc-lista-corpo'), elListaBusca = raiz.querySelector('#calc-lista-busca');
    var tempoBuscaLista = null, filtroLista = {};
    function carregarLista() {
      elListaCorpo.innerHTML = '<p class="calc-lista-vazio">Carregando…</p>';
      var qs = '';
      if (elListaBusca.value.trim()) qs += '&q=' + encodeURIComponent(elListaBusca.value.trim());
      if (filtroLista.cliente_id) qs += '&cliente_id=' + filtroLista.cliente_id;
      if (filtroLista.processo_id) qs += '&processo_id=' + filtroLista.processo_id;
      apiGet('/api/painel?acao=calculo_listar' + qs).then(function (d) {
        var itens = d.calculos || [];
        if (!itens.length) { elListaCorpo.innerHTML = '<p class="calc-lista-vazio">Nenhum cálculo salvo' + (qs ? ' com esse filtro' : ' ainda') + '.</p>'; return; }
        elListaCorpo.innerHTML = '<table class="calc-lista-tabela"><thead><tr><th>Cálculo</th><th>Cliente</th><th>Processo</th><th>Atualizado</th><th></th></tr></thead><tbody>' +
          itens.map(function (c) {
            return '<tr data-id="' + c.id + '"><td>' + esc(c.nome) + '</td><td>' + esc(c.cliente_nome || '—') + '</td><td>' + esc(c.processo_numero || '—') + '</td>' +
              '<td>' + esc(fmtDataHora(c.atualizado_em)) + (c.atualizado_por ? '<br><small>' + esc(c.atualizado_por) + '</small>' : '') + '</td>' +
              '<td class="calc-lista-acoes"><button type="button" class="btn-secundario" data-abrir="' + c.id + '">Abrir</button>' +
              '<button type="button" class="btn-secundario" data-excluir="' + c.id + '" title="Excluir do sistema">Excluir</button></td></tr>';
          }).join('') + '</tbody></table>';
        elListaCorpo._itens = itens;
      }).catch(function (e) { elListaCorpo.innerHTML = '<p class="calc-ind-alerta">Não foi possível carregar a lista: ' + esc(e.message || 'erro de conexão') + '</p>'; });
    }
    function temAlteracaoPendente() {
      if (pasta.vinculo.id) return !!pasta.vinculo.hash && hashTexto(retratoServidor()) !== pasta.vinculo.hash;
      return pasta.abas.some(function (a) { return Object.keys(a.celulas).length > 0; });
    }
    function abrirSalvo(item) {
      if (temAlteracaoPendente() && !window.confirm('O cálculo atual tem alterações que não foram salvas no sistema e serão perdidas. Abrir mesmo assim?')) return;
      apiGet('/api/painel?acao=calculo_obter&id=' + item.id).then(function (d) {
        var c = d.calculo, cont = c.conteudo || {};
        var novo = normalizar({ nome: c.nome, abas: cont.abas, indices: cont.indices,
          vinculo: { id: c.id, versao: c.versao, cliente_id: c.cliente_id, cliente_nome: item.cliente_nome || '', processo_id: c.processo_id, processo_numero: item.processo_numero || '', modelo: c.modelo || '' } });
        pasta = novo; ativa = 0; desfazer = []; refazer = []; elNome.value = pasta.nome;
        sel = { ac: 1, ar: 1, c1: 1, r1: 1, c2: 1, r2: 1 };
        pasta.vinculo.hash = hashTexto(retratoServidor()); salvar(); desenharAbas(); desenharGrade();
        elLista.classList.add('hidden'); raiz.querySelector('#calc-btn-lista').setAttribute('aria-expanded', 'false');
      }).catch(function (e) { window.alert('Não foi possível abrir o cálculo: ' + (e.message || 'erro de conexão')); });
    }
    elListaCorpo.addEventListener('click', function (e) {
      var ab = e.target.closest ? e.target.closest('[data-abrir]') : null, ex = e.target.closest ? e.target.closest('[data-excluir]') : null;
      var itens = elListaCorpo._itens || [];
      if (ab) { var it = itens.filter(function (x) { return String(x.id) === ab.getAttribute('data-abrir'); })[0]; if (it) abrirSalvo(it); }
      else if (ex) {
        var it2 = itens.filter(function (x) { return String(x.id) === ex.getAttribute('data-excluir'); })[0];
        if (!it2 || !window.confirm('Excluir o cálculo "' + it2.nome + '" do sistema? Esta ação não pode ser desfeita.')) return;
        apiPost('/api/painel?acao=calculo_excluir', { id: it2.id }).then(function () {
          if (pasta.vinculo.id === it2.id) { pasta.vinculo.id = null; pasta.vinculo.versao = null; pasta.vinculo.hash = ''; salvar(); }
          carregarLista();
        }).catch(function (er) { window.alert('Não foi possível excluir: ' + (er.message || 'erro de conexão')); });
      }
    });
    raiz.querySelector('#calc-btn-lista').addEventListener('click', function () {
      var abrir = elLista.classList.contains('hidden');
      elLista.classList.toggle('hidden', !abrir);
      this.setAttribute('aria-expanded', abrir ? 'true' : 'false');
      if (abrir) { filtroLista = {}; carregarLista(); }
    });
    raiz.querySelector('#calc-lista-fechar').addEventListener('click', function () { elLista.classList.add('hidden'); raiz.querySelector('#calc-btn-lista').setAttribute('aria-expanded', 'false'); });
    elListaBusca.addEventListener('input', function () { clearTimeout(tempoBuscaLista); tempoBuscaLista = setTimeout(carregarLista, 300); });

    // escolher cliente / processo
    var modalVinc = null;
    function fecharModalVinc() { if (modalVinc) { modalVinc.remove(); modalVinc = null; } }
    raiz.querySelector('#calc-btn-vincular').addEventListener('click', function () {
      if (editando) confirmarEdicao(0, 0);
      fecharModalVinc();
      var escolha = { cliente_id: pasta.vinculo.cliente_id, cliente_nome: pasta.vinculo.cliente_nome, processo_id: pasta.vinculo.processo_id, processo_numero: pasta.vinculo.processo_numero };
      modalVinc = document.createElement('div');
      modalVinc.className = 'calc-modal';
      modalVinc.innerHTML = '<div class="calc-modal-caixa" role="dialog" aria-modal="true" aria-labelledby="calc-v-titulo">' +
        '<h3 id="calc-v-titulo">A quem pertence este cálculo?</h3>' +
        '<p class="calc-modal-dica">Pode escolher o cliente, o processo ou os dois (os dois é o ideal). Nenhum é obrigatório.</p>' +
        '<label class="calc-v-campo">Cliente <input type="text" id="calc-v-cliente" maxlength="100" placeholder="Digite parte do nome" autocomplete="off"></label>' +
        '<div class="calc-v-resultados" id="calc-v-clientes"></div>' +
        '<label class="calc-v-campo">Processo <input type="text" id="calc-v-processo" maxlength="100" placeholder="Digite parte do número" autocomplete="off"></label>' +
        '<div class="calc-v-resultados" id="calc-v-processos"></div>' +
        '<div class="calc-v-escolha" id="calc-v-escolha"></div>' +
        '<div class="calc-modal-acoes"><button type="button" class="btn-secundario" id="calc-v-limpar">Limpar</button>' +
          '<button type="button" class="btn-secundario calc-ind-aplicar" id="calc-v-ok">Aplicar</button><button type="button" class="btn-secundario" id="calc-v-cancelar">Cancelar</button></div></div>';
      raiz.appendChild(modalVinc);
      var inC = modalVinc.querySelector('#calc-v-cliente'), inP = modalVinc.querySelector('#calc-v-processo');
      var resC = modalVinc.querySelector('#calc-v-clientes'), resP = modalVinc.querySelector('#calc-v-processos'), elEsc = modalVinc.querySelector('#calc-v-escolha');
      var tC = null, tP = null;
      function desenharEscolha() {
        elEsc.innerHTML = '<span class="calc-chip' + (escolha.cliente_id ? '' : ' vazio') + '">' + (escolha.cliente_id ? 'Cliente: <b>' + esc(escolha.cliente_nome) + '</b>' : 'Sem cliente') + '</span>' +
          '<span class="calc-chip' + (escolha.processo_id ? '' : ' vazio') + '">' + (escolha.processo_id ? 'Processo: <b>' + esc(escolha.processo_numero) + '</b>' : 'Sem processo') + '</span>';
      }
      function pintar(el, itens, rotulo, tipo) {
        el.innerHTML = itens.length ? itens.map(function (x) { return '<button type="button" class="calc-v-item" data-tipo="' + tipo + '" data-id="' + x.id + '">' + esc(rotulo(x)) + '</button>'; }).join('') : '<span class="calc-lista-vazio">Nada encontrado.</span>';
        el._itens = itens;
      }
      function buscar(tipo) {
        var qs = '&q=' + encodeURIComponent((tipo === 'c' ? inC : inP).value.trim());
        if (tipo === 'p' && escolha.cliente_id) qs += '&cliente_id=' + escolha.cliente_id;
        apiGet('/api/painel?acao=calculo_vinculos' + qs).then(function (d) {
          if (tipo === 'c') pintar(resC, d.clientes || [], function (x) { return x.nome; }, 'c');
          else pintar(resP, d.processos || [], function (x) { return x.numero_cnj + (x.cliente_nome ? ' — ' + x.cliente_nome : ''); }, 'p');
        }).catch(function (e) { (tipo === 'c' ? resC : resP).innerHTML = '<span class="calc-ind-alerta">' + esc(e.message || 'erro de conexão') + '</span>'; });
      }
      inC.addEventListener('input', function () { clearTimeout(tC); tC = setTimeout(function () { buscar('c'); }, 300); });
      inP.addEventListener('input', function () { clearTimeout(tP); tP = setTimeout(function () { buscar('p'); }, 300); });
      modalVinc.addEventListener('click', function (e) {
        var b = e.target.closest ? e.target.closest('.calc-v-item') : null;
        if (!b) return;
        var lista = (b.getAttribute('data-tipo') === 'c' ? resC : resP)._itens || [];
        var x = lista.filter(function (i) { return String(i.id) === b.getAttribute('data-id'); })[0];
        if (!x) return;
        if (b.getAttribute('data-tipo') === 'c') { escolha.cliente_id = x.id; escolha.cliente_nome = x.nome; resC.innerHTML = ''; inC.value = x.nome; buscar('p'); }
        else { escolha.processo_id = x.id; escolha.processo_numero = x.numero_cnj; resP.innerHTML = ''; inP.value = x.numero_cnj; }
        desenharEscolha();
      });
      modalVinc.addEventListener('mousedown', function (e) { if (e.target === modalVinc) fecharModalVinc(); });
      modalVinc.querySelector('#calc-v-cancelar').addEventListener('click', fecharModalVinc);
      modalVinc.querySelector('#calc-v-limpar').addEventListener('click', function () { escolha = { cliente_id: null, cliente_nome: '', processo_id: null, processo_numero: '' }; inC.value = ''; inP.value = ''; resC.innerHTML = ''; resP.innerHTML = ''; desenharEscolha(); });
      modalVinc.querySelector('#calc-v-ok').addEventListener('click', function () {
        antesDeMudar();
        pasta.vinculo.cliente_id = escolha.cliente_id; pasta.vinculo.cliente_nome = escolha.cliente_nome;
        pasta.vinculo.processo_id = escolha.processo_id; pasta.vinculo.processo_numero = escolha.processo_numero;
        salvar(); fecharModalVinc();
      });
      desenharEscolha(); buscar('c'); buscar('p'); inC.focus();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modalVinc) fecharModalVinc(); });

    // indices do escritorio: baixa as tabelas compartilhadas e mantem a copia local em dia
    function carregarIndicesEscritorio() {
      apiGet('/api/painel?acao=calculo_indices_listar').then(function (d) {
        (d.indices || []).forEach(function (i) { gravarBiblioteca(i.codigo, { fonte: i.fonte || '', consulta: i.consulta || '', serie: i.serie || {} }); });
        var antes = JSON.stringify(pasta.indices);
        pasta = normalizar(pasta); // so preenche indices que estao vazios neste calculo
        if (JSON.stringify(pasta.indices) !== antes) { salvar(); atualizarValores(); if (typeof sincronizarIndices === 'function') sincronizarIndices(); }
      }).catch(function () { /* sem servidor: segue com a copia local */ });
    }

    // ---------- topo ----------
    elNome.addEventListener('change', function () { antesDeMudar(); pasta.nome = elNome.value.trim().slice(0, 120); salvar(); });
    raiz.querySelector('#calc-btn-desfazer').addEventListener('click', fazerDesfazer);
    raiz.querySelector('#calc-btn-refazer').addEventListener('click', fazerRefazer);
    raiz.querySelector('#calc-btn-novo').addEventListener('click', function () {
      if (!window.confirm('Começar um cálculo novo? O rascunho atual será descartado (exporte um arquivo antes, se quiser guardá-lo).')) return;
      pasta = normalizar(pastaVazia()); ativa = 0; desfazer = []; refazer = []; elNome.value = ''; sel = { ac: 1, ar: 1, c1: 1, r1: 1, c2: 1, r2: 1 };
      salvar(); desenharAbas(); desenharGrade();
    });
    function nomeArquivo() {
      return (pasta.nome || 'calculo').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'calculo';
    }
    function baixar(blob, nome) {
      var url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = nome; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 800);
    }
    raiz.querySelector('#calc-btn-exportar').addEventListener('click', function () {
      if (editando) confirmarEdicao(0, 0);
      baixar(new Blob([JSON.stringify(pasta, null, 1)], { type: 'application/json' }), nomeArquivo() + '.calculo.json');
    });

    // ---------- Excel e PDF ----------
    function carregarExcelJS() {
      return new Promise(function (ok, erro) {
        if (window.ExcelJS) return ok(window.ExcelJS);
        var sc = document.createElement('script');
        sc.src = URL_EXCELJS; sc.integrity = SRI_EXCELJS; sc.crossOrigin = 'anonymous';
        sc.onload = function () { window.ExcelJS ? ok(window.ExcelJS) : erro(new Error('ExcelJS')); };
        sc.onerror = function () { erro(new Error('rede')); };
        document.head.appendChild(sc);
      });
    }
    var btnExcel = raiz.querySelector('#calc-btn-excel');
    btnExcel.addEventListener('click', function () {
      if (editando) confirmarEdicao(0, 0);
      var rotulo = btnExcel.textContent;
      btnExcel.disabled = true; btnExcel.textContent = 'Gerando…';
      carregarExcelJS()
        .then(function (E) { return window.CalculosExportar.montarExcel(pasta, E).xlsx.writeBuffer(); })
        .then(function (buf) { baixar(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), nomeArquivo() + '.xlsx'); })
        .catch(function () { window.alert('Não consegui gerar o Excel agora (o componente precisa de internet para carregar). Tente de novo.'); })
        .then(function () { btnExcel.disabled = false; btnExcel.textContent = rotulo; });
    });

    var modalPdf = null;
    function fecharModalPdf() { if (modalPdf) { modalPdf.remove(); modalPdf = null; } }
    function imprimir(indices) {
      var html = window.CalculosExportar.htmlImpressao(pasta, { abas: indices });
      var fr = document.createElement('iframe');
      fr.setAttribute('aria-hidden', 'true'); fr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
      document.body.appendChild(fr);
      var d = fr.contentWindow.document;
      d.open(); d.write(html); d.close();
      setTimeout(function () { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) { window.alert('Não consegui abrir a impressão neste navegador.'); } }, 300);
      setTimeout(function () { fr.remove(); }, 120000);
    }
    raiz.querySelector('#calc-btn-pdf').addEventListener('click', function () {
      if (editando) confirmarEdicao(0, 0);
      fecharModalPdf();
      modalPdf = document.createElement('div');
      modalPdf.className = 'calc-modal';
      modalPdf.innerHTML = '<div class="calc-modal-caixa" role="dialog" aria-modal="true" aria-labelledby="calc-modal-titulo">' +
        '<h3 id="calc-modal-titulo">Imprimir / salvar em PDF</h3>' +
        '<p>Escolha as abas que entram no documento:</p>' +
        '<div class="calc-modal-lista">' + pasta.abas.map(function (a, i) {
          return '<label><input type="checkbox" data-i="' + i + '"' + (SEM_PDF_POR_PADRAO.test(a.nome) ? '' : ' checked') + '> ' + esc(a.nome) + '</label>';
        }).join('') + '</div>' +
        '<p class="calc-modal-dica">Na janela de impressão, escolha <b>Salvar como PDF</b>. Formato: A4, Times New Roman 12, espaçamento 1,5; abas largas saem em paisagem.</p>' +
        '<div class="calc-modal-acoes"><button type="button" class="btn-secundario calc-ind-aplicar" id="calc-pdf-ok">Gerar</button><button type="button" class="btn-secundario" id="calc-pdf-cancelar">Cancelar</button></div></div>';
      raiz.appendChild(modalPdf);
      modalPdf.addEventListener('mousedown', function (e) { if (e.target === modalPdf) fecharModalPdf(); });
      modalPdf.querySelector('#calc-pdf-cancelar').addEventListener('click', fecharModalPdf);
      modalPdf.querySelector('#calc-pdf-ok').addEventListener('click', function () {
        var escolhidas = Array.prototype.map.call(modalPdf.querySelectorAll('input[type="checkbox"]:checked'), function (c) { return +c.getAttribute('data-i'); });
        if (!escolhidas.length) { window.alert('Marque ao menos uma aba.'); return; }
        fecharModalPdf(); imprimir(escolhidas);
      });
      var primeiro = modalPdf.querySelector('input[type="checkbox"]'); if (primeiro) primeiro.focus();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modalPdf) fecharModalPdf(); });

    raiz.querySelector('#calc-modelo').addEventListener('change', function (e) {
      var sel2 = e.target, id = sel2.value;
      sel2.value = '';
      if (!id || !window.CalculosModelos) return;
      if (editando) confirmarEdicao(0, 0);
      var temConteudo = pasta.abas.some(function (a) { return Object.keys(a.celulas).length > 0; });
      if (temConteudo && !window.confirm('Abrir o modelo vai substituir o rascunho atual (exporte um arquivo antes, se quiser guardá-lo). Continuar?')) return;
      var novo = window.CalculosModelos.criar(id);
      if (!novo) return;
      antesDeMudar(); pasta = normalizar(novo); pasta.vinculo.modelo = id; ativa = 0; elNome.value = pasta.nome;
      sel = { ac: 1, ar: 1, c1: 1, r1: 1, c2: 1, r2: 1 };
      salvar(); desenharAbas(); desenharGrade();
    });
    var elArquivo = raiz.querySelector('#calc-arquivo');
    raiz.querySelector('#calc-btn-importar').addEventListener('click', function () { elArquivo.click(); });
    elArquivo.addEventListener('change', function () {
      var f = elArquivo.files && elArquivo.files[0];
      if (!f) return;
      var leitor = new FileReader();
      leitor.onload = function () {
        try {
          var p = JSON.parse(String(leitor.result));
          if (!pastaValida(p)) throw new Error('formato');
          if (!window.confirm('Importar "' + (p.nome || f.name) + '"? O rascunho atual será substituído.')) return;
          antesDeMudar(); pasta = normalizar(p); pasta.vinculo = vinculoVazio(); ativa = 0; elNome.value = pasta.nome; // ids do arquivo nao valem aqui
          sel = { ac: 1, ar: 1, c1: 1, r1: 1, c2: 1, r2: 1 }; salvar(); desenharAbas(); desenharGrade();
        } catch (err) { window.alert('Não consegui ler este arquivo. Use um arquivo exportado por esta tela (.calculo.json).'); }
        elArquivo.value = '';
      };
      leitor.readAsText(f);
    });

    elNome.value = pasta.nome === 'Novo cálculo' ? '' : pasta.nome;
    desenharAbas();
    desenharGrade();
    atualizarInfoSistema();
    carregarIndicesEscritorio();
  }

  window.CalculosUI = { montar: montar };
})();
