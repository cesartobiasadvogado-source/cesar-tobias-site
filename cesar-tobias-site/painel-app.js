(function () {
  var gate = document.getElementById('gate');
  var shell = document.getElementById('shell');
  var conteudo = document.getElementById('conteudo');
  var evolucaoMensalAtual = [];
  var filtroGraficoAtual = '6';
  var dadosPainelAtual = null;
  var itensModalDrillAtual = [];

  var ROTULO_STATUS_DRILL = {
    'EmAberto': 'A Receber — parcelas em aberto',
    'Paga': 'Parcelas pagas',
    'Vencida': 'Parcelas vencidas',
    'Vence hoje': 'Parcelas vencendo hoje',
    'A vencer': 'Parcelas a vencer',
    'Sem data de vencimento': 'Parcelas sem data de vencimento',
  };

  function renderModalDrillCorpo(itens) {
    var corpo = document.getElementById('modal-drill-corpo');
    if (!itens.length) {
      corpo.innerHTML = '<div class="empty-state"><div class="msg">Nenhum lançamento encontrado.</div></div>';
      return;
    }
    corpo.innerHTML = '<div class="table-scroll"><table style="min-width:420px;">' +
      '<thead><tr><th>Cliente</th><th>Vencimento</th><th style="text-align:right">Saldo</th><th></th></tr></thead><tbody>' +
      itens.map(function (i) {
        var classeChip = i.situacao === 'Vencida' ? 'crit' : (i.situacao === 'Paga' ? 'good' : (i.situacao === 'Vence hoje' ? 'warn' : 'neutral'));
        return '<tr><td>' + esc(i.nome) + '</td><td>' + esc(i.vencimento || '—') + '</td>' +
          '<td class="num">R$ ' + fmtMoeda(i.saldo) + '</td>' +
          '<td><span class="chip ' + classeChip + '">' + esc(i.situacao) + (i.dias_atraso > 0 ? ' · ' + i.dias_atraso + 'd' : '') + '</span></td></tr>';
      }).join('') +
      '</tbody></table></div>';
  }

  function abrirModalDrill(status, ancoraSecao) {
    var overlay = document.getElementById('modal-drill');
    if (ancoraSecao) {
      overlay.classList.add('hidden');
      var alvo = document.getElementById(ancoraSecao);
      if (alvo) alvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    var titulo = document.getElementById('modal-drill-titulo');
    var busca = document.getElementById('modal-drill-busca-input');
    titulo.textContent = ROTULO_STATUS_DRILL[status] || status;
    busca.value = '';
    document.getElementById('modal-drill-corpo').innerHTML = '<div class="empty-state"><div class="msg">Carregando...</div></div>';
    overlay.classList.remove('hidden');
    apiPostJson('/api/painel?acao=executar', { tipo: 'listar_parcelas_status', status: status })
      .then(function (r) {
        itensModalDrillAtual = r.itens || [];
        renderModalDrillCorpo(itensModalDrillAtual);
      })
      .catch(function () {
        document.getElementById('modal-drill-corpo').innerHTML = '<div class="aviso-tenant">Não foi possível carregar agora. Tente de novo.</div>';
      });
  }

  var TITULO_TOPBAR_POR_PAGINA = {
    inicio: 'Início', financeiro: 'Financeiro', pje: 'Processual (PJe)', clientes: 'Clientes', processos: 'Processos',
    importar_oab: 'Importar pela OAB', criar_processo: 'Criar Processo', novo_cliente: 'Novo Cliente',
    agenda: 'Agenda', automacoes: 'Automações', padrao_operacional: 'Padrão Operacional',
    audiencias: 'Audiências', admin: 'Conexões do escritório', configuracoes: 'Configurações do Escritório',
  };

  function wireMenuMobile() {
    var titulo = document.getElementById('topbar-mobile-titulo');
    if (titulo) titulo.textContent = TITULO_TOPBAR_POR_PAGINA[PAGINA_ATUAL] || 'Painel';

    var sidebar = document.getElementById('sidebar');
    var backdrop = document.getElementById('sidebar-backdrop');
    var btnAbrir = document.getElementById('btn-menu-mobile');
    var btnFechar = document.getElementById('btn-fechar-menu-mobile');
    if (!sidebar || !backdrop || !btnAbrir || !btnFechar) return;

    function abrirMenu() {
      sidebar.classList.add('aberta');
      backdrop.classList.add('visivel');
      btnAbrir.setAttribute('aria-expanded', 'true');
    }
    function fecharMenu() {
      sidebar.classList.remove('aberta');
      backdrop.classList.remove('visivel');
      btnAbrir.setAttribute('aria-expanded', 'false');
    }
    btnAbrir.addEventListener('click', abrirMenu);
    btnFechar.addEventListener('click', fecharMenu);
    backdrop.addEventListener('click', fecharMenu);
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') fecharMenu();
    });
  }

  function wireModalDrill() {
    var overlay = document.getElementById('modal-drill');
    var fechar = document.getElementById('modal-drill-fechar');
    var busca = document.getElementById('modal-drill-busca-input');
    fechar.addEventListener('click', function () { overlay.classList.add('hidden'); });
    overlay.addEventListener('click', function (ev) { if (ev.target === overlay) overlay.classList.add('hidden'); });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') overlay.classList.add('hidden');
    });
    busca.addEventListener('input', function () {
      var termo = busca.value.trim().toLowerCase();
      var filtrados = !termo ? itensModalDrillAtual : itensModalDrillAtual.filter(function (i) {
        return i.nome.toLowerCase().indexOf(termo) !== -1;
      });
      renderModalDrillCorpo(filtrados);
    });
    document.addEventListener('click', function (ev) {
      var alvo = ev.target.closest('[data-drill-status]');
      if (!alvo) return;
      abrirModalDrill(alvo.getAttribute('data-drill-status'), alvo.getAttribute('data-drill-ancora'));
    });
  }
  var usuarioInput = document.getElementById('usuario-input');
  var senhaInput = document.getElementById('senha-input');
  var btnEntrar = document.getElementById('btn-entrar');
  var gateError = document.getElementById('gate-error');
  var tenantIdInput = document.getElementById('tenant-id-input');
  var toggleEscritorioParceiro = document.getElementById('toggle-escritorio-parceiro');

  var tenantIdSalvo = localStorage.getItem('cadastro_tenant_id');
  if (tenantIdSalvo) {
    tenantIdInput.value = tenantIdSalvo;
    tenantIdInput.style.display = '';
    toggleEscritorioParceiro.style.display = 'none';
  }
  toggleEscritorioParceiro.addEventListener('click', function () {
    tenantIdInput.style.display = '';
    toggleEscritorioParceiro.style.display = 'none';
    tenantIdInput.focus();
  });

  var usuarioLembrado = localStorage.getItem('painel_usuario_lembrado');
  if (usuarioLembrado && document.getElementById('gate-lembrar')) {
    usuarioInput.value = usuarioLembrado;
    document.getElementById('gate-lembrar').checked = true;
    senhaInput.focus();
  }

  function _sistemaPrefereDark() {
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  function aplicarTema(tema) {
    if (tema !== 'light' && tema !== 'dark' && tema !== 'system') tema = 'light';
    if (tema === 'system') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', tema);
    }
    localStorage.setItem('painel_tema', tema);

    var temaEfetivo = tema === 'system' ? (_sistemaPrefereDark() ? 'dark' : 'light') : tema;
    var iconeClaro = document.getElementById('icone-tema-claro');
    var iconeEscuro = document.getElementById('icone-tema-escuro');
    if (iconeClaro) iconeClaro.classList.toggle('hidden', temaEfetivo === 'dark');
    if (iconeEscuro) iconeEscuro.classList.toggle('hidden', temaEfetivo !== 'dark');
    var textoTema = document.getElementById('texto-tema');
    if (textoTema) textoTema.textContent = temaEfetivo === 'dark' ? 'Modo claro' : 'Modo escuro';

    document.querySelectorAll('[data-hdr-tema]').forEach(function (btn) {
      btn.classList.toggle('ativo', btn.getAttribute('data-hdr-tema') === tema);
    });
  }

  aplicarTema(localStorage.getItem('painel_tema') || 'light');

  document.getElementById('btn-tema').addEventListener('click', function () {
    var atual = localStorage.getItem('painel_tema') || 'light';
    var efetivo = atual === 'system' ? (_sistemaPrefereDark() ? 'dark' : 'light') : atual;
    aplicarTema(efetivo === 'dark' ? 'light' : 'dark');
  });

  document.querySelectorAll('[data-hdr-tema]').forEach(function (btn) {
    btn.addEventListener('click', function () { aplicarTema(btn.getAttribute('data-hdr-tema')); });
  });

  function sair() {
    sessionStorage.removeItem('painel_token');
    document.documentElement.removeAttribute('data-tem-sessao');
    shell.classList.add('hidden');
    gate.classList.remove('hidden');
    usuarioInput.value = '';
    senhaInput.value = '';
    gateError.textContent = '';
  }
  document.getElementById('btn-sair').addEventListener('click', sair);
  var btnHdrSair = document.getElementById('hdr-btn-sair');
  if (btnHdrSair) btnHdrSair.addEventListener('click', sair);

  // Dropdowns do topo (botao "+" e menu do usuario) -- compartilhados em todas as paginas.
  (function wireDropdownsTopo() {
    var pares = [
      { btn: document.getElementById('hdr-btn-add'), menu: document.getElementById('hdr-menu-add') },
      { btn: document.getElementById('hdr-btn-perfil'), menu: document.getElementById('hdr-menu-perfil') },
    ];
    function fecharTodos(exceto) {
      pares.forEach(function (p) {
        if (p.menu && p.menu !== exceto) p.menu.classList.add('hidden');
        if (p.btn) p.btn.setAttribute('aria-expanded', 'false');
      });
    }
    pares.forEach(function (p) {
      if (!p.btn || !p.menu) return;
      p.btn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        var vaiAbrir = p.menu.classList.contains('hidden');
        fecharTodos();
        if (vaiAbrir) {
          p.menu.classList.remove('hidden');
          p.btn.setAttribute('aria-expanded', 'true');
        }
      });
    });
    document.addEventListener('click', function () { fecharTodos(); });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') fecharTodos(); });
  })();

  function misturarComBranco(hex, fator) {
    var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    var mix = function (c) { return Math.round(c + (255 - c) * fator); };
    return '#' + [mix(r), mix(g), mix(b)].map(function (v) { return v.toString(16).padStart(2, '0'); }).join('');
  }

  function corComputadaParaHex(nomeVar) {
    var valor = getComputedStyle(document.documentElement).getPropertyValue(nomeVar).trim();
    if (valor.charAt(0) === '#') return valor;
    var numeros = valor.match(/\d+/g);
    if (!numeros) return '#2c5ce0';
    return '#' + numeros.slice(0, 3).map(function (n) { return (+n).toString(16).padStart(2, '0'); }).join('');
  }

  function aplicarCorAccent(hex) {
    document.documentElement.style.setProperty('--accent', hex);
    document.documentElement.style.setProperty('--accent-soft', misturarComBranco(hex, 0.88));
    document.documentElement.style.setProperty('--sidebar-accent', hex);
  }

  var inputCorAccent = document.getElementById('input-cor-accent');
  inputCorAccent.value = localStorage.getItem('painel_cor_accent') || corComputadaParaHex('--accent');
  inputCorAccent.addEventListener('input', function () {
    aplicarCorAccent(inputCorAccent.value);
    localStorage.setItem('painel_cor_accent', inputCorAccent.value);
  });

  document.getElementById('btn-cor-reset').addEventListener('click', function () {
    localStorage.removeItem('painel_cor_accent');
    document.documentElement.style.removeProperty('--accent');
    document.documentElement.style.removeProperty('--accent-soft');
    document.documentElement.style.removeProperty('--sidebar-accent');
    inputCorAccent.value = corComputadaParaHex('--accent');
  });

  var inputCorFundo = document.getElementById('input-cor-fundo');
  inputCorFundo.value = localStorage.getItem('painel_cor_fundo') || corComputadaParaHex('--sidebar-bg');
  inputCorFundo.addEventListener('input', function () {
    document.documentElement.style.setProperty('--sidebar-bg', inputCorFundo.value);
    localStorage.setItem('painel_cor_fundo', inputCorFundo.value);
  });

  document.getElementById('btn-cor-fundo-reset').addEventListener('click', function () {
    localStorage.removeItem('painel_cor_fundo');
    document.documentElement.style.removeProperty('--sidebar-bg');
    inputCorFundo.value = corComputadaParaHex('--sidebar-bg');
  });

  var inputCorPagina = document.getElementById('input-cor-pagina');
  inputCorPagina.value = localStorage.getItem('painel_cor_pagina') || corComputadaParaHex('--bg');
  inputCorPagina.addEventListener('input', function () {
    document.documentElement.style.setProperty('--bg', inputCorPagina.value);
    localStorage.setItem('painel_cor_pagina', inputCorPagina.value);
  });

  document.getElementById('btn-cor-pagina-reset').addEventListener('click', function () {
    localStorage.removeItem('painel_cor_pagina');
    document.documentElement.style.removeProperty('--bg');
    inputCorPagina.value = corComputadaParaHex('--bg');
  });

  function fmtMoeda(v) {
    return (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  var ESC_MAPA = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(valor) {
    return String(valor === null || valor === undefined ? '' : valor).replace(/[&<>"']/g, function (c) {
      return ESC_MAPA[c];
    });
  }

  function linkCliente(nome) {
    return '<a class="link-original" href="painel-clientes.html?cliente=' + encodeURIComponent(nome) + '">' + esc(nome) + '</a>';
  }

  function normalizarBusca(valor) {
    return String(valor || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  function apiGet(url) {
    var token = sessionStorage.getItem('painel_token');
    return fetch(url, { cache: 'no-store', headers: { 'Authorization': 'Bearer ' + token } });
  }

  function apiPost(url, corpo) {
    var token = sessionStorage.getItem('painel_token');
    return fetch(url, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo || {})
    });
  }

  // fetch() so rejeita a Promise em falha de rede -- uma resposta HTTP de erro (500, 401 etc)
  // ainda cai no .then() de sucesso normalmente. Isso fazia telas de carregamento tratarem um
  // erro real do servidor como "lista vazia" (ex: planilha deu erro 500 -> aparecia "nenhum
  // processo encontrado", como se o cliente simplesmente nao tivesse processo nenhum, quando na
  // verdade a chamada tinha falhado). Esses dois helpers viram Promise rejeitada de verdade
  // quando a resposta nao e ok, pra quem ja tem um .catch() passar a mostrar erro de verdade em
  // vez de "vazio" -- sem precisar mudar cada tela que carrega alguma lista.
  function respostaJsonOuErro(r) {
    return r.json().catch(function () { return {}; }).then(function (dados) {
      if (!r.ok) {
        var erro = new Error((dados && dados.erro) || ('Erro ' + r.status));
        erro.status = r.status;
        throw erro;
      }
      return dados;
    });
  }

  function apiGetJson(url) {
    return apiGet(url).then(respostaJsonOuErro);
  }

  function apiPostJson(url, corpo) {
    return apiPost(url, corpo).then(respostaJsonOuErro);
  }

  function valorOculto(chave) {
    return localStorage.getItem('painel_oculto_' + chave) === '1';
  }

  function renderCardValor(chave, valor, rotulo, sub, drillStatus, drillAncora) {
    var oculto = valorOculto(chave);
    var textoValor = oculto ? '••••••' : fmtMoeda(valor);
    var linkDrill = (drillStatus || drillAncora)
      ? '<button type="button" class="card-drill-link" data-drill-status="' + esc(drillStatus || '') + '"' +
          (drillAncora ? ' data-drill-ancora="' + esc(drillAncora) + '"' : '') + '>Ver lançamentos →</button>'
      : '';
    return '<div class="stat-card">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">' +
        '<div class="stat-value money">' + textoValor + '</div>' +
        '<button class="btn-olho" data-olho="' + chave + '" title="' + (oculto ? 'Mostrar valor' : 'Ocultar valor') + '" aria-label="' + (oculto ? 'Mostrar valor' : 'Ocultar valor') + '" aria-pressed="' + (oculto ? 'true' : 'false') + '">' +
          (oculto ? '🙈' : '👁') +
        '</button>' +
      '</div>' +
      '<div class="stat-label">' + rotulo + '</div>' +
      '<div class="stat-sub">' + sub + '</div>' +
      linkDrill +
    '</div>';
  }

  var NOMES_MES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  var NOMES_MES_EXTENSO = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  function nomeMesAbrev(mesStr) {
    var partes = mesStr.split('-');
    return NOMES_MES_ABREV[parseInt(partes[1], 10) - 1] + '/' + partes[0].slice(2);
  }

  function nomeMesExtenso(mesStr) {
    var partes = mesStr.split('-');
    return NOMES_MES_EXTENSO[parseInt(partes[1], 10) - 1] + '/' + partes[0];
  }

  function fmtMoedaCompacta(v) {
    try {
      return new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(v || 0);
    } catch (e) {
      return fmtMoeda(v);
    }
  }

  function filtrarEvolucao(evolucao, filtro) {
    if (filtro === 'todos') return evolucao;
    if (filtro === 'mes_atual') {
      var mesAtual = new Date().toISOString().slice(0, 7);
      return evolucao.filter(function (m) { return m.mes === mesAtual; });
    }
    if (filtro === 'mes_anterior') {
      var dAnt = new Date(); dAnt.setDate(1); dAnt.setMonth(dAnt.getMonth() - 1);
      var mesAnterior = dAnt.toISOString().slice(0, 7);
      return evolucao.filter(function (m) { return m.mes === mesAnterior; });
    }
    if (filtro === 'ano_atual') {
      var anoAtual = String(new Date().getFullYear());
      return evolucao.filter(function (m) { return m.mes.slice(0, 4) === anoAtual; });
    }
    if (filtro === 'ano_anterior') {
      var anoAnterior = String(new Date().getFullYear() - 1);
      return evolucao.filter(function (m) { return m.mes.slice(0, 4) === anoAnterior; });
    }
    return evolucao.slice(-parseInt(filtro, 10));
  }

  function somaRecebido(evolucaoFiltrada) {
    return evolucaoFiltrada.reduce(function (acc, m) { return acc + m.recebido; }, 0);
  }

  var ROTULOS_FILTRO_PERIODO = {
    'todos': 'em todo o período', 'mes_atual': 'este mês', 'mes_anterior': 'no mês anterior',
    'ano_atual': 'este ano', 'ano_anterior': 'no ano anterior',
  };

  function rotuloFiltro(filtro) {
    return ROTULOS_FILTRO_PERIODO[filtro] || ('nos últimos ' + filtro + ' meses');
  }

  function reduzMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function animarContagem(el, valorFinal) {
    if (!el) return;
    if (reduzMotion()) { el.textContent = 'R$ ' + fmtMoeda(valorFinal); return; }
    var duracao = 900;
    var inicio = null;
    function passo(ts) {
      if (inicio === null) inicio = ts;
      var progresso = Math.min((ts - inicio) / duracao, 1);
      var facilitado = 1 - Math.pow(1 - progresso, 3); // ease-out cubic
      el.textContent = 'R$ ' + fmtMoeda(valorFinal * facilitado);
      if (progresso < 1) requestAnimationFrame(passo);
    }
    requestAnimationFrame(passo);
  }

  var STATUS_PARCELA_CONFIG = [
    { chave: 'Vencida', rotulo: 'Vencidas', cor: '#f0616c' },
    { chave: 'Vence hoje', rotulo: 'Vencendo hoje', cor: '#f0a94e' },
    { chave: 'A vencer', rotulo: 'A vencer', cor: '#6c8cf0' },
    { chave: 'Paga', rotulo: 'Pagas', cor: '#5fd68f' },
    { chave: 'Sem data de vencimento', rotulo: 'Sem data de vencimento', cor: '#4d5878' },
  ];

  function renderStatusParcelasDonut(statusObj) {
    var itens = STATUS_PARCELA_CONFIG.map(function (cfg) {
      return { chave: cfg.chave, rotulo: cfg.rotulo, cor: cfg.cor, qtd: statusObj[cfg.chave] || 0 };
    });
    var total = itens.reduce(function (acc, i) { return acc + i.qtd; }, 0);

    if (total === 0) {
      return '<div class="status-card"><div class="status-card-titulo">Status das Parcelas</div>' +
        '<div class="fluxo-vazio" style="padding:20px 0;">Nenhuma parcela cadastrada ainda.</div></div>';
    }

    var raio = 70, centro = 84, circunferencia = 2 * Math.PI * raio;
    var acumulado = 0;
    var arcos = itens.filter(function (i) { return i.qtd > 0; }).map(function (i) {
      var fracao = i.qtd / total;
      var comprimento = fracao * circunferencia;
      var offset = circunferencia - acumulado;
      acumulado += comprimento;
      return '<circle cx="' + centro + '" cy="' + centro + '" r="' + raio + '" fill="none" stroke="' + i.cor + '" ' +
        'stroke-width="22" stroke-dasharray="' + comprimento + ' ' + (circunferencia - comprimento) + '" ' +
        'stroke-dashoffset="' + offset + '" transform="rotate(-90 ' + centro + ' ' + centro + ')" />';
    }).join('');

    var legenda = itens.filter(function (i) { return i.qtd > 0; }).map(function (i) {
      var pct = Math.round((i.qtd / total) * 100);
      return '<div class="status-legenda-item" data-drill-status="' + esc(i.chave) + '" style="cursor:pointer;" title="Clique pra ver os lançamentos">' +
        '<span class="status-legenda-swatch" style="background:' + i.cor + ';"></span>' +
        i.rotulo + '<span class="status-legenda-pct">' + pct + '%</span><b>' + i.qtd + '</b>' +
      '</div>';
    }).join('');

    return '<div class="status-card">' +
      '<div class="status-card-titulo">Status das Parcelas</div>' +
      '<div class="status-donut-wrap">' +
        '<svg width="168" height="168" viewBox="0 0 168 168">' + arcos + '</svg>' +
        '<div class="status-donut-total"><div class="num">' + total + '</div><div class="lbl">parcelas</div></div>' +
      '</div>' +
      '<div class="status-legenda">' + legenda + '</div>' +
    '</div>';
  }

  function desenharFluxoCaixa(evolucaoFiltrada) {
    var wrap = document.getElementById('grafico-financeiro-svg');
    if (!wrap) return;
    var tooltipHtml = '<div class="fluxo-tooltip" id="grafico-tooltip"></div>';
    var totalRecebido = somaRecebido(evolucaoFiltrada);
    var totalAReceber = evolucaoFiltrada.reduce(function (acc, m) { return acc + m.a_receber; }, 0);
    if (!evolucaoFiltrada.length) {
      wrap.innerHTML = '<div class="fluxo-vazio">Sem movimentação financeira registrada ainda.</div>' + tooltipHtml;
      return;
    }
    var W = 900, H = 220;
    var orbeRaio = 38, orbeEsqX = 70, orbeDirX = W - 70, orbeY = 88;
    var linhaEsqX = orbeEsqX + orbeRaio + 22, linhaDirX = orbeDirX - orbeRaio - 22;
    var larguraUtil = linhaDirX - linhaEsqX;
    var n = evolucaoFiltrada.length;
    var passoX = n > 1 ? larguraUtil / (n - 1) : 0;

    var maxRecebido = Math.max.apply(null, evolucaoFiltrada.map(function (m) { return m.recebido; }).concat([0.01]));
    var maxAReceber = Math.max.apply(null, evolucaoFiltrada.map(function (m) { return m.a_receber; }).concat([0.01]));

    var animado = !reduzMotion();
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Fluxo de recebimentos por mês">';
    svg += '<defs>' +
      '<radialGradient id="fluxoOrbeAReceber" cx="35%" cy="30%" r="75%">' +
        '<stop offset="0%" stop-color="#f0a94e" stop-opacity="0.95" />' +
        '<stop offset="100%" stop-color="#c9822f" stop-opacity="0.35" />' +
      '</radialGradient>' +
      '<radialGradient id="fluxoOrbeRecebido" cx="35%" cy="30%" r="75%">' +
        '<stop offset="0%" stop-color="#8fa6f7" stop-opacity="0.98" />' +
        '<stop offset="100%" stop-color="#3b56c4" stop-opacity="0.4" />' +
      '</radialGradient>' +
    '</defs>';

    // linha do tempo, se desenhando da esquerda pra direita
    svg += '<line class="fluxo-linha' + (animado ? ' fluxo-linha-anim' : '') + '" x1="' + linhaEsqX + '" y1="' + orbeY + '" x2="' + linhaDirX + '" y2="' + orbeY + '" />';

    // orbe "A Receber" (esquerda)
    svg += '<circle cx="' + orbeEsqX + '" cy="' + orbeY + '" r="' + orbeRaio + '" fill="url(#fluxoOrbeAReceber)" style="filter:drop-shadow(0 0 10px rgba(240,169,78,.45));" />';
    svg += '<text class="fluxo-orbe-label" x="' + orbeEsqX + '" y="' + (orbeY - orbeRaio - 14) + '" text-anchor="middle">A Receber</text>';
    svg += '<text class="fluxo-orbe-valor" id="fluxo-valor-a-receber" fill="#f0a94e" x="' + orbeEsqX + '" y="' + (orbeY + orbeRaio + 26) + '" text-anchor="middle">R$ 0,00</text>';

    // orbe "Recebido" (direita)
    svg += '<circle cx="' + orbeDirX + '" cy="' + orbeY + '" r="' + orbeRaio + '" fill="url(#fluxoOrbeRecebido)" style="filter:drop-shadow(0 0 10px rgba(108,140,240,.55));" />';
    svg += '<text class="fluxo-orbe-label" x="' + orbeDirX + '" y="' + (orbeY - orbeRaio - 14) + '" text-anchor="middle">Recebido</text>';
    svg += '<text class="fluxo-orbe-valor" id="fluxo-valor-recebido" fill="#8fa6f7" x="' + orbeDirX + '" y="' + (orbeY + orbeRaio + 26) + '" text-anchor="middle">R$ 0,00</text>';

    var passoRotulo = Math.ceil(n / 10);
    evolucaoFiltrada.forEach(function (m, idx) {
      var cx = linhaEsqX + passoX * idx;
      var raioRecebido = 3 + (m.recebido / maxRecebido) * 6.5;
      var raioAReceber = 5 + (m.a_receber / maxAReceber) * 8;
      var atraso = animado ? (idx * (900 / Math.max(n, 1))) : 0;

      if (m.a_receber > 0) {
        svg += '<circle class="fluxo-no-a-receber' + (animado ? ' fluxo-no-entrada' : '') + '" cx="' + cx + '" cy="' + orbeY + '" r="' + raioAReceber + '" ' +
          (animado ? 'style="animation-delay:' + atraso + 'ms;"' : '') + ' />';
      }
      svg += '<circle class="fluxo-no-recebido' + (animado ? ' fluxo-no-entrada' : '') + '" cx="' + cx + '" cy="' + orbeY + '" r="' + raioRecebido + '" ' +
        (animado ? 'style="animation-delay:' + atraso + 'ms;"' : '') + ' />';
      if (m.vencido > 0) {
        svg += '<circle cx="' + cx + '" cy="' + orbeY + '" r="' + (raioAReceber + 3.5) + '" fill="none" stroke="#f0616c" stroke-width="1.6" opacity="0.85" />';
      }
      svg += '<rect x="' + (cx - passoX / 2) + '" y="' + (orbeY - 30) + '" width="' + (passoX || 40) + '" height="60" fill="transparent" ' +
        'data-mes="' + esc(m.mes) + '" data-recebido="' + m.recebido + '" data-a-receber="' + m.a_receber + '" data-vencido="' + (m.vencido || 0) + '" style="cursor:pointer;" />';
      if (idx % passoRotulo === 0) {
        svg += '<text class="fluxo-mes-texto" x="' + cx + '" y="' + (orbeY + 34) + '" text-anchor="middle">' + esc(nomeMesAbrev(m.mes)) + '</text>';
      }
    });

    svg += '</svg>';
    wrap.innerHTML = svg + tooltipHtml;
    wireHoverGrafico(wrap);
    animarContagem(document.getElementById('fluxo-valor-a-receber'), totalAReceber);
    animarContagem(document.getElementById('fluxo-valor-recebido'), totalRecebido);
  }

  function wireHoverGrafico(wrap) {
    var tooltip = document.getElementById('grafico-tooltip');
    var svgEl = wrap.querySelector('svg');
    if (!tooltip || !svgEl) return;
    svgEl.addEventListener('mousemove', function (ev) {
      var alvo = ev.target.closest('[data-mes]');
      if (!alvo) { tooltip.classList.remove('visivel'); return; }
      var mes = alvo.getAttribute('data-mes');
      var recebido = parseFloat(alvo.getAttribute('data-recebido'));
      var aReceber = parseFloat(alvo.getAttribute('data-a-receber'));
      var vencido = parseFloat(alvo.getAttribute('data-vencido')) || 0;
      tooltip.innerHTML = '<div style="font-weight:600;margin-bottom:4px;">' + esc(nomeMesExtenso(mes)) + '</div>' +
        'Recebido: <b>R$ ' + fmtMoeda(recebido) + '</b><br>' +
        'A receber: <b>R$ ' + fmtMoeda(aReceber) + '</b>' +
        (vencido > 0 ? '<br>Em atraso: <b style="color:#f0616c;">R$ ' + fmtMoeda(vencido) + '</b>' : '');
      var wrapRect = wrap.getBoundingClientRect();
      tooltip.style.left = (ev.clientX - wrapRect.left) + 'px';
      tooltip.style.top = (ev.clientY - wrapRect.top) + 'px';
      tooltip.classList.add('visivel');
    });
    svgEl.addEventListener('mouseleave', function () { tooltip.classList.remove('visivel'); });
  }

  function renderTabelaGrafico(evolucaoFiltrada) {
    var corpo = document.getElementById('grafico-tabela-corpo');
    if (!corpo) return;
    corpo.innerHTML = evolucaoFiltrada.map(function (m) {
      return '<tr><td>' + esc(nomeMesExtenso(m.mes)) + '</td>' +
        '<td class="num">R$ ' + fmtMoeda(m.recebido) + '</td>' +
        '<td class="num">R$ ' + fmtMoeda(m.a_receber) + '</td>' +
        '<td class="num">' + (m.vencido > 0 ? '<span style="color:var(--crit);">R$ ' + fmtMoeda(m.vencido) + '</span>' : '—') + '</td></tr>';
    }).join('');
  }

  function aplicarFiltroGrafico(filtro) {
    filtroGraficoAtual = filtro;
    document.querySelectorAll('.fluxo-filtro-btn').forEach(function (btn) {
      btn.classList.toggle('ativo', btn.getAttribute('data-filtro') === filtro);
    });
    var filtrado = filtrarEvolucao(evolucaoMensalAtual, filtro);
    desenharFluxoCaixa(filtrado);
    renderTabelaGrafico(filtrado);
    var cardRecebidoPeriodo = document.getElementById('card-recebido-periodo');
    if (cardRecebidoPeriodo) {
      cardRecebidoPeriodo.innerHTML = renderCardValor('recebido_periodo', somaRecebido(filtrado), 'Recebido no Período', rotuloFiltro(filtro));
    }
    var f = dadosPainelAtual && dadosPainelAtual.financeiro;
    if (f) {
      var somaAReceberPeriodo = filtrado.reduce(function (acc, m) { return acc + m.a_receber; }, 0);
      var somaVencidoPeriodo = filtrado.reduce(function (acc, m) { return acc + (m.vencido || 0); }, 0);
      var cardAReceber = document.getElementById('card-a-receber');
      if (cardAReceber) {
        var subAReceber = filtro === 'todos'
          ? (f.parcelas_vencidas.length ? f.parcelas_vencidas.length + ' parcela(s) vencida(s)' : 'saldo de honorários em aberto')
          : 'R$ ' + fmtMoeda(somaAReceberPeriodo) + ' com vencimento ' + rotuloFiltro(filtro);
        cardAReceber.innerHTML = renderCardValor('a_receber', f.total_a_receber, 'A Receber', subAReceber, 'EmAberto');
      }
      var cardEmAtraso = document.getElementById('card-em-atraso');
      if (cardEmAtraso) {
        var subEmAtrasoAtual = filtro === 'todos'
          ? (f.parcelas_vencidas.length ? f.parcelas_vencidas.length + ' parcela(s) vencida(s)' : 'nenhuma parcela vencida')
          : 'R$ ' + fmtMoeda(somaVencidoPeriodo) + ' vencido, venc. ' + rotuloFiltro(filtro);
        cardEmAtraso.innerHTML = renderCardValor('em_atraso', f.total_vencido, 'Em Atraso', subEmAtrasoAtual, null, 'sec-vencidas');
      }
    }
    wireOlhinhos(dadosPainelAtual);
  }

  function wireVisaoFinanceira() {
    document.querySelectorAll('.fluxo-filtro-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { aplicarFiltroGrafico(btn.getAttribute('data-filtro')); });
    });
    var btnTabela = document.getElementById('grafico-tabela-toggle');
    if (btnTabela) {
      btnTabela.addEventListener('click', function () {
        var tabelaWrap = document.getElementById('grafico-tabela-wrap');
        var graficoWrap = document.getElementById('grafico-financeiro-svg');
        var vaiMostrarTabela = tabelaWrap.classList.contains('hidden');
        tabelaWrap.classList.toggle('hidden', !vaiMostrarTabela);
        graficoWrap.classList.toggle('hidden', vaiMostrarTabela);
        btnTabela.textContent = vaiMostrarTabela ? 'Ver como gráfico' : 'Ver como tabela';
      });
    }
    aplicarFiltroGrafico(filtroGraficoAtual);
  }

  function wireDevedoresMes() {
    var input = document.getElementById('devedores-mes-input');
    var btn = document.getElementById('devedores-mes-buscar');
    var resultado = document.getElementById('devedores-mes-resultado');
    if (!input || !btn || !resultado) return;
    if (!input.value) {
      var hoje = new Date();
      input.value = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0');
    }
    btn.addEventListener('click', function () {
      var mes = input.value;
      if (!mes) {
        resultado.innerHTML = '<div class="aviso-tenant">Escolha um mês.</div>';
        return;
      }
      btn.disabled = true; btn.textContent = 'Buscando...';
      resultado.innerHTML = '';
      apiPostJson('/api/painel?acao=executar', { tipo: 'relatorio_devedores_mes', mes: mes })
        .then(function (corpo) {
          btn.disabled = false; btn.textContent = 'Ver quem deve';
          var devedores = corpo.devedores || [];
          if (!devedores.length) {
            resultado.innerHTML = '<div class="empty-state"><div class="glyph">✓</div>' +
              '<div class="msg">Ninguém deve parcela nesse mês.</div></div>';
            return;
          }
          var linhas = devedores.map(function (d) {
            var parcelaTxt = d.numero_parcela ? (d.numero_parcela + '/' + (d.total_parcelas || '?')) : '—';
            return '<tr><td>' + esc(d.nome) + '</td><td>' + esc(parcelaTxt) + '</td>' +
              '<td>' + esc(d.vencimento) + '</td><td class="num">R$ ' + fmtMoeda(d.saldo) + '</td></tr>';
          }).join('');
          resultado.innerHTML =
            '<div class="chip warn" style="margin-bottom:12px;">Total do mês: R$ ' + fmtMoeda(corpo.total_devedores) + '</div>' +
            '<div class="table-scroll"><table style="min-width:460px;"><thead><tr><th>Cliente</th><th>Parcela</th><th>Vencimento</th><th style="text-align:right">Valor</th></tr></thead>' +
            '<tbody>' + linhas + '</tbody></table></div>';
        })
        .catch(function () {
          btn.disabled = false; btn.textContent = 'Ver quem deve';
          resultado.innerHTML = '<div class="aviso-tenant">Não foi possível buscar agora. Tente de novo.</div>';
        });
    });
  }

  function carregarListaClientesFinanceiro() {
    var wrap = document.getElementById('lista-clientes-financeiro-wrap');
    if (!wrap) return;
    apiPostJson('/api/painel?acao=executar', { tipo: 'listar_clientes_financeiro' })
      .then(function (corpo) {
        var clientes = corpo.clientes || [];
        if (!clientes.length) {
          wrap.innerHTML = '<div class="empty-state"><div class="msg">Nenhum cliente cadastrado ainda.</div></div>';
          return;
        }
        var linhas = clientes.map(function (c) {
          var classeChip = c.status === 'Ativo' ? 'good' : 'neutral';
          return '<tr><td>' + esc(c.nome) + '</td>' +
            '<td><span class="chip ' + classeChip + '">' + esc(c.status || '—') + '</span></td>' +
            '<td class="num">R$ ' + fmtMoeda(c.valor_total) + '</td>' +
            '<td style="text-align:right"><button class="btn-editar" data-remover-cliente="' + esc(c.nome) + '">Remover</button></td></tr>';
        }).join('');
        wrap.innerHTML =
          '<div class="table-scroll"><table style="min-width:480px;"><thead><tr><th>Cliente</th><th>Status</th><th style="text-align:right">Valor total</th><th></th></tr></thead>' +
          '<tbody>' + linhas + '</tbody></table></div>';
        wrap.querySelectorAll('[data-remover-cliente]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var nome = btn.getAttribute('data-remover-cliente');
            if (!confirm('Remover "' + nome + '" da planilha de honorários? Essa ação não pode ser desfeita pelo painel.')) return;
            btn.disabled = true; btn.textContent = 'Removendo...';
            apiPostJson('/api/painel?acao=executar', { tipo: 'remover_cliente_financeiro', nome: nome })
              .then(function () { carregarListaClientesFinanceiro(); })
              .catch(function () {
                btn.disabled = false; btn.textContent = 'Remover';
                alert('Não foi possível remover agora. Tente de novo.');
              });
          });
        });
      })
      .catch(function () {
        wrap.innerHTML = '<div class="aviso-tenant">Não foi possível carregar a lista de clientes.</div>';
      });
  }

  function wireFormExito() {
    var form = document.getElementById('form-exito-atualizar');
    if (!form) return;
    var msg = document.getElementById('form-exito-msg');
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var corpo = {};
      form.querySelectorAll('[data-campo-exito]').forEach(function (el) {
        corpo[el.getAttribute('data-campo-exito')] = el.value.trim();
      });
      var botao = form.querySelector('button[type="submit"]');
      botao.disabled = true; botao.textContent = 'Atualizando...';
      msg.textContent = '';
      apiPostJson('/api/painel?acao=executar', {
        tipo: 'atualizar_exito_financeiro',
        nome: corpo.nome,
        tipo_servico: corpo.tipo_servico,
        valor_recebido_cliente: corpo.valor_recebido_cliente,
      })
        .then(function (r) {
          botao.disabled = false; botao.textContent = 'Atualizar honorário';
          var deuCerto = (r.resposta || '').indexOf('atualizado') !== -1;
          msg.style.color = deuCerto ? 'var(--good)' : 'var(--crit)';
          msg.textContent = (r.resposta || 'Atualizado.') +
            (deuCerto ? ' Os valores no painel podem levar até 90s pra refletir — ou clique em "Atualizar agora".' : '');
          if (deuCerto) form.reset();
        })
        .catch(function () {
          botao.disabled = false; botao.textContent = 'Atualizar honorário';
          msg.style.color = 'var(--crit)';
          msg.textContent = 'Não foi possível atualizar agora. Confira o nome/serviço e tente de novo.';
        });
    });
  }

  function wireOlhinhos(dados) {
    document.querySelectorAll('[data-olho]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var chave = btn.getAttribute('data-olho');
        var ocultoAtual = valorOculto(chave);
        if (ocultoAtual) {
          localStorage.removeItem('painel_oculto_' + chave);
        } else {
          localStorage.setItem('painel_oculto_' + chave, '1');
        }
        renderPainel(dados);
      });
    });
  }

  function fmtDataHora(iso) {
    var d = new Date(iso);
    return d.toLocaleString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function renderPainel(dados) {
    if (dados.nome_escritorio) document.getElementById('sidebar-nome').textContent = dados.nome_escritorio;
    if (dados.nome_advogado) document.getElementById('sidebar-sub').textContent = dados.nome_advogado;
    var avisoTenant = document.getElementById('aviso-tenant-incompleto');
    if (avisoTenant) avisoTenant.remove();
    if (sessionStorage.getItem('painel_token') && sessionStorage.getItem('painel_token').indexOf(':') !== -1) {
      var aviso = document.createElement('div');
      aviso.id = 'aviso-tenant-incompleto';
      aviso.className = 'aviso-tenant';
      aviso.style.margin = '0 0 18px';
      aviso.textContent = 'A geração de contrato ainda não está adaptada pro seu escritório — essa parte está em construção pela equipe.';
      var conteudoEl = document.getElementById('conteudo');
      if (conteudoEl) conteudoEl.insertBefore(aviso, conteudoEl.firstChild);
    }
    var perms = dados.usuario_permissoes || [];
    var f = dados.financeiro;
    var p = dados.pje;

    var primeiroNome = ((dados.nome_advogado || '').trim().split(' ')[0]) || 'Bem-vindo(a)';
    var htmlInicio =
      '<section id="sec-inicio">' +
        '<div class="inicio-suporte" id="inicio-suporte">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="17" height="17" style="flex-shrink:0;"><path d="M4 4h16v13H7l-3 3z"></path><path d="M8 9h8M8 13h5"></path></svg>' +
          '<span>Alguma dúvida ou precisa de ajuda pra configurar seu escritório? Fale diretamente com a gente.</span>' +
          '<a class="inicio-suporte-btn" href="https://wa.me/5596991745909?text=' +
            encodeURIComponent('Olá! Preciso de ajuda com a plataforma Vero Jurídico.') +
            '" target="_blank" rel="noopener">Falar conosco</a>' +
          '<button type="button" class="inicio-suporte-fechar" id="btn-fechar-suporte-inicio" aria-label="Fechar aviso">✕</button>' +
        '</div>' +

        '<div class="inicio-banner">' +
          '<p class="inicio-banner-eyebrow">Primeiro passo na Vero Jurídico</p>' +
          '<h2 class="inicio-banner-titulo">' + esc(primeiroNome) + ', traga seus processos para a Vero Jurídico</h2>' +
          '<p class="inicio-banner-sub">Traga sua carteira ou cadastre um caso — a partir daí a plataforma passa a acompanhar prazos, audiências e pendências financeiras automaticamente.</p>' +

          '<div class="inicio-tiles">' +
            '<a class="inicio-tile inicio-tile--recomendado" href="painel-importar-oab.html#sec-importar-oab">' +
              '<div class="inicio-tile-topo">' +
                '<span class="inicio-tile-icone"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"></circle><path d="m21 21-4.3-4.3"></path></svg></span>' +
                '<span class="inicio-tile-badge">Recomendado</span>' +
              '</div>' +
              '<div class="inicio-tile-titulo">Importar pela OAB</div>' +
              '<div class="inicio-tile-desc">Consulte pelo número e UF, selecione os processos e importe em lote — ideal pra migrar a carteira.</div>' +
              '<span class="inicio-tile-link">Buscar processos →</span>' +
            '</a>' +
            '<a class="inicio-tile" href="painel-criar-processo.html#sec-criar-processo">' +
              '<div class="inicio-tile-topo">' +
                '<span class="inicio-tile-icone"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19V6a2 2 0 0 1 2-2h6l5 5v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"></path><path d="M12 4v5h5"></path></svg></span>' +
              '</div>' +
              '<div class="inicio-tile-titulo">Criar processo manualmente</div>' +
              '<div class="inicio-tile-desc">Cadastre um caso novo com os dados completos — perfeito pra começar com um processo só.</div>' +
              '<span class="inicio-tile-link">Novo processo →</span>' +
            '</a>' +
          '</div>' +

          '<ul class="inicio-lista-check">' +
            '<li>Financeiro com parcelas vencidas destacadas automaticamente</li>' +
            '<li>Prazos monitorados direto na base oficial do CNJ</li>' +
            '<li>Painel organizado por área: Financeiro, Processual, Clientes, Agenda</li>' +
          '</ul>' +
        '</div>' +

        '<div class="panel" style="margin-top:16px;">' +
          '<div class="panel-header"><span class="panel-title">Primeiros passos na plataforma</span></div>' +
          '<div class="inicio-checklist">' +
            '<div class="inicio-checklist-item">' +
              '<span class="inicio-checklist-num">1</span>' +
              '<span class="inicio-checklist-texto">Cadastre um cliente</span>' +
              '<a class="inicio-checklist-btn" href="painel-novo-cliente.html#sec-novo-cliente">Cadastrar cliente</a>' +
            '</div>' +
            '<div class="inicio-checklist-item">' +
              '<span class="inicio-checklist-num">2</span>' +
              '<span class="inicio-checklist-texto">Crie ou importe processos</span>' +
              '<a class="inicio-checklist-btn" href="painel-criar-processo.html#sec-criar-processo">Novo processo</a>' +
            '</div>' +
            '<div class="inicio-checklist-item">' +
              '<span class="inicio-checklist-num">3</span>' +
              '<span class="inicio-checklist-texto">Adicione um prazo</span>' +
              '<a class="inicio-checklist-btn" href="painel-agenda.html#sec-agenda">Criar prazo</a>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</section>';

    var htmlFinanceiro = '';
    var htmlExito = '';
    var painelVencidasHtml = '';
    if (f) {
      var htmlVencidas;
      if (f.parcelas_vencidas.length === 0) {
        htmlVencidas =
          '<div class="empty-state"><div class="glyph">✓</div>' +
          '<div class="msg">Nenhuma parcela em atraso agora. Tudo em dia.</div></div>';
      } else {
        var linhas = f.parcelas_vencidas.map(function (item) {
          var classe = item.dias_atraso > 15 ? 'crit' : 'warn';
          return '<tr><td>' + linkCliente(item.nome) + '</td>' +
            '<td class="num">R$ ' + fmtMoeda(item.saldo) + '</td>' +
            '<td>' + esc(item.vencimento) + '</td>' +
            '<td class="num"><span class="days-badge ' + classe + '">' + item.dias_atraso + ' dias</span></td>' +
            '<td style="text-align:right">' +
              '<button class="btn-editar" data-cobrar-nome="' + esc(item.nome) + '" ' +
              'data-cobrar-valor="' + esc(item.saldo) + '" data-cobrar-vencimento="' + esc(item.vencimento) + '" ' +
              'data-cobrar-linha-contrato="' + esc(item.linha_contrato || '') + '" ' +
              'data-cobrar-numero-parcela="' + esc(item.numero_parcela || '') + '">Cobrar</button>' +
            '</td></tr>';
        }).join('');
        htmlVencidas =
          '<div class="table-scroll">' +
          '<table style="min-width:560px;"><thead><tr><th>Cliente</th><th style="text-align:right">Saldo</th><th>Vencimento</th><th style="text-align:right">Atraso</th><th></th></tr></thead>' +
          '<tbody>' + linhas + '</tbody></table>' +
          '</div>';
      }

      var chipVencidas = f.parcelas_vencidas.length === 0
        ? '<span class="chip good">Nenhuma vencida</span>'
        : '<span class="chip crit">' + f.parcelas_vencidas.length + ' vencida(s)</span>';

      evolucaoMensalAtual = f.evolucao_mensal || [];
      dadosPainelAtual = dados;
      var filtradoInicial = filtrarEvolucao(evolucaoMensalAtual, filtroGraficoAtual);
      var subReceber = f.parcelas_vencidas.length
        ? f.parcelas_vencidas.length + ' parcela(s) vencida(s)'
        : 'saldo de honorários em aberto';

      var exitoResumo = f.exito || { total_previsto: 0, total_recebido: 0, total_a_receber: 0, casos: [] };
      var subEmAtraso = f.parcelas_vencidas.length
        ? f.parcelas_vencidas.length + ' parcela(s) vencida(s)'
        : 'nenhuma parcela vencida';
      var subExito = exitoResumo.casos.length
        ? exitoResumo.casos.length + ' caso(s) de êxito cadastrado(s)'
        : 'nenhum caso de êxito cadastrado';

      var htmlAlertaInadimplencia = f.total_vencido > 0
        ? '<a href="#sec-vencidas" class="alerta-inadimplencia">' +
            '<span class="alerta-inadimplencia-icone">⚠</span>' +
            '<span><b>R$ ' + fmtMoeda(f.total_vencido) + '</b> em atraso — ' + f.parcelas_vencidas.length + ' parcela(s) vencida(s). Ver cobrança pendente →</span>' +
          '</a>'
        : '';

      var PRESETS_PERIODO = [
        { chave: 'mes_atual', rotulo: 'Este mês' },
        { chave: 'mes_anterior', rotulo: 'Mês anterior' },
        { chave: '3', rotulo: '3 meses' },
        { chave: '6', rotulo: '6 meses' },
        { chave: '12', rotulo: '12 meses' },
        { chave: 'ano_atual', rotulo: 'Este ano' },
        { chave: 'ano_anterior', rotulo: 'Ano anterior' },
        { chave: 'todos', rotulo: 'Todo o período' },
      ];

      htmlFinanceiro =
        '<section id="sec-visao-geral"><p class="section-label">Visão Financeira</p>' +
        htmlAlertaInadimplencia +
        '<div class="periodo-filtro-bar">' +
          '<span class="periodo-filtro-label">Período</span>' +
          PRESETS_PERIODO.map(function (p) {
            return '<button type="button" class="fluxo-filtro-btn' + (p.chave === filtroGraficoAtual ? ' ativo' : '') + '" data-filtro="' + p.chave + '">' + p.rotulo + '</button>';
          }).join('') +
        '</div>' +
        '<div class="stat-grid">' +
          '<div id="card-a-receber" style="display:contents;">' + renderCardValor('a_receber', f.total_a_receber, 'A Receber', subReceber, 'EmAberto') + '</div>' +
          '<div id="card-recebido-periodo" style="display:contents;">' + renderCardValor('recebido_periodo', somaRecebido(filtradoInicial), 'Recebido no Período', rotuloFiltro(filtroGraficoAtual)) + '</div>' +
          renderCardValor('valor_recebido', f.valor_recebido_geral, 'Total Acumulado', 'tudo que já entrou, desde o início', 'Paga') +
          '<div id="card-em-atraso" style="display:contents;">' + renderCardValor('em_atraso', f.total_vencido, 'Em Atraso', subEmAtraso, null, 'sec-vencidas') + '</div>' +
          renderCardValor('exito_previsto', exitoResumo.total_previsto, 'Honorários de Êxito', subExito, null, 'sec-exito') +
        '</div>' +
        '<div class="fluxo-card">' +
          '<div class="fluxo-cabecalho">' +
            '<span class="fluxo-titulo">Fluxo de Caixa Vivo</span>' +
          '</div>' +
          '<div class="fluxo-legenda">' +
            '<span class="fluxo-legenda-item"><span class="fluxo-legenda-swatch" style="background:#6c8cf0;box-shadow:0 0 5px rgba(108,140,240,.8);"></span>Recebido</span>' +
            '<span class="fluxo-legenda-item"><span class="fluxo-legenda-swatch" style="background:rgba(240,169,78,.6);"></span>A receber</span>' +
            '<span class="fluxo-legenda-item"><span class="fluxo-legenda-swatch" style="background:transparent;border:1.6px solid #f0616c;"></span>Com valor vencido</span>' +
          '</div>' +
          '<div class="fluxo-svg-wrap" id="grafico-financeiro-svg" style="position:relative;"><div class="fluxo-tooltip" id="grafico-tooltip"></div></div>' +
          '<div id="grafico-tabela-wrap" class="hidden table-scroll" style="margin-top:14px;">' +
            '<table style="min-width:420px;"><thead><tr><th>Mês</th><th style="text-align:right">Recebido</th><th style="text-align:right">A receber</th><th style="text-align:right">Vencido</th></tr></thead>' +
            '<tbody id="grafico-tabela-corpo"></tbody></table>' +
          '</div>' +
          '<button type="button" class="fluxo-tabela-toggle" id="grafico-tabela-toggle">Ver como tabela</button>' +
          (f.recebido_sem_data > 0
            ? '<div style="position:relative;z-index:1;margin-top:14px;padding:10px 13px;border-radius:8px;background:rgba(240,169,78,.1);border:1px solid rgba(240,169,78,.25);color:#e0b374;font-size:12.5px;line-height:1.5;">' +
                '<b>R$ ' + fmtMoeda(f.recebido_sem_data) + '</b> recebidos não aparecem no gráfico acima porque são lançamentos antigos sem data de pagamento registrada na planilha — esse valor já está incluído no "Total Acumulado".' +
              '</div>'
            : '') +
        '</div>' +
        renderStatusParcelasDonut(f.parcelas_por_status || {}) +
        '<p class="section-label" style="margin-top:22px;">Outros indicadores</p><div class="stat-grid">' +
          '<div class="stat-card"><div class="stat-value">' + f.contratos_ativos + '</div><div class="stat-label">Contratos ativos</div><div class="stat-sub">em andamento neste momento</div></div>' +
          '<div class="stat-card"><div class="stat-value">' + f.contratos_encerrados + '</div><div class="stat-label">Contratos encerrados</div><div class="stat-sub">concluídos</div></div>' +
          '<div class="stat-card"><div class="stat-value">' + f.clientes_novos_mes + '</div><div class="stat-label">Cliente(s) novo(s)</div><div class="stat-sub">contrato iniciado este mês</div></div>' +
          renderCardValor('valor_total', f.valor_total_geral, 'Valor total', 'contratos + honorários de êxito') +
        '</div></section>';

      var casosExito = exitoResumo.casos || [];
      var CHIP_STATUS_EXITO = { 'Paga': 'good', 'Aguardando recebimento': 'warn' };
      var htmlListaExito;
      if (casosExito.length === 0) {
        htmlListaExito = '<div class="empty-state"><div class="msg">Nenhum caso de honorário de êxito cadastrado ainda.</div></div>';
      } else {
        var linhasExito = casosExito.map(function (c) {
          return '<tr><td>' + esc(c.cliente) + '</td>' +
            '<td>' + esc(c.servico) + '</td>' +
            '<td class="num">' + c.percentual + '%</td>' +
            '<td class="num">R$ ' + fmtMoeda(c.honorario) + '</td>' +
            '<td class="num">R$ ' + fmtMoeda(c.recebido) + '</td>' +
            '<td class="num">R$ ' + fmtMoeda(c.a_receber) + '</td>' +
            '<td><span class="chip ' + (CHIP_STATUS_EXITO[c.status] || 'neutral') + '">' + esc(c.status || '—') + '</span></td></tr>';
        }).join('');
        htmlListaExito = '<div class="table-scroll"><table style="min-width:680px;">' +
          '<thead><tr><th>Cliente</th><th>Serviço</th><th style="text-align:right">%</th><th style="text-align:right">Honorário</th>' +
          '<th style="text-align:right">Recebido</th><th style="text-align:right">A receber</th><th>Status</th></tr></thead>' +
          '<tbody>' + linhasExito + '</tbody></table></div>';
      }

      var htmlExito =
        '<section id="sec-exito"><p class="section-label">Honorários de Êxito</p>' +
          '<div class="stat-grid">' +
            renderCardValor('exito_previsto_sub', exitoResumo.total_previsto, 'Previsto', 'soma dos honorários já calculados') +
            renderCardValor('exito_recebido_sub', exitoResumo.total_recebido, 'Recebido', 'já pago ao escritório') +
            renderCardValor('exito_falta_sub', exitoResumo.total_a_receber, 'Falta Receber', 'honorário − já recebido') +
          '</div>' +
          '<div class="panel" style="margin-top:14px;">' +
            '<div class="panel-header"><span class="panel-title">Casos cadastrados</span></div>' +
            htmlListaExito +
          '</div>' +
          '<div class="panel" style="margin-top:14px;">' +
            '<div class="panel-header"><span class="panel-title">Registrar valor recebido pelo cliente</span></div>' +
            '<div style="padding:16px 20px;font-size:12.5px;color:var(--ink-faint);line-height:1.5;">' +
              'Quando o processo termina, informe aqui quanto o cliente recebeu na causa (condenação/acordo) — ' +
              'o honorário de êxito é recalculado automaticamente (% × esse valor).' +
            '</div>' +
            '<form id="form-exito-atualizar" class="proposta-form" style="padding:0 20px 18px;display:grid;gap:8px;grid-template-columns:1fr 1fr;">' +
              '<input type="text" placeholder="Nome do cliente" data-campo-exito="nome" required>' +
              '<input type="text" placeholder="Serviço (igual ao cadastro)" data-campo-exito="tipo_servico" required>' +
              '<input type="number" step="0.01" min="0" placeholder="Valor recebido pelo cliente (R$)" data-campo-exito="valor_recebido_cliente" required>' +
              '<button type="submit" class="btn-relatorio-mes" style="grid-column:span 1;">Atualizar honorário</button>' +
              '<div id="form-exito-msg" style="grid-column:1 / -1;font-size:12.5px;"></div>' +
            '</form>' +
          '</div>' +
        '</section>';

      var htmlRanking;
      var rankingLista = f.ranking_maiores_devedores || [];
      if (rankingLista.length === 0) {
        htmlRanking = '<div class="empty-state"><div class="glyph">✓</div><div class="msg">Ninguém com saldo em aberto.</div></div>';
      } else {
        var maiorSaldoRanking = rankingLista[0].saldo || 1;
        htmlRanking = '<div class="table-scroll"><table style="min-width:380px;">' +
          '<thead><tr><th>Cliente</th><th style="text-align:right">A receber</th></tr></thead><tbody>' +
          rankingLista.map(function (r, idx) {
            var pctBarra = Math.max(4, Math.round((r.saldo / maiorSaldoRanking) * 100));
            return '<tr><td>' + (idx + 1) + '. ' + linkCliente(r.nome) +
              '<div style="height:4px;border-radius:2px;background:var(--surface-sunken);margin-top:5px;overflow:hidden;">' +
                '<div style="height:100%;width:' + pctBarra + '%;background:var(--accent);"></div>' +
              '</div></td>' +
              '<td class="num">R$ ' + fmtMoeda(r.saldo) + '</td></tr>';
          }).join('') +
          '</tbody></table></div>';
      }
      var painelRankingHtml =
        '<div class="panel" id="sec-ranking-devedores">' +
          '<div class="panel-header"><span class="panel-title">Maiores valores a receber</span></div>' +
          htmlRanking +
        '</div>';

      painelVencidasHtml =
        '<div class="panel" id="sec-vencidas">' +
          '<div class="panel-header"><span class="panel-title">Cobrança pendente</span>' + chipVencidas + '</div>' +
          htmlVencidas +
        '</div>' + painelRankingHtml;
    }

    var overviewLineHtml = '';
    var painelPrazosHtml = '';
    var htmlAvisosSection = '';
    if (p) {
      var htmlPrazos;
      if (p.prazos_semana.length === 0) {
        htmlPrazos =
          '<div class="empty-state"><div class="glyph">—</div>' +
          '<div class="msg">Nenhum prazo com vencimento nos próximos 14 dias.</div></div>';
      } else {
        htmlPrazos = p.prazos_semana.map(function (item) {
          var linkHtml = item.link
            ? '<a href="' + esc(item.link) + '" target="_blank" rel="noopener" class="link-original">Ver comunicação original</a>'
            : '';
          return '<div class="prazo-card">' +
            '<div class="prazo-card-topo">' +
              '<div><div class="prazo-processo">' + esc(item.processo) + '</div>' +
              '<div class="prazo-meta">' + esc(item.tribunal) + (item.tipo ? ' · ' + esc(item.tipo) : '') + '</div></div>' +
              '<span class="days-badge warn">' + esc(item.data_limite) + '</span>' +
            '</div>' +
            (item.orgao ? '<div class="prazo-orgao">' + esc(item.orgao) + '</div>' : '') +
            (item.resumo ? '<div class="prazo-resumo">' + esc(item.resumo) + '</div>' : '') +
            (linkHtml ? '<div style="margin-top:6px;">' + linkHtml + '</div>' : '') +
          '</div>';
        }).join('');
      }

      var chipPrazos = p.prazos_semana.length === 0
        ? '<span class="chip neutral">Sem prazos</span>'
        : '<span class="chip warn">' + p.prazos_semana.length + ' prazo(s)</span>';

      var avisosSemPrazo = p.avisos_sem_prazo || [];
      var htmlAvisos;
      if (avisosSemPrazo.length === 0) {
        htmlAvisos =
          '<div class="empty-state"><div class="glyph">—</div>' +
          '<div class="msg">Nenhum aviso sem prazo nos últimos 7 dias.</div></div>';
      } else {
        htmlAvisos = avisosSemPrazo.map(function (item) {
          var linkHtml = item.link
            ? '<a href="' + esc(item.link) + '" target="_blank" rel="noopener" class="link-original">Ver comunicação original</a>'
            : '';
          return '<div class="prazo-card">' +
            '<div class="prazo-card-topo">' +
              '<div><div class="prazo-processo">' + esc(item.processo) + '</div>' +
              '<div class="prazo-meta">' + esc(item.tribunal) + (item.tipo ? ' · ' + esc(item.tipo) : '') + '</div></div>' +
              '<span class="days-badge neutral">' + esc(item.data) + '</span>' +
            '</div>' +
            (item.orgao ? '<div class="prazo-orgao">' + esc(item.orgao) + '</div>' : '') +
            (item.resumo ? '<div class="prazo-resumo">' + esc(item.resumo) + '</div>' : '') +
            (linkHtml ? '<div style="margin-top:6px;">' + linkHtml + '</div>' : '') +
          '</div>';
        }).join('');
      }
      var chipAvisos = avisosSemPrazo.length === 0
        ? '<span class="chip neutral">Nenhum</span>'
        : '<span class="chip neutral">' + avisosSemPrazo.length + ' aviso(s)</span>';

      overviewLineHtml =
        '<div class="overview-line"><span><b>' + p.comunicacoes_semana + '</b> comunicações novas nos últimos 7 dias</span>' +
        '<span><b>' + p.prazos_semana.length + '</b> prazo(s) nos próximos 14 dias</span></div>';

      painelPrazosHtml =
        '<div class="panel" id="sec-pje">' +
          '<div class="panel-header"><span class="panel-title">Prazos da semana</span>' + chipPrazos + '</div>' +
          htmlPrazos +
        '</div>';

      htmlAvisosSection =
        '<section><p class="section-label">Avisos recentes sem prazo</p>' +
        '<div class="panel"><div class="panel-header"><span class="panel-title">Despachos e decisões dos últimos 7 dias</span>' + chipAvisos + '</div>' +
          htmlAvisos +
        '</div></section>';
    }

    var htmlPje = !p ? '' :
      '<section><p class="section-label">Processual — PJe</p>' +
        overviewLineHtml + painelPrazosHtml +
      '</section>' + htmlAvisosSection;

    var htmlClientes = perms.indexOf('clientes') === -1 ? '' :
      '<section id="sec-clientes"><p class="section-label">Clientes</p>' +
        '<div class="panel"><div class="panel-header"><span class="panel-title">Visão consolidada</span></div>' +
          '<input type="text" id="clientes-busca" class="input-flush" placeholder="Buscar cliente pelo nome...">' +
          '<div id="clientes-lista"><div class="empty-state"><div class="msg">Carregando…</div></div></div>' +
        '</div></section>';

    var htmlPainelImportarOab =
        '<div class="panel">' +
          '<div class="panel-header"><span class="panel-title">Importar pela OAB</span></div>' +
          '<div style="padding:16px 20px;">' +
            '<p style="margin:0 0 14px;font-size:12.5px;color:var(--ink-soft);">' +
              'Busca processos com comunicações recentes (intimações, citações) vinculadas à sua OAB, direto na base ' +
              'oficial do CNJ. Não cobre a carteira inteira — só processos com movimentação eletrônica publicada.</p>' +
            '<div id="procoab-erro"></div>' +
            '<div class="procman-linha" style="align-items:flex-end;">' +
              '<div style="flex:0 0 140px;"><label>Número da OAB</label><input id="procoab-numero" placeholder="Ex: 12345"></div>' +
              '<div style="flex:0 0 90px;"><label>UF</label><input id="procoab-uf" maxlength="2" style="text-transform:uppercase" placeholder="Ex: AP"></div>' +
              '<div style="flex:0 0 auto;"><button id="procoab-btn-buscar" style="padding:9px 16px;border:none;' +
                'border-radius:7px;background:var(--accent);color:#fff;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;">Buscar processos</button></div>' +
            '</div>' +
            '<div id="procoab-resultado"></div>' +
          '</div>' +
        '</div>';

    var htmlImportarOab = perms.indexOf('processos') === -1 ? '' :
      '<section id="sec-importar-oab"><p class="section-label">Importar pela OAB</p>' +
        htmlPainelImportarOab +
      '</section>';

    var htmlPainelCriarProcesso =
        '<div class="panel">' +
          '<div class="panel-header"><span class="panel-title">Criar processo manualmente</span></div>' +
          '<div style="padding:16px 20px;">' +
            '<p style="margin:0 0 14px;font-size:12.5px;color:var(--ink-soft);">' +
              'Pra processos que não vêm pelo PJe — cadastre os dados aqui, do jeito que fizer sentido pro seu controle.</p>' +
            '<div id="procman-erro"></div>' +

            '<p class="section-label" style="margin:0 0 8px;">Dados do processo</p>' +
            '<div class="procman-linha">' +
              '<div><label>Número do processo (CNJ)</label><input id="procman-numero-cnj" placeholder="0000000-00.0000.0.00.0000"></div>' +
              '<div><label>Classe processual</label><input id="procman-classe" placeholder="Ex: Ação de Cobrança"></div>' +
            '</div>' +
            '<div class="procman-linha">' +
              '<div><label>Área do direito</label><input id="procman-area" placeholder="Ex: Cível, Trabalhista"></div>' +
              '<div><label>Órgão julgador / Vara</label><input id="procman-orgao" placeholder="Ex: 1ª Vara Cível"></div>' +
            '</div>' +
            '<div class="procman-linha">' +
              '<div><label>Tribunal</label><input id="procman-tribunal" placeholder="Ex: TJSP, TRT-2"></div>' +
              '<div><label>Comarca / Foro</label><input id="procman-comarca" placeholder="Ex: São Paulo"></div>' +
            '</div>' +
            '<div class="procman-linha">' +
              '<div><label>Grau</label><select id="procman-grau"><option value="">Selecione...</option><option>1º Grau</option><option>2º Grau</option><option>Tribunal Superior</option></select></div>' +
              '<div><label>Status</label><select id="procman-status"><option>Em andamento</option><option>Suspenso</option><option>Finalizado</option><option>Arquivado</option></select></div>' +
            '</div>' +

            '<p class="section-label" style="margin:18px 0 8px;">Cliente vinculado</p>' +
            '<label>Cliente *</label>' +
            '<input type="text" list="procman-clientes-lista" id="procman-cliente" placeholder="Selecione ou digite o nome do cliente" style="width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid var(--line);border-radius:7px;font-size:13.5px;background:var(--bg);color:var(--ink);margin-bottom:4px;">' +
            '<datalist id="procman-clientes-lista"></datalist>' +

            '<p class="section-label" style="margin:18px 0 8px;">Situação do processo</p>' +
            '<div class="procman-linha">' +
              '<div><label>Fase processual</label><input id="procman-fase" placeholder="Ex: Conhecimento, Execução, Recurso"></div>' +
              '<div><label>Valor da causa (R$)</label><input id="procman-valor-causa" placeholder="0,00"></div>' +
            '</div>' +
            '<div class="procman-linha">' +
              '<div><label>Data de distribuição</label><input type="date" id="procman-data-distribuicao"></div>' +
              '<div><label>Data de encerramento</label><input type="date" id="procman-data-encerramento"></div>' +
            '</div>' +
            '<div class="procman-linha">' +
              '<div><label>Advogado responsável</label><input id="procman-advogado" placeholder="Nome do responsável"></div>' +
              '<div><label>Prioridade legal</label><input id="procman-prioridade" placeholder="Ex: idoso, saúde"></div>' +
            '</div>' +

            '<p class="section-label" style="margin:18px 0 8px;">Classificações e organização</p>' +
            '<div class="procman-linha">' +
              '<div><label>Risco do processo</label><select id="procman-risco"><option value="">—</option><option>Baixo</option><option>Médio</option><option>Alto</option></select></div>' +
              '<div><label>Nível de sigilo</label><select id="procman-sigilo"><option value="">—</option><option>Público</option><option>Restrito</option><option>Segredo de justiça</option></select></div>' +
            '</div>' +
            '<label>Observações internas</label>' +
            '<textarea id="procman-obs" rows="3" placeholder="Anotações internas sobre o processo..." ' +
              'style="width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid var(--line);border-radius:7px;' +
              'font-size:13.5px;font-family:inherit;background:var(--bg);color:var(--ink);resize:vertical;"></textarea>' +

            '<div id="procman-msg-sucesso"></div>' +
            '<div style="margin-top:14px;"><button id="procman-btn-salvar" style="padding:9px 16px;border:none;' +
              'border-radius:7px;background:var(--accent);color:#fff;font-size:13px;font-weight:600;cursor:pointer;">Salvar processo</button></div>' +
          '</div>' +
        '</div>';

    var htmlCriarProcesso = perms.indexOf('processos') === -1 ? '' :
      '<section id="sec-criar-processo"><p class="section-label">Criar processo manualmente</p>' +
        htmlPainelCriarProcesso +
      '</section>';

    var htmlNovoCliente = perms.indexOf('clientes') === -1 ? '' :
      '<section id="sec-novo-cliente">' +
        '<div class="procpage-dark">' +
          '<div class="procficha-topo">' +
            '<div class="procficha-titulo-wrap">' +
              '<button type="button" class="procficha-voltar" id="cliente-btn-cancelar">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M19 12H5M11 18l-6-6 6-6"></path></svg>' +
                '<span>Cancelar</span>' +
              '</button>' +
              '<h2 class="procficha-numero" id="cliente-form-titulo">Novo cliente</h2>' +
            '</div>' +
          '</div>' +
          '<div id="cliente-form-erro"></div>' +

          '<div class="procficha-corpo">' +
            '<div>' +

              '<div class="procficha-painel" style="margin-bottom:16px;">' +
                '<p class="procficha-painel-titulo">Foto do Cliente</p>' +
                '<p class="procficha-painel-sub">Adicione uma foto para identificação rápida</p>' +
                '<div style="display:flex; align-items:center; gap:14px; margin-top:10px;">' +
                  '<div id="cliente-foto-preview" style="width:56px; height:56px; border-radius:50%; background:#0b1220; border:1px solid #232d42; display:flex; align-items:center; justify-content:center; color:#8293b5; overflow:hidden; flex-shrink:0;">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="26" height="26"><circle cx="12" cy="8" r="3.3"></circle><path d="M5 21c0-4 3-6.5 7-6.5s7 2.5 7 6.5"></path></svg>' +
                  '</div>' +
                  '<button type="button" class="procpage-btn" id="cliente-btn-foto">Adicionar foto</button>' +
                  '<input type="file" id="cliente-input-foto" accept="image/png,image/jpeg,image/webp" style="display:none;">' +
                '</div>' +
              '</div>' +

              '<div class="procficha-painel" style="margin-bottom:16px;">' +
                '<p class="procficha-painel-titulo">Dados Pessoais</p>' +
                '<p class="procficha-painel-sub">Informações básicas do cliente</p>' +
                '<div class="procficha-editar-grid">' +
                  '<div><label>Tipo *</label><select id="cliente-tipo"><option>Pessoa Física</option><option>Pessoa Jurídica</option></select></div>' +
                  '<div><label>Nome / Razão Social *</label><input id="cliente-nome" placeholder="Digite o nome completo ou razão social"></div>' +
                  '<div><label id="cliente-label-cpf">CPF</label><input id="cliente-cpf-cnpj" placeholder="000.000.000-00"></div>' +
                  '<div><label>E-mail</label><input type="email" id="cliente-email" placeholder="cliente@exemplo.com"></div>' +
                  '<div><label>Telefone</label><input id="cliente-telefone" placeholder="(00) 00000-0000"></div>' +
                '</div>' +
              '</div>' +

              '<div class="procficha-painel" style="margin-bottom:16px;">' +
                '<p class="procficha-painel-titulo">Endereço</p>' +
                '<p class="procficha-painel-sub">Localização e dados de contato</p>' +
                '<div class="procficha-editar-grid">' +
                  '<div><label>CEP</label><input id="cliente-cep" placeholder="00000-000" maxlength="9"><span id="cliente-cep-status" style="display:block; font-size:11px; color:#8293b5; margin-top:3px;">Busca automática ao digitar</span></div>' +
                  '<div><label>Logradouro</label><input id="cliente-logradouro" placeholder="Rua, avenida, praça..."></div>' +
                  '<div><label>Número</label><input id="cliente-numero" placeholder="Nº"></div>' +
                  '<div><label>Complemento</label><input id="cliente-complemento" placeholder="Apto, sala, bloco..."></div>' +
                  '<div><label>Bairro</label><input id="cliente-bairro" placeholder="Nome do bairro"></div>' +
                  '<div><label>Cidade</label><input id="cliente-cidade" placeholder="Nome da cidade"></div>' +
                  '<div><label>UF</label><input id="cliente-uf" maxlength="2" style="text-transform:uppercase;"></div>' +
                '</div>' +
              '</div>' +

              '<div class="procficha-painel" style="margin-bottom:16px;">' +
                '<p class="procficha-painel-titulo">Observações</p>' +
                '<p class="procficha-painel-sub">Anotações e informações complementares</p>' +
                '<textarea id="cliente-observacoes" rows="3" placeholder="Observações gerais, combinados, informações complementares sobre o cliente..." style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #232d42;border-radius:6px;font-size:13px;font-family:inherit;background:#0b1220;color:#e7eaf0;resize:vertical;"></textarea>' +
              '</div>' +

              '<div class="procficha-painel" style="margin-bottom:16px;">' +
                '<p class="procficha-painel-titulo">Etiquetas</p>' +
                '<p class="procficha-painel-sub">Classifique e organize seus clientes</p>' +
                '<div id="cliente-etiquetas-selecionadas" style="display:flex; flex-wrap:wrap; gap:6px; margin:10px 0;"></div>' +
                '<div style="display:flex; gap:8px; flex-wrap:wrap; position:relative;">' +
                  '<button type="button" class="procpage-btn" id="cliente-btn-add-etiqueta">+ Adicionar etiqueta</button>' +
                  '<div id="cliente-etiquetas-dropdown" class="procman-acoes-menu hidden" style="position:absolute; top:calc(100% + 4px); left:0; min-width:200px; max-height:220px; overflow-y:auto;"></div>' +
                  '<button type="button" class="procpage-btn" id="cliente-btn-nova-etiqueta">Cadastrar nova etiqueta</button>' +
                '</div>' +
              '</div>' +

              '<div><button type="button" class="procpage-btn procpage-btn-primary" id="cliente-btn-salvar">Salvar cliente</button></div>' +
            '</div>' +

            '<div class="procficha-resumo">' +
              '<p class="procficha-painel-titulo" style="margin:0 0 8px;">Progresso</p>' +
              '<div id="cliente-progresso-itens" style="display:flex; flex-direction:column; gap:10px;"></div>' +
              '<div style="margin-top:10px;">' +
                '<div style="display:flex; justify-content:space-between; font-size:11px; color:#8293b5; margin-bottom:4px;"><span>Completude</span><span id="cliente-progresso-pct">0%</span></div>' +
                '<div style="height:6px; background:#0b1220; border-radius:999px; overflow:hidden;"><div id="cliente-progresso-barra" style="height:100%; width:0%; background:#2c5ce0; transition:width .2s;"></div></div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</section>';

    var htmlProcessos = perms.indexOf('processos') === -1 ? '' :
      '<section id="sec-processos">' +
        '<div class="procpage-dark">' +
          '<div id="procpage-view-lista">' +
            '<div class="procpage-topo">' +
              '<h2 class="procpage-titulo">Processos</h2>' +
              '<div class="procpage-acoes-topo">' +
                '<a class="procpage-btn" href="painel-importar-oab.html#sec-importar-oab">' +
                  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"></circle><path d="m21 21-4.3-4.3"></path></svg>' +
                  'Busca OAB</a>' +
                '<a class="procpage-btn procpage-btn-primary" href="painel-criar-processo.html#sec-criar-processo">' +
                  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"></path></svg>' +
                  'Novo processo</a>' +
              '</div>' +
            '</div>' +

            '<div class="procpage-filtros">' +
              '<p class="procpage-filtros-titulo">Busca avançada</p>' +
              '<div class="procpage-filtros-grid">' +
                '<div><label>Nº do processo</label><input type="text" id="procpage-filtro-numero"></div>' +
                '<div><label>Cliente</label><input type="text" id="procpage-filtro-cliente" list="procpage-clientes-lista"><datalist id="procpage-clientes-lista"></datalist></div>' +
                '<div><label>Tribunal</label><input type="text" id="procpage-filtro-tribunal"></div>' +
                '<div><label>Status</label><select id="procpage-filtro-status">' +
                  '<option value="ativos_encerrados" selected>Ativos e encerrados</option>' +
                  '<option value="ativos">Ativos</option>' +
                  '<option value="encerrados">Encerrados</option>' +
                  '<option value="arquivados">Arquivados</option>' +
                  '<option value="todos">Todos</option>' +
                '</select></div>' +
                '<div><label>Palavra-chave</label><input type="text" id="procpage-filtro-palavra" placeholder="Busca em número, classe, órgão..."></div>' +
                '<div class="procpage-filtros-botoes">' +
                  '<button type="button" class="procpage-btn" id="procpage-filtro-limpar">Limpar</button>' +
                  '<button type="button" class="procpage-btn procpage-btn-primary" id="procpage-filtro-buscar">Buscar</button>' +
                '</div>' +
              '</div>' +
            '</div>' +

            '<div class="procpage-tabela-wrap">' +
              '<div id="procman-lista"><div class="empty-state"><div class="msg" style="color:#8293b5;">Carregando…</div></div></div>' +
            '</div>' +
          '</div>' +

          '<div id="procpage-view-ficha" class="hidden"></div>' +
        '</div>' +

        '<div style="margin-top:22px;">' +
          '<p class="section-label">Comunicações do PJe (sincronização automática)</p>' +
          '<div class="panel"><div class="panel-header"><span class="panel-title">Processos com comunicações recentes</span></div>' +
            '<div id="processos-lista"><div class="empty-state"><div class="msg">Carregando…</div></div></div>' +
          '</div>' +
        '</div>' +
      '</section>';

    var htmlProcessoAdministrativo = perms.indexOf('processos') === -1 ? '' :
      '<section id="sec-processo-administrativo"><p class="section-label">Processo Administrativo</p>' +
        '<div class="panel">' +
          '<div class="panel-header"><span class="panel-title">Novo processo administrativo</span></div>' +
          '<p style="padding:0 20px;margin:0 0 4px;font-size:12.5px;color:var(--ink-soft);">' +
            'Protocolos em órgãos públicos (INSS, prefeitura etc.), fora do Judiciário. Se preencher a data do lembrete, ' +
            'já cria uma tarefa automática na Agenda nessa data.' +
          '</p>' +
          '<div style="padding:0 20px 16px;">' +
            '<div class="audiencia-upload-dropzone" id="procadm-analisar-dropzone" style="max-width:420px;padding:16px;">' +
              '<div class="audiencia-upload-msg">' +
                '<strong>Arraste o protocolo aqui</strong>' +
                '<span>PDF, JPG, PNG ou WEBP · até 4 MB</span>' +
                '<button type="button" id="procadm-analisar-escolher">Escolher arquivo</button>' +
              '</div>' +
              '<input type="file" id="procadm-analisar-input" accept="application/pdf,image/jpeg,image/png,image/webp" class="hidden">' +
            '</div>' +
            '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px;">' +
              '<span id="procadm-analisar-nome-arquivo" style="font-size:12.5px;color:var(--ink-soft);"></span>' +
              '<button type="button" id="procadm-analisar-btn" style="font-size:12.5px;padding:8px 14px;border-radius:7px;border:1px solid var(--line);background:var(--surface);color:var(--ink);cursor:pointer;">Preencher com IA a partir do documento</button>' +
              '<span id="procadm-analisar-status" style="font-size:12.5px;color:var(--ink-soft);"></span>' +
            '</div>' +
          '</div>' +
          '<div class="proposta-form">' +
            '<input type="text" list="procadm-clientes-lista" placeholder="Cliente" data-campo="cliente" data-form="procadm_criar">' +
            '<datalist id="procadm-clientes-lista"></datalist>' +
            '<input type="text" placeholder="Órgão (ex: INSS)" data-campo="orgao" data-form="procadm_criar">' +
            '<input type="text" placeholder="Nº do protocolo" data-campo="numero_protocolo" data-form="procadm_criar">' +
            '<input type="text" placeholder="Próximo passo (ex: buscar resultado no órgão)" data-campo="proximo_passo" data-form="procadm_criar" style="grid-column: span 2;">' +
            '<label style="display:flex; flex-direction:column; gap:4px; font-size:11.5px; color:var(--ink-soft);">Data do lembrete (ex: quando ir buscar o resultado)' +
              '<input type="date" data-campo="prazo" data-form="procadm_criar" style="font-family:inherit; font-size:13px; padding:8px 10px; border-radius:8px; border:1px solid var(--line); background:var(--surface); color:var(--ink);">' +
            '</label>' +
            '<textarea placeholder="Observações (opcional)" data-campo="observacoes" data-form="procadm_criar" style="grid-column: span 3; min-height:56px; font-family:inherit; font-size:13px; padding:10px; border-radius:8px; border:1px solid var(--line); background:var(--surface); color:var(--ink);"></textarea>' +
            '<button type="button" id="procadm-btn-criar" style="padding:10px 18px;border:none;border-radius:7px;background:var(--accent);color:#fff;font-size:13px;font-weight:600;cursor:pointer;">Criar processo</button>' +
          '</div>' +
          '<div class="automacao-resultado" id="procadm-resultado" aria-live="polite" style="padding:0 20px 16px;"></div>' +
        '</div>' +
        '<div class="panel" style="margin-top:16px;">' +
          '<div class="panel-header"><span class="panel-title">Processos em andamento</span></div>' +
          '<div id="procadm-lista"><div class="empty-state"><div class="msg">Carregando…</div></div></div>' +
        '</div>' +
      '</section>';

    var htmlAgenda = perms.indexOf('agenda') === -1 ? '' :
      '<section id="sec-agenda"><p class="section-label">Agenda — eventos e tarefas</p><div class="agenda-grid">' +

        '<div class="panel">' +
          '<div class="panel-header"><span class="panel-title">Eventos</span></div>' +
          '<div class="agenda-form">' +
            '<input type="text" id="evento-titulo" placeholder="Título">' +
            '<input type="date" id="evento-data">' +
            '<input type="time" id="evento-hora">' +
            '<label style="display:flex;align-items:center;gap:5px;font-size:12.5px;color:var(--ink-soft);white-space:nowrap;">' +
              '<input type="checkbox" id="evento-meet" style="width:auto;"> Gerar link do Meet' +
            '</label>' +
            '<button id="evento-btn-salvar">Criar</button>' +
            '<button class="cancelar-edicao hidden" id="evento-btn-cancelar">Cancelar</button>' +
          '</div>' +
          '<div class="admin-msg hidden" id="evento-meet-resultado" aria-live="polite"></div>' +
          '<div id="agenda-lista-eventos"><div class="empty-state"><div class="msg">Carregando…</div></div></div>' +
        '</div>' +

        '<div class="panel">' +
          '<div class="panel-header"><span class="panel-title">Tarefas</span></div>' +
          '<div class="agenda-form">' +
            '<input type="text" id="tarefa-titulo" placeholder="Título">' +
            '<input type="date" id="tarefa-data">' +
            '<button id="tarefa-btn-salvar">Criar</button>' +
            '<button class="cancelar-edicao hidden" id="tarefa-btn-cancelar">Cancelar</button>' +
          '</div>' +
          '<div id="agenda-lista-tarefas"><div class="empty-state"><div class="msg">Carregando…</div></div></div>' +
        '</div>' +

      '</div></section>';

    var htmlCobrancaAvulsa = perms.indexOf('financeiro') === -1 ? '' :
      '<section id="sec-cobranca-avulsa"><p class="section-label">Cobrança avulsa</p>' +
        '<div class="panel">' +
          '<div class="panel-header"><span class="panel-title">Cobrar algo fora de parcela de contrato</span></div>' +
          '<div class="proposta-form">' +
            '<input type="text" list="cobranca-avulsa-clientes-lista" placeholder="Nome do cliente" data-campo="nome" data-form="cobrar_cliente">' +
            '<datalist id="cobranca-avulsa-clientes-lista"></datalist>' +
            '<input type="text" placeholder="Valor (ex: 500,00)" data-campo="valor" data-form="cobrar_cliente">' +
            '<input type="text" placeholder="Vencimento (ex: 25/08/2026)" data-campo="vencimento" data-form="cobrar_cliente">' +
            '<input type="text" placeholder="Descrição (opcional)" data-campo="descricao" data-form="cobrar_cliente">' +
            '<button data-tipo="cobrar_cliente" class="btn-automacao">Enviar cobrança</button>' +
          '</div>' +
          '<div class="automacao-resultado" data-resultado="cobrar_cliente" aria-live="polite" style="padding:0 20px 16px;"></div>' +
        '</div>' +
      '</section>';

    var htmlNotificacaoExtrajudicial = perms.indexOf('financeiro') === -1 ? '' :
      '<section id="sec-notificacao-extrajudicial"><p class="section-label">Notificação Extrajudicial</p>' +
        '<div class="panel">' +
          '<div class="panel-header"><span class="panel-title">Cobrar cliente inadimplente formalmente</span></div>' +
          '<p style="padding:0 20px;margin:0 0 4px;font-size:12.5px;color:var(--ink-soft);">' +
            'O valor devido, dias em atraso e dados do cliente (CPF, endereço) são preenchidos automaticamente. ' +
            'Cláusula, descrição do débito e prazo são decisão sua a cada notificação.' +
          '</p>' +
          '<div class="proposta-form">' +
            '<input type="text" list="notificacao-extrajudicial-clientes-lista" placeholder="Nome do cliente" data-campo="nome" data-form="notificacao_extrajudicial_gerar">' +
            '<datalist id="notificacao-extrajudicial-clientes-lista"></datalist>' +
            '<input type="text" placeholder="Prazo para pagamento em dias (ex: 10)" data-campo="prazo_dias" data-form="notificacao_extrajudicial_gerar">' +
            '<input type="text" placeholder="Cláusula dos honorários (ex: 3ª)" data-campo="clausula_honorarios" data-form="notificacao_extrajudicial_gerar">' +
            '<input type="text" placeholder="Descrição do débito (ex: parcelas 3 e 4)" data-campo="descricao_debito" data-form="notificacao_extrajudicial_gerar" style="grid-column: span 2;">' +
            '<input type="email" id="notificacao-extrajudicial-email" placeholder="E-mail do cliente (opcional)" style="grid-column: span 1;">' +
            '<button data-tipo="notificacao_extrajudicial_gerar" data-preview="notificacao-extrajudicial-preview" class="btn-automacao">Gerar notificação (revisar antes de enviar)</button>' +
          '</div>' +
          '<div class="automacao-resultado" data-resultado="notificacao_extrajudicial_gerar" aria-live="polite" style="padding:0 20px 16px;white-space:pre-wrap;"></div>' +
          '<div id="notificacao-extrajudicial-preview"></div>' +
          '<div style="padding:0 20px 20px;" id="notificacao-extrajudicial-confirmar-area" class="hidden">' +
            '<button type="button" id="notificacao-extrajudicial-btn-confirmar" style="padding:10px 18px;border:none;border-radius:7px;background:var(--accent);color:#fff;font-size:13px;font-weight:600;cursor:pointer;">Confirmar e enviar pro cliente</button>' +
          '</div>' +
        '</div>' +
      '</section>';

    var htmlPropostas = perms.indexOf('automacoes') === -1 ? '' :
      '<section id="sec-propostas"><p class="section-label">Propostas</p>' +
        '<div class="panel">' +
          '<div class="panel-header"><span class="panel-title">Gerar proposta de honorários</span></div>' +
          '<div class="proposta-form">' +
            '<input type="text" placeholder="Nome do cliente" data-campo="nome" data-form="gerar_proposta">' +
            '<input type="text" placeholder="Tipo de serviço" data-campo="tipo_servico" data-form="gerar_proposta">' +
            '<input type="text" placeholder="Valor total (ex: 3000,00)" data-campo="valor" data-form="gerar_proposta">' +
            '<input type="text" placeholder="Entrada (opcional)" data-campo="entrada" data-form="gerar_proposta">' +
            '<input type="text" placeholder="Nº de parcelas (opcional)" data-campo="parcelas" data-form="gerar_proposta">' +
            '<button data-tipo="gerar_proposta" class="btn-automacao">Gerar proposta</button>' +
          '</div>' +
          '<div class="automacao-resultado" data-resultado="gerar_proposta" aria-live="polite" style="padding:0 20px 16px;"></div>' +
          '<div id="proposta-preview"></div>' +
        '</div>' +
      '</section>';

    var htmlContrato = perms.indexOf('automacoes') === -1 ? '' :
      '<section id="sec-contrato"><p class="section-label">Contrato</p>' +
        '<div class="panel">' +
          '<div class="panel-header"><span class="panel-title">Gerar contrato de honorários</span></div>' +
          '<div class="proposta-form">' +
            '<input type="text" list="contrato-clientes-lista" placeholder="Nome do cliente" data-campo="nome" data-form="gerar_contrato">' +
            '<datalist id="contrato-clientes-lista"></datalist>' +
            '<input type="text" list="contrato-modelos-lista" id="contrato-tipo-servico" placeholder="Tipo de serviço" data-campo="tipo_servico" data-form="gerar_contrato">' +
            '<datalist id="contrato-modelos-lista"></datalist>' +
            '<input type="text" placeholder="Descrição do serviço (opcional)" data-campo="descricao" data-form="gerar_contrato">' +
            '<input type="text" class="contrato-campo-pagamento" placeholder="Valor total (ex: 3000,00)" data-campo="valor" data-form="gerar_contrato">' +
            '<input type="text" class="contrato-campo-pagamento" placeholder="Entrada (opcional)" data-campo="entrada" data-form="gerar_contrato">' +
            '<input type="text" class="contrato-campo-pagamento" placeholder="Nº de parcelas (opcional)" data-campo="parcelas" data-form="gerar_contrato">' +
            '<input type="text" class="contrato-campo-pagamento" placeholder="Vencimento da entrada (ex: 20/09/2026)" data-campo="data_entrada" data-form="gerar_contrato">' +
            '<input type="text" class="contrato-campo-pagamento" placeholder="Dia de vencimento da parcela (1-31)" data-campo="dia_vencimento" data-form="gerar_contrato">' +
            '<input type="text" class="contrato-campo-exito" placeholder="% honorários de êxito (opcional)" data-campo="percentual_honorarios" data-form="gerar_contrato">' +
            '<input type="text" class="contrato-campo-exito" placeholder="% recursal (opcional)" data-campo="percentual_recursal" data-form="gerar_contrato">' +
            '<div id="contrato-campos-extra-dinamicos" style="display:contents"></div>' +
            '<div id="contrato-modelo-aviso" class="automacao-resultado hidden" style="grid-column: span 3; padding: 0;"></div>' +
            '<button data-tipo="gerar_contrato" data-preview="contrato-preview" class="btn-automacao">Gerar contrato</button>' +
          '</div>' +
          '<div class="automacao-resultado" data-resultado="gerar_contrato" aria-live="polite" style="padding:0 20px 16px;"></div>' +
          '<div id="contrato-preview"></div>' +
        '</div>' +
      '</section>';

    var htmlCadastroCliente = perms.indexOf('financeiro') === -1 ? '' :
      '<section id="sec-cadastro-cliente"><p class="section-label">Cadastrar cliente</p>' +
        '<div class="panel">' +
          '<div class="panel-header"><span class="panel-title">Cadastrar cliente na planilha de honorários</span></div>' +
          '<div class="proposta-form">' +
            '<input type="text" placeholder="Nome do cliente" data-campo="nome" data-form="cadastrar_cliente_financeiro">' +
            '<input type="text" placeholder="WhatsApp do cliente" data-campo="whatsapp" data-form="cadastrar_cliente_financeiro">' +
            '<input type="email" placeholder="E-mail do cliente (opcional)" data-campo="email" data-form="cadastrar_cliente_financeiro">' +
            '<input type="text" placeholder="Tipo de serviço" data-campo="tipo_servico" data-form="cadastrar_cliente_financeiro">' +
            '<input type="text" placeholder="Valor total (ex: 3000,00)" data-campo="valor_total" data-form="cadastrar_cliente_financeiro">' +
            '<select data-campo="forma_pagamento" data-form="cadastrar_cliente_financeiro">' +
              '<option value="Parcelado">Parcelado</option>' +
              '<option value="À Vista">À Vista</option>' +
            '</select>' +
            '<input type="text" placeholder="Valor de entrada (opcional)" data-campo="valor_entrada" data-form="cadastrar_cliente_financeiro">' +
            '<input type="text" placeholder="Nº de parcelas (opcional)" data-campo="num_parcelas" data-form="cadastrar_cliente_financeiro">' +
            '<input type="text" placeholder="Data de início (ex: 01/09/2026)" data-campo="data_inicio" data-form="cadastrar_cliente_financeiro">' +
            '<input type="text" placeholder="Vencimento da 1ª parcela (ex: 10/09/2026)" data-campo="data_primeira_parcela" data-form="cadastrar_cliente_financeiro">' +
            '<input type="text" list="lista-percentuais-exito" placeholder="% de honorários de êxito (opcional)" data-campo="percentual_exito" data-form="cadastrar_cliente_financeiro">' +
            '<datalist id="lista-percentuais-exito"><option value="20"><option value="25"><option value="30"><option value="40"></datalist>' +
            '<button data-tipo="cadastrar_cliente_financeiro" class="btn-automacao">Cadastrar cliente</button>' +
          '</div>' +
          '<div class="automacao-resultado" data-resultado="cadastrar_cliente_financeiro" aria-live="polite" style="padding:0 20px 16px;"></div>' +
        '</div>' +
        '<div class="panel" style="margin-top:16px;">' +
          '<div class="panel-header"><span class="panel-title">Clientes cadastrados na planilha</span></div>' +
          '<div id="lista-clientes-financeiro-wrap" style="padding:16px 20px;"><div class="empty-state"><div class="msg">Carregando...</div></div></div>' +
        '</div>' +
        '<div class="panel" style="margin-top:16px;">' +
          '<div class="panel-header"><span class="panel-title">Quem deve em cada mês</span></div>' +
          '<div class="proposta-form">' +
            '<input type="month" id="devedores-mes-input">' +
            '<button type="button" class="btn-relatorio-mes" id="devedores-mes-buscar">Ver quem deve</button>' +
          '</div>' +
          '<div id="devedores-mes-resultado" style="padding:0 20px 20px;"></div>' +
        '</div>' +
      '</section>';

    var htmlAutomacoes = perms.indexOf('automacoes') === -1 ? '' :
      '<section id="sec-automacoes"><p class="section-label">Automações</p><div class="automacoes-grid">' +

        '<div class="automacao-card">' +
          '<div class="automacao-titulo"><svg class="automacao-icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><path d="M12 11v6M9 14h6"></path></svg>Cadastrar novo cliente</div>' +
          '<div class="automacao-desc">Cria a pasta do cliente no Drive com as subpastas padrão.</div>' +
          '<input type="text" placeholder="Nome do cliente" data-campo="nome" data-form="novo_cliente">' +
          '<button data-tipo="novo_cliente" class="btn-automacao">Cadastrar</button>' +
          '<div class="automacao-resultado" data-resultado="novo_cliente" aria-live="polite"></div>' +
        '</div>' +

        '<div class="automacao-card">' +
          '<div class="automacao-titulo"><svg class="automacao-icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 2h6l5 5v13a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"></path><path d="M15 2v5h5"></path><path d="M9 13l2 2 4-4"></path></svg>Verificar dados do cliente</div>' +
          '<div class="automacao-desc">Confere se já tem contrato e procuração na pasta, e mostra os dados de acesso (CPF, RG, endereço) prontos pra copiar.</div>' +
          '<input type="text" list="verificar-dados-clientes-lista" placeholder="Nome do cliente" data-campo="nome" data-form="verificar_dados_cliente">' +
          '<datalist id="verificar-dados-clientes-lista"></datalist>' +
          '<button data-tipo="verificar_dados_cliente" class="btn-automacao">Verificar</button>' +
          '<div class="automacao-resultado" data-resultado="verificar_dados_cliente" aria-live="polite" style="white-space:pre-wrap;user-select:text;"></div>' +
        '</div>' +

        '<div class="automacao-card">' +
          '<div class="automacao-titulo"><svg class="automacao-icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 12a9 9 0 1 1-2.64-6.36"></path><path d="M21 3v6h-6"></path></svg>Verificar PJe agora</div>' +
          '<div class="automacao-desc">Checa novas comunicações na hora.</div>' +
          '<button data-tipo="verificar_pje" class="btn-automacao">Executar</button>' +
          '<div class="automacao-resultado" data-resultado="verificar_pje" aria-live="polite"></div>' +
        '</div>' +

        '<div class="automacao-card">' +
          '<div class="automacao-titulo"><svg class="automacao-icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 12a9 9 0 1 1-2.64-6.36"></path><path d="M21 3v6h-6"></path></svg>Resumo semanal PJe</div>' +
          '<div class="automacao-desc">Envia o resumo dos últimos 7 dias no WhatsApp.</div>' +
          '<button data-tipo="resumo_pje" class="btn-automacao">Executar</button>' +
          '<div class="automacao-resultado" data-resultado="resumo_pje" aria-live="polite"></div>' +
        '</div>' +

        '<div class="automacao-card">' +
          '<div class="automacao-titulo"><svg class="automacao-icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 12a9 9 0 1 1-2.64-6.36"></path><path d="M21 3v6h-6"></path></svg>Verificar Autentique</div>' +
          '<div class="automacao-desc">Checa documentos assinados agora.</div>' +
          '<button data-tipo="verificar_autentique" class="btn-automacao">Executar</button>' +
          '<div class="automacao-resultado" data-resultado="verificar_autentique" aria-live="polite"></div>' +
        '</div>' +

        '<div class="automacao-card">' +
          '<div class="automacao-titulo"><svg class="automacao-icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19V6a2 2 0 0 1 2-2h6l5 5v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"></path><path d="M12 4v5h5"></path></svg>Declaração de residência</div>' +
          '<input type="text" placeholder="Nome do cliente" data-campo="nome" data-form="gerar_residencia">' +
          '<input type="text" placeholder="Endereço (opcional, se ainda não tiver salvo)" data-campo="endereco" data-form="gerar_residencia">' +
          '<button data-tipo="gerar_residencia" class="btn-automacao">Gerar</button>' +
          '<div class="automacao-resultado" data-resultado="gerar_residencia" aria-live="polite"></div>' +
        '</div>' +

        '<div class="automacao-card">' +
          '<div class="automacao-titulo"><svg class="automacao-icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19V6a2 2 0 0 1 2-2h6l5 5v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"></path><path d="M12 4v5h5"></path></svg>Declaração de hipossuficiência</div>' +
          '<input type="text" placeholder="Nome do cliente" data-campo="nome" data-form="gerar_hipossuficiencia">' +
          '<input type="text" placeholder="Motivo da ação (opcional)" data-campo="descricao" data-form="gerar_hipossuficiencia">' +
          '<button data-tipo="gerar_hipossuficiencia" class="btn-automacao">Gerar</button>' +
          '<div class="automacao-resultado" data-resultado="gerar_hipossuficiencia" aria-live="polite"></div>' +
        '</div>' +

        '<div class="automacao-card">' +
          '<div class="automacao-titulo"><svg class="automacao-icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19V6a2 2 0 0 1 2-2h6l5 5v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"></path><path d="M12 4v5h5"></path></svg>Gerar recibo</div>' +
          '<input type="text" placeholder="Nome do cliente" data-campo="nome" data-form="gerar_recibo">' +
          '<input type="text" placeholder="Valor (ex: 1500,00)" data-campo="valor" data-form="gerar_recibo">' +
          '<input type="text" placeholder="Descrição (opcional)" data-campo="descricao" data-form="gerar_recibo">' +
          '<button data-tipo="gerar_recibo" class="btn-automacao">Gerar</button>' +
          '<div class="automacao-resultado" data-resultado="gerar_recibo" aria-live="polite"></div>' +
        '</div>' +

        (perms.indexOf('financeiro') === -1 ? '' :
        '<div class="automacao-card">' +
          '<div class="automacao-titulo"><svg class="automacao-icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20V10"></path><path d="M10 20V4"></path><path d="M16 20v-7"></path><path d="M4 20h16"></path></svg>Relatório de fechamento</div>' +
          '<div class="automacao-desc">Mostra o valor total, total pago e saldo de um cliente.</div>' +
          '<input type="text" placeholder="Nome do cliente" data-campo="nome" data-form="relatorio_fechamento">' +
          '<button data-tipo="relatorio_fechamento" class="btn-automacao">Ver relatório</button>' +
          '<div class="automacao-resultado" data-resultado="relatorio_fechamento" aria-live="polite"></div>' +
        '</div>') +

        '<div class="automacao-card">' +
          '<div class="automacao-titulo"><svg class="automacao-icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 2 11 13"></path><path d="M22 2 15 22 11 13 2 9 22 2z"></path></svg>Enviar assinatura</div>' +
          '<input type="text" placeholder="Nome do cliente" data-campo="nome" data-form="enviar_assinatura">' +
          '<button data-tipo="enviar_assinatura" class="btn-automacao">Enviar</button>' +
          '<div class="automacao-resultado" data-resultado="enviar_assinatura" aria-live="polite"></div>' +
        '</div>' +

        '<div class="automacao-card">' +
          '<div class="automacao-titulo"><svg class="automacao-icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>Gerar link com UTM</div>' +
          '<input type="text" placeholder="Origem (ex: instagram)" data-campo="origem" data-form="gerar_utm">' +
          '<input type="text" placeholder="Mídia (ex: stories)" data-campo="midia" data-form="gerar_utm">' +
          '<input type="text" placeholder="Campanha" data-campo="campanha" data-form="gerar_utm">' +
          '<button data-tipo="gerar_utm" class="btn-automacao">Gerar</button>' +
          '<div class="automacao-resultado" data-resultado="gerar_utm" aria-live="polite"></div>' +
        '</div>' +

        '<div class="automacao-card">' +
          '<div class="automacao-titulo"><svg class="automacao-icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 2 11 13"></path><path d="M22 2 15 22 11 13 2 9 22 2z"></path></svg>Responder confirmação pendente</div>' +
          '<div class="automacao-desc">Use quando alguma ação acima pedir uma escolha (ex: qual documento enviar).</div>' +
          '<input type="text" placeholder="Ex: 1,2 ou todos" data-campo="resposta" data-form="responder_pendente">' +
          '<button data-tipo="responder_pendente" class="btn-automacao">Responder</button>' +
          '<div class="automacao-resultado" data-resultado="responder_pendente" aria-live="polite"></div>' +
        '</div>' +

      '</div></section>';

    var htmlPadraoOperacional = perms.indexOf('padrao_operacional') === -1 ? '' :
      '<section id="sec-padrao-operacional"><p class="section-label">Padrão Operacional</p>' +
        '<div class="panel">' +
          '<div class="padrao-abas">' +
            '<button type="button" class="padrao-aba-btn ativo" data-aba="atendimentos" aria-pressed="true">Atendimentos</button>' +
            '<button type="button" class="padrao-aba-btn" data-aba="fechamentos" aria-pressed="false">Fechamentos</button>' +
            '<button type="button" class="padrao-aba-btn" data-aba="financeiro" aria-pressed="false">Financeiro</button>' +
            '<button type="button" class="padrao-aba-btn" data-aba="processos" aria-pressed="false">Processos</button>' +
            '<button type="button" class="padrao-aba-btn" data-aba="sistemas_acessos" aria-pressed="false">Sistemas e Acessos</button>' +
          '</div>' +
          '<div class="padrao-corpo">' +
            '<textarea id="padrao-texto" maxlength="4000" placeholder="Escreva aqui o procedimento padrão desta área…">Carregando…</textarea>' +
            '<div class="padrao-corpo-rodape">' +
              '<button id="padrao-btn-salvar" disabled>Salvar</button>' +
              '<span class="padrao-contador" id="padrao-contador"></span>' +
              '<span class="admin-msg" id="padrao-msg" aria-live="polite" style="padding:0;"></span>' +
            '</div>' +
          '</div>' +
        '</div></section>';

    var htmlAudiencias = perms.indexOf('audiencias') === -1 ? '' :
      '<section id="sec-audiencias"><p class="section-label">Audiências</p>' +
        '<div class="panel">' +
          '<div class="panel-header"><span class="panel-title" id="audiencias-titulo-aba">Marcadas (próximas)</span>' +
            '<div class="subtabs">' +
              '<button type="button" class="subtab-btn ativo" data-aba-audiencia="marcadas">Marcadas</button>' +
              '<button type="button" class="subtab-btn" data-aba-audiencia="realizadas">Realizadas</button>' +
            '</div></div>' +
          '<div id="pauta-audiencias-lista"><div class="empty-state"><div class="msg">Carregando…</div></div></div>' +
          '<div id="bloco-realizadas" class="hidden">' +
            '<div class="audiencia-upload-area">' +
              '<input type="text" id="audiencia-upload-cliente" list="audiencia-upload-clientes-lista" placeholder="Nome do cliente">' +
              '<datalist id="audiencia-upload-clientes-lista"></datalist>' +
              '<div class="audiencia-upload-dropzone" id="audiencia-upload-dropzone">' +
                '<div class="audiencia-upload-msg" id="audiencia-upload-msg">' +
                  '<strong>Arraste a gravação aqui</strong>' +
                  '<span>Áudio ou vídeo de audiência, reunião ou atendimento.</span>' +
                  '<button type="button" id="audiencia-upload-escolher">Escolher arquivo</button>' +
                '</div>' +
                '<input type="file" id="audiencia-upload-input" accept="audio/*,video/*" class="hidden">' +
              '</div>' +
            '</div>' +
            '<div class="audiencias-busca"><input type="text" id="audiencias-busca-input" placeholder="Buscar por cliente ou conteúdo do resumo…"></div>' +
            '<div id="audiencias-lista"><div class="empty-state"><div class="msg">Carregando…</div></div></div>' +
          '</div>' +
        '</div></section>';

    var htmlAdmin = !dados.usuario_admin ? '' :
      '<section id="sec-admin"><p class="section-label">Administração — usuários</p>' +
        '<div class="panel">' +
          '<div class="admin-form">' +
            '<input type="text" id="admin-nome" placeholder="Nome">' +
            '<input type="text" id="admin-login" placeholder="Login" autocomplete="off">' +
            '<input type="password" id="admin-senha" placeholder="Senha" autocomplete="new-password">' +
          '</div>' +
          '<div class="admin-permissoes">' +
            '<label><input type="checkbox" data-permissao="financeiro"> Financeiro</label>' +
            '<label><input type="checkbox" data-permissao="pje"> Processual (PJe)</label>' +
            '<label><input type="checkbox" data-permissao="clientes"> Clientes</label>' +
            '<label><input type="checkbox" data-permissao="processos"> Ficha de processos</label>' +
            '<label><input type="checkbox" data-permissao="agenda"> Agenda</label>' +
            '<label><input type="checkbox" data-permissao="automacoes"> Automações</label>' +
            '<label><input type="checkbox" data-permissao="padrao_operacional"> Padrão Operacional</label>' +
            '<label><input type="checkbox" data-permissao="audiencias"> Audiências</label>' +
            '<label class="admin-permissao-admin"><input type="checkbox" id="admin-eh-admin"> Administrador (acesso total + gerencia usuários)</label>' +
          '</div>' +
          '<div style="padding:0 20px 16px;"><button id="admin-btn-criar">Adicionar usuário</button></div>' +
          '<div class="admin-msg" id="admin-msg" aria-live="polite"></div>' +
          '<div id="admin-lista-usuarios"></div>' +
        '</div></section>';

    // Conexoes do escritorio (WhatsApp/Asaas/papel timbrado) -- movidas do cadastro pra ca:
    // so aparecem pra quem ja tem login de verdade (usuario_admin) e sessao de tenant (token
    // no formato "tenant_id:sessao" -- a conta classica do Cesar Tobias nao tem esse formato
    // e nao usa esse fluxo). Ver correcao de seguranca: essas acoes agora exigem sessao
    // valida no backend, nao aceitam mais so um tenant_id (que e a OAB do advogado, publica).
    var sessaoEhTenant = (sessionStorage.getItem('painel_token') || '').indexOf(':') !== -1;
    var htmlConexoes = (!dados.usuario_admin || !sessaoEhTenant) ? '' :
      '<section id="sec-conexoes"><p class="section-label">Conexões do escritório</p>' +
        '<div class="panel">' +
          '<div class="panel-header"><span class="panel-title">WhatsApp</span>' +
            '<span class="chip neutral" id="conexao-status-wa">Verificando...</span></div>' +
          '<div style="padding:16px 20px;">' +
            '<p style="margin:0 0 12px; font-size:13px; color:var(--ink-soft);">Conecte o número que vai atender seus clientes.</p>' +
            '<div id="conexao-erro-wa" style="margin-bottom:10px;"></div>' +
            '<button class="btn-conexao" id="btn-conexao-wa-qr">Mostrar QR code</button>' +
            '<button class="btn-conexao-secundario" id="btn-conexao-wa-verificar">Verificar conexão</button>' +
          '</div>' +
        '</div>' +
        '<div class="panel" style="margin-top:14px;">' +
          '<div class="panel-header"><span class="panel-title">Asaas (cobrança Pix/boleto/cartão)</span></div>' +
          '<div style="padding:16px 20px;">' +
            '<div id="conexao-erro-asaas" style="margin-bottom:10px;"></div>' +
            '<input type="password" id="conexao-asaas-key" class="conexao-input" placeholder="Chave de API da Asaas ($aact_...)">' +
            '<br><button class="btn-conexao" id="btn-conexao-asaas">Conectar Asaas</button>' +
          '</div>' +
        '</div>' +
        '<div class="panel" style="margin-top:14px;">' +
          '<div class="panel-header"><span class="panel-title">Papel timbrado</span></div>' +
          '<div style="padding:16px 20px;">' +
            '<p style="margin:0 0 12px; font-size:13px; color:var(--ink-soft);">Usado de fundo nos contratos e procurações gerados pra você.</p>' +
            '<div id="conexao-erro-logo" style="margin-bottom:10px;"></div>' +
            '<input type="file" id="conexao-logo-input" accept="image/*" style="margin-bottom:10px; display:block;">' +
            '<div id="conexao-logo-previa" style="margin-bottom:10px;"></div>' +
            '<button class="btn-conexao" id="btn-conexao-logo">Enviar</button>' +
          '</div>' +
        '</div>' +
      '</section>';

    // Pagina "Configuracoes do Escritorio" -- admin-only, igual admin/conexoes. A aba Usuarios
    // reaproveita htmlAdmin (definido acima) tal e qual, mesmos ids -- carregarListaUsuarios()/
    // criarUsuarioAdmin ja funcionam sem mudar nada. Configuracao/Avisos/Atualizacoes/Auditoria
    // sao conteudo novo.
    var htmlConfiguracoes = !dados.usuario_admin ? '' :
      '<section id="sec-configuracoes"><p class="section-label">Configurações do Escritório</p>' +
        '<div class="subtabs" style="margin-bottom:14px;">' +
          '<button type="button" class="subtab-btn ativo" data-aba-config="dados">Configuração</button>' +
          '<button type="button" class="subtab-btn" data-aba-config="usuarios">Usuários</button>' +
          '<button type="button" class="subtab-btn" data-aba-config="avisos">Avisos do escritório</button>' +
          '<button type="button" class="subtab-btn" data-aba-config="atualizacoes">Atualizações automáticas</button>' +
          '<button type="button" class="subtab-btn" data-aba-config="auditoria">Auditoria</button>' +
          '<button type="button" class="subtab-btn" data-aba-config="assinatura">Assinatura e Faturamento</button>' +
        '</div>' +

        '<div id="config-painel-dados" class="config-painel">' +
          '<div class="panel">' +
            '<div class="panel-header"><span class="panel-title">Dados do escritório</span></div>' +
            '<div style="padding:16px 20px; display:grid; grid-template-columns:1fr 1fr; gap:12px;">' +
              '<label class="campo-label">Nome fantasia<input type="text" id="cfg-nome-escritorio"></label>' +
              '<label class="campo-label">Razão social<input type="text" id="cfg-razao-social"></label>' +
              '<label class="campo-label">CNPJ<input type="text" id="cfg-cnpj" placeholder="00.000.000/0000-00"></label>' +
              '<label class="campo-label">Inscrição estadual' +
                '<input type="text" id="cfg-inscricao-estadual"></label>' +
              '<label class="campo-label" style="align-self:end; flex-direction:row; align-items:center; gap:8px; display:flex;">' +
                '<input type="checkbox" id="cfg-isento-ie" style="width:auto;"> Isento de inscrição estadual</label>' +
              '<label class="campo-label">Inscrição municipal<input type="text" id="cfg-inscricao-municipal"></label>' +
            '</div>' +
          '</div>' +
          '<div class="panel" style="margin-top:14px;">' +
            '<div class="panel-header"><span class="panel-title">Endereço</span>' +
              '<span class="chip neutral" id="cfg-cep-status">Busca automática ao digitar</span></div>' +
            '<div style="padding:16px 20px; display:grid; grid-template-columns:1fr 1fr; gap:12px;">' +
              '<label class="campo-label">CEP<input type="text" id="cfg-cep" placeholder="00000-000"></label>' +
              '<label class="campo-label">Logradouro<input type="text" id="cfg-logradouro"></label>' +
              '<label class="campo-label">Número<input type="text" id="cfg-numero"></label>' +
              '<label class="campo-label">Complemento<input type="text" id="cfg-complemento"></label>' +
              '<label class="campo-label">Bairro<input type="text" id="cfg-bairro"></label>' +
              '<label class="campo-label">Cidade<input type="text" id="cfg-cidade"></label>' +
              '<label class="campo-label">UF<input type="text" id="cfg-uf" maxlength="2" style="text-transform:uppercase;"></label>' +
            '</div>' +
          '</div>' +
          '<div class="panel" style="margin-top:14px;">' +
            '<div class="panel-header"><span class="panel-title">Contato</span></div>' +
            '<div style="padding:16px 20px; display:grid; grid-template-columns:1fr 1fr; gap:12px;">' +
              '<label class="campo-label">Telefone<input type="text" id="cfg-telefone"></label>' +
              '<label class="campo-label">Celular/WhatsApp<input type="text" id="cfg-celular"></label>' +
              '<label class="campo-label">E-mail<input type="email" id="cfg-email"></label>' +
              '<label class="campo-label">Site<input type="text" id="cfg-site" placeholder="https://"></label>' +
            '</div>' +
          '</div>' +
          '<div class="panel" style="margin-top:14px;">' +
            '<div class="panel-header"><span class="panel-title">Dados bancários</span><small style="color:var(--ink-soft);">Opcional</small></div>' +
            '<div style="padding:16px 20px; display:grid; grid-template-columns:1fr 1fr; gap:12px;">' +
              '<label class="campo-label">Banco<input type="text" id="cfg-banco-nome"></label>' +
              '<label class="campo-label">Agência<input type="text" id="cfg-banco-agencia"></label>' +
              '<label class="campo-label">Conta<input type="text" id="cfg-banco-conta"></label>' +
              '<label class="campo-label">Chave Pix<input type="text" id="cfg-banco-pix"></label>' +
            '</div>' +
          '</div>' +
          '<div style="padding:16px 0;">' +
            '<button id="cfg-btn-salvar">Salvar dados do escritório</button>' +
            '<span class="admin-msg" id="cfg-msg" aria-live="polite" style="margin-left:12px;"></span>' +
          '</div>' +
        '</div>' +

        '<div id="config-painel-usuarios" class="config-painel hidden">' + htmlAdmin + '</div>' +

        '<div id="config-painel-avisos" class="config-painel hidden">' +
          '<div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:6px;">' +
            '<div>' +
              '<p style="margin:0; font-weight:600; color:var(--ink);">Avisos do Escritório</p>' +
              '<p style="margin:4px 0 0; font-size:12.5px; color:var(--ink-soft); max-width:640px;">' +
                'Mensagens ativas aparecem na seção <strong>Avisos do escritório</strong> do menu do sino no topo. ' +
                'Desative pelo botão "Ativo" para ocultar sem excluir. Máximo 100 caracteres por mensagem.</p>' +
            '</div>' +
            '<button id="aviso-btn-novo" style="white-space:nowrap;">+ Novo aviso</button>' +
          '</div>' +
          '<span class="admin-msg" id="aviso-msg" aria-live="polite"></span>' +
          '<div id="aviso-lista" style="margin-top:10px;"></div>' +
        '</div>' +

        '<div id="modal-aviso" class="modal-overlay hidden">' +
          '<div class="aviso-modal-caixa">' +
            '<h3><span id="aviso-modal-titulo">Novo aviso</span>' +
              '<button type="button" class="aviso-modal-fechar" id="aviso-modal-fechar" aria-label="Fechar">✕</button></h3>' +
            '<input type="hidden" id="aviso-modal-id">' +
            '<label for="aviso-modal-mensagem">Mensagem</label>' +
            '<textarea id="aviso-modal-mensagem" rows="3" maxlength="100" ' +
              'placeholder="Texto exibido em Avisos do escritório no menu do sino (máx. 100 caracteres)"></textarea>' +
            '<div class="aviso-modal-contador"><span id="aviso-modal-contador-num">0</span>/100</div>' +
            '<div class="aviso-modal-ativo-row">' +
              '<span style="font-size:12.5px; font-weight:600; color:var(--ink-soft);">Ativo</span>' +
              '<label><input type="radio" name="aviso-modal-ativo" value="sim" checked> Sim</label>' +
              '<label><input type="radio" name="aviso-modal-ativo" value="nao"> Não</label>' +
            '</div>' +
            '<div class="aviso-modal-acoes">' +
              '<button type="button" class="btn-conexao-secundario" id="aviso-modal-cancelar">Cancelar</button>' +
              '<button type="button" id="aviso-modal-salvar">Salvar</button>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div id="config-painel-atualizacoes" class="config-painel hidden">' +
          '<div class="panel">' +
            '<div class="panel-header"><span class="panel-title">Como a atualização automática funciona</span></div>' +
            '<div style="padding:16px 20px; font-size:13.5px; color:var(--ink-soft); line-height:1.6;">' +
              '<p><strong style="color:var(--ink);">DataJud (CNJ)</strong> — todo dia, o sistema consulta a API pública ' +
              'do CNJ pra cada processo cadastrado e importa andamentos novos automaticamente. A atualização dos ' +
              'tribunais no DataJud não é em tempo real (pode levar de horas a alguns dias).</p>' +
              '<p><strong style="color:var(--ink);">Comunica PJe</strong> — as intimações eletrônicas do PJe são ' +
              'verificadas automaticamente (a cada 15 minutos, quando chegam por push do Gmail, ou uma vez por dia) ' +
              'e viram tarefa/prazo, linha na planilha e pasta do cliente sozinhas.</p>' +
              '<p>Essas duas verificações rodam sozinhas em segundo plano — não precisa apertar nada. Se quiser forçar ' +
              'uma checagem imediata de um processo específico, use o botão "Sincronizar agora" na ficha do processo.</p>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div id="config-painel-auditoria" class="config-painel hidden">' +
          '<div class="panel">' +
            '<div class="panel-header"><span class="panel-title">Auditoria</span></div>' +
            '<p style="padding:0 20px; font-size:12.5px; color:var(--ink-soft);">Registra ações a partir de hoje — não há histórico de antes desta funcionalidade existir.</p>' +
            '<div id="auditoria-lista" style="padding:0 20px 20px;"><div class="empty-state"><div class="msg">Carregando…</div></div></div>' +
          '</div>' +
        '</div>' +

        '<div id="config-painel-assinatura" class="config-painel hidden">' +
          '<div class="panel">' +
            '<div class="panel-header"><span class="panel-title">Assinatura e Faturamento</span></div>' +
            '<div style="padding:16px 20px; font-size:13.5px; color:var(--ink-soft); line-height:1.6;">' +
              '<p>Esta plataforma ainda não tem cobrança nem planos pagos — o acesso não depende de assinatura hoje.</p>' +
              '<p>Quando essa função existir, é aqui que você vai ver seu plano atual, forma de pagamento e faturas.</p>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</section>';

    // cada pagina mostra so a area que e dela -- PAGINA_ATUAL e definido inline em cada HTML
    // (painel.html = 'financeiro', painel-pje.html = 'pje', etc.). Tudo acima continua calculado
    // do mesmo jeito de sempre (nao muda a logica de nenhuma secao), so a montagem final escolhe
    // o que realmente entra na pagina.
    var MAPA_CONTEUDO_POR_PAGINA = {
      inicio: htmlInicio,
      financeiro: htmlFinanceiro + htmlExito + painelVencidasHtml + htmlCobrancaAvulsa + htmlNotificacaoExtrajudicial + htmlCadastroCliente,
      pje: htmlPje,
      clientes: htmlClientes,
      processos: htmlProcessos + htmlProcessoAdministrativo,
      importar_oab: htmlImportarOab,
      criar_processo: htmlCriarProcesso,
      novo_cliente: htmlNovoCliente,
      agenda: htmlAgenda,
      automacoes: htmlPropostas + htmlContrato + htmlAutomacoes,
      padrao_operacional: htmlPadraoOperacional,
      audiencias: htmlAudiencias,
      admin: htmlConexoes,
      configuracoes: htmlConfiguracoes,
    };
    var MAPA_PERMISSAO_POR_PAGINA = {
      financeiro: 'financeiro', pje: 'pje', clientes: 'clientes', processos: 'processos',
      importar_oab: 'processos', criar_processo: 'processos', novo_cliente: 'clientes',
      agenda: 'agenda', automacoes: 'automacoes', padrao_operacional: 'padrao_operacional',
      audiencias: 'audiencias', admin: null, configuracoes: null,
    };
    var permissaoNecessaria = MAPA_PERMISSAO_POR_PAGINA[PAGINA_ATUAL];
    var temAcessoPagina = (PAGINA_ATUAL === 'admin' || PAGINA_ATUAL === 'configuracoes')
      ? !!dados.usuario_admin
      : (permissaoNecessaria ? perms.indexOf(permissaoNecessaria) !== -1 : true);
    var htmlConteudoPagina = temAcessoPagina
      ? (MAPA_CONTEUDO_POR_PAGINA[PAGINA_ATUAL] || '')
      : '<div class="empty-state"><div class="msg">Você não tem permissão para acessar esta área.</div></div>';

    conteudo.innerHTML =
      '<header class="masthead">' +
        '<div class="masthead-name">' + esc(dados.nome_escritorio || 'César Tobias Advocacia') + '<small>Painel do escritório</small></div>' +
        '<div class="masthead-meta">Logado como <strong>' + esc(dados.usuario_logado || '') + '</strong><br>' +
        'Gerado em <strong>' + fmtDataHora(dados.gerado_em) + '</strong> · Fuso America/Fortaleza</div>' +
      '</header>' +
      htmlConteudoPagina +
      '<footer><span>Dados de Contratos, Controle de Parcelas e Comunicações PJe</span>' +
      '<button class="btn-refresh" id="btn-atualizar">Atualizar agora</button></footer>';

    document.getElementById('btn-atualizar').addEventListener('click', function () {
      carregarDados();
    });

    var navAdminEl = document.getElementById('nav-admin');
    if (navAdminEl) navAdminEl.classList.toggle('hidden', !dados.usuario_admin || !sessaoEhTenant);
    var navConfigEl = document.getElementById('nav-configuracoes');
    if (navConfigEl) navConfigEl.classList.toggle('hidden', !dados.usuario_admin);

    wireSidebar(dados);

    var perfilNomeEl = document.getElementById('hdr-perfil-nome');
    if (perfilNomeEl) {
      var nomeAdv = dados.nome_advogado || dados.usuario_logado || '—';
      perfilNomeEl.textContent = nomeAdv;
      document.getElementById('hdr-perfil-escritorio').textContent = dados.nome_escritorio || '—';
      var iniciaisAdv = nomeAdv.trim().split(/\s+/).slice(0, 2).map(function (p) { return p[0]; }).join('').toUpperCase() || '--';
      document.getElementById('hdr-perfil-avatar').textContent = iniciaisAdv;
    }

    if (!temAcessoPagina) return;

    if (PAGINA_ATUAL === 'automacoes') { wireAutomacoes(); wireContrato(); }
    if (PAGINA_ATUAL === 'agenda') { wireAgenda(); carregarAgenda(); }
    if (PAGINA_ATUAL === 'financeiro') { wireCobranca(); wireOlhinhos(dados); wireNotificacaoExtrajudicial(); wireVisaoFinanceira(); wireDevedoresMes(); carregarListaClientesFinanceiro(); wireFormExito(); }
    if (PAGINA_ATUAL === 'processos') { carregarProcessos(); wireProcessosAdministrativos(); wireProcessosHub(); }
    if (PAGINA_ATUAL === 'importar_oab') { wireImportarOab(dados); }
    if (PAGINA_ATUAL === 'criar_processo') { wireProcessoManual(); }
    if (PAGINA_ATUAL === 'novo_cliente') { wireNovoCliente(); }
    if (PAGINA_ATUAL === 'clientes') carregarClientes();
    if (PAGINA_ATUAL === 'padrao_operacional') carregarPadraoOperacional();
    if (PAGINA_ATUAL === 'audiencias') { wireAudienciasSubtabs(); wireUploadAudiencia(); carregarAudiencias(); carregarPautaAudiencias(); }
    if (PAGINA_ATUAL === 'inicio') {
      var suporteInicio = document.getElementById('inicio-suporte');
      if (suporteInicio) {
        if (localStorage.getItem('inicio_suporte_fechado') === '1') {
          suporteInicio.style.display = 'none';
        } else {
          document.getElementById('btn-fechar-suporte-inicio').addEventListener('click', function () {
            suporteInicio.style.display = 'none';
            localStorage.setItem('inicio_suporte_fechado', '1');
          });
        }
      }
    }
    if (PAGINA_ATUAL === 'admin' && dados.usuario_admin) {
      if (document.getElementById('sec-conexoes')) wireConexoes();
    }
    if (PAGINA_ATUAL === 'configuracoes' && dados.usuario_admin) {
      wireConfiguracoes();
    }
  }

  // Redimensiona a imagem no navegador pra caber num A4 vertical (proporcao 1:1.414), pra nao
  // mandar arquivo gigante pra Lambda -- devolve so o base64, sem o prefixo "data:image/...".
  function redimensionarParaTimbrado(arquivo) {
    return new Promise(function (resolve, reject) {
      var leitor = new FileReader();
      leitor.onerror = reject;
      leitor.onload = function (e) {
        var img = new Image();
        img.onerror = reject;
        img.onload = function () {
          var larguraAlvo = 800, alturaAlvo = Math.round(800 * 1.414);
          var canvas = document.createElement('canvas');
          canvas.width = larguraAlvo; canvas.height = alturaAlvo;
          var ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, larguraAlvo, alturaAlvo);
          var escala = Math.min(larguraAlvo / img.width, alturaAlvo / img.height);
          var w = img.width * escala, h = img.height * escala;
          var x = (larguraAlvo - w) / 2, y = (alturaAlvo - h) / 2;
          ctx.drawImage(img, x, y, w, h);
          var dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          resolve(dataUrl.split(',')[1]);
        };
        img.src = e.target.result;
      };
      leitor.readAsDataURL(arquivo);
    });
  }

  function wireConfiguracoes() {
    document.querySelectorAll('[data-aba-config]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('[data-aba-config]').forEach(function (b) { b.classList.remove('ativo'); });
        btn.classList.add('ativo');
        var aba = btn.getAttribute('data-aba-config');
        document.querySelectorAll('.config-painel').forEach(function (p) { p.classList.add('hidden'); });
        document.getElementById('config-painel-' + aba).classList.remove('hidden');
      });
    });

    // aba Usuarios -- reaproveita htmlAdmin/carregarListaUsuarios/criarUsuarioAdmin tal e qual.
    carregarListaUsuarios();
    document.getElementById('admin-btn-criar').addEventListener('click', criarUsuarioAdmin);

    // aba Configuracao (dados do escritorio)
    apiGetJson('/api/painel?acao=escritorio_obter').then(function (d) {
      if (!d) return;
      var mapa = {
        'cfg-nome-escritorio': 'nome_escritorio', 'cfg-razao-social': 'razao_social', 'cfg-cnpj': 'cnpj',
        'cfg-inscricao-estadual': 'inscricao_estadual', 'cfg-inscricao-municipal': 'inscricao_municipal',
        'cfg-cep': 'cep', 'cfg-logradouro': 'logradouro', 'cfg-numero': 'numero', 'cfg-complemento': 'complemento',
        'cfg-bairro': 'bairro', 'cfg-cidade': 'cidade_endereco', 'cfg-uf': 'uf_endereco',
        'cfg-telefone': 'telefone', 'cfg-celular': 'celular', 'cfg-email': 'email_contato', 'cfg-site': 'site',
        'cfg-banco-nome': 'banco_nome', 'cfg-banco-agencia': 'banco_agencia', 'cfg-banco-conta': 'banco_conta',
        'cfg-banco-pix': 'banco_pix',
      };
      Object.keys(mapa).forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.value = d[mapa[id]] || '';
      });
      document.getElementById('cfg-isento-ie').checked = !!d.isento_ie;
    });

    document.getElementById('cfg-cep').addEventListener('input', function () {
      var digitos = this.value.replace(/\D/g, '').slice(0, 8);
      this.value = digitos.length > 5 ? digitos.slice(0, 5) + '-' + digitos.slice(5) : digitos;
      var statusEl = document.getElementById('cfg-cep-status');
      if (digitos.length !== 8) { statusEl.textContent = 'Busca automática ao digitar'; return; }
      statusEl.textContent = 'Buscando...';
      fetch('https://viacep.com.br/ws/' + digitos + '/json/')
        .then(function (r) { return r.json(); })
        .then(function (dados) {
          if (dados.erro) { statusEl.textContent = 'CEP não encontrado.'; return; }
          document.getElementById('cfg-logradouro').value = dados.logradouro || '';
          document.getElementById('cfg-bairro').value = dados.bairro || '';
          document.getElementById('cfg-cidade').value = dados.localidade || '';
          document.getElementById('cfg-uf').value = dados.uf || '';
          statusEl.textContent = 'Endereço encontrado.';
        })
        .catch(function () { statusEl.textContent = 'Não foi possível buscar o CEP agora.'; });
    });

    document.getElementById('cfg-btn-salvar').addEventListener('click', function () {
      var msg = document.getElementById('cfg-msg');
      msg.textContent = 'Salvando...';
      var corpo = {
        nome_escritorio: document.getElementById('cfg-nome-escritorio').value,
        razao_social: document.getElementById('cfg-razao-social').value,
        cnpj: document.getElementById('cfg-cnpj').value,
        inscricao_estadual: document.getElementById('cfg-inscricao-estadual').value,
        isento_ie: document.getElementById('cfg-isento-ie').checked,
        inscricao_municipal: document.getElementById('cfg-inscricao-municipal').value,
        cep: document.getElementById('cfg-cep').value,
        logradouro: document.getElementById('cfg-logradouro').value,
        numero: document.getElementById('cfg-numero').value,
        complemento: document.getElementById('cfg-complemento').value,
        bairro: document.getElementById('cfg-bairro').value,
        cidade_endereco: document.getElementById('cfg-cidade').value,
        uf_endereco: document.getElementById('cfg-uf').value,
        telefone: document.getElementById('cfg-telefone').value,
        celular: document.getElementById('cfg-celular').value,
        email_contato: document.getElementById('cfg-email').value,
        site: document.getElementById('cfg-site').value,
        banco_nome: document.getElementById('cfg-banco-nome').value,
        banco_agencia: document.getElementById('cfg-banco-agencia').value,
        banco_conta: document.getElementById('cfg-banco-conta').value,
        banco_pix: document.getElementById('cfg-banco-pix').value,
      };
      apiPost('/api/painel?acao=escritorio_salvar', corpo)
        .then(function (r) { return r.json().then(function (c) { return { status: r.status, corpo: c }; }); })
        .then(function (resultado) {
          msg.textContent = resultado.status === 200 ? 'Dados salvos com sucesso.' : (resultado.corpo.erro || 'Erro ao salvar.');
        });
    });

    // aba Avisos do escritorio
    var avisosCache = [];
    var modalAviso = document.getElementById('modal-aviso');
    var campoModalMensagem = document.getElementById('aviso-modal-mensagem');

    function carregarAvisos() {
      apiGetJson('/api/painel?acao=avisos_listar').then(function (d) {
        var container = document.getElementById('aviso-lista');
        if (!container || !d || !d.avisos) return;
        avisosCache = d.avisos;
        if (d.avisos.length === 0) {
          container.innerHTML = '<div class="empty-state"><div class="msg">Nenhum aviso cadastrado. Clique em "Novo aviso" para adicionar.</div></div>';
          return;
        }
        container.innerHTML = '<div class="table-scroll"><table class="aviso-tabela" style="min-width:520px;">' +
          '<thead><tr><th>Mensagem</th><th>Ativo</th><th>Ações</th></tr></thead>' +
          '<tbody>' + d.avisos.map(function (a) {
            return '<tr><td>' + esc(a.mensagem) + '</td>' +
              '<td><button class="btn-conexao-secundario" data-aviso-toggle="' + a.id + '" data-aviso-ativo="' + a.ativo + '">' +
                (a.ativo ? '<span class="chip good">Sim</span>' : '<span class="chip neutral">Não</span>') + '</button></td>' +
              '<td><button class="btn-conexao-secundario" data-aviso-editar="' + a.id + '">Editar</button> ' +
                '<button class="btn-remover" data-aviso-excluir="' + a.id + '">Excluir</button></td></tr>';
          }).join('') + '</tbody></table></div>';

        container.querySelectorAll('[data-aviso-toggle]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            apiPost('/api/painel?acao=aviso_atualizar', {
              id: btn.getAttribute('data-aviso-toggle'),
              ativo: btn.getAttribute('data-aviso-ativo') !== 'true',
            }).then(carregarAvisos);
          });
        });
        container.querySelectorAll('[data-aviso-editar]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var id = btn.getAttribute('data-aviso-editar');
            var aviso = avisosCache.filter(function (a) { return String(a.id) === String(id); })[0];
            if (aviso) abrirModalAviso(aviso);
          });
        });
        container.querySelectorAll('[data-aviso-excluir]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            if (!confirm('Excluir este aviso?')) return;
            apiPost('/api/painel?acao=aviso_excluir', { id: btn.getAttribute('data-aviso-excluir') }).then(carregarAvisos);
          });
        });
      });
    }
    carregarAvisos();

    function atualizarContadorAviso() {
      document.getElementById('aviso-modal-contador-num').textContent = campoModalMensagem.value.length;
    }
    campoModalMensagem.addEventListener('input', atualizarContadorAviso);

    function abrirModalAviso(aviso) {
      document.getElementById('aviso-modal-titulo').textContent = aviso ? 'Editar aviso' : 'Novo aviso';
      document.getElementById('aviso-modal-id').value = aviso ? aviso.id : '';
      campoModalMensagem.value = aviso ? aviso.mensagem : '';
      atualizarContadorAviso();
      var ativo = aviso ? aviso.ativo : true;
      document.querySelector('input[name="aviso-modal-ativo"][value="' + (ativo ? 'sim' : 'nao') + '"]').checked = true;
      document.getElementById('aviso-msg').textContent = '';
      modalAviso.classList.remove('hidden');
      campoModalMensagem.focus();
    }
    function fecharModalAviso() {
      modalAviso.classList.add('hidden');
    }
    document.getElementById('aviso-btn-novo').addEventListener('click', function () { abrirModalAviso(null); });
    document.getElementById('aviso-modal-fechar').addEventListener('click', fecharModalAviso);
    document.getElementById('aviso-modal-cancelar').addEventListener('click', fecharModalAviso);
    modalAviso.addEventListener('click', function (e) { if (e.target === modalAviso) fecharModalAviso(); });

    document.getElementById('aviso-modal-salvar').addEventListener('click', function () {
      var msg = document.getElementById('aviso-msg');
      var id = document.getElementById('aviso-modal-id').value;
      var mensagem = campoModalMensagem.value;
      var ativo = document.querySelector('input[name="aviso-modal-ativo"]:checked').value === 'sim';
      var acao = id ? 'aviso_atualizar' : 'aviso_criar';
      var corpo = id ? { id: id, mensagem: mensagem, ativo: ativo } : { mensagem: mensagem, ativo: ativo };
      apiPost('/api/painel?acao=' + acao, corpo)
        .then(function (r) { return r.json().then(function (c) { return { status: r.status, corpo: c }; }); })
        .then(function (resultado) {
          if (resultado.status !== 200) { msg.textContent = resultado.corpo.erro || 'Erro ao salvar o aviso.'; return; }
          fecharModalAviso();
          msg.textContent = id ? 'Aviso atualizado.' : 'Aviso publicado.';
          carregarAvisos();
        });
    });

    // aba Auditoria
    apiGetJson('/api/painel?acao=auditoria_listar').then(function (d) {
      var container = document.getElementById('auditoria-lista');
      if (!container || !d || !d.registros) return;
      if (d.registros.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="msg">Nenhuma ação registrada ainda.</div></div>';
        return;
      }
      container.innerHTML = '<div class="table-scroll"><table style="min-width:640px;">' +
        '<thead><tr><th>Data/Hora</th><th>Usuário</th><th>Ação</th><th>Entidade</th><th>Detalhes</th></tr></thead>' +
        '<tbody>' + d.registros.map(function (r) {
          return '<tr><td>' + fmtDataHora(r.criado_em) + '</td><td>' + esc(r.usuario || '—') + '</td>' +
            '<td>' + esc(r.acao) + '</td><td>' + esc(r.entidade) + (r.entidade_id ? ' #' + esc(r.entidade_id) : '') + '</td>' +
            '<td>' + esc(r.detalhes || '') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    });
  }

  function wireConexoes() {
    var LAMBDA_BASE = 'https://63quf5pqd4t5hgjuvi67r3juzq0mawnb.lambda-url.us-east-1.on.aws/';

    function verificarWhatsApp() {
      var chipWa = document.getElementById('conexao-status-wa');
      apiGetJson('/api/painel?acao=whatsapp_status')
        .then(function (dados) {
          if (dados.conectado) {
            chipWa.textContent = 'Conectado';
            chipWa.className = 'chip good';
          } else {
            chipWa.textContent = 'Não conectado';
            chipWa.className = 'chip neutral';
          }
        })
        .catch(function () {
          chipWa.textContent = 'Não foi possível checar';
          chipWa.className = 'chip warn';
        });
    }
    verificarWhatsApp();

    document.getElementById('btn-conexao-wa-qr').addEventListener('click', function () {
      var token = sessionStorage.getItem('painel_token');
      window.open(LAMBDA_BASE + '?action=whatsapp_conectar_iniciar&token=' + encodeURIComponent(token), '_blank');
    });
    document.getElementById('btn-conexao-wa-verificar').addEventListener('click', function () {
      var btn = this;
      var erroDiv = document.getElementById('conexao-erro-wa');
      erroDiv.innerHTML = '';
      btn.disabled = true; btn.textContent = 'Verificando...';
      apiGetJson('/api/painel?acao=whatsapp_status')
        .then(function (dados) {
          btn.disabled = false; btn.textContent = 'Verificar conexão';
          if (dados.conectado) {
            erroDiv.innerHTML = '<div class="aviso-tenant" style="background:var(--good-soft); color:var(--good);">WhatsApp conectado com sucesso.</div>';
          } else {
            erroDiv.innerHTML = '<div class="aviso-tenant">Ainda não detectei a conexão. Escaneie o QR code na aba aberta e tente de novo.</div>';
          }
          verificarWhatsApp();
        })
        .catch(function () {
          btn.disabled = false; btn.textContent = 'Verificar conexão';
          erroDiv.innerHTML = '<div class="aviso-tenant">Não foi possível checar agora. Tente de novo.</div>';
        });
    });

    document.getElementById('btn-conexao-asaas').addEventListener('click', function () {
      var btn = this;
      var chave = document.getElementById('conexao-asaas-key').value.trim();
      var erroDiv = document.getElementById('conexao-erro-asaas');
      erroDiv.innerHTML = '';
      if (!chave) {
        erroDiv.innerHTML = '<div class="aviso-tenant">Cole a chave de API primeiro.</div>';
        return;
      }
      btn.disabled = true; btn.textContent = 'Conectando...';
      apiPostJson('/api/painel?acao=asaas_conectar', { api_key: chave })
        .then(function (dados) {
          btn.disabled = false; btn.textContent = 'Conectar Asaas';
          // asaas_conectar devolve status 200 mesmo em falha de validacao (chave invalida) --
          // o erro vem dentro do corpo, nao via status HTTP, entao precisa checar aqui.
          if (!dados.conectado) {
            erroDiv.innerHTML = '<div class="aviso-tenant">' + esc(dados.erro || 'Não foi possível conectar.') + '</div>';
            return;
          }
          erroDiv.innerHTML = '<div class="aviso-tenant" style="background:var(--good-soft); color:var(--good);">Conectado! Conta: ' + esc(dados.nome_conta || '') + '</div>';
        })
        .catch(function (e) {
          btn.disabled = false; btn.textContent = 'Conectar Asaas';
          erroDiv.innerHTML = '<div class="aviso-tenant">' + esc(e.message || 'Não foi possível conectar.') + '</div>';
        });
    });

    document.getElementById('conexao-logo-input').addEventListener('change', function (ev) {
      var arquivo = ev.target.files[0];
      var previa = document.getElementById('conexao-logo-previa');
      previa.innerHTML = '';
      if (!arquivo) return;
      var img = new Image();
      var leitor = new FileReader();
      leitor.onload = function (e) { img.src = e.target.result; };
      img.onload = function () {
        var previewImg = document.createElement('img');
        previewImg.src = img.src;
        previewImg.style.maxWidth = '160px';
        previewImg.style.border = '1px solid var(--line)';
        previewImg.style.borderRadius = '6px';
        previa.appendChild(previewImg);
      };
      leitor.readAsDataURL(arquivo);
    });

    document.getElementById('btn-conexao-logo').addEventListener('click', function () {
      var btn = this;
      var arquivo = document.getElementById('conexao-logo-input').files[0];
      var erroDiv = document.getElementById('conexao-erro-logo');
      erroDiv.innerHTML = '';
      if (!arquivo) {
        erroDiv.innerHTML = '<div class="aviso-tenant">Escolha uma imagem primeiro.</div>';
        return;
      }
      btn.disabled = true; btn.textContent = 'Processando...';
      redimensionarParaTimbrado(arquivo)
        .then(function (logoBase64) {
          return apiPostJson('/api/painel?acao=upload_logo_tenant', { logo_base64: logoBase64 });
        })
        .then(function () {
          btn.disabled = false; btn.textContent = 'Enviar';
          erroDiv.innerHTML = '<div class="aviso-tenant" style="background:var(--good-soft); color:var(--good);">Papel timbrado enviado!</div>';
        })
        .catch(function (e) {
          btn.disabled = false; btn.textContent = 'Enviar';
          erroDiv.innerHTML = '<div class="aviso-tenant">' + esc(e.message || 'Não foi possível enviar a imagem.') + '</div>';
        });
    });
  }

  function wireUploadAudiencia() {
    var dropzone = document.getElementById('audiencia-upload-dropzone');
    var input = document.getElementById('audiencia-upload-input');
    var msg = document.getElementById('audiencia-upload-msg');
    var campoCliente = document.getElementById('audiencia-upload-cliente');
    var datalistClientes = document.getElementById('audiencia-upload-clientes-lista');

    apiGetJson('/api/painel?acao=clientes')
      .then(function (dados) {
        datalistClientes.innerHTML = (dados.clientes || []).map(function (c) {
          return '<option value="' + esc(c.nome) + '">';
        }).join('');
      })
      .catch(function () { /* datalist so ajuda, nao bloqueia o upload se falhar */ });

    document.getElementById('audiencia-upload-escolher').addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () {
      if (input.files[0]) processarUploadAudiencia(input.files[0]);
    });

    ['dragenter', 'dragover'].forEach(function (ev) {
      dropzone.addEventListener(ev, function (e) {
        e.preventDefault();
        dropzone.classList.add('arrastando');
      });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      dropzone.addEventListener(ev, function (e) {
        e.preventDefault();
        dropzone.classList.remove('arrastando');
      });
    });
    dropzone.addEventListener('drop', function (e) {
      var arquivo = e.dataTransfer.files && e.dataTransfer.files[0];
      if (arquivo) processarUploadAudiencia(arquivo);
    });

    function arrayBufferParaBase64(buffer) {
      var binario = '';
      var bytes = new Uint8Array(buffer);
      for (var i = 0; i < bytes.length; i++) binario += String.fromCharCode(bytes[i]);
      return btoa(binario);
    }

    function processarUploadAudiencia(arquivo) {
      var nomeCliente = (campoCliente.value || '').trim();
      if (!nomeCliente) {
        alert('Informe o nome do cliente antes de enviar o áudio.');
        return;
      }
      msg.innerHTML = '<strong>Enviando…</strong><span class="audiencia-upload-progresso" id="audiencia-upload-progresso">Iniciando…</span>';
      var progressoEl = document.getElementById('audiencia-upload-progresso');

      apiPost('/api/painel?acao=audiencias', {
        op: 'iniciar_upload_audiencia', cliente: nomeCliente,
        nome_arquivo: arquivo.name, mimetype: arquivo.type || 'application/octet-stream',
        tamanho_total: arquivo.size
      })
        .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.erro || 'falha'); return d; }); })
        .then(function (dados) {
          return enviarPedacos(arquivo, dados.upload_id, dados.tamanho_chunk, progressoEl);
        })
        .then(function (uploadId) {
          if (progressoEl) progressoEl.textContent = 'Transcrevendo (pode levar alguns minutos)…';
          return apiPost('/api/painel?acao=audiencias', { op: 'finalizar_upload_audiencia', upload_id: uploadId })
            .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.erro || 'falha'); return d; }); });
        })
        .then(function (dados) {
          msg.innerHTML = '<strong>Arraste a gravação aqui</strong><span>Áudio ou vídeo de audiência, reunião ou atendimento.</span>' +
            '<button type="button" id="audiencia-upload-escolher">Escolher arquivo</button>';
          document.getElementById('audiencia-upload-escolher').addEventListener('click', function () { input.click(); });
          campoCliente.value = '';
          input.value = '';
          carregarAudiencias();
          alert(dados.resposta || 'Áudio processado.');
        })
        .catch(function (e) {
          msg.innerHTML = '<strong>Arraste a gravação aqui</strong><span>Áudio ou vídeo de audiência, reunião ou atendimento.</span>' +
            '<button type="button" id="audiencia-upload-escolher">Escolher arquivo</button>';
          document.getElementById('audiencia-upload-escolher').addEventListener('click', function () { input.click(); });
          alert('Não foi possível processar o áudio: ' + (e.message || 'erro desconhecido'));
        });
    }

    function enviarPedacos(arquivo, uploadId, tamanhoChunk, progressoEl) {
      var offset = 0;
      function proximoPedaco() {
        if (offset >= arquivo.size) return Promise.resolve(uploadId);
        var pedaco = arquivo.slice(offset, offset + tamanhoChunk);
        return pedaco.arrayBuffer().then(function (buffer) {
          return apiPost('/api/painel?acao=audiencia_chunk', {
            upload_id: uploadId, dados_base64: arrayBufferParaBase64(buffer)
          }).then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.erro || 'falha'); return d; }); });
        }).then(function () {
          offset += tamanhoChunk;
          if (progressoEl) {
            var pct = Math.min(100, Math.round((offset / arquivo.size) * 100));
            progressoEl.textContent = pct + '% enviado';
          }
          return proximoPedaco();
        });
      }
      return proximoPedaco();
    }
  }

  function wireAudienciasSubtabs() {
    var titulo = document.getElementById('audiencias-titulo-aba');
    var listaMarcadas = document.getElementById('pauta-audiencias-lista');
    var listaRealizadas = document.getElementById('bloco-realizadas');
    document.querySelectorAll('[data-aba-audiencia]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('[data-aba-audiencia]').forEach(function (b) { b.classList.remove('ativo'); });
        btn.classList.add('ativo');
        var aba = btn.getAttribute('data-aba-audiencia');
        if (aba === 'marcadas') {
          listaMarcadas.classList.remove('hidden');
          listaRealizadas.classList.add('hidden');
          titulo.textContent = 'Marcadas (próximas)';
        } else {
          listaMarcadas.classList.add('hidden');
          listaRealizadas.classList.remove('hidden');
          titulo.textContent = 'Realizadas';
        }
      });
    });
  }

  function wireSidebar(dados) {
    var nomeUsuario = dados.usuario_logado || '';
    var iniciais = nomeUsuario.trim().split(/\s+/).slice(0, 2).map(function (p) { return p[0]; }).join('').toUpperCase() || '--';
    document.getElementById('sidebar-avatar').textContent = iniciais;
    document.getElementById('sidebar-rodape-usuario').textContent = nomeUsuario || '—';

    var perms = dados.usuario_permissoes || [];
    var itensNav = document.querySelectorAll('.nav-item[href]');
    var arquivoAtual = (window.location.pathname.split('/').pop() || 'painel.html');
    itensNav.forEach(function (item) {
      var secao = item.getAttribute('data-secao');
      // 'inicio' nao e uma area com permissao propria (nao existe isso no backend) -- e a
      // pagina de boas-vindas, sempre visivel pra qualquer usuario logado, por isso fica de
      // fora dessa checagem (mesma logica que ja excluia o item de Administracao, que nem tem
      // data-secao e usa a checagem separada dados.usuario_admin).
      if (secao && secao !== 'inicio') {
        item.classList.toggle('hidden', perms.indexOf(secao) === -1);
      }
      item.classList.toggle('ativo', (secao || 'admin') === PAGINA_ATUAL);

      var partesHref = item.getAttribute('href').split('#');
      var arquivoAlvo = partesHref[0];
      var ancora = partesHref[1];
      if (ancora && arquivoAlvo === arquivoAtual) {
        // mesma pagina -- so rola suavemente ate a secao, em vez de recarregar
        item.addEventListener('click', function (e) {
          var alvo = document.getElementById(ancora);
          if (!alvo) return;
          e.preventDefault();
          alvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
      // pagina diferente: deixa o navegador navegar normalmente pelo href (link de verdade)
    });

    wireScrollSpyMenu(itensNav);
  }

  function wireScrollSpyMenu(itensNav) {
    // paginas com mais de uma sub-secao no menu (ex: Financeiro tem 4) -- acende so a que esta
    // visivel na tela agora, em vez do grupo inteiro junto.
    var itensDoGrupo = Array.prototype.filter.call(itensNav, function (item) {
      return item.getAttribute('data-secao') === PAGINA_ATUAL;
    });
    if (itensDoGrupo.length < 2 || typeof IntersectionObserver === 'undefined') return;

    var mapa = itensDoGrupo.map(function (item) {
      var ancora = (item.getAttribute('href') || '').split('#')[1];
      return { item: item, alvo: ancora ? document.getElementById(ancora) : null };
    }).filter(function (m) { return m.alvo; });
    if (mapa.length < 2) return;

    var observer = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (entrada) {
        if (!entrada.isIntersecting) return;
        var atual = mapa.filter(function (m) { return m.alvo === entrada.target; })[0];
        if (!atual) return;
        mapa.forEach(function (m) { m.item.classList.toggle('ativo', m === atual); });
      });
    }, { rootMargin: '-15% 0px -70% 0px', threshold: 0 });

    mapa.forEach(function (m) { observer.observe(m.alvo); });
  }

  var clientesCarregados = [];

  function carregarClientes() {
    apiGetJson('/api/painel?acao=clientes')
      .then(function (dados) {
        clientesCarregados = dados.clientes || [];
        var busca = document.getElementById('clientes-busca');
        // veio de um link de outra pagina (ex: "Cobrança pendente" em Financeiro) apontando pra
        // um cliente especifico -- ja abre filtrado nele, em vez do usuario ter que buscar de novo.
        var clienteDaUrl = new URLSearchParams(window.location.search).get('cliente');
        if (clienteDaUrl && busca) busca.value = clienteDaUrl;
        renderClientes(clienteDaUrl
          ? clientesCarregados.filter(function (c) { return c.nome.toLowerCase().indexOf(clienteDaUrl.toLowerCase()) !== -1; })
          : clientesCarregados);
        if (busca) {
          busca.addEventListener('input', function () {
            var termo = busca.value.toLowerCase();
            renderClientes(clientesCarregados.filter(function (c) {
              return c.nome.toLowerCase().indexOf(termo) !== -1;
            }));
          });
        }
      })
      .catch(function () {
        document.getElementById('clientes-lista').innerHTML =
          '<div class="empty-state"><div class="msg">Não foi possível carregar os clientes.</div></div>';
      });
  }

  function renderClientes(clientes) {
    var container = document.getElementById('clientes-lista');
    if (clientes.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="msg">Nenhum cliente encontrado.</div></div>';
      return;
    }

    container.innerHTML = clientes.map(function (c, idx) {
      var parcelasPendentes = c.parcelas.length;
      var valorPendente = c.parcelas.reduce(function (soma, p) { return soma + (p.saldo || 0); }, 0);
      var contratosAtivos = c.contratos.filter(function (ct) { return String(ct.status).toUpperCase() === 'ATIVO'; }).length;

      var badges = '';
      if (contratosAtivos > 0) badges += '<span class="chip good">' + contratosAtivos + ' contrato(s) ativo(s)</span> ';
      if (parcelasPendentes > 0) badges += '<span class="chip crit">R$ ' + fmtMoeda(valorPendente) + ' pendente</span> ';
      if (c.processos.length > 0) badges += '<span class="chip neutral">' + c.processos.length + ' processo(s) PJe</span> ';
      if ((c.processos_administrativos || []).length > 0) badges += '<span class="chip neutral">' + c.processos_administrativos.length + ' processo(s) administrativo(s)</span>';

      var contratosHtml = c.contratos.map(function (ct) {
        return '<div class="prazo-card"><div class="prazo-card-topo">' +
          '<div><div class="prazo-processo">' + esc(ct.tipo_servico) + '</div>' +
          '<div class="prazo-meta">Valor total: R$ ' + fmtMoeda(ct.valor_total) + '</div></div>' +
          '<span class="days-badge ' + (String(ct.status).toUpperCase() === 'ATIVO' ? 'good' : 'warn') + '">' + esc(ct.status) + '</span>' +
        '</div></div>';
      }).join('') || '<div class="empty-state"><div class="msg">Sem contratos.</div></div>';

      var parcelasHtml = c.parcelas.map(function (p) {
        return '<div class="prazo-card"><div class="prazo-card-topo">' +
          '<div><div class="prazo-processo">R$ ' + fmtMoeda(p.saldo) + '</div>' +
          '<div class="prazo-meta">Vencimento: ' + esc(p.vencimento) + '</div></div>' +
          '<span class="days-badge ' + (p.situacao === 'Vencida' ? 'crit' : 'warn') + '">' + esc(p.situacao || 'Pendente') + '</span>' +
        '</div></div>';
      }).join('') || '<div class="empty-state"><div class="msg">Nenhuma parcela pendente.</div></div>';

      var processosHtml = c.processos.map(function (p) {
        return '<div class="prazo-card"><div class="prazo-card-topo">' +
          '<div><div class="prazo-processo">' + esc(p.processo) + '</div>' +
          '<div class="prazo-meta">' + esc(p.status_atual) + ' · última movimentação: ' + esc(p.ultima_movimentacao) + '</div></div>' +
          (p.proximo_prazo ? '<span class="days-badge warn">Prazo ' + esc(p.proximo_prazo) + '</span>' : '') +
        '</div></div>';
      }).join('') || '<div class="empty-state"><div class="msg">Nenhum processo vinculado.</div></div>';

      var ROTULOS_STATUS_PROCADM_CLIENTE = { aberto: 'Aberto', aguardando: 'Aguardando', concluido: 'Concluído' };
      var processosAdministrativosHtml = (c.processos_administrativos || []).map(function (p) {
        return '<div class="prazo-card"><div class="prazo-card-topo">' +
          '<div><div class="prazo-processo">' + esc(p.orgao || 'Órgão não informado') +
            (p.numero_protocolo ? ' · Protocolo ' + esc(p.numero_protocolo) : '') + '</div>' +
          '<div class="prazo-meta">' + esc(p.proximo_passo || 'Sem próximo passo definido') + '</div></div>' +
          '<span class="days-badge ' + (p.status === 'concluido' ? 'good' : (p.status === 'aguardando' ? 'warn' : 'neutral')) + '">' +
            esc(ROTULOS_STATUS_PROCADM_CLIENTE[p.status] || p.status) +
            (p.prazo ? ' · ' + esc(fmtDataCurta(p.prazo)) : '') + '</span>' +
        '</div></div>';
      }).join('') || '<div class="empty-state"><div class="msg">Nenhum processo administrativo vinculado.</div></div>';

      return '<div class="processo-card">' +
        '<button type="button" class="processo-cabecalho" data-toggle-cliente="' + idx + '" aria-expanded="false" aria-controls="cliente-corpo-' + idx + '">' +
          '<div><div class="processo-numero">' + esc(c.nome) + '</div>' +
          '<div class="processo-meta">' + badges + '</div></div>' +
        '</button>' +
        '<div class="processo-corpo" id="cliente-corpo-' + idx + '">' +
          '<p class="section-label" style="margin-top:8px;">Contratos</p>' + contratosHtml +
          '<p class="section-label" style="margin-top:16px;">Parcelas pendentes</p>' + parcelasHtml +
          '<p class="section-label" style="margin-top:16px;">Processos (PJe)</p>' + processosHtml +
          '<p class="section-label" style="margin-top:16px;">Processos administrativos</p>' + processosAdministrativosHtml +
        '</div>' +
      '</div>';
    }).join('');

    container.querySelectorAll('[data-toggle-cliente]').forEach(function (el) {
      el.addEventListener('click', function () {
        var corpo = document.getElementById('cliente-corpo-' + el.getAttribute('data-toggle-cliente'));
        var aberto = corpo.classList.toggle('aberto');
        el.setAttribute('aria-expanded', aberto ? 'true' : 'false');
      });
    });
  }

  function carregarProcessos() {
    apiGetJson('/api/painel?acao=processos&op=listar')
      .then(function (dados) {
        renderProcessos(dados.processos || []);
      })
      .catch(function () {
        document.getElementById('processos-lista').innerHTML =
          '<div class="empty-state"><div class="msg">Não foi possível carregar os processos.</div></div>';
      });
  }

  function renderProcessos(processos) {
    var container = document.getElementById('processos-lista');
    if (processos.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="msg">Nenhum processo com comunicações registradas ainda.</div></div>';
      return;
    }

    container.innerHTML = processos.map(function (p, idx) {
      var timelineHtml = p.timeline.map(function (item) {
        var classeAndamento = item.tipo_registro === 'andamento' ? ' timeline-item-andamento' : '';
        return '<div class="timeline-item' + classeAndamento + '">' +
          '<div class="timeline-item-data">' + esc(item.data) + (item.prazo ? ' · prazo ' + esc(item.prazo) : '') + '</div>' +
          '<div class="timeline-item-tipo">' + esc(item.tipo) + (item.tribunal ? ' — ' + esc(item.tribunal) : '') + '</div>' +
          (item.orgao ? '<div class="prazo-orgao">' + esc(item.orgao) + '</div>' : '') +
          (item.resumo ? '<div class="timeline-item-resumo">' + esc(item.resumo) + '</div>' : '') +
          (item.link ? '<div style="margin-top:4px;"><a href="' + esc(item.link) + '" target="_blank" rel="noopener" class="link-original">Ver comunicação original</a></div>' : '') +
        '</div>';
      }).join('');

      var badges = '<span class="chip neutral">' + p.total_movimentacoes + ' movimentação(ões)</span>';
      if (p.proximo_prazo) badges = '<span class="chip warn">Prazo ' + esc(p.proximo_prazo) + '</span>' + badges;

      return '<div class="processo-card">' +
        '<button type="button" class="processo-cabecalho" data-toggle-processo="' + idx + '" aria-expanded="false" aria-controls="processo-corpo-' + idx + '">' +
          '<div><div class="processo-numero">' + esc(p.processo) + '</div>' +
          (p.cliente ? '<div class="processo-cliente">' + esc(p.cliente) + '</div>' : '<div class="processo-cliente" style="color:var(--ink-faint);">Cliente não identificado</div>') +
          '<div class="processo-meta">' + esc(p.tribunal) + (p.orgao_atual ? ' · ' + esc(p.orgao_atual) : '') + ' · última movimentação: ' + esc(p.ultima_movimentacao) + '</div></div>' +
          '<div class="processo-badges">' + badges + '</div>' +
        '</button>' +
        '<div class="processo-corpo" id="processo-corpo-' + idx + '">' +
          '<div class="processo-edit-form">' +
            '<input type="text" placeholder="Cliente vinculado" id="processo-cliente-' + idx + '" value="' + esc(p.cliente || '') + '">' +
            '<input type="date" placeholder="Próxima audiência" id="processo-audiencia-' + idx + '" value="' + esc(p.proxima_audiencia || '') + '">' +
            '<button data-salvar-processo="' + idx + '">Salvar</button>' +
            '<textarea placeholder="Observações internas" id="processo-obs-' + idx + '">' + esc(p.observacoes || '') + '</textarea>' +
          '</div>' +
          (p.proxima_audiencia ? '<div class="chip warn" style="margin-bottom:12px;">Próxima audiência: ' + esc(fmtDataCurta(p.proxima_audiencia)) + '</div>' : '') +
          '<div class="timeline">' + timelineHtml + '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    container.querySelectorAll('[data-toggle-processo]').forEach(function (el) {
      el.addEventListener('click', function () {
        var corpo = document.getElementById('processo-corpo-' + el.getAttribute('data-toggle-processo'));
        var aberto = corpo.classList.toggle('aberto');
        el.setAttribute('aria-expanded', aberto ? 'true' : 'false');
      });
    });

    container.querySelectorAll('[data-salvar-processo]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var idx = btn.getAttribute('data-salvar-processo');
        var processo = processos[idx].processo;
        var cliente = document.getElementById('processo-cliente-' + idx).value;
        var audiencia = document.getElementById('processo-audiencia-' + idx).value;
        var observacoes = document.getElementById('processo-obs-' + idx).value;
        var textoOriginal = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Salvando...';
        apiPost('/api/painel?acao=processos', {
          op: 'salvar_meta',
          processo: processo,
          cliente: cliente,
          proxima_audiencia: audiencia,
          observacoes: observacoes
        }).then(function (r) { return r.json(); }).then(function () {
          carregarProcessos();
        }).catch(function () {
          btn.disabled = false;
          btn.textContent = textoOriginal;
          alert('Não foi possível salvar agora.');
        });
      });
    });
  }

  function arquivoParaBase64ProcAdm(arquivo) {
    return arquivo.arrayBuffer().then(function (buffer) {
      var binario = '';
      var bytes = new Uint8Array(buffer);
      for (var i = 0; i < bytes.length; i++) binario += String.fromCharCode(bytes[i]);
      return btoa(binario);
    });
  }

  var MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

  function fmtDataProcesso(iso) {
    if (!iso) return '—';
    var partes = String(iso).split('-');
    if (partes.length !== 3) return iso;
    return partes[2].slice(0, 2) + '/' + MESES_ABREV[parseInt(partes[1], 10) - 1] + '/' + partes[0];
  }

  var _processosManuaisCarregados = [];

  var TIPOS_ATO_PROCESSUAL = [
    'Decisão', 'Despacho', 'Sentença', 'Intimação', 'Publicação', 'Distribuição', 'Juntada', 'Movimentação', 'Protocolo',
  ];

  function _garantirModalAtosProcessuais() {
    if (document.getElementById('modal-atos-processuais')) return;
    var div = document.createElement('div');
    div.innerHTML =
      '<div id="modal-atos-processuais" class="modal-overlay hidden">' +
        '<div class="modal-drill-caixa" style="max-width:600px;">' +
          '<div class="modal-drill-cabecalho">' +
            '<span class="modal-drill-titulo" id="atos-modal-titulo">Atos Processuais</span>' +
            '<button type="button" class="modal-drill-fechar" id="atos-modal-fechar" aria-label="Fechar">✕</button>' +
          '</div>' +
          '<div id="atos-modal-corpo-lista">' +
            '<div style="display:flex; align-items:center; gap:8px; padding:12px 20px; border-bottom:1px solid var(--line); flex-wrap:wrap;">' +
              '<button type="button" class="subtab-btn ativo" data-atos-filtro="Todos">Todos</button>' +
              '<button type="button" class="subtab-btn" data-atos-filtro="Tribunal">Tribunal</button>' +
              '<button type="button" class="subtab-btn" data-atos-filtro="Escritorio">Escritório</button>' +
              '<button type="button" id="atos-btn-novo" style="margin-left:auto; padding:7px 14px; border:none; border-radius:999px; background:var(--accent); color:#fff; font-size:12.5px; font-weight:600; cursor:pointer;">+ Novo Ato</button>' +
            '</div>' +
            '<div id="atos-modal-lista" class="modal-drill-corpo"></div>' +
          '</div>' +
          '<div id="atos-modal-corpo-form" class="hidden" style="padding:18px 20px;">' +
            '<div id="atos-form-erro"></div>' +
            '<label>Origem</label>' +
            '<select id="atos-form-origem" style="width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid var(--line);border-radius:7px;font-size:13.5px;background:var(--bg);color:var(--ink);margin-bottom:14px;">' +
              '<option value="Tribunal">Tribunal</option>' +
              '<option value="Escritorio">Escritório</option>' +
            '</select>' +
            '<label>Tipo</label>' +
            '<select id="atos-form-tipo" style="width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid var(--line);border-radius:7px;font-size:13.5px;background:var(--bg);color:var(--ink);margin-bottom:14px;">' +
              TIPOS_ATO_PROCESSUAL.map(function (t) { return '<option value="' + esc(t) + '">' + esc(t) + '</option>'; }).join('') +
            '</select>' +
            '<label>Descrição</label>' +
            '<textarea id="atos-form-descricao" rows="3" style="width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid var(--line);border-radius:7px;font-size:13.5px;font-family:inherit;background:var(--bg);color:var(--ink);resize:vertical;margin-bottom:14px;"></textarea>' +
            '<label>Data</label>' +
            '<div style="display:flex; gap:8px; margin-bottom:18px;">' +
              '<input type="date" id="atos-form-data" style="flex:1;padding:9px 10px;border:1px solid var(--line);border-radius:7px;font-size:13.5px;background:var(--bg);color:var(--ink);">' +
              '<button type="button" id="atos-btn-hoje" style="padding:9px 14px;border:1px solid var(--line);border-radius:7px;background:var(--surface-sunken);color:var(--ink-soft);font-size:13px;cursor:pointer;">Hoje</button>' +
            '</div>' +
            '<div style="display:flex; gap:8px; justify-content:flex-end;">' +
              '<button type="button" id="atos-btn-cancelar" style="padding:9px 16px;border:1px solid var(--line);border-radius:7px;background:var(--surface-sunken);color:var(--ink-soft);font-size:13px;cursor:pointer;">Cancelar</button>' +
              '<button type="button" id="atos-btn-registrar" style="padding:9px 16px;border:none;border-radius:7px;background:var(--accent);color:#fff;font-size:13px;font-weight:600;cursor:pointer;">Registrar</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(div.firstChild);

    var overlay = document.getElementById('modal-atos-processuais');
    var processoAtual = null;
    var atosCarregados = [];
    var filtroAtual = 'Todos';

    function fechar() { overlay.classList.add('hidden'); }
    document.getElementById('atos-modal-fechar').addEventListener('click', fechar);
    overlay.addEventListener('click', function (ev) { if (ev.target === overlay) fechar(); });

    function mostrarLista() {
      document.getElementById('atos-modal-corpo-form').classList.add('hidden');
      document.getElementById('atos-modal-corpo-lista').classList.remove('hidden');
    }
    function mostrarForm() {
      document.getElementById('atos-modal-corpo-lista').classList.add('hidden');
      document.getElementById('atos-modal-corpo-form').classList.remove('hidden');
      document.getElementById('atos-form-erro').innerHTML = '';
      document.getElementById('atos-form-origem').value = 'Escritorio';
      document.getElementById('atos-form-tipo').value = TIPOS_ATO_PROCESSUAL[0];
      document.getElementById('atos-form-descricao').value = '';
      document.getElementById('atos-form-data').value = new Date().toISOString().slice(0, 10);
    }

    function renderLista() {
      var corpo = document.getElementById('atos-modal-lista');
      var filtrados = filtroAtual === 'Todos' ? atosCarregados : atosCarregados.filter(function (a) { return a.origem === filtroAtual; });
      if (filtrados.length === 0) {
        corpo.innerHTML = '<div class="empty-state"><div class="msg">Nenhum ato processual registrado.</div></div>';
        return;
      }
      corpo.innerHTML = filtrados.map(function (a) {
        return '<div class="prazo-card">' +
          '<div class="prazo-card-topo">' +
            '<div><span class="chip ' + (a.origem === 'Tribunal' ? 'neutral' : 'good') + '">' + esc(a.origem === 'Tribunal' ? 'Tribunal' : 'Escritório') + '</span> ' +
              '<strong style="font-size:13.5px;">' + esc(a.tipo || 'Ato') + '</strong></div>' +
            '<span class="prazo-meta">' + fmtDataProcesso(a.data) + '</span>' +
          '</div>' +
          (a.descricao ? '<div class="prazo-resumo">' + esc(a.descricao) + '</div>' : '') +
          (a.link ? '<div style="margin-top:6px;"><a href="' + esc(a.link) + '" target="_blank" rel="noopener" style="font-size:12px;color:var(--accent);">Ver documento original</a></div>' : '') +
        '</div>';
      }).join('');
    }

    function carregarAtos() {
      document.getElementById('atos-modal-lista').innerHTML = '<div class="empty-state"><div class="msg">Carregando…</div></div>';
      apiGetJson('/api/painel?acao=ato_processual_listar&processo_id=' + processoAtual.id)
        .then(function (dados) {
          atosCarregados = dados.atos || [];
          renderLista();
        })
        .catch(function () {
          document.getElementById('atos-modal-lista').innerHTML = '<div class="empty-state"><div class="msg">Não foi possível carregar os atos agora.</div></div>';
        });
    }

    document.querySelectorAll('[data-atos-filtro]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('[data-atos-filtro]').forEach(function (b) { b.classList.remove('ativo'); });
        btn.classList.add('ativo');
        filtroAtual = btn.getAttribute('data-atos-filtro');
        renderLista();
      });
    });

    document.getElementById('atos-btn-novo').addEventListener('click', mostrarForm);
    document.getElementById('atos-btn-cancelar').addEventListener('click', mostrarLista);
    document.getElementById('atos-btn-hoje').addEventListener('click', function () {
      document.getElementById('atos-form-data').value = new Date().toISOString().slice(0, 10);
    });

    document.getElementById('atos-btn-registrar').addEventListener('click', function () {
      var btn = this;
      var erroDiv = document.getElementById('atos-form-erro');
      erroDiv.innerHTML = '';
      var corpo = {
        processo_id: processoAtual.id,
        origem: document.getElementById('atos-form-origem').value,
        tipo: document.getElementById('atos-form-tipo').value,
        descricao: document.getElementById('atos-form-descricao').value.trim(),
        data: document.getElementById('atos-form-data').value,
      };
      btn.disabled = true; btn.textContent = 'Registrando...';
      apiPostJson('/api/painel?acao=ato_processual_criar', corpo)
        .then(function () {
          btn.disabled = false; btn.textContent = 'Registrar';
          mostrarLista();
          carregarAtos();
        })
        .catch(function (e) {
          btn.disabled = false; btn.textContent = 'Registrar';
          erroDiv.innerHTML = '<div class="aviso-tenant">' + esc(e.message || 'Não foi possível registrar o ato agora.') + '</div>';
        });
    });

    overlay._abrirParaProcesso = function (processo) {
      processoAtual = processo;
      filtroAtual = 'Todos';
      document.querySelectorAll('[data-atos-filtro]').forEach(function (b) { b.classList.toggle('ativo', b.getAttribute('data-atos-filtro') === 'Todos'); });
      document.getElementById('atos-modal-titulo').textContent = 'Atos Processuais — ' + (processo.numero_cnj || processo.cliente_nome);
      mostrarLista();
      overlay.classList.remove('hidden');
      carregarAtos();
    };
  }

  function abrirModalAtosProcessuais(processo) {
    _garantirModalAtosProcessuais();
    document.getElementById('modal-atos-processuais')._abrirParaProcesso(processo);
  }

  function _fmtTamanhoArquivo(bytes) {
    if (!bytes && bytes !== 0) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function _arrayBufferParaBase64Doc(buffer) {
    var binario = '';
    var bytes = new Uint8Array(buffer);
    for (var i = 0; i < bytes.length; i++) binario += String.fromCharCode(bytes[i]);
    return btoa(binario);
  }

  function _garantirModalDocumentosProcesso() {
    if (document.getElementById('modal-documentos-processo')) return;
    var div = document.createElement('div');
    div.innerHTML =
      '<div id="modal-documentos-processo" class="modal-overlay hidden">' +
        '<div class="modal-drill-caixa" style="max-width:600px;">' +
          '<div class="modal-drill-cabecalho">' +
            '<span class="modal-drill-titulo" id="docs-modal-titulo">Documentos</span>' +
            '<button type="button" class="modal-drill-fechar" id="docs-modal-fechar" aria-label="Fechar">✕</button>' +
          '</div>' +
          '<div style="padding:18px 20px; border-bottom:1px solid var(--line);">' +
            '<div id="docs-dropzone" style="border:2px dashed var(--line); border-radius:10px; padding:22px; text-align:center; cursor:pointer; color:var(--ink-soft); font-size:13px;">' +
              '<strong style="display:block; color:var(--ink); font-size:13.5px; margin-bottom:4px;">Arraste o arquivo aqui ou clique para escolher</strong>' +
              '<span>PDF, Word, JPG ou PNG · máximo 10 MB</span>' +
            '</div>' +
            '<input type="file" id="docs-input-arquivo" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" style="display:none;">' +
            '<label style="display:block; margin-top:12px;">Descrição (opcional)</label>' +
            '<input type="text" id="docs-input-descricao" style="width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid var(--line);border-radius:7px;font-size:13.5px;background:var(--bg);color:var(--ink);margin-top:6px;">' +
            '<div id="docs-arquivo-selecionado" style="font-size:12.5px; color:var(--ink-soft); margin-top:8px;"></div>' +
            '<div style="display:flex; justify-content:flex-end; margin-top:12px;">' +
              '<button type="button" id="docs-btn-enviar" style="padding:9px 16px;border:none;border-radius:7px;background:var(--accent);color:#fff;font-size:13px;font-weight:600;cursor:pointer;" disabled>Enviar</button>' +
            '</div>' +
            '<div id="docs-upload-status" style="font-size:12.5px; color:var(--ink-soft); margin-top:6px;"></div>' +
          '</div>' +
          '<div id="docs-modal-lista" class="modal-drill-corpo"></div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(div.firstChild);

    var overlay = document.getElementById('modal-documentos-processo');
    var processoAtual = null;
    var arquivoEscolhido = null;
    var dropzone = document.getElementById('docs-dropzone');
    var inputArquivo = document.getElementById('docs-input-arquivo');
    var inputDescricao = document.getElementById('docs-input-descricao');
    var btnEnviar = document.getElementById('docs-btn-enviar');
    var arquivoSelecionadoEl = document.getElementById('docs-arquivo-selecionado');
    var statusEl = document.getElementById('docs-upload-status');

    function fechar() { overlay.classList.add('hidden'); }
    document.getElementById('docs-modal-fechar').addEventListener('click', fechar);
    overlay.addEventListener('click', function (ev) { if (ev.target === overlay) fechar(); });

    dropzone.addEventListener('click', function () { inputArquivo.click(); });
    dropzone.addEventListener('dragover', function (e) { e.preventDefault(); dropzone.classList.add('arrastando'); });
    ['dragleave', 'drop'].forEach(function (ev) {
      dropzone.addEventListener(ev, function (e) { e.preventDefault(); dropzone.classList.remove('arrastando'); });
    });
    dropzone.addEventListener('drop', function (e) {
      var arquivo = e.dataTransfer.files && e.dataTransfer.files[0];
      if (arquivo) escolherArquivo(arquivo);
    });
    inputArquivo.addEventListener('change', function () {
      if (inputArquivo.files && inputArquivo.files[0]) escolherArquivo(inputArquivo.files[0]);
    });

    function escolherArquivo(arquivo) {
      if (arquivo.size > 10 * 1024 * 1024) {
        statusEl.textContent = 'Arquivo maior que 10 MB.';
        return;
      }
      arquivoEscolhido = arquivo;
      arquivoSelecionadoEl.textContent = arquivo.name + ' (' + _fmtTamanhoArquivo(arquivo.size) + ')';
      statusEl.textContent = '';
      btnEnviar.disabled = false;
    }

    function renderLista(documentos) {
      var corpo = document.getElementById('docs-modal-lista');
      if (!documentos || documentos.length === 0) {
        corpo.innerHTML = '<div class="empty-state"><div class="msg">Nenhum documento neste processo. Envie o primeiro arquivo acima.</div></div>';
        return;
      }
      corpo.innerHTML = documentos.map(function (d) {
        return '<div class="prazo-card">' +
          '<div class="prazo-card-topo">' +
            '<div><strong style="font-size:13.5px;">' + esc(d.nome_arquivo) + '</strong> ' +
              '<span class="prazo-meta">' + _fmtTamanhoArquivo(d.tamanho) + '</span></div>' +
            '<a href="' + esc(d.link) + '" target="_blank" rel="noopener" style="font-size:12.5px; color:var(--accent);">Abrir</a>' +
          '</div>' +
          (d.descricao ? '<div class="prazo-resumo">' + esc(d.descricao) + '</div>' : '') +
          '<div style="margin-top:6px;"><button type="button" class="procman-acao-excluir" data-docs-excluir="' + d.id + '" style="border:none;background:none;color:var(--danger,#c0392b);font-size:12px;cursor:pointer;padding:0;">Excluir</button></div>' +
        '</div>';
      }).join('');

      Array.prototype.forEach.call(corpo.querySelectorAll('[data-docs-excluir]'), function (btn) {
        btn.addEventListener('click', function () {
          if (!window.confirm('Excluir este documento?')) return;
          var id = btn.getAttribute('data-docs-excluir');
          apiPostJson('/api/painel?acao=documento_processo_excluir', { id: id })
            .then(function () { carregarDocumentos(); })
            .catch(function (e) { alert(e.message || 'Não foi possível excluir o documento agora.'); });
        });
      });
    }

    function carregarDocumentos() {
      document.getElementById('docs-modal-lista').innerHTML = '<div class="empty-state"><div class="msg">Carregando…</div></div>';
      apiGetJson('/api/painel?acao=documento_processo_listar&processo_id=' + processoAtual.id)
        .then(function (dados) { renderLista(dados.documentos || []); })
        .catch(function () {
          document.getElementById('docs-modal-lista').innerHTML = '<div class="empty-state"><div class="msg">Não foi possível carregar os documentos agora.</div></div>';
        });
    }

    function enviarPedacosDoc(arquivo, uploadId, tamanhoChunk) {
      var offset = 0;
      function proximoPedaco() {
        if (offset >= arquivo.size) return Promise.resolve(uploadId);
        var pedaco = arquivo.slice(offset, offset + tamanhoChunk);
        return pedaco.arrayBuffer().then(function (buffer) {
          return apiPostJson('/api/painel?acao=documento_processo_upload_chunk', {
            upload_id: uploadId, dados_base64: _arrayBufferParaBase64Doc(buffer)
          });
        }).then(function () {
          offset += tamanhoChunk;
          var pct = Math.min(100, Math.round((offset / arquivo.size) * 100));
          statusEl.textContent = pct + '% enviado';
          return proximoPedaco();
        });
      }
      return proximoPedaco();
    }

    btnEnviar.addEventListener('click', function () {
      if (!arquivoEscolhido) return;
      btnEnviar.disabled = true;
      statusEl.textContent = 'Iniciando…';
      var arquivo = arquivoEscolhido;
      apiPostJson('/api/painel?acao=documento_processo_upload_iniciar', {
        processo_id: processoAtual.id, nome_arquivo: arquivo.name,
        mimetype: arquivo.type || 'application/octet-stream', tamanho_total: arquivo.size,
        descricao: inputDescricao.value.trim(),
      })
        .then(function (dados) { return enviarPedacosDoc(arquivo, dados.upload_id, dados.tamanho_chunk); })
        .then(function (uploadId) {
          statusEl.textContent = 'Concluindo…';
          return apiPostJson('/api/painel?acao=documento_processo_upload_finalizar', { upload_id: uploadId });
        })
        .then(function () {
          statusEl.textContent = '';
          arquivoEscolhido = null;
          arquivoSelecionadoEl.textContent = '';
          inputDescricao.value = '';
          inputArquivo.value = '';
          btnEnviar.disabled = true;
          carregarDocumentos();
        })
        .catch(function (e) {
          btnEnviar.disabled = false;
          statusEl.textContent = 'Não foi possível enviar: ' + (e.message || 'erro desconhecido');
        });
    });

    overlay._abrirParaProcesso = function (processo) {
      processoAtual = processo;
      arquivoEscolhido = null;
      arquivoSelecionadoEl.textContent = '';
      inputDescricao.value = '';
      inputArquivo.value = '';
      btnEnviar.disabled = true;
      statusEl.textContent = '';
      document.getElementById('docs-modal-titulo').textContent = 'Documentos — ' + (processo.numero_cnj || processo.cliente_nome);
      overlay.classList.remove('hidden');
      carregarDocumentos();
    };
  }

  function abrirModalDocumentosProcesso(processo) {
    _garantirModalDocumentosProcesso();
    document.getElementById('modal-documentos-processo')._abrirParaProcesso(processo);
  }

  function _chipStatusProcesso(status) {
    if (status === 'Finalizado') return 'good';
    if (status === 'Suspenso') return 'warn';
    if (status === 'Arquivado') return 'neutral';
    return 'neutral';
  }

  function _numeroCnjValidoParaDatajud(numero) {
    return ((numero || '').replace(/\D/g, '').length === 20);
  }

  var _processosManuaisTodos = [];

  function _passaNoFiltroStatusProcesso(status, grupo) {
    // agrupa os 4 status reais (Em andamento/Suspenso/Finalizado/Arquivado) em categorias mais
    // amplas, do jeito que a busca avançada oferece -- "Suspenso" conta como ativo porque o
    // processo ainda não foi concluído, só está parado.
    if (grupo === 'todos' || !grupo) return true;
    if (grupo === 'arquivados') return status === 'Arquivado';
    if (grupo === 'encerrados') return status === 'Finalizado';
    if (grupo === 'ativos') return status === 'Em andamento' || status === 'Suspenso';
    if (grupo === 'ativos_encerrados') return status !== 'Arquivado';
    return true;
  }

  function _passaNosFiltrosProcesso(p, f) {
    if (f.numero && (p.numero_cnj || '').toLowerCase().indexOf(f.numero) === -1) return false;
    if (f.cliente && (p.cliente_nome || '').toLowerCase().indexOf(f.cliente) === -1) return false;
    if (f.tribunal && (p.tribunal || '').toLowerCase().indexOf(f.tribunal) === -1) return false;
    if (!_passaNoFiltroStatusProcesso(p.status, f.status)) return false;
    if (f.palavra) {
      var alvo = [p.numero_cnj, p.classe_processual, p.orgao_julgador, p.comarca, p.area_direito]
        .filter(Boolean).join(' ').toLowerCase();
      if (alvo.indexOf(f.palavra) === -1) return false;
    }
    return true;
  }

  function _renderTabelaProcessosManuais(processos) {
    var lista = document.getElementById('procman-lista');
    if (!lista) return;
    _processosManuaisCarregados = processos;
    if (processos.length === 0) {
      lista.innerHTML = '<div class="empty-state"><div class="msg" style="color:#8293b5;">Nenhum processo encontrado.</div></div>';
      return;
    }
    var svgEditar = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>';
    var svgAtos = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v18"></path><path d="M5 7l-3 6a3 3 0 0 0 6 0z"></path><path d="M19 7l-3 6a3 3 0 0 0 6 0z"></path><path d="M5 7h14M9 3h6"></path></svg>';
    var svgDocs = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4h11l5 5v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"></path><path d="M14 4v5h5"></path></svg>';
    var svgMais = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="6" r="1.8"></circle><circle cx="12" cy="12" r="1.8"></circle><circle cx="12" cy="18" r="1.8"></circle></svg>';

    lista.innerHTML = '<table><thead><tr>' +
      '<th>Processo</th><th>Monitoramento</th><th>Status</th><th>Cadastrado em</th><th></th>' +
      '</tr></thead><tbody>' +
      processos.map(function (p, indice) {
        var monitorado = _numeroCnjValidoParaDatajud(p.numero_cnj) && !!p.tribunal;
        var importadoOab = p.origem === 'oab';
        return '<tr>' +
          '<td>' +
            '<button type="button" class="procpage-numero-link" data-procpage-abrir="' + indice + '">' + esc(p.numero_cnj || 'Sem número') + '</button>' +
            '<div class="procpage-sub">' + esc(p.cliente_nome) + (p.tribunal ? ' · ' + esc(p.tribunal) : '') +
              '<span class="procpage-tag">' + (importadoOab ? 'Importado (OAB)' : 'Manual') + '</span></div>' +
          '</td>' +
          '<td><span class="chip ' + (monitorado ? 'good' : 'neutral') + '" title="' +
            (monitorado ? 'Número e tribunal reconhecidos — entra na sincronização diária de movimentações via DataJud (base pública do CNJ).' : 'Preencha o número do processo (formato completo) e o tribunal pra habilitar a sincronização automática via DataJud.') +
            '">' + (monitorado ? 'Monitorado automaticamente' : 'Sem monitoramento automático') + '</span></td>' +
          '<td><span class="chip ' + _chipStatusProcesso(p.status) + '">' + esc(p.status || '—') + '</span></td>' +
          '<td style="color:#8293b5;">' + fmtDataProcesso(String(p.criado_em || '').slice(0, 10)) + '</td>' +
          '<td>' +
            '<div class="procpage-acoes-icones">' +
              '<a class="procpage-icone-btn" title="Editar" href="painel-criar-processo.html?editar=' + p.id + '#sec-criar-processo">' + svgEditar + '</a>' +
              '<button type="button" class="procpage-icone-btn" title="Atos processuais" data-procman-atos="' + indice + '">' + svgAtos + '</button>' +
              '<button type="button" class="procpage-icone-btn" title="Documentos" data-procman-docs="' + indice + '">' + svgDocs + '</button>' +
              '<span class="procman-acoes-wrap">' +
                '<button type="button" class="procpage-icone-btn" data-procman-mais="' + indice + '" aria-label="Mais opções">' + svgMais + '</button>' +
                '<div class="procman-acoes-menu hidden" data-procman-menu="' + indice + '">' +
                  '<a href="painel-criar-processo.html?editar=' + p.id + '#sec-criar-processo">Editar</a>' +
                  '<button type="button" data-procman-status-acao="Finalizado" data-procman-indice="' + indice + '">Encerrar</button>' +
                  '<button type="button" data-procman-status-acao="Arquivado" data-procman-indice="' + indice + '">Arquivar</button>' +
                  '<button type="button" class="procman-acao-excluir" data-procman-excluir="' + indice + '">Excluir</button>' +
                '</div>' +
              '</span>' +
            '</div>' +
          '</td>' +
        '</tr>';
      }).join('') +
      '</tbody></table>';
  }

  function _lerFiltrosProcessoAtuais() {
    var el = function (id) { return document.getElementById(id); };
    return {
      numero: (el('procpage-filtro-numero') || {}).value ? el('procpage-filtro-numero').value.trim().toLowerCase() : '',
      cliente: (el('procpage-filtro-cliente') || {}).value ? el('procpage-filtro-cliente').value.trim().toLowerCase() : '',
      tribunal: (el('procpage-filtro-tribunal') || {}).value ? el('procpage-filtro-tribunal').value.trim().toLowerCase() : '',
      status: el('procpage-filtro-status') ? el('procpage-filtro-status').value : 'ativos_encerrados',
      palavra: (el('procpage-filtro-palavra') || {}).value ? el('procpage-filtro-palavra').value.trim().toLowerCase() : '',
    };
  }

  function carregarProcessosManuais() {
    var lista = document.getElementById('procman-lista');
    if (!lista) return;
    apiGetJson('/api/painel?acao=processo_manual_listar')
      .then(function (dados) {
        _processosManuaisTodos = dados.processos || [];
        var f = _lerFiltrosProcessoAtuais();
        _renderTabelaProcessosManuais(_processosManuaisTodos.filter(function (p) { return _passaNosFiltrosProcesso(p, f); }));
      })
      .catch(function () {
        lista.innerHTML = '<div class="empty-state"><div class="msg" style="color:#8293b5;">Não foi possível carregar os processos agora.</div></div>';
      });
  }

  var ABAS_FICHA_PROCESSO = [
    { chave: 'geral', rotulo: 'Visão geral' },
    { chave: 'dados', rotulo: 'Dados do processo' },
    { chave: 'partes', rotulo: 'Partes' },
    { chave: 'andamentos', rotulo: 'Andamentos' },
    { chave: 'prazos', rotulo: 'Prazos' },
    { chave: 'documentos', rotulo: 'Documentos' },
    { chave: 'financeiro', rotulo: 'Financeiro' },
  ];

  function _campoFicha(rotulo, valor) {
    return '<div><div class="procficha-campo-label">' + esc(rotulo) + '</div><div class="procficha-campo-valor">' + esc(valor || '—') + '</div></div>';
  }

  function _htmlDatajudMeta(meta) {
    var assuntosHtml = (meta.assuntos && meta.assuntos.length)
      ? '<div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:6px;">' +
          meta.assuntos.map(function (a) { return '<span class="chip neutral">' + esc(a) + '</span>'; }).join('') +
        '</div>'
      : '';
    var atualizadoEm = meta.atualizado_em ? fmtDataProcesso(String(meta.atualizado_em).slice(0, 10)) : null;
    return (
      '<div style="background:#0b1220; border:1px solid #232d42; border-radius:8px; padding:14px 16px; margin-bottom:18px;">' +
        '<p class="procficha-painel-titulo" style="margin:0 0 2px;">Dados oficiais (DataJud/CNJ)</p>' +
        '<p class="procficha-painel-sub" style="margin-bottom:12px;">Sincronizado automaticamente — não editável aqui.</p>' +
        '<div class="procficha-campos-grid">' +
          _campoFicha('Grau', meta.grau) +
          _campoFicha('Sistema', meta.sistema) +
          _campoFicha('Formato', meta.formato) +
          _campoFicha('Data de ajuizamento', meta.data_ajuizamento ? fmtDataProcesso(meta.data_ajuizamento) : null) +
          _campoFicha('Atualizado no DataJud em', atualizadoEm) +
        '</div>' +
        (assuntosHtml ? '<div class="procficha-campo-label" style="margin-top:10px;">Assuntos</div>' + assuntosHtml : '') +
      '</div>'
    );
  }

  function _htmlFichaProcesso(p) {
    return (
      '<div class="procficha-topo">' +
        '<div class="procficha-titulo-wrap">' +
          '<button type="button" class="procficha-voltar" id="procficha-btn-voltar" aria-label="Voltar">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M19 12H5M11 18l-6-6 6-6"></path></svg>' +
            '<span>Voltar</span>' +
          '</button>' +
          '<h2 class="procficha-numero">' + esc(p.numero_cnj || p.cliente_nome) + '</h2>' +
        '</div>' +
        '<span class="procficha-acoes-wrap">' +
          '<button type="button" class="procpage-btn" id="procficha-btn-acoes">Ações ▾</button>' +
          '<div class="procman-acoes-menu hidden" id="procficha-menu-acoes" style="right:0;">' +
            '<a href="painel-criar-processo.html?editar=' + p.id + '#sec-criar-processo">Editar</a>' +
            '<button type="button" data-procficha-status="Finalizado">Encerrar</button>' +
            '<button type="button" data-procficha-status="Arquivado">Arquivar</button>' +
            '<button type="button" class="procman-acao-excluir" id="procficha-btn-excluir">Excluir</button>' +
          '</div>' +
        '</span>' +
      '</div>' +

      '<div class="procficha-tabs">' +
        ABAS_FICHA_PROCESSO.map(function (a, i) {
          return '<button type="button" class="procficha-tab' + (i === 0 ? ' ativo' : '') + '" data-procficha-tab="' + a.chave + '">' + esc(a.rotulo) + '</button>';
        }).join('') +
      '</div>' +

      '<div class="procficha-corpo">' +
        '<div id="procficha-conteudo">' +

          '<div class="procficha-painel" data-procficha-painel="geral">' +
            '<p class="procficha-painel-titulo">Visão geral</p>' +
            '<div class="procficha-campos-grid">' +
              _campoFicha('Cliente', p.cliente_nome) +
              _campoFicha('Número do processo', p.numero_cnj) +
              _campoFicha('Status', p.status) +
            '</div>' +
            '<p class="procficha-painel-titulo" style="margin-top:18px;">Monitoramento</p>' +
            '<p class="procficha-painel-sub">' + (_numeroCnjValidoParaDatajud(p.numero_cnj) && p.tribunal
              ? 'Número e tribunal reconhecidos — as movimentações são sincronizadas automaticamente todo dia via DataJud (base pública do CNJ). Pode levar de horas a dias pra uma movimentação nova aparecer, dependendo do tribunal.'
              : 'Preencha o número completo do processo (formato CNJ) e o tribunal em "Dados do processo" pra habilitar a sincronização automática de movimentações via DataJud.') +
            (p.origem === 'oab' ? ' Este processo também apareceu numa busca automática por OAB.' : '') +
            '</p>' +
            (p.datajud_meta && p.datajud_meta.nivel_sigilo ? (
              '<div style="margin-top:14px; padding:10px 14px; border-radius:8px; background:#2a2312; border:1px solid #6b5a1a; color:#e8c766; font-size:13px;">' +
                '⚠️ O DataJud registra este processo com nível de sigilo ' + esc(String(p.datajud_meta.nivel_sigilo)) + ' (não é totalmente público).' +
              '</div>'
            ) : '') +
            '<p class="procficha-painel-titulo" style="margin-top:18px;">Últimas movimentações</p>' +
            '<p class="procficha-painel-sub">Movimentações do tribunal são sincronizadas automaticamente (DataJud/CNJ) quando o número do processo é reconhecido pela base pública — pode levar de algumas horas a alguns dias pra aparecer. Registre atos processuais pra completar com o histórico do escritório.</p>' +
            '<div id="procficha-geral-atos"><div class="empty-state"><div class="msg" style="color:#8293b5;">Carregando…</div></div></div>' +
          '</div>' +

          '<div class="procficha-painel hidden" data-procficha-painel="dados">' +
            (p.datajud_meta ? _htmlDatajudMeta(p.datajud_meta) : '') +
            '<p class="procficha-painel-titulo">Dados do processo</p>' +
            '<p class="procficha-painel-sub">Classificação, tribunal e órgão julgador</p>' +
            '<div id="procficha-form-erro"></div>' +
            '<div class="procficha-editar-grid">' +
              '<div><label>Classe processual</label><input id="procficha-edit-classe" value="' + esc(p.classe_processual || '') + '"></div>' +
              '<div><label>Área do direito</label><input id="procficha-edit-area" value="' + esc(p.area_direito || '') + '"></div>' +
              '<div><label>Órgão julgador / Vara</label><input id="procficha-edit-orgao" value="' + esc(p.orgao_julgador || '') + '"></div>' +
              '<div><label>Tribunal</label><input id="procficha-edit-tribunal" value="' + esc(p.tribunal || '') + '"></div>' +
              '<div><label>Comarca / Foro</label><input id="procficha-edit-comarca" value="' + esc(p.comarca || '') + '"></div>' +
              '<div><label>Grau</label><select id="procficha-edit-grau"><option value="">Selecione...</option>' +
                ['1º Grau', '2º Grau', 'Tribunal Superior'].map(function (g) { return '<option' + (p.grau === g ? ' selected' : '') + '>' + g + '</option>'; }).join('') +
              '</select></div>' +
            '</div>' +

            '<p class="procficha-painel-titulo" style="margin-top:18px;">Cliente vinculado</p>' +
            '<div class="procficha-editar-grid">' +
              '<div><label>Cliente *</label><input id="procficha-edit-cliente" list="procficha-edit-clientes-lista" value="' + esc(p.cliente_nome || '') + '"><datalist id="procficha-edit-clientes-lista"></datalist></div>' +
            '</div>' +

            '<p class="procficha-painel-titulo" style="margin-top:18px;">Situação do processo</p>' +
            '<div class="procficha-editar-grid">' +
              '<div><label>Status</label><select id="procficha-edit-status">' +
                ['Em andamento', 'Suspenso', 'Finalizado', 'Arquivado'].map(function (s) { return '<option' + (p.status === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') +
              '</select></div>' +
              '<div><label>Fase processual</label><input id="procficha-edit-fase" value="' + esc(p.fase_processual || '') + '"></div>' +
              '<div><label>Data de distribuição</label><input type="date" id="procficha-edit-data-distribuicao" value="' + esc(p.data_distribuicao || '') + '"></div>' +
              '<div><label>Data de encerramento</label><input type="date" id="procficha-edit-data-encerramento" value="' + esc(p.data_encerramento || '') + '"></div>' +
              '<div><label>Valor da causa</label><input id="procficha-edit-valor-causa" value="' + (p.valor_causa != null ? esc(String(p.valor_causa).replace('.', ',')) : '') + '" placeholder="0,00"></div>' +
              '<div><label>Advogado responsável</label><input id="procficha-edit-advogado" value="' + esc(p.advogado_responsavel || '') + '"></div>' +
              '<div><label>Prioridade legal</label><input id="procficha-edit-prioridade" value="' + esc(p.prioridade_legal || '') + '" placeholder="Ex: idoso, saúde"></div>' +
            '</div>' +

            '<p class="procficha-painel-titulo" style="margin-top:18px;">Classificações e organização</p>' +
            '<div class="procficha-editar-grid">' +
              '<div><label>Risco do processo</label><select id="procficha-edit-risco"><option value="">—</option>' +
                ['Baixo', 'Médio', 'Alto'].map(function (r) { return '<option' + (p.risco_processo === r ? ' selected' : '') + '>' + r + '</option>'; }).join('') +
              '</select></div>' +
              '<div><label>Nível de sigilo</label><select id="procficha-edit-sigilo"><option value="">—</option>' +
                ['Público', 'Restrito', 'Segredo de justiça'].map(function (s) { return '<option' + (p.nivel_sigilo === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') +
              '</select></div>' +
            '</div>' +
            '<label style="display:block; font-size:11px; color:#8293b5; margin:14px 0 5px;">Observações internas</label>' +
            '<textarea id="procficha-edit-obs" rows="3" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #232d42;border-radius:6px;font-size:13px;font-family:inherit;background:#0b1220;color:#e7eaf0;resize:vertical;">' + esc(p.observacoes_internas || '') + '</textarea>' +

            '<div style="margin-top:16px;"><button type="button" class="procpage-btn procpage-btn-primary" id="procficha-btn-salvar-dados">Salvar alterações</button></div>' +
          '</div>' +

          '<div class="procficha-painel hidden" data-procficha-painel="partes">' +
            '<div style="display:flex; align-items:center; justify-content:space-between;"><p class="procficha-painel-titulo" style="margin:0;">Partes do processo</p></div>' +
            '<p class="procficha-painel-sub">Hoje só registramos o cliente vinculado ao processo — cadastro de partes adicionais (polo ativo/passivo completo) ainda não é um recurso disponível.</p>' +
            '<div class="procficha-campos-grid">' + _campoFicha('Cliente vinculado', p.cliente_nome) + '</div>' +
          '</div>' +

          '<div class="procficha-painel hidden" data-procficha-painel="andamentos">' +
            '<p class="procficha-painel-titulo">Andamentos</p>' +
            '<p class="procficha-painel-sub">Atos registrados pelo escritório e movimentações sincronizadas automaticamente do tribunal via DataJud/CNJ. A sincronização automática roda 1x por dia — use "Sincronizar agora" pra não esperar (ex: processo recém-importado).</p>' +
            '<div style="margin-bottom:12px; display:flex; gap:8px; flex-wrap:wrap;">' +
              '<button type="button" class="procpage-btn procpage-btn-primary" id="procficha-btn-novo-ato">+ Novo ato</button>' +
              '<button type="button" class="procpage-btn" id="procficha-btn-sincronizar-agora">Sincronizar agora</button>' +
              '<span id="procficha-sincronizar-status" style="font-size:12.5px; color:#8293b5; align-self:center;"></span>' +
            '</div>' +
            '<div id="procficha-lista-atos"><div class="empty-state"><div class="msg" style="color:#8293b5;">Carregando…</div></div></div>' +
          '</div>' +

          '<div class="procficha-painel hidden" data-procficha-painel="prazos">' +
            '<p class="procficha-painel-titulo">Prazos</p>' +
            '<div class="empty-state"><div class="msg" style="color:#8293b5;">Cadastro de prazos ainda não disponível — em breve.</div></div>' +
          '</div>' +

          '<div class="procficha-painel hidden" data-procficha-painel="documentos">' +
            '<p class="procficha-painel-titulo">Anexos deste processo</p>' +
            '<p class="procficha-painel-sub">Arquivos enviados e vinculados a este processo.</p>' +
            '<div style="margin-bottom:12px;"><button type="button" class="procpage-btn procpage-btn-primary" id="procficha-btn-novo-doc">+ Enviar documento</button></div>' +
            '<div id="procficha-lista-docs"><div class="empty-state"><div class="msg" style="color:#8293b5;">Carregando…</div></div></div>' +

            '<p class="procficha-painel-titulo" style="margin-top:22px;">Modelos de documentos</p>' +
            '<p class="procficha-painel-sub">Gere um PDF a partir dos modelos já cadastrados no escritório, preenchido com os dados do cliente vinculado.</p>' +
            '<input type="text" id="procficha-modelos-busca" placeholder="Buscar por nome do modelo..." style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #232d42;border-radius:6px;font-size:13px;background:#0b1220;color:#e7eaf0;margin-bottom:10px;">' +
            '<div id="procficha-lista-modelos"><div class="empty-state"><div class="msg" style="color:#8293b5;">Carregando…</div></div></div>' +
            '<div id="procficha-modelo-preview"></div>' +
          '</div>' +

          '<div class="procficha-painel hidden" data-procficha-painel="financeiro">' +
            '<div style="display:flex; align-items:center; justify-content:space-between;">' +
              '<p class="procficha-painel-titulo" style="margin:0;">Financeiro do processo</p>' +
            '</div>' +
            '<p class="procficha-painel-sub">Somado pelos contratos com o mesmo nome de cliente — hoje não há vínculo direto entre processo e contrato.</p>' +
            '<div id="procficha-financeiro-corpo"><div class="empty-state"><div class="msg" style="color:#8293b5;">Carregando…</div></div></div>' +
          '</div>' +

        '</div>' +

        '<div class="procficha-resumo">' +
          '<div><div class="procficha-resumo-item-label">Status</div><div class="procficha-resumo-item-valor" style="font-size:14px;">' + esc(p.status || '—') + '</div></div>' +
          '<div class="procficha-resumo-divisor"></div>' +
          '<div><div class="procficha-resumo-item-label">Prazos</div><div class="procficha-resumo-item-valor">—</div></div>' +
          '<div class="procficha-resumo-divisor"></div>' +
          '<div><div class="procficha-resumo-item-label">Documentos</div><div class="procficha-resumo-item-valor" id="procficha-resumo-docs">—</div></div>' +
          '<div class="procficha-resumo-divisor"></div>' +
          '<div><div class="procficha-resumo-item-label">Andamentos</div><div class="procficha-resumo-item-valor" id="procficha-resumo-atos">—</div>' +
            '<a href="#" class="procficha-resumo-item-link" data-procficha-vertab="andamentos">Ver todos</a></div>' +
          '<div class="procficha-resumo-divisor"></div>' +
          '<div><div class="procficha-resumo-item-label">Financeiro</div><div class="procficha-resumo-item-valor" id="procficha-resumo-financeiro" style="font-size:16px;">—</div>' +
            '<a href="painel.html#sec-visao-geral" class="procficha-resumo-item-link">Ver financeiro</a></div>' +
        '</div>' +
      '</div>'
    );
  }

  function abrirFichaProcesso(processo) {
    var viewLista = document.getElementById('procpage-view-lista');
    var viewFicha = document.getElementById('procpage-view-ficha');
    if (!viewLista || !viewFicha) return;

    viewFicha.innerHTML = _htmlFichaProcesso(processo);
    viewLista.classList.add('hidden');
    viewFicha.classList.remove('hidden');
    viewFicha.scrollIntoView({ behavior: 'smooth', block: 'start' });

    function mostrarAba(chave) {
      document.querySelectorAll('[data-procficha-painel]').forEach(function (el) {
        el.classList.toggle('hidden', el.getAttribute('data-procficha-painel') !== chave);
      });
      document.querySelectorAll('[data-procficha-tab]').forEach(function (btn) {
        btn.classList.toggle('ativo', btn.getAttribute('data-procficha-tab') === chave);
      });
    }

    document.querySelectorAll('[data-procficha-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () { mostrarAba(btn.getAttribute('data-procficha-tab')); });
    });
    document.querySelectorAll('[data-procficha-vertab]').forEach(function (a) {
      a.addEventListener('click', function (ev) { ev.preventDefault(); mostrarAba(a.getAttribute('data-procficha-vertab')); });
    });

    document.getElementById('procficha-btn-voltar').addEventListener('click', function () {
      viewFicha.classList.add('hidden');
      viewLista.classList.remove('hidden');
      carregarProcessosManuais();
    });

    document.getElementById('procficha-btn-acoes').addEventListener('click', function (ev) {
      ev.stopPropagation();
      document.getElementById('procficha-menu-acoes').classList.toggle('hidden');
    });
    document.addEventListener('click', function fecharMenuAcoesFicha(ev) {
      var menu = document.getElementById('procficha-menu-acoes');
      if (menu && !ev.target.closest('.procficha-acoes-wrap')) menu.classList.add('hidden');
    });
    document.querySelectorAll('[data-procficha-status]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.getElementById('procficha-menu-acoes').classList.add('hidden');
        apiPostJson('/api/painel?acao=processo_manual_status', { id: processo.id, status: btn.getAttribute('data-procficha-status') })
          .then(function () { processo.status = btn.getAttribute('data-procficha-status'); abrirFichaProcesso(processo); })
          .catch(function () { alert('Não foi possível atualizar o status agora.'); });
      });
    });
    document.getElementById('procficha-btn-excluir').addEventListener('click', function () {
      document.getElementById('procficha-menu-acoes').classList.add('hidden');
      if (!window.confirm('Excluir o processo de ' + processo.cliente_nome + '? Essa ação não pode ser desfeita.')) return;
      apiPostJson('/api/painel?acao=processo_manual_excluir', { id: processo.id })
        .then(function () {
          viewFicha.classList.add('hidden');
          viewLista.classList.remove('hidden');
          carregarProcessosManuais();
        })
        .catch(function () { alert('Não foi possível excluir o processo agora.'); });
    });

    function _htmlListaAtosInline(atos) {
      if (!atos.length) return '<div class="empty-state"><div class="msg" style="color:#8293b5;">Nenhum ato processual registrado.</div></div>';
      return atos.map(function (a) {
        return '<div class="prazo-card" style="background:#0b1220;border-color:#232d42;">' +
          '<div class="prazo-card-topo">' +
            '<div><span class="chip ' + (a.origem === 'Tribunal' ? 'neutral' : 'good') + '">' + esc(a.origem === 'Tribunal' ? 'Tribunal' : 'Escritório') + '</span> ' +
              '<strong style="font-size:13px;color:#e7eaf0;">' + esc(a.tipo || 'Ato') + '</strong></div>' +
            '<span class="prazo-meta" style="color:#8293b5;">' + fmtDataProcesso(a.data) + '</span>' +
          '</div>' +
          (a.descricao ? '<div class="prazo-resumo" style="color:#a7b0c2;">' + esc(a.descricao) + '</div>' : '') +
          (a.link ? '<div style="margin-top:6px;"><a href="' + esc(a.link) + '" target="_blank" rel="noopener" style="font-size:12px;color:#6c8cf0;">Ver documento original</a></div>' : '') +
        '</div>';
      }).join('');
    }

    apiGetJson('/api/painel?acao=ato_processual_listar&processo_id=' + processo.id)
      .then(function (dados) {
        var atos = dados.atos || [];
        document.getElementById('procficha-resumo-atos').textContent = atos.length;
        var geralEl = document.getElementById('procficha-geral-atos');
        if (geralEl) geralEl.innerHTML = _htmlListaAtosInline(atos.slice(0, 3));
        var listaEl = document.getElementById('procficha-lista-atos');
        if (listaEl) listaEl.innerHTML = _htmlListaAtosInline(atos);
      })
      .catch(function () {
        document.getElementById('procficha-resumo-atos').textContent = '—';
      });

    apiGetJson('/api/painel?acao=documento_processo_listar&processo_id=' + processo.id)
      .then(function (dados) {
        var documentos = dados.documentos || [];
        document.getElementById('procficha-resumo-docs').textContent = documentos.length;
        var listaEl = document.getElementById('procficha-lista-docs');
        if (!listaEl) return;
        listaEl.innerHTML = documentos.length === 0
          ? '<div class="empty-state"><div class="msg" style="color:#8293b5;">Nenhum documento neste processo.</div></div>'
          : documentos.map(function (d) {
              return '<div class="prazo-card" style="background:#0b1220;border-color:#232d42;">' +
                '<div class="prazo-card-topo">' +
                  '<strong style="font-size:13px;color:#e7eaf0;">' + esc(d.nome_arquivo) + '</strong>' +
                  '<a href="' + esc(d.link) + '" target="_blank" rel="noopener" style="font-size:12px;color:#6c8cf0;">Abrir</a>' +
                '</div>' +
              '</div>';
            }).join('');
      })
      .catch(function () {
        document.getElementById('procficha-resumo-docs').textContent = '—';
      });

    apiGetJson('/api/painel?acao=processo_financeiro_resumo&cliente_nome=' + encodeURIComponent(processo.cliente_nome))
      .then(function (resumo) {
        var totalEmAberto = resumo.pendente + resumo.em_atraso;
        document.getElementById('procficha-resumo-financeiro').textContent = 'R$ ' + fmtMoeda(totalEmAberto);
        var corpoEl = document.getElementById('procficha-financeiro-corpo');
        if (!corpoEl) return;
        if (resumo.qtd_contratos === 0) {
          corpoEl.innerHTML = '<div class="empty-state"><div class="msg" style="color:#8293b5;">Nenhum contrato encontrado com o nome desse cliente.</div></div>';
          return;
        }
        var vencimentosHtml = resumo.proximos_vencimentos.length === 0
          ? '<div class="empty-state"><div class="msg" style="color:#8293b5;">Nenhuma conta a receber.</div></div>'
          : resumo.proximos_vencimentos.map(function (v) {
              var corSituacao = v.situacao === 'Vencida' ? '#e23a2e' : (v.situacao === 'Vence hoje' ? '#9c7a16' : '#8293b5');
              return '<div class="prazo-card" style="background:#0b1220;border-color:#232d42;">' +
                '<div class="prazo-card-topo">' +
                  '<div><strong style="font-size:13px;color:#e7eaf0;">' + esc(v.tipo_servico || 'Parcela') + '</strong></div>' +
                  '<span style="font-size:12px;color:' + corSituacao + ';">' + esc(v.situacao) + (v.dias_atraso ? ' · ' + v.dias_atraso + 'd' : '') + '</span>' +
                '</div>' +
                '<div class="prazo-resumo" style="color:#a7b0c2;">R$ ' + fmtMoeda(v.saldo) + (v.data_vencimento ? ' · vence ' + fmtDataProcesso(v.data_vencimento) : '') + '</div>' +
              '</div>';
            }).join('');
        corpoEl.innerHTML =
          '<div class="procficha-campos-grid" style="margin-bottom:18px;">' +
            _campoFicha('Contratos', String(resumo.qtd_contratos)) +
            _campoFicha('Pendente', 'R$ ' + fmtMoeda(resumo.pendente)) +
            _campoFicha('Em atraso', 'R$ ' + fmtMoeda(resumo.em_atraso)) +
            _campoFicha('Recebido', 'R$ ' + fmtMoeda(resumo.valor_pago)) +
          '</div>' +
          '<p class="procficha-painel-titulo">Próximos vencimentos</p>' + vencimentosHtml +
          '<p class="procficha-painel-titulo" style="margin-top:18px;">Despesas do processo</p>' +
          '<div class="empty-state"><div class="msg" style="color:#8293b5;">Registro de despesas do processo ainda não disponível.</div></div>';
      })
      .catch(function () {
        document.getElementById('procficha-resumo-financeiro').textContent = '—';
      });

    document.getElementById('procficha-btn-novo-ato').addEventListener('click', function () { abrirModalAtosProcessuais(processo); });

    var btnSincronizarAgora = document.getElementById('procficha-btn-sincronizar-agora');
    if (btnSincronizarAgora) {
      btnSincronizarAgora.addEventListener('click', function () {
        var statusEl = document.getElementById('procficha-sincronizar-status');
        btnSincronizarAgora.disabled = true;
        statusEl.textContent = 'Sincronizando (pode levar alguns segundos)...';
        apiPostJson('/api/painel?acao=processo_datajud_sincronizar', { id: processo.id })
          .then(function (resultado) {
            var mensagem = resultado.novos > 0
              ? resultado.novos + ' andamento(s) novo(s) encontrado(s).'
              : 'Sincronizado — nenhum andamento novo encontrado.';
            abrirFichaProcesso(processo);
            mostrarAba('andamentos');
            document.getElementById('procficha-sincronizar-status').textContent = mensagem;
          })
          .catch(function (e) {
            btnSincronizarAgora.disabled = false;
            statusEl.textContent = e.message || 'Não foi possível sincronizar agora.';
          });
      });
    }
    document.getElementById('procficha-btn-novo-doc').addEventListener('click', function () { abrirModalDocumentosProcesso(processo); });

    var datalistClienteFicha = document.getElementById('procficha-edit-clientes-lista');
    if (datalistClienteFicha) {
      apiGetJson('/api/painel?acao=clientes')
        .then(function (dados) {
          datalistClienteFicha.innerHTML = (dados.clientes || []).map(function (c) { return '<option value="' + esc(c.nome) + '">'; }).join('');
        })
        .catch(function () { /* datalist so ajuda */ });
    }
    var btnSalvarDados = document.getElementById('procficha-btn-salvar-dados');
    if (btnSalvarDados) {
      btnSalvarDados.addEventListener('click', function () {
        var erroDiv = document.getElementById('procficha-form-erro');
        erroDiv.innerHTML = '';
        var clienteNome = document.getElementById('procficha-edit-cliente').value.trim();
        if (!clienteNome) {
          erroDiv.innerHTML = '<div class="aviso-tenant">Selecione ou digite o nome do cliente.</div>';
          return;
        }
        var corpo = {
          id: processo.id,
          cliente_nome: clienteNome,
          numero_cnj: processo.numero_cnj || '',
          classe_processual: document.getElementById('procficha-edit-classe').value.trim(),
          area_direito: document.getElementById('procficha-edit-area').value.trim(),
          orgao_julgador: document.getElementById('procficha-edit-orgao').value.trim(),
          tribunal: document.getElementById('procficha-edit-tribunal').value.trim(),
          comarca: document.getElementById('procficha-edit-comarca').value.trim(),
          grau: document.getElementById('procficha-edit-grau').value,
          status: document.getElementById('procficha-edit-status').value,
          fase_processual: document.getElementById('procficha-edit-fase').value.trim(),
          valor_causa: document.getElementById('procficha-edit-valor-causa').value.trim(),
          data_distribuicao: document.getElementById('procficha-edit-data-distribuicao').value,
          data_encerramento: document.getElementById('procficha-edit-data-encerramento').value,
          advogado_responsavel: document.getElementById('procficha-edit-advogado').value.trim(),
          prioridade_legal: document.getElementById('procficha-edit-prioridade').value.trim(),
          risco_processo: document.getElementById('procficha-edit-risco').value,
          nivel_sigilo: document.getElementById('procficha-edit-sigilo').value,
          observacoes_internas: document.getElementById('procficha-edit-obs').value.trim(),
        };
        btnSalvarDados.disabled = true; btnSalvarDados.textContent = 'Salvando...';
        apiPostJson('/api/painel?acao=processo_manual_atualizar', corpo)
          .then(function () { return apiGetJson('/api/painel?acao=processo_manual_listar'); })
          .then(function (dados) {
            btnSalvarDados.disabled = false;
            var atualizado = (dados.processos || []).find(function (pr) { return String(pr.id) === String(processo.id); }) || processo;
            abrirFichaProcesso(atualizado);
            mostrarAba('dados');
            document.getElementById('procficha-form-erro').innerHTML =
              '<div class="aviso-tenant" style="background:var(--good-soft);color:var(--good);">Alterações salvas com sucesso.</div>';
          })
          .catch(function (e) {
            btnSalvarDados.disabled = false; btnSalvarDados.textContent = 'Salvar alterações';
            erroDiv.innerHTML = '<div class="aviso-tenant">' + esc(e.message || 'Não foi possível salvar agora.') + '</div>';
          });
      });
    }

    var listaModelosEl = document.getElementById('procficha-lista-modelos');
    var modelosCarregados = [];
    function renderModelos(nomes) {
      if (!listaModelosEl) return;
      if (nomes.length === 0) {
        listaModelosEl.innerHTML = '<div class="empty-state"><div class="msg" style="color:#8293b5;">Nenhum modelo cadastrado.</div></div>';
        return;
      }
      listaModelosEl.innerHTML = nomes.map(function (nome) {
        return '<div class="procficha-modelo-item"><span>' + esc(nome) + '</span>' +
          '<button type="button" class="procpage-btn" data-procficha-gerar-modelo="' + esc(nome) + '">Gerar PDF</button></div>';
      }).join('');
      listaModelosEl.querySelectorAll('[data-procficha-gerar-modelo]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var nomeModelo = btn.getAttribute('data-procficha-gerar-modelo');
          btn.disabled = true; btn.textContent = 'Gerando...';
          apiPost('/api/painel?acao=executar', { tipo: 'gerar_contrato', nome: processo.cliente_nome, tipo_servico: nomeModelo })
            .then(function (r) { return r.json().then(function (c) { return { status: r.status, corpo: c }; }); })
            .then(function (resultado) {
              btn.disabled = false; btn.textContent = 'Gerar PDF';
              if (resultado.status === 200 && resultado.corpo.pdf_id) {
                mostrarPreviewDocumento(resultado.corpo.pdf_id, 'procficha-modelo-preview');
              } else {
                alert(resultado.corpo.erro || 'Não foi possível gerar o documento agora.');
              }
            })
            .catch(function () {
              btn.disabled = false; btn.textContent = 'Gerar PDF';
              alert('Não foi possível gerar o documento agora.');
            });
        });
      });
    }
    if (listaModelosEl) {
      apiGetJson('/api/painel?acao=modelos_contrato')
        .then(function (dados) {
          modelosCarregados = dados.modelos || [];
          renderModelos(modelosCarregados);
        })
        .catch(function () {
          listaModelosEl.innerHTML = '<div class="empty-state"><div class="msg" style="color:#8293b5;">Não foi possível carregar os modelos agora.</div></div>';
        });
      document.getElementById('procficha-modelos-busca').addEventListener('input', function () {
        var termo = this.value.trim().toLowerCase();
        renderModelos(modelosCarregados.filter(function (n) { return n.toLowerCase().indexOf(termo) !== -1; }));
      });
    }
  }

  function wireProcessosHub() {
    var lista = document.getElementById('procman-lista');
    if (!lista) return;

    carregarProcessosManuais();

    var datalistFiltro = document.getElementById('procpage-clientes-lista');
    apiGetJson('/api/painel?acao=clientes')
      .then(function (dados) {
        datalistFiltro.innerHTML = (dados.clientes || []).map(function (c) { return '<option value="' + esc(c.nome) + '">'; }).join('');
      })
      .catch(function () { /* datalist so ajuda, nao bloqueia a busca manual se falhar */ });

    function aplicarFiltros() {
      var f = _lerFiltrosProcessoAtuais();
      _renderTabelaProcessosManuais(_processosManuaisTodos.filter(function (p) { return _passaNosFiltrosProcesso(p, f); }));
    }
    document.getElementById('procpage-filtro-buscar').addEventListener('click', aplicarFiltros);
    document.getElementById('procpage-filtro-limpar').addEventListener('click', function () {
      ['procpage-filtro-numero', 'procpage-filtro-cliente', 'procpage-filtro-tribunal', 'procpage-filtro-palavra'].forEach(function (id) {
        document.getElementById(id).value = '';
      });
      document.getElementById('procpage-filtro-status').value = 'ativos_encerrados';
      aplicarFiltros();
    });

    lista.addEventListener('click', function (ev) {
      var btnAbrir = ev.target.closest('[data-procpage-abrir]');
      if (btnAbrir) {
        var indiceAbrir = parseInt(btnAbrir.getAttribute('data-procpage-abrir'), 10);
        var processoAbrir = _processosManuaisCarregados[indiceAbrir];
        if (processoAbrir) abrirFichaProcesso(processoAbrir);
        return;
      }

      var btnMais = ev.target.closest('[data-procman-mais]');
      if (btnMais) {
        var menuAlvo = document.querySelector('[data-procman-menu="' + btnMais.getAttribute('data-procman-mais') + '"]');
        var jaAberto = !menuAlvo.classList.contains('hidden');
        document.querySelectorAll('.procman-acoes-menu').forEach(function (m) { m.classList.add('hidden'); m.classList.remove('abre-para-cima'); });
        if (!jaAberto) {
          menuAlvo.classList.remove('hidden');
          // se abrir pra baixo estourar a tela (ex: tabela grande, linha perto do rodape), abre pra cima
          var retangulo = menuAlvo.getBoundingClientRect();
          if (retangulo.bottom > window.innerHeight) menuAlvo.classList.add('abre-para-cima');
        }
        return;
      }

      var btnAtos = ev.target.closest('[data-procman-atos]');
      if (btnAtos) {
        var indiceAtos = parseInt(btnAtos.getAttribute('data-procman-atos'), 10);
        var processoAtos = _processosManuaisCarregados[indiceAtos];
        if (processoAtos) abrirModalAtosProcessuais(processoAtos);
        return;
      }

      var btnDocs = ev.target.closest('[data-procman-docs]');
      if (btnDocs) {
        var indiceDocs = parseInt(btnDocs.getAttribute('data-procman-docs'), 10);
        var processoDocs = _processosManuaisCarregados[indiceDocs];
        if (processoDocs) abrirModalDocumentosProcesso(processoDocs);
        return;
      }

      var btnStatus = ev.target.closest('[data-procman-status-acao]');
      if (btnStatus) {
        document.querySelectorAll('.procman-acoes-menu').forEach(function (m) { m.classList.add('hidden'); });
        var indiceStatus = parseInt(btnStatus.getAttribute('data-procman-indice'), 10);
        var processoStatus = _processosManuaisCarregados[indiceStatus];
        var novoStatus = btnStatus.getAttribute('data-procman-status-acao');
        if (!processoStatus) return;
        apiPostJson('/api/painel?acao=processo_manual_status', { id: processoStatus.id, status: novoStatus })
          .then(function () { carregarProcessosManuais(); })
          .catch(function () { /* lista so nao atualiza -- usuario pode tentar de novo */ });
        return;
      }

      var btnExcluir = ev.target.closest('[data-procman-excluir]');
      if (btnExcluir) {
        document.querySelectorAll('.procman-acoes-menu').forEach(function (m) { m.classList.add('hidden'); });
        var indiceExcluir = parseInt(btnExcluir.getAttribute('data-procman-excluir'), 10);
        var processoExcluir = _processosManuaisCarregados[indiceExcluir];
        if (!processoExcluir) return;
        if (!window.confirm('Excluir o processo de ' + processoExcluir.cliente_nome + '? Essa ação não pode ser desfeita.')) return;
        apiPostJson('/api/painel?acao=processo_manual_excluir', { id: processoExcluir.id })
          .then(function () { carregarProcessosManuais(); })
          .catch(function () { /* lista so nao atualiza -- usuario pode tentar de novo */ });
        return;
      }

      if (!ev.target.closest('.procman-acoes-wrap')) {
        document.querySelectorAll('.procman-acoes-menu').forEach(function (m) { m.classList.add('hidden'); });
      }
    });

    document.addEventListener('click', function (ev) {
      if (!ev.target.closest('.procman-acoes-wrap')) {
        document.querySelectorAll('.procman-acoes-menu').forEach(function (m) { m.classList.add('hidden'); });
      }
    });
  }

  function wireImportarOab(dados) {
    var btnBuscar = document.getElementById('procoab-btn-buscar');
    if (!btnBuscar) return;

    var inputNumero = document.getElementById('procoab-numero');
    var inputUf = document.getElementById('procoab-uf');
    if (dados.oab_numero) inputNumero.value = dados.oab_numero;
    if (dados.oab_uf) inputUf.value = dados.oab_uf;

    function linhaResultado(p, indice) {
      var opcoesCliente = [];
      (p.polo_ativo || '').split(' / ').forEach(function (n) { if (n.trim()) opcoesCliente.push(n.trim()); });
      (p.polo_passivo || '').split(' / ').forEach(function (n) { if (n.trim()) opcoesCliente.push(n.trim()); });
      var selectCliente = '<select class="procoab-cliente-select" data-indice="' + indice + '">' +
        opcoesCliente.map(function (n) { return '<option value="' + esc(n) + '">' + esc(n) + '</option>'; }).join('') +
        '</select>';
      return '<tr>' +
        '<td><input type="checkbox" class="procoab-check" data-indice="' + indice + '" checked></td>' +
        '<td>' + esc(p.numero_cnj || '—') + '<div style="font-size:11px;color:var(--ink-faint);">' + esc(p.classe_processual || '') + '</div></td>' +
        '<td>' + esc(p.tribunal || '—') + '</td>' +
        '<td>' + esc(p.polo_ativo || '—') + '</td>' +
        '<td>' + esc(p.polo_passivo || '—') + '</td>' +
        '<td>' + selectCliente + '</td>' +
        '</tr>';
    }

    btnBuscar.addEventListener('click', function () {
      var erroDiv = document.getElementById('procoab-erro');
      var resultadoDiv = document.getElementById('procoab-resultado');
      erroDiv.innerHTML = '';
      resultadoDiv.innerHTML = '';
      var numero = inputNumero.value.trim();
      var uf = inputUf.value.trim().toUpperCase();
      if (!numero || !uf) {
        erroDiv.innerHTML = '<div class="aviso-tenant">Preencha o número e a UF da OAB.</div>';
        return;
      }
      btnBuscar.disabled = true; btnBuscar.textContent = 'Buscando...';
      apiGetJson('/api/painel?acao=processo_manual_buscar_oab&numero_oab=' + encodeURIComponent(numero) + '&uf_oab=' + encodeURIComponent(uf))
        .then(function (dadosResp) {
          btnBuscar.disabled = false; btnBuscar.textContent = 'Buscar processos';
          var processos = dadosResp.processos || [];
          if (processos.length === 0) {
            resultadoDiv.innerHTML = '<div class="empty-state"><div class="msg">Nenhum processo com comunicação recente encontrado pra essa OAB.</div></div>';
            return;
          }
          resultadoDiv.innerHTML =
            '<div class="table-scroll" style="margin-top:14px;"><table><thead><tr>' +
              '<th></th><th>Processo</th><th>Tribunal</th><th>Polo ativo</th><th>Polo passivo</th><th>Cliente (confirme)</th>' +
            '</tr></thead><tbody>' +
            processos.map(linhaResultado).join('') +
            '</tbody></table></div>' +
            '<div style="margin-top:12px;"><button id="procoab-btn-importar" style="padding:9px 16px;border:none;' +
              'border-radius:7px;background:var(--good);color:#fff;font-size:13px;font-weight:600;cursor:pointer;">Importar selecionados</button>' +
              '<span id="procoab-status-importar" style="margin-left:10px;font-size:12.5px;color:var(--ink-soft);"></span></div>';

          document.getElementById('procoab-btn-importar').addEventListener('click', function () {
            var btnImportar = this;
            var statusEl = document.getElementById('procoab-status-importar');
            var linhasSelecionadas = Array.prototype.filter.call(
              document.querySelectorAll('.procoab-check'), function (c) { return c.checked; }
            );
            if (linhasSelecionadas.length === 0) {
              statusEl.textContent = 'Selecione ao menos um processo.';
              return;
            }
            btnImportar.disabled = true;
            var total = linhasSelecionadas.length;
            var concluidos = 0;
            var falhas = 0;

            function importarProximo(pos) {
              if (pos >= linhasSelecionadas.length) {
                btnImportar.disabled = false;
                statusEl.textContent = concluidos + ' de ' + total + ' importado(s)' + (falhas ? ', ' + falhas + ' falhou(aram)' : '') + '.';
                if (concluidos > 0) carregarProcessosManuais();
                return;
              }
              var indice = parseInt(linhasSelecionadas[pos].getAttribute('data-indice'), 10);
              var p = processos[indice];
              var selectEl = document.querySelector('.procoab-cliente-select[data-indice="' + indice + '"]');
              var clienteEscolhido = selectEl ? selectEl.value : '';
              statusEl.textContent = 'Importando ' + (pos + 1) + ' de ' + total + '...';
              apiPostJson('/api/painel?acao=processo_manual_criar', {
                cliente_nome: clienteEscolhido, numero_cnj: p.numero_cnj, tribunal: p.tribunal,
                classe_processual: p.classe_processual, orgao_julgador: p.orgao_julgador,
                origem: 'oab',
              })
                .then(function () { concluidos += 1; importarProximo(pos + 1); })
                .catch(function () { falhas += 1; importarProximo(pos + 1); });
            }
            importarProximo(0);
          });
        })
        .catch(function (e) {
          btnBuscar.disabled = false; btnBuscar.textContent = 'Buscar processos';
          erroDiv.innerHTML = '<div class="aviso-tenant">' + esc(e.message || 'Não foi possível buscar agora. Tente de novo.') + '</div>';
        });
    });
  }

  function wireProcessoManual() {
    var btnSalvar = document.getElementById('procman-btn-salvar');
    if (!btnSalvar) return;

    var processoEditandoId = null;

    var datalistProcMan = document.getElementById('procman-clientes-lista');
    apiGetJson('/api/painel?acao=clientes')
      .then(function (dados) {
        datalistProcMan.innerHTML = (dados.clientes || []).map(function (c) {
          return '<option value="' + esc(c.nome) + '">';
        }).join('');
      })
      .catch(function () { /* datalist so ajuda, nao bloqueia o preenchimento manual se falhar */ });

    function limparFormulario() {
      ['procman-numero-cnj', 'procman-classe', 'procman-area', 'procman-orgao', 'procman-tribunal',
        'procman-comarca', 'procman-cliente', 'procman-fase', 'procman-valor-causa',
        'procman-data-distribuicao', 'procman-data-encerramento', 'procman-advogado',
        'procman-prioridade', 'procman-obs'].forEach(function (id) {
        document.getElementById(id).value = '';
      });
      document.getElementById('procman-grau').value = '';
      document.getElementById('procman-status').value = 'Em andamento';
      document.getElementById('procman-risco').value = '';
      document.getElementById('procman-sigilo').value = '';
      processoEditandoId = null;
      btnSalvar.textContent = 'Salvar processo';
      var btnCancelar = document.getElementById('procman-btn-cancelar-edicao');
      if (btnCancelar) btnCancelar.remove();
    }

    function preencherFormularioParaEdicao(p) {
      document.getElementById('procman-numero-cnj').value = p.numero_cnj || '';
      document.getElementById('procman-classe').value = p.classe_processual || '';
      document.getElementById('procman-area').value = p.area_direito || '';
      document.getElementById('procman-orgao').value = p.orgao_julgador || '';
      document.getElementById('procman-tribunal').value = p.tribunal || '';
      document.getElementById('procman-comarca').value = p.comarca || '';
      document.getElementById('procman-grau').value = p.grau || '';
      document.getElementById('procman-status').value = p.status || 'Em andamento';
      document.getElementById('procman-cliente').value = p.cliente_nome || '';
      document.getElementById('procman-fase').value = p.fase_processual || '';
      document.getElementById('procman-valor-causa').value = p.valor_causa != null ? String(p.valor_causa).replace('.', ',') : '';
      document.getElementById('procman-data-distribuicao').value = p.data_distribuicao || '';
      document.getElementById('procman-data-encerramento').value = p.data_encerramento || '';
      document.getElementById('procman-advogado').value = p.advogado_responsavel || '';
      document.getElementById('procman-prioridade').value = p.prioridade_legal || '';
      document.getElementById('procman-risco').value = p.risco_processo || '';
      document.getElementById('procman-sigilo').value = p.nivel_sigilo || '';
      document.getElementById('procman-obs').value = p.observacoes_internas || '';

      processoEditandoId = p.id;
      btnSalvar.textContent = 'Salvar alterações';
      if (!document.getElementById('procman-btn-cancelar-edicao')) {
        var btnCancelar = document.createElement('button');
        btnCancelar.type = 'button';
        btnCancelar.id = 'procman-btn-cancelar-edicao';
        btnCancelar.textContent = 'Cancelar edição';
        btnCancelar.style.cssText = 'margin-left:8px;padding:9px 16px;border:1px solid var(--line);border-radius:7px;background:var(--surface-sunken);color:var(--ink-soft);font-size:13px;cursor:pointer;';
        btnCancelar.addEventListener('click', function () {
          var erroDiv = document.getElementById('procman-erro');
          erroDiv.innerHTML = '';
          limparFormulario();
        });
        btnSalvar.parentNode.appendChild(btnCancelar);
      }
      btnSalvar.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    btnSalvar.addEventListener('click', function () {
      var erroDiv = document.getElementById('procman-erro');
      erroDiv.innerHTML = '';
      var clienteNome = document.getElementById('procman-cliente').value.trim();
      if (!clienteNome) {
        erroDiv.innerHTML = '<div class="aviso-tenant">Selecione ou digite o nome do cliente.</div>';
        return;
      }

      var corpo = {
        cliente_nome: clienteNome,
        numero_cnj: document.getElementById('procman-numero-cnj').value.trim(),
        classe_processual: document.getElementById('procman-classe').value.trim(),
        area_direito: document.getElementById('procman-area').value.trim(),
        orgao_julgador: document.getElementById('procman-orgao').value.trim(),
        tribunal: document.getElementById('procman-tribunal').value.trim(),
        comarca: document.getElementById('procman-comarca').value.trim(),
        grau: document.getElementById('procman-grau').value,
        status: document.getElementById('procman-status').value,
        fase_processual: document.getElementById('procman-fase').value.trim(),
        valor_causa: document.getElementById('procman-valor-causa').value.trim(),
        data_distribuicao: document.getElementById('procman-data-distribuicao').value,
        data_encerramento: document.getElementById('procman-data-encerramento').value,
        advogado_responsavel: document.getElementById('procman-advogado').value.trim(),
        prioridade_legal: document.getElementById('procman-prioridade').value.trim(),
        risco_processo: document.getElementById('procman-risco').value,
        nivel_sigilo: document.getElementById('procman-sigilo').value,
        observacoes_internas: document.getElementById('procman-obs').value.trim(),
      };

      var estaEditando = !!processoEditandoId;
      if (estaEditando) corpo.id = processoEditandoId;
      var acao = estaEditando ? 'processo_manual_atualizar' : 'processo_manual_criar';
      var textoSalvando = estaEditando ? 'Salvando alterações...' : 'Salvando...';

      btnSalvar.disabled = true; btnSalvar.textContent = textoSalvando;
      apiPostJson('/api/painel?acao=' + acao, corpo)
        .then(function () {
          erroDiv.innerHTML = '';
          document.getElementById('procman-msg-sucesso').innerHTML =
            '<div class="aviso-tenant" style="background:var(--good-soft);color:var(--good);">' +
              (estaEditando ? 'Alterações salvas com sucesso. ' : 'Processo salvo com sucesso. ') +
              '<a href="painel-processos.html#sec-processos" style="color:inherit;font-weight:600;">Ver na lista de Processos</a>' +
            '</div>';
          btnSalvar.disabled = false;
          limparFormulario();
        })
        .catch(function (e) {
          btnSalvar.disabled = false; btnSalvar.textContent = estaEditando ? 'Salvar alterações' : 'Salvar processo';
          erroDiv.innerHTML = '<div class="aviso-tenant">' + esc(e.message || 'Não foi possível salvar agora.') + '</div>';
        });
    });

    // veio de "Editar" na lista de Processos (painel-processos.html) -- pre-preenche o
    // formulario com os dados desse processo, buscando a lista pra achar pelo id.
    var idParaEditar = new URLSearchParams(window.location.search).get('editar');
    if (idParaEditar) {
      apiGetJson('/api/painel?acao=processo_manual_listar')
        .then(function (dados) {
          var processo = (dados.processos || []).find(function (p) { return String(p.id) === String(idParaEditar); });
          if (processo) preencherFormularioParaEdicao(processo);
        })
        .catch(function () { /* se falhar, o formulario so fica em branco -- usuario preenche de novo */ });
    }
  }

  function wireNovoCliente() {
    var btnSalvar = document.getElementById('cliente-btn-salvar');
    if (!btnSalvar) return;

    var fotoArquivoSelecionado = null;
    var etiquetasCatalogo = [];
    var etiquetasSelecionadasIds = [];

    var CAMPOS_PROGRESSO_CLIENTE = [
      { rotulo: 'Dados Básicos', sub: 'Nome e tipo obrigatórios',
        completo: function () { return !!document.getElementById('cliente-nome').value.trim(); } },
      { rotulo: 'CPF/CNPJ', sub: 'Opcional',
        completo: function () { return !!document.getElementById('cliente-cpf-cnpj').value.trim(); } },
      { rotulo: 'Endereço', sub: 'Opcional',
        completo: function () { return !!document.getElementById('cliente-cep').value.trim(); } },
      { rotulo: 'Etiquetas', sub: 'Opcional',
        completo: function () { return etiquetasSelecionadasIds.length > 0; } },
    ];

    function renderProgressoCliente() {
      var container = document.getElementById('cliente-progresso-itens');
      var completos = 0;
      container.innerHTML = CAMPOS_PROGRESSO_CLIENTE.map(function (c) {
        var ok = c.completo();
        if (ok) completos += 1;
        return '<div style="display:flex; align-items:center; gap:8px;">' +
          '<div style="width:20px; height:20px; border-radius:50%; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700; ' +
            (ok ? 'background:#1b3a2a; color:#4fd88a;' : 'background:#1b2743; color:#8293b5;') + '">' + (ok ? '✓' : '') + '</div>' +
          '<div><div style="font-size:12.5px; font-weight:600; color:#e7eaf0;">' + esc(c.rotulo) + '</div>' +
          '<div style="font-size:11px; color:#8293b5;">' + esc(c.sub) + '</div></div>' +
        '</div>';
      }).join('');
      var pct = Math.round((completos / CAMPOS_PROGRESSO_CLIENTE.length) * 100);
      document.getElementById('cliente-progresso-pct').textContent = pct + '%';
      document.getElementById('cliente-progresso-barra').style.width = pct + '%';
    }

    ['cliente-nome', 'cliente-cpf-cnpj'].forEach(function (id) {
      document.getElementById(id).addEventListener('input', renderProgressoCliente);
    });

    document.getElementById('cliente-tipo').addEventListener('change', function () {
      var labelCpf = document.getElementById('cliente-label-cpf');
      var inputCpf = document.getElementById('cliente-cpf-cnpj');
      if (this.value === 'Pessoa Jurídica') {
        labelCpf.textContent = 'CNPJ';
        inputCpf.placeholder = '00.000.000/0000-00';
      } else {
        labelCpf.textContent = 'CPF';
        inputCpf.placeholder = '000.000.000-00';
      }
    });

    document.getElementById('cliente-btn-foto').addEventListener('click', function () {
      document.getElementById('cliente-input-foto').click();
    });
    document.getElementById('cliente-input-foto').addEventListener('change', function () {
      var arquivo = this.files && this.files[0];
      if (!arquivo) return;
      if (arquivo.size > 5 * 1024 * 1024) {
        alert('A foto precisa ter até 5MB.');
        this.value = '';
        return;
      }
      fotoArquivoSelecionado = arquivo;
      var leitor = new FileReader();
      leitor.onload = function (e) {
        document.getElementById('cliente-foto-preview').innerHTML =
          '<img src="' + e.target.result + '" style="width:100%;height:100%;object-fit:cover;">';
      };
      leitor.readAsDataURL(arquivo);
    });

    document.getElementById('cliente-cep').addEventListener('input', function () {
      var digitos = this.value.replace(/\D/g, '').slice(0, 8);
      this.value = digitos.length > 5 ? digitos.slice(0, 5) + '-' + digitos.slice(5) : digitos;
      var statusEl = document.getElementById('cliente-cep-status');
      renderProgressoCliente();
      if (digitos.length !== 8) { statusEl.textContent = 'Busca automática ao digitar'; return; }
      statusEl.textContent = 'Buscando...';
      fetch('https://viacep.com.br/ws/' + digitos + '/json/')
        .then(function (r) { return r.json(); })
        .then(function (dados) {
          if (dados.erro) { statusEl.textContent = 'CEP não encontrado.'; return; }
          document.getElementById('cliente-logradouro').value = dados.logradouro || '';
          document.getElementById('cliente-bairro').value = dados.bairro || '';
          document.getElementById('cliente-cidade').value = dados.localidade || '';
          document.getElementById('cliente-uf').value = dados.uf || '';
          statusEl.textContent = 'Endereço encontrado.';
        })
        .catch(function () { statusEl.textContent = 'Não foi possível buscar o CEP agora.'; });
    });

    function renderEtiquetasSelecionadas() {
      var container = document.getElementById('cliente-etiquetas-selecionadas');
      container.innerHTML = etiquetasSelecionadasIds.map(function (id) {
        var et = etiquetasCatalogo.find(function (e) { return e.id === id; });
        if (!et) return '';
        return '<span class="chip good" style="display:inline-flex; align-items:center; gap:6px;">' + esc(et.nome) +
          '<button type="button" data-remover-etiqueta="' + id + '" style="background:none; border:none; color:inherit; cursor:pointer; font-size:13px; line-height:1; padding:0;">✕</button></span>';
      }).join('');
      container.querySelectorAll('[data-remover-etiqueta]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = parseInt(btn.getAttribute('data-remover-etiqueta'), 10);
          etiquetasSelecionadasIds = etiquetasSelecionadasIds.filter(function (x) { return x !== id; });
          renderEtiquetasSelecionadas();
          renderProgressoCliente();
        });
      });
    }

    function renderDropdownEtiquetas() {
      var dropdown = document.getElementById('cliente-etiquetas-dropdown');
      var disponiveis = etiquetasCatalogo.filter(function (e) { return etiquetasSelecionadasIds.indexOf(e.id) === -1; });
      if (disponiveis.length === 0) {
        dropdown.innerHTML = '<span style="padding:8px 10px; font-size:12.5px; color:var(--ink-faint); display:block;">Nenhuma etiqueta disponível.</span>';
        return;
      }
      dropdown.innerHTML = disponiveis.map(function (e) {
        return '<button type="button" data-escolher-etiqueta="' + e.id + '">' + esc(e.nome) + '</button>';
      }).join('');
      dropdown.querySelectorAll('[data-escolher-etiqueta]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          etiquetasSelecionadasIds.push(parseInt(btn.getAttribute('data-escolher-etiqueta'), 10));
          renderEtiquetasSelecionadas();
          renderProgressoCliente();
          dropdown.classList.add('hidden');
        });
      });
    }

    apiGetJson('/api/painel?acao=etiqueta_listar')
      .then(function (dados) { etiquetasCatalogo = dados.etiquetas || []; })
      .catch(function () { /* dropdown so fica vazio se falhar */ });

    document.getElementById('cliente-btn-add-etiqueta').addEventListener('click', function (ev) {
      ev.stopPropagation();
      renderDropdownEtiquetas();
      document.getElementById('cliente-etiquetas-dropdown').classList.toggle('hidden');
    });
    document.addEventListener('click', function (ev) {
      if (!ev.target.closest('#cliente-etiquetas-dropdown') && !ev.target.closest('#cliente-btn-add-etiqueta')) {
        var dropdown = document.getElementById('cliente-etiquetas-dropdown');
        if (dropdown) dropdown.classList.add('hidden');
      }
    });
    document.getElementById('cliente-btn-nova-etiqueta').addEventListener('click', function () {
      var nome = window.prompt('Nome da nova etiqueta:');
      if (!nome || !nome.trim()) return;
      apiPostJson('/api/painel?acao=etiqueta_criar', { nome: nome.trim() })
        .then(function (etiqueta) {
          if (!etiquetasCatalogo.find(function (e) { return e.id === etiqueta.id; })) etiquetasCatalogo.push(etiqueta);
          etiquetasSelecionadasIds.push(etiqueta.id);
          renderEtiquetasSelecionadas();
          renderProgressoCliente();
        })
        .catch(function (e) { alert(e.message || 'Não foi possível criar a etiqueta agora.'); });
    });

    document.getElementById('cliente-btn-cancelar').addEventListener('click', function () {
      window.location.href = 'painel-clientes.html#sec-clientes';
    });

    function arrayBufferParaBase64Cliente(buffer) {
      var binario = '';
      var bytes = new Uint8Array(buffer);
      for (var i = 0; i < bytes.length; i++) binario += String.fromCharCode(bytes[i]);
      return btoa(binario);
    }

    btnSalvar.addEventListener('click', function () {
      var erroDiv = document.getElementById('cliente-form-erro');
      erroDiv.innerHTML = '';
      var nome = document.getElementById('cliente-nome').value.trim();
      if (!nome) {
        erroDiv.innerHTML = '<div class="aviso-tenant">Preencha o nome / razão social.</div>';
        return;
      }

      var corpo = {
        tipo: document.getElementById('cliente-tipo').value,
        nome: nome,
        cpf_cnpj: document.getElementById('cliente-cpf-cnpj').value.trim(),
        email: document.getElementById('cliente-email').value.trim(),
        telefone: document.getElementById('cliente-telefone').value.trim(),
        cep: document.getElementById('cliente-cep').value.trim(),
        logradouro: document.getElementById('cliente-logradouro').value.trim(),
        numero: document.getElementById('cliente-numero').value.trim(),
        complemento: document.getElementById('cliente-complemento').value.trim(),
        bairro: document.getElementById('cliente-bairro').value.trim(),
        cidade: document.getElementById('cliente-cidade').value.trim(),
        uf: document.getElementById('cliente-uf').value.trim(),
        observacoes: document.getElementById('cliente-observacoes').value.trim(),
      };

      btnSalvar.disabled = true; btnSalvar.textContent = 'Salvando...';

      apiPostJson('/api/painel?acao=cliente_cadastro_criar', corpo)
        .then(function (resultado) {
          var clienteId = resultado.id;
          var pendentes = [];
          if (fotoArquivoSelecionado) {
            pendentes.push(fotoArquivoSelecionado.arrayBuffer().then(function (buffer) {
              return apiPostJson('/api/painel?acao=cliente_foto_salvar', {
                cliente_id: clienteId, nome_arquivo: fotoArquivoSelecionado.name,
                mimetype: fotoArquivoSelecionado.type || 'image/jpeg',
                dados_base64: arrayBufferParaBase64Cliente(buffer),
              });
            }));
          }
          if (etiquetasSelecionadasIds.length > 0) {
            pendentes.push(apiPostJson('/api/painel?acao=cliente_etiquetas_definir', {
              cliente_id: clienteId, etiqueta_ids: etiquetasSelecionadasIds,
            }));
          }
          return Promise.all(pendentes);
        })
        .then(function () {
          window.location.href = 'painel-clientes.html#sec-clientes';
        })
        .catch(function (e) {
          btnSalvar.disabled = false; btnSalvar.textContent = 'Salvar cliente';
          erroDiv.innerHTML = '<div class="aviso-tenant">' + esc(e.message || 'Não foi possível salvar agora.') + '</div>';
        });
    });

    renderProgressoCliente();
  }

  function wireProcessosAdministrativos() {
    var btnCriar = document.getElementById('procadm-btn-criar');
    var resultadoEl = document.getElementById('procadm-resultado');
    if (!btnCriar) return;

    var datalistProcAdm = document.getElementById('procadm-clientes-lista');
    if (datalistProcAdm) {
      apiGetJson('/api/painel?acao=clientes')
        .then(function (dados) {
          datalistProcAdm.innerHTML = (dados.clientes || []).map(function (c) {
            return '<option value="' + esc(c.nome) + '">';
          }).join('');
        })
        .catch(function () { /* datalist so ajuda, nao bloqueia o preenchimento manual se falhar */ });
    }

    var btnAnalisar = document.getElementById('procadm-analisar-btn');
    var inputAnalisar = document.getElementById('procadm-analisar-input');
    var statusAnalisar = document.getElementById('procadm-analisar-status');
    var dropzoneAnalisar = document.getElementById('procadm-analisar-dropzone');
    var escolherAnalisar = document.getElementById('procadm-analisar-escolher');
    var nomeArquivoAnalisar = document.getElementById('procadm-analisar-nome-arquivo');
    var arquivoAnalisadoBase64 = null;
    var arquivoAnalisadoInfo = null;

    function selecionarArquivoProcAdm(arquivo) {
      if (!arquivo) return;
      var dt = new DataTransfer();
      dt.items.add(arquivo);
      inputAnalisar.files = dt.files;
      if (nomeArquivoAnalisar) nomeArquivoAnalisar.textContent = arquivo.name;
      if (statusAnalisar) statusAnalisar.textContent = '';
      arquivoAnalisadoBase64 = null;
      arquivoAnalisadoInfo = null;
    }

    if (dropzoneAnalisar && inputAnalisar) {
      if (escolherAnalisar) escolherAnalisar.addEventListener('click', function () { inputAnalisar.click(); });
      inputAnalisar.addEventListener('change', function () {
        if (inputAnalisar.files[0]) {
          if (nomeArquivoAnalisar) nomeArquivoAnalisar.textContent = inputAnalisar.files[0].name;
          if (statusAnalisar) statusAnalisar.textContent = '';
          arquivoAnalisadoBase64 = null;
          arquivoAnalisadoInfo = null;
        }
      });
      ['dragenter', 'dragover'].forEach(function (ev) {
        dropzoneAnalisar.addEventListener(ev, function (e) {
          e.preventDefault();
          dropzoneAnalisar.classList.add('arrastando');
        });
      });
      ['dragleave', 'drop'].forEach(function (ev) {
        dropzoneAnalisar.addEventListener(ev, function (e) {
          e.preventDefault();
          dropzoneAnalisar.classList.remove('arrastando');
        });
      });
      dropzoneAnalisar.addEventListener('drop', function (e) {
        var arquivo = e.dataTransfer.files && e.dataTransfer.files[0];
        if (arquivo) selecionarArquivoProcAdm(arquivo);
      });
    }

    if (btnAnalisar) {
      btnAnalisar.addEventListener('click', function () {
        var arquivo = inputAnalisar.files && inputAnalisar.files[0];
        if (!arquivo) { alert('Escolha um arquivo primeiro.'); return; }
        if (arquivo.size > 4 * 1024 * 1024) { alert('Arquivo maior que 4 MB -- suba um menor.'); return; }

        var textoOriginal = btnAnalisar.textContent;
        btnAnalisar.disabled = true;
        btnAnalisar.textContent = 'Analisando...';
        statusAnalisar.textContent = '';

        arquivoParaBase64ProcAdm(arquivo).then(function (base64) {
          arquivoAnalisadoBase64 = base64;
          arquivoAnalisadoInfo = { nome_arquivo: arquivo.name, mimetype: arquivo.type || 'application/octet-stream' };
          return apiPostJson('/api/painel?acao=processo_administrativo_analisar', {
            mimetype: arquivo.type || 'application/octet-stream', dados_base64: base64
          });
        }).then(function (dados) {
          var campoCliente = document.querySelector('[data-form="procadm_criar"][data-campo="cliente"]');
          var campoOrgao = document.querySelector('[data-form="procadm_criar"][data-campo="orgao"]');
          var campoProtocolo = document.querySelector('[data-form="procadm_criar"][data-campo="numero_protocolo"]');
          if (dados.cliente_sugerido && campoCliente) campoCliente.value = dados.cliente_sugerido;
          if (dados.orgao && campoOrgao) campoOrgao.value = dados.orgao;
          if (dados.numero_protocolo && campoProtocolo) campoProtocolo.value = dados.numero_protocolo;

          if (dados.cliente_sugerido && dados.cliente_encontrado) {
            statusAnalisar.textContent = 'Preenchido. Cliente encontrado: ' + dados.cliente_sugerido + '. Confira antes de criar.';
          } else if (dados.cliente_sugerido) {
            statusAnalisar.textContent = 'Preenchido, mas não achei "' + dados.cliente_sugerido + '" cadastrado -- confira o nome do cliente.';
          } else {
            statusAnalisar.textContent = 'Não consegui identificar o cliente no documento -- preencha manualmente.';
          }
        }).catch(function (erro) {
          statusAnalisar.textContent = (erro && erro.message) || 'Não foi possível analisar o documento agora.';
          arquivoAnalisadoBase64 = null;
          arquivoAnalisadoInfo = null;
        }).finally(function () {
          btnAnalisar.disabled = false;
          btnAnalisar.textContent = textoOriginal;
        });
      });
    }

    btnCriar.addEventListener('click', function () {
      var campos = document.querySelectorAll('[data-form="procadm_criar"]');
      var corpo = { op: 'criar' };
      campos.forEach(function (campo) {
        var nomeCampo = campo.getAttribute('data-campo');
        if (nomeCampo) corpo[nomeCampo] = campo.value;
      });

      var textoOriginal = btnCriar.textContent;
      btnCriar.disabled = true;
      btnCriar.textContent = 'Criando...';
      resultadoEl.textContent = '';

      apiPostJson('/api/painel?acao=processos_administrativos', corpo)
        .then(function (dados) {
          resultadoEl.textContent = 'Processo criado.';
          campos.forEach(function (campo) { campo.value = ''; });

          var novoId = dados.processo && dados.processo.id;
          if (novoId && arquivoAnalisadoBase64 && arquivoAnalisadoInfo) {
            var infoParaAnexar = arquivoAnalisadoInfo;
            var base64ParaAnexar = arquivoAnalisadoBase64;
            arquivoAnalisadoBase64 = null;
            arquivoAnalisadoInfo = null;
            if (inputAnalisar) inputAnalisar.value = '';
            if (statusAnalisar) statusAnalisar.textContent = '';
            if (nomeArquivoAnalisar) nomeArquivoAnalisar.textContent = '';
            return apiPostJson('/api/painel?acao=processo_administrativo_anexar', {
              id: novoId, nome_arquivo: infoParaAnexar.nome_arquivo, mimetype: infoParaAnexar.mimetype, dados_base64: base64ParaAnexar
            }).then(function () {
              resultadoEl.textContent = 'Processo criado e documento anexado.';
            }).catch(function () {
              resultadoEl.textContent = 'Processo criado, mas não consegui anexar o documento -- anexe manualmente na ficha dele.';
            });
          }
        })
        .then(function () {
          carregarProcessosAdministrativos();
        })
        .catch(function (erro) {
          resultadoEl.textContent = (erro && erro.message) || 'Não foi possível criar agora.';
        })
        .finally(function () {
          btnCriar.disabled = false;
          btnCriar.textContent = textoOriginal;
        });
    });

    carregarProcessosAdministrativos();
  }

  function carregarProcessosAdministrativos() {
    apiGetJson('/api/painel?acao=processos_administrativos&op=listar')
      .then(function (dados) {
        renderProcessosAdministrativos(dados.processos || []);
      })
      .catch(function () {
        document.getElementById('procadm-lista').innerHTML =
          '<div class="empty-state"><div class="msg">Não foi possível carregar os processos administrativos.</div></div>';
      });
  }

  var ROTULOS_STATUS_PROCADM = { aberto: 'Aberto', aguardando: 'Aguardando', concluido: 'Concluído' };
  var CHIP_CLASSE_STATUS_PROCADM = { aberto: 'neutral', aguardando: 'warn', concluido: 'good' };

  function renderProcessosAdministrativos(processos) {
    var container = document.getElementById('procadm-lista');
    if (processos.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="msg">Nenhum processo administrativo cadastrado ainda.</div></div>';
      return;
    }

    container.innerHTML = processos.map(function (p) {
      var docsHtml = (p.documentos || []).map(function (d) {
        return '<div style="display:flex;align-items:center;gap:6px;font-size:12.5px;margin-bottom:3px;">' +
          '<button type="button" data-ver-doc-procadm="' + esc(d.id) + '" style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:12.5px;text-decoration:underline;padding:0;">' + esc(d.nome) + '</button>' +
          '<button type="button" data-remover-doc-procadm="' + esc(p.id) + '|' + esc(d.id) + '" title="Remover" style="background:none;border:none;color:var(--ink-faint);cursor:pointer;font-size:13px;padding:0;">×</button>' +
        '</div>';
      }).join('');

      return '<div class="processo-card" style="padding:14px 20px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;">' +
          '<div>' +
            '<div style="font-weight:600;">' + esc(p.cliente) + '</div>' +
            '<div style="font-size:12.5px;color:var(--ink-soft);">' + esc(p.orgao || 'Órgão não informado') +
              (p.numero_protocolo ? ' · Protocolo ' + esc(p.numero_protocolo) : '') + '</div>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:8px;">' +
            '<span class="chip ' + (CHIP_CLASSE_STATUS_PROCADM[p.status] || 'neutral') + '">' + esc(ROTULOS_STATUS_PROCADM[p.status] || p.status) + '</span>' +
            '<select data-status-select-procadm="' + esc(p.id) + '" style="font-size:12px;padding:4px 6px;border-radius:6px;border:1px solid var(--line);background:var(--surface);color:var(--ink);">' +
              '<option value="aberto"' + (p.status === 'aberto' ? ' selected' : '') + '>Aberto</option>' +
              '<option value="aguardando"' + (p.status === 'aguardando' ? ' selected' : '') + '>Aguardando</option>' +
              '<option value="concluido"' + (p.status === 'concluido' ? ' selected' : '') + '>Concluído</option>' +
            '</select>' +
          '</div>' +
        '</div>' +
        (p.prazo ? '<div class="chip warn" style="margin-top:8px;">Lembrete: ' + esc(fmtDataCurta(p.prazo)) + '</div>' : '') +
        (p.proximo_passo ? '<div style="margin-top:8px;font-size:13px;"><b>Próximo passo:</b> ' + esc(p.proximo_passo) + '</div>' : '') +
        (p.observacoes ? '<div style="margin-top:6px;font-size:13px;color:var(--ink-soft);">' + esc(p.observacoes) + '</div>' : '') +
        '<div style="margin-top:10px;">' +
          '<div style="font-size:12px;font-weight:600;color:var(--ink-soft);margin-bottom:4px;">Documentos</div>' +
          (docsHtml || '<div style="font-size:12.5px;color:var(--ink-faint);">Nenhum documento anexado.</div>') +
          '<div style="margin-top:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
            '<input type="file" data-upload-input-procadm="' + esc(p.id) + '" style="font-size:12px;max-width:220px;">' +
            '<button type="button" data-upload-btn-procadm="' + esc(p.id) + '" style="font-size:12px;padding:5px 10px;border-radius:6px;border:1px solid var(--line);background:var(--surface);color:var(--ink);cursor:pointer;">Anexar</button>' +
          '</div>' +
        '</div>' +
        '<div style="margin-top:10px;">' +
          '<button type="button" data-excluir-procadm="' + esc(p.id) + '" style="font-size:12px;color:var(--crit);background:none;border:none;cursor:pointer;padding:0;">Excluir processo</button>' +
        '</div>' +
      '</div>';
    }).join('');

    container.querySelectorAll('[data-status-select-procadm]').forEach(function (select) {
      select.addEventListener('change', function () {
        var id = select.getAttribute('data-status-select-procadm');
        apiPostJson('/api/painel?acao=processos_administrativos', { op: 'atualizar', id: id, status: select.value })
          .then(function () { carregarProcessosAdministrativos(); })
          .catch(function () { alert('Não foi possível atualizar o status agora.'); });
      });
    });

    container.querySelectorAll('[data-ver-doc-procadm]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var textoOriginal = btn.textContent;
        btn.textContent = 'Abrindo...';
        apiGet('/api/painel?acao=processo_administrativo_documento&id=' + encodeURIComponent(btn.getAttribute('data-ver-doc-procadm')))
          .then(function (r) { if (!r.ok) throw new Error('falha'); return r.blob(); })
          .then(function (blob) {
            window.open(URL.createObjectURL(blob), '_blank', 'noopener');
            btn.textContent = textoOriginal;
          })
          .catch(function () {
            btn.textContent = textoOriginal;
            alert('Não foi possível abrir o documento agora.');
          });
      });
    });

    container.querySelectorAll('[data-remover-doc-procadm]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var partes = btn.getAttribute('data-remover-doc-procadm').split('|');
        if (!confirm('Remover este documento?')) return;
        apiPostJson('/api/painel?acao=processos_administrativos', { op: 'remover_documento', id: partes[0], documento_id: partes[1] })
          .then(function () { carregarProcessosAdministrativos(); })
          .catch(function () { alert('Não foi possível remover o documento agora.'); });
      });
    });

    container.querySelectorAll('[data-upload-btn-procadm]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-upload-btn-procadm');
        var input = container.querySelector('[data-upload-input-procadm="' + id + '"]');
        var arquivo = input && input.files && input.files[0];
        if (!arquivo) { alert('Escolha um arquivo primeiro.'); return; }
        if (arquivo.size > 4 * 1024 * 1024) { alert('Arquivo maior que 4 MB -- suba um menor.'); return; }

        var textoOriginal = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Enviando...';
        arquivo.arrayBuffer().then(function (buffer) {
          var binario = '';
          var bytes = new Uint8Array(buffer);
          for (var i = 0; i < bytes.length; i++) binario += String.fromCharCode(bytes[i]);
          return apiPostJson('/api/painel?acao=processo_administrativo_anexar', {
            id: id, nome_arquivo: arquivo.name, mimetype: arquivo.type || 'application/octet-stream',
            dados_base64: btoa(binario)
          });
        })
          .then(function () { carregarProcessosAdministrativos(); })
          .catch(function (erro) {
            btn.disabled = false;
            btn.textContent = textoOriginal;
            alert((erro && erro.message) || 'Não foi possível enviar o arquivo agora.');
          });
      });
    });

    container.querySelectorAll('[data-excluir-procadm]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-excluir-procadm');
        if (!confirm('Excluir este processo administrativo? Os documentos continuam na pasta do cliente no Drive.')) return;
        apiPostJson('/api/painel?acao=processos_administrativos', { op: 'excluir', id: id })
          .then(function () { carregarProcessosAdministrativos(); })
          .catch(function () { alert('Não foi possível excluir agora.'); });
      });
    });
  }

  function wireCobranca() {
    var datalistCobrancaAvulsa = document.getElementById('cobranca-avulsa-clientes-lista');
    if (datalistCobrancaAvulsa) {
      apiGetJson('/api/painel?acao=clientes')
        .then(function (dados) {
          datalistCobrancaAvulsa.innerHTML = (dados.clientes || []).map(function (c) {
            return '<option value="' + esc(c.nome) + '">';
          }).join('');
        })
        .catch(function () { /* datalist so ajuda, nao bloqueia o preenchimento manual se falhar */ });
    }

    var datalistNotificacao = document.getElementById('notificacao-extrajudicial-clientes-lista');
    if (datalistNotificacao) {
      apiGetJson('/api/painel?acao=clientes')
        .then(function (dados) {
          datalistNotificacao.innerHTML = (dados.clientes || []).map(function (c) {
            return '<option value="' + esc(c.nome) + '">';
          }).join('');
        })
        .catch(function () { /* datalist so ajuda, nao bloqueia o preenchimento manual se falhar */ });
    }

    document.querySelectorAll('[data-cobrar-nome]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!confirm('Enviar cobrança de R$ ' + btn.getAttribute('data-cobrar-valor') + ' para ' +
          btn.getAttribute('data-cobrar-nome') + '?')) return;
        var textoOriginal = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Enviando...';
        apiPost('/api/painel?acao=executar', {
          tipo: 'cobrar_cliente',
          nome: btn.getAttribute('data-cobrar-nome'),
          valor: btn.getAttribute('data-cobrar-valor'),
          vencimento: btn.getAttribute('data-cobrar-vencimento'),
          linha_contrato: btn.getAttribute('data-cobrar-linha-contrato'),
          numero_parcela: btn.getAttribute('data-cobrar-numero-parcela')
        }).then(function (r) { return r.json(); }).then(function (dados) {
          alert(dados.resposta || dados.erro || 'Concluído.');
          btn.disabled = false;
          btn.textContent = textoOriginal;
        }).catch(function () {
          btn.disabled = false;
          btn.textContent = textoOriginal;
          alert('Não foi possível enviar a cobrança agora.');
        });
      });
    });
  }

  function wireNotificacaoExtrajudicial() {
    // A geracao (botao "Gerar notificacao") usa o mecanismo generico de automacao
    // (executarAutomacao/wireAutomacoes, mesmo caminho ja comprovado em Proposta/Contrato) --
    // aqui so cuida do botao extra "Confirmar e enviar", que nao existe nas outras automacoes.
    var btnConfirmar = document.getElementById('notificacao-extrajudicial-btn-confirmar');
    var areaConfirmar = document.getElementById('notificacao-extrajudicial-confirmar-area');
    var resultadoEl = document.querySelector('[data-resultado="notificacao_extrajudicial_gerar"]');
    if (!btnConfirmar || !areaConfirmar) return;

    btnConfirmar.addEventListener('click', function () {
      var pdfId = areaConfirmar.dataset.pdfId;
      var nome = areaConfirmar.dataset.nome;
      var prazoDias = areaConfirmar.dataset.prazoDias;
      var email = areaConfirmar.dataset.email;
      if (!pdfId || !nome) return;

      var aviso = 'Isso vai enviar a notificação de verdade pro cliente' +
        (email ? ' (WhatsApp + e-mail).' : ' (WhatsApp -- nenhum e-mail foi informado).') +
        ' Não dá pra desfazer. Confirma?';
      if (!confirm(aviso)) return;

      var textoOriginal = btnConfirmar.textContent;
      btnConfirmar.disabled = true;
      btnConfirmar.textContent = 'Enviando...';

      apiPostJson('/api/painel?acao=executar', {
        tipo: 'notificacao_extrajudicial_enviar',
        nome: nome, pdf_id: pdfId, prazo_dias: prazoDias, email: email
      })
        .then(function (dados) {
          if (resultadoEl) resultadoEl.textContent = dados.resposta || 'Concluído.';
          areaConfirmar.classList.add('hidden');
          delete areaConfirmar.dataset.pdfId;
        })
        .catch(function (erro) {
          if (resultadoEl) resultadoEl.textContent = (erro && erro.message) || 'Não foi possível enviar agora. Tente de novo.';
        })
        .finally(function () {
          btnConfirmar.disabled = false;
          btnConfirmar.textContent = textoOriginal;
        });
    });
  }

  var eventoEditandoId = null;
  var tarefaEditandoId = null;

  function fmtDataCurta(iso) {
    if (!iso) return '';
    var dataParte = iso.split('T')[0];
    var horaParte = iso.includes('T') ? iso.split('T')[1].substring(0, 5) : '';
    var partes = dataParte.split('-');
    var dataFmt = partes[2] + '/' + partes[1] + '/' + partes[0];
    return horaParte ? dataFmt + ' às ' + horaParte : dataFmt;
  }

  function carregarAgenda() {
    apiGetJson('/api/painel?acao=agenda&op=listar')
      .then(function (dados) {
        renderAgendaEventos(dados.eventos || []);
        renderAgendaTarefas(dados.tarefas || []);
        renderProximosCompromissos(dados.eventos || [], dados.tarefas || []);
      })
      .catch(function () {
        document.getElementById('agenda-lista-eventos').innerHTML =
          '<div class="empty-state"><div class="msg">Não foi possível carregar os eventos.</div></div>';
        document.getElementById('agenda-lista-tarefas').innerHTML =
          '<div class="empty-state"><div class="msg">Não foi possível carregar as tarefas.</div></div>';
        var listaProximos = document.getElementById('visao-proximos-lista');
        if (listaProximos) {
          listaProximos.innerHTML = '<div class="empty-state"><div class="msg">Não foi possível carregar a agenda.</div></div>';
        }
      });
  }

  function renderProximosCompromissos(eventos, tarefas) {
    var container = document.getElementById('visao-proximos-lista');
    if (!container) return;

    var itens = eventos.map(function (ev) {
      return { titulo: ev.titulo, dataOrdenacao: ev.inicio, dataExibida: fmtDataCurta(ev.inicio) };
    }).concat(
      tarefas.filter(function (t) { return t.data_vencimento; }).map(function (t) {
        return { titulo: t.titulo, dataOrdenacao: t.data_vencimento, dataExibida: fmtDataCurta(t.data_vencimento) };
      })
    );
    itens.sort(function (a, b) { return a.dataOrdenacao < b.dataOrdenacao ? -1 : 1; });
    itens = itens.slice(0, 4);

    if (itens.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="msg">Nada agendado nos próximos dias.</div></div>';
      return;
    }

    container.innerHTML = itens.map(function (item) {
      return '<div class="agenda-item">' +
        '<div><div class="agenda-item-titulo">' + esc(item.titulo) + '</div>' +
        '<div class="agenda-item-data">' + esc(item.dataExibida) + '</div></div>' +
      '</div>';
    }).join('');
  }

  function renderAgendaEventos(eventos) {
    var container = document.getElementById('agenda-lista-eventos');
    if (eventos.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="msg">Nenhum evento nos próximos 30 dias.</div></div>';
      return;
    }
    container.innerHTML = eventos.map(function (ev) {
      return '<div class="agenda-item">' +
        '<div><div class="agenda-item-titulo">' + esc(ev.titulo) + '</div>' +
        '<div class="agenda-item-data">' + esc(fmtDataCurta(ev.inicio)) + '</div></div>' +
        '<div class="agenda-item-acoes">' +
          '<button class="btn-editar" data-editar-evento="' + esc(ev.id) + '" data-titulo="' + esc(ev.titulo) + '" data-inicio="' + esc(ev.inicio) + '">Editar</button>' +
          '<button class="btn-remover" data-excluir-evento="' + esc(ev.id) + '">Excluir</button>' +
        '</div></div>';
    }).join('');

    container.querySelectorAll('[data-editar-evento]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        eventoEditandoId = btn.getAttribute('data-editar-evento');
        document.getElementById('evento-titulo').value = btn.getAttribute('data-titulo');
        var inicio = btn.getAttribute('data-inicio');
        document.getElementById('evento-data').value = inicio.split('T')[0];
        document.getElementById('evento-hora').value = inicio.includes('T') ? inicio.split('T')[1].substring(0, 5) : '';
        document.getElementById('evento-btn-salvar').textContent = 'Salvar edição';
        document.getElementById('evento-btn-cancelar').classList.remove('hidden');
      });
    });
    container.querySelectorAll('[data-excluir-evento]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!confirm('Excluir esse evento?')) return;
        apiPost('/api/painel?acao=agenda', { op: 'excluir_evento', id: btn.getAttribute('data-excluir-evento') })
          .then(function () { carregarAgenda(); });
      });
    });
  }

  function renderAgendaTarefas(tarefas) {
    var container = document.getElementById('agenda-lista-tarefas');
    if (tarefas.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="msg">Nenhuma tarefa pendente.</div></div>';
      return;
    }
    container.innerHTML = tarefas.map(function (t) {
      return '<div class="agenda-item">' +
        '<div><div class="agenda-item-titulo">' + esc(t.titulo) + '</div>' +
        '<div class="agenda-item-data">' + (t.data_vencimento ? esc(fmtDataCurta(t.data_vencimento)) : 'Sem prazo') + '</div></div>' +
        '<div class="agenda-item-acoes">' +
          '<button class="btn-concluir" data-concluir-tarefa="' + esc(t.id) + '">Concluir</button>' +
          '<button class="btn-editar" data-editar-tarefa="' + esc(t.id) + '" data-titulo="' + esc(t.titulo) + '" data-venc="' + esc(t.data_vencimento || '') + '">Editar</button>' +
          '<button class="btn-remover" data-excluir-tarefa="' + esc(t.id) + '">Excluir</button>' +
        '</div></div>';
    }).join('');

    container.querySelectorAll('[data-concluir-tarefa]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        btn.disabled = true;
        btn.textContent = 'Concluindo...';
        apiPost('/api/painel?acao=agenda', { op: 'concluir_tarefa', id: btn.getAttribute('data-concluir-tarefa') })
          .then(function (r) { return r.json().then(function (c) { return { status: r.status, corpo: c }; }); })
          .then(function (resultado) {
            if (resultado.status !== 200) {
              btn.disabled = false;
              btn.textContent = 'Concluir';
              alert(resultado.corpo.erro || 'Não foi possível concluir a tarefa agora.');
              return;
            }
            carregarAgenda();
          })
          .catch(function () {
            btn.disabled = false;
            btn.textContent = 'Concluir';
            alert('Não foi possível concluir a tarefa agora.');
          });
      });
    });
    container.querySelectorAll('[data-editar-tarefa]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        tarefaEditandoId = btn.getAttribute('data-editar-tarefa');
        document.getElementById('tarefa-titulo').value = btn.getAttribute('data-titulo');
        document.getElementById('tarefa-data').value = btn.getAttribute('data-venc');
        document.getElementById('tarefa-btn-salvar').textContent = 'Salvar edição';
        document.getElementById('tarefa-btn-cancelar').classList.remove('hidden');
      });
    });
    container.querySelectorAll('[data-excluir-tarefa]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!confirm('Excluir essa tarefa?')) return;
        apiPost('/api/painel?acao=agenda', { op: 'excluir_tarefa', id: btn.getAttribute('data-excluir-tarefa') })
          .then(function () { carregarAgenda(); });
      });
    });
  }

  function wireAgenda() {
    document.getElementById('evento-btn-salvar').addEventListener('click', function () {
      var titulo = document.getElementById('evento-titulo').value.trim();
      var data = document.getElementById('evento-data').value;
      var hora = document.getElementById('evento-hora').value;
      var comMeet = document.getElementById('evento-meet').checked;
      if (!titulo || !data) return;
      var op = eventoEditandoId ? 'editar_evento' : 'criar_evento';
      var corpoEvento = { op: op, titulo: titulo, data: data };
      if (hora) corpoEvento.hora = hora;
      if (comMeet && !eventoEditandoId) corpoEvento.meet = 'true';
      if (eventoEditandoId) corpoEvento.id = eventoEditandoId;
      var resultadoEl = document.getElementById('evento-meet-resultado');
      apiPost('/api/painel?acao=agenda', corpoEvento).then(function (r) { return r.json(); }).then(function (dados) {
        eventoEditandoId = null;
        document.getElementById('evento-titulo').value = '';
        document.getElementById('evento-data').value = '';
        document.getElementById('evento-hora').value = '';
        document.getElementById('evento-meet').checked = false;
        document.getElementById('evento-btn-salvar').textContent = 'Criar';
        document.getElementById('evento-btn-cancelar').classList.add('hidden');
        if (dados.link_meet) {
          resultadoEl.classList.remove('hidden');
          resultadoEl.innerHTML = 'Link do Meet: <a href="' + esc(dados.link_meet) + '" target="_blank" rel="noopener" style="color:var(--accent);">' + esc(dados.link_meet) + '</a>';
        } else {
          resultadoEl.classList.add('hidden');
        }
        carregarAgenda();
      });
    });

    document.getElementById('evento-btn-cancelar').addEventListener('click', function () {
      eventoEditandoId = null;
      document.getElementById('evento-titulo').value = '';
      document.getElementById('evento-data').value = '';
      document.getElementById('evento-hora').value = '';
      document.getElementById('evento-btn-salvar').textContent = 'Criar';
      this.classList.add('hidden');
    });

    document.getElementById('tarefa-btn-salvar').addEventListener('click', function () {
      var titulo = document.getElementById('tarefa-titulo').value.trim();
      var data = document.getElementById('tarefa-data').value;
      if (!titulo) return;
      var op = tarefaEditandoId ? 'editar_tarefa' : 'criar_tarefa';
      var corpoTarefa = { op: op, titulo: titulo };
      if (data) corpoTarefa.data = data;
      if (tarefaEditandoId) corpoTarefa.id = tarefaEditandoId;
      apiPost('/api/painel?acao=agenda', corpoTarefa).then(function () {
        tarefaEditandoId = null;
        document.getElementById('tarefa-titulo').value = '';
        document.getElementById('tarefa-data').value = '';
        document.getElementById('tarefa-btn-salvar').textContent = 'Criar';
        document.getElementById('tarefa-btn-cancelar').classList.add('hidden');
        carregarAgenda();
      });
    });

    document.getElementById('tarefa-btn-cancelar').addEventListener('click', function () {
      tarefaEditandoId = null;
      document.getElementById('tarefa-titulo').value = '';
      document.getElementById('tarefa-data').value = '';
      document.getElementById('tarefa-btn-salvar').textContent = 'Criar';
      this.classList.add('hidden');
    });
  }

  var CONTRATO_PLACEHOLDERS_PAGAMENTO = ['VALOR_TOTAL', 'VALOR_TOTAL_EXTENSO', 'VALOR_ENTRADA', 'VALOR_ENTRADA_EXTENSO', 'VALOR_PARCELA', 'VALOR_PARCELA_EXTENSO', 'NUM_PARCELAS', 'DATA_ENTRADA', 'DIA_VENCIMENTO'];
  var CONTRATO_PLACEHOLDERS_EXITO = ['PERCENTUAL_HONORARIOS', 'PERCENTUAL_RECURSAL'];

  function rotularCampoExtraContrato(nomePlaceholder) {
    var texto = nomePlaceholder.replace(/^VALOR_/, 'Valor ').replace(/^PERCENTUAL_/, '% ').replace(/_/g, ' ');
    return texto.charAt(0) + texto.slice(1).toLowerCase();
  }

  function wireContrato() {
    var datalistClientes = document.getElementById('contrato-clientes-lista');
    var datalistModelos = document.getElementById('contrato-modelos-lista');
    var campoTipoServico = document.getElementById('contrato-tipo-servico');
    var avisoEl = document.getElementById('contrato-modelo-aviso');
    var extrasContainer = document.getElementById('contrato-campos-extra-dinamicos');
    if (!datalistClientes || !datalistModelos || !campoTipoServico) return;

    var nomesModelosConhecidos = [];

    apiGetJson('/api/painel?acao=clientes')
      .then(function (dados) {
        datalistClientes.innerHTML = (dados.clientes || []).map(function (c) {
          return '<option value="' + esc(c.nome) + '">';
        }).join('');
      })
      .catch(function () { /* datalist so ajuda, nao bloqueia o preenchimento manual se falhar */ });

    apiGetJson('/api/painel?acao=modelos_contrato')
      .then(function (dados) {
        nomesModelosConhecidos = dados.modelos || [];
        datalistModelos.innerHTML = nomesModelosConhecidos.map(function (nomeArquivo) {
          return '<option value="' + esc(nomeArquivo) + '">';
        }).join('');
      })
      .catch(function () { /* idem */ });

    function mostrarTodosCamposContrato() {
      document.querySelectorAll('.contrato-campo-pagamento, .contrato-campo-exito').forEach(function (el) {
        el.classList.remove('hidden');
      });
      if (extrasContainer) extrasContainer.innerHTML = '';
      if (avisoEl) { avisoEl.classList.add('hidden'); avisoEl.textContent = ''; }
    }

    function ajustarCamposContrato(placeholders) {
      var usaPagamento = CONTRATO_PLACEHOLDERS_PAGAMENTO.some(function (p) { return placeholders.indexOf(p) !== -1; });
      var usaExito = CONTRATO_PLACEHOLDERS_EXITO.some(function (p) { return placeholders.indexOf(p) !== -1; });
      var placeholdersConhecidos = CONTRATO_PLACEHOLDERS_PAGAMENTO.concat(CONTRATO_PLACEHOLDERS_EXITO);
      var placeholdersExtras = placeholders.filter(function (p) {
        // "_EXTENSO" e sempre derivado automaticamente do valor numerico correspondente --
        // nao precisa (nem deve) virar um campo separado pra digitar por extenso na mao.
        return (p.indexOf('VALOR_') === 0 || p.indexOf('PERCENTUAL_') === 0) &&
          p.indexOf('_EXTENSO') === -1 && placeholdersConhecidos.indexOf(p) === -1;
      });

      document.querySelectorAll('.contrato-campo-pagamento').forEach(function (el) {
        el.classList.toggle('hidden', !usaPagamento);
      });
      document.querySelectorAll('.contrato-campo-exito').forEach(function (el) {
        el.classList.toggle('hidden', !usaExito);
      });
      if (extrasContainer) {
        extrasContainer.innerHTML = placeholdersExtras.map(function (nome) {
          return '<input type="text" placeholder="' + esc(rotularCampoExtraContrato(nome)) + ' (opcional)" data-campo-extra="' + esc(nome) + '" data-form="gerar_contrato">';
        }).join('');
      }

      if (avisoEl) {
        if (!usaPagamento && !usaExito && !placeholdersExtras.length) {
          avisoEl.textContent = 'Este modelo não usa os campos de valor/entrada nem de percentual desta tela — o pagamento já está definido no próprio texto do contrato.';
          avisoEl.classList.remove('hidden');
        } else {
          avisoEl.classList.add('hidden');
          avisoEl.textContent = '';
        }
      }
    }

    campoTipoServico.addEventListener('input', function () {
      var valorDigitado = campoTipoServico.value.trim();
      if (nomesModelosConhecidos.indexOf(valorDigitado) === -1) {
        mostrarTodosCamposContrato();
        return;
      }
      apiGetJson('/api/painel?acao=modelo_campos&nome=' + encodeURIComponent(valorDigitado))
        .then(function (dados) { ajustarCamposContrato(dados.placeholders || []); })
        .catch(function () { mostrarTodosCamposContrato(); });
    });
  }

  // O navegador (Chrome) so mostra no menu do <input list> as opcoes que "batem" com o texto
  // atual do campo -- depois de escolher uma opcao, o texto fica identico a ela, entao clicar
  // na seta de novo so mostra aquela mesma opcao ja escolhida, escondendo as outras. Isso aqui
  // detecta AUTOMATICAMENTE todo <input list> da pagina (o que ja existe na carga inicial e
  // qualquer um criado depois, em innerHTML de qualquer aba) e adiciona um botao "x" que limpa
  // o campo pra lista completa voltar a aparecer -- nao precisa lembrar de repetir esse padrao
  // manualmente toda vez que um campo novo desses for criado no futuro.
  (function () {
    var contadorId = 0;

    function ativarLimparDatalist(input) {
      if (input.dataset.datalistAuto) return; // ja processado, evita duplicar
      input.dataset.datalistAuto = '1';
      if (!input.id) {
        contadorId += 1;
        input.id = 'datalist-auto-' + contadorId;
      }

      var wrapper = document.createElement('div');
      wrapper.style.position = 'relative';
      input.parentNode.insertBefore(wrapper, input);
      wrapper.appendChild(input);

      input.style.paddingRight = '28px';
      input.style.boxSizing = 'border-box';
      if (!input.style.width) input.style.width = '100%';

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.title = 'Limpar e ver todas as opções';
      btn.textContent = '×';
      btn.style.cssText = 'position:absolute; right:4px; top:50%; transform:translateY(-50%); ' +
        'border:none; background:none; color:var(--ink-faint); cursor:pointer; font-size:15px; line-height:1; padding:4px 6px;';
      btn.addEventListener('click', function () {
        input.value = '';
        input.dispatchEvent(new Event('input'));
        input.focus();
      });
      wrapper.appendChild(btn);
    }

    function escanear(raiz) {
      (raiz.querySelectorAll ? raiz : document).querySelectorAll('input[list]').forEach(ativarLimparDatalist);
    }

    escanear(document);

    new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        m.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          if (node.matches && node.matches('input[list]')) ativarLimparDatalist(node);
          else if (node.querySelectorAll) escanear(node);
        });
      });
    }).observe(document.body, { childList: true, subtree: true });
  })();

  function wireAutomacoes() {
    var botoes = document.querySelectorAll('.btn-automacao');
    for (var i = 0; i < botoes.length; i++) {
      botoes[i].addEventListener('click', function (e) {
        var tipoBotao = e.target.getAttribute('data-tipo');
        if (tipoBotao === 'remover_cliente_financeiro') {
          var nomeCampo = document.querySelector('[data-form="remover_cliente_financeiro"][data-campo="nome"]');
          var nomeDigitado = nomeCampo ? nomeCampo.value.trim() : '';
          if (!nomeDigitado || !confirm('Remover "' + nomeDigitado + '" da planilha de honorários? Essa ação não pode ser desfeita pelo painel.')) {
            return;
          }
        }
        executarAutomacao(tipoBotao, e.target);
      });
    }

    var datalistVerificarDados = document.getElementById('verificar-dados-clientes-lista');
    if (datalistVerificarDados) {
      apiGetJson('/api/painel?acao=clientes')
        .then(function (dados) {
          datalistVerificarDados.innerHTML = (dados.clientes || []).map(function (c) {
            return '<option value="' + esc(c.nome) + '">';
          }).join('');
        })
        .catch(function () { /* datalist so ajuda, nao bloqueia o preenchimento manual se falhar */ });
    }
  }

  function executarAutomacao(tipo, botao) {
    var resultadoEl = document.querySelector('[data-resultado="' + tipo + '"]');
    var campos = document.querySelectorAll('[data-form="' + tipo + '"]');
    var corpo = { tipo: tipo };
    var camposExtra = {};

    for (var i = 0; i < campos.length; i++) {
      var nomeCampo = campos[i].getAttribute('data-campo');
      if (nomeCampo) {
        corpo[nomeCampo] = campos[i].value;
        continue;
      }
      var nomeExtra = campos[i].getAttribute('data-campo-extra');
      if (nomeExtra && campos[i].value) camposExtra[nomeExtra] = campos[i].value;
    }
    if (Object.keys(camposExtra).length) corpo.campos_extra = JSON.stringify(camposExtra);

    botao.disabled = true;
    var textoOriginal = botao.textContent;
    botao.textContent = 'Executando...';
    if (resultadoEl) resultadoEl.textContent = '';

    apiPost('/api/painel?acao=executar', corpo)
      .then(function (r) { return r.json().then(function (c) { return { status: r.status, corpo: c }; }); })
      .then(function (resultado) {
        if (resultadoEl) {
          resultadoEl.textContent = resultado.status === 200
            ? (resultado.corpo.resposta || 'Concluído.')
            : (resultado.corpo.erro || 'Erro ao executar.');
        }
        if (resultado.status === 200 && resultado.corpo.pdf_id) {
          mostrarPreviewDocumento(resultado.corpo.pdf_id, botao.getAttribute('data-preview') || 'proposta-preview');
        }
        if (tipo === 'cadastrar_cliente_financeiro' && resultado.status === 200) {
          carregarListaClientesFinanceiro();
        }
        if (tipo === 'notificacao_extrajudicial_gerar') {
          var areaConfirmarNotif = document.getElementById('notificacao-extrajudicial-confirmar-area');
          if (areaConfirmarNotif) {
            if (resultado.status === 200 && resultado.corpo.pdf_id) {
              areaConfirmarNotif.dataset.pdfId = resultado.corpo.pdf_id;
              areaConfirmarNotif.dataset.nome = corpo.nome || '';
              areaConfirmarNotif.dataset.prazoDias = corpo.prazo_dias || '';
              areaConfirmarNotif.dataset.email = (document.getElementById('notificacao-extrajudicial-email') || {}).value || '';
              areaConfirmarNotif.classList.remove('hidden');
            } else {
              areaConfirmarNotif.classList.add('hidden');
              delete areaConfirmarNotif.dataset.pdfId;
            }
          }
        }
      })
      .catch(function () {
        if (resultadoEl) resultadoEl.textContent = 'Não foi possível executar agora.';
      })
      .finally(function () {
        botao.disabled = false;
        botao.textContent = textoOriginal;
      });
  }

  function mostrarPreviewDocumento(pdfId, containerId) {
    var container = document.getElementById(containerId || 'proposta-preview');
    if (!container) return;
    container.innerHTML = '<div class="empty-state"><div class="msg">Carregando pré-visualização…</div></div>';
    apiGet('/api/painel?acao=documento_gerado&id=' + encodeURIComponent(pdfId))
      .then(function (r) { if (!r.ok) throw new Error('falha'); return r.blob(); })
      .then(function (blob) {
        var url = URL.createObjectURL(blob);
        container.innerHTML =
          '<div class="proposta-preview-topo"><button type="button" class="proposta-preview-fechar">Fechar pré-visualização</button></div>' +
          '<iframe class="proposta-preview-iframe" src="' + url + '"></iframe>';
        container.querySelector('.proposta-preview-fechar').addEventListener('click', function () {
          container.innerHTML = '';
        });
      })
      .catch(function () {
        container.innerHTML = '<div class="empty-state"><div class="msg">Não foi possível carregar a pré-visualização.</div></div>';
      });
  }

  var padraoOperacionalDados = {};
  var padraoOperacionalAbaAtual = 'atendimentos';

  function carregarPadraoOperacional() {
    apiGetJson('/api/painel?acao=padrao_operacional&op=listar')
      .then(function (dados) {
        padraoOperacionalDados = dados.abas || {};
        wirePadraoOperacional();
        mostrarAbaPadrao('atendimentos');
      })
      .catch(function () {
        var textarea = document.getElementById('padrao-texto');
        if (textarea) textarea.value = 'Não foi possível carregar o conteúdo agora.';
      });
  }

  function mostrarAbaPadrao(aba) {
    padraoOperacionalAbaAtual = aba;
    var textarea = document.getElementById('padrao-texto');
    var botaoSalvar = document.getElementById('padrao-btn-salvar');
    if (!textarea) return;
    textarea.value = padraoOperacionalDados[aba] || '';
    textarea.disabled = false;
    if (botaoSalvar) botaoSalvar.disabled = false;
    atualizarContadorPadrao();
    document.querySelectorAll('.padrao-aba-btn').forEach(function (btn) {
      var ativo = btn.getAttribute('data-aba') === aba;
      btn.classList.toggle('ativo', ativo);
      btn.setAttribute('aria-pressed', ativo ? 'true' : 'false');
    });
  }

  function atualizarContadorPadrao() {
    var textarea = document.getElementById('padrao-texto');
    var contador = document.getElementById('padrao-contador');
    if (textarea && contador) {
      contador.textContent = textarea.value.length + '/4000';
    }
  }

  function wirePadraoOperacional() {
    document.querySelectorAll('.padrao-aba-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        mostrarAbaPadrao(btn.getAttribute('data-aba'));
      });
    });

    var textarea = document.getElementById('padrao-texto');
    if (textarea) textarea.addEventListener('input', atualizarContadorPadrao);

    var botaoSalvar = document.getElementById('padrao-btn-salvar');
    var msg = document.getElementById('padrao-msg');
    if (botaoSalvar) {
      botaoSalvar.addEventListener('click', function () {
        var texto = textarea.value;
        var abaSalva = padraoOperacionalAbaAtual;
        botaoSalvar.disabled = true;
        botaoSalvar.textContent = 'Salvando...';
        if (msg) msg.textContent = '';
        apiPost('/api/painel?acao=padrao_operacional', { op: 'salvar', aba: abaSalva, conteudo: texto })
          .then(function (r) { return r.json().then(function (c) { return { status: r.status, corpo: c }; }); })
          .then(function (resultado) {
            if (resultado.status === 200) {
              padraoOperacionalDados[abaSalva] = texto;
              if (msg) {
                msg.textContent = 'Salvo.';
                setTimeout(function () { msg.textContent = ''; }, 3000);
              }
            } else if (msg) {
              msg.textContent = resultado.corpo.erro || 'Não foi possível salvar agora.';
            }
          })
          .catch(function () {
            if (msg) msg.textContent = 'Não foi possível salvar agora.';
          })
          .finally(function () {
            botaoSalvar.disabled = false;
            botaoSalvar.textContent = 'Salvar';
          });
      });
    }
  }

  function carregarPautaAudiencias() {
    apiGetJson('/api/painel?acao=pauta_audiencias')
      .then(function (dados) { renderPautaAudiencias(dados.pauta || []); })
      .catch(function () {
        document.getElementById('pauta-audiencias-lista').innerHTML =
          '<div class="empty-state"><div class="msg">Não foi possível carregar a pauta de audiências.</div></div>';
      });
  }

  function renderPautaAudiencias(pauta) {
    var container = document.getElementById('pauta-audiencias-lista');
    if (pauta.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="msg">Nenhuma audiência marcada no momento.</div></div>';
      return;
    }
    container.innerHTML = pauta.map(function (a) {
      return '<div class="processo-card">' +
        '<div class="processo-corpo aberto" style="padding-top:14px;">' +
          '<div class="processo-numero">' + esc(a.tipo_audiencia) + '</div>' +
          '<div class="processo-meta">' + esc(a.numero_processo) + (a.tribunal ? ' · ' + esc(a.tribunal) : '') +
            (a.orgao ? ' · ' + esc(a.orgao) : '') + '</div>' +
          (a.cliente ? '<div class="processo-meta">Cliente: ' + esc(a.cliente) + '</div>' : '') +
          '<div class="timeline-item-resumo" style="margin-top:8px;">' +
            '<strong>' + esc(fmtDataCurta(a.data + (a.hora ? 'T' + a.hora : ''))) + '</strong>' +
          '</div>' +
          (a.link_videoconferencia
            ? '<div style="margin-top:8px;"><a href="' + esc(a.link_videoconferencia) + '" target="_blank" rel="noopener" class="link-original">Entrar na videoconferência</a></div>'
            : '') +
          '<div style="margin-top:10px;"><button data-marcar-realizada="' + esc(a.id) + '">Audiência realizada</button></div>' +
        '</div></div>';
    }).join('');

    container.querySelectorAll('[data-marcar-realizada]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-marcar-realizada');
        var textoOriginal = btn.textContent;
        btn.textContent = 'Salvando...';
        btn.disabled = true;
        apiPost('/api/painel?acao=pauta_audiencias', { op: 'marcar_realizada', id: id })
          .then(function (r) { if (!r.ok) throw new Error('falha'); return r.json(); })
          .then(function () { carregarPautaAudiencias(); })
          .catch(function () {
            btn.textContent = textoOriginal;
            btn.disabled = false;
            alert('Não foi possível marcar a audiência como realizada agora.');
          });
      });
    });
  }

  function carregarAudiencias() {
    apiGetJson('/api/painel?acao=audiencias&op=listar')
      .then(function (dados) { renderAudiencias(dados.audiencias || []); })
      .catch(function () {
        document.getElementById('audiencias-lista').innerHTML =
          '<div class="empty-state"><div class="msg">Não foi possível carregar as audiências.</div></div>';
      });
  }

  function fmtDuracao(seg) {
    if (!seg && seg !== 0) return '';
    var h = Math.floor(seg / 3600), m = Math.floor((seg % 3600) / 60), s = seg % 60;
    if (h > 0) return h + 'h ' + String(m).padStart(2, '0') + 'min';
    if (m > 0) return m + ' min';
    return s + ' s';
  }

  function parseTranscricaoDialogo(texto) {
    var linhas = texto.split('\n');
    var regexFala = /^\[(\d{2}:\d{2}:\d{2})\]\s+Locutor\s+(\S+):\s*(.*)$/;
    var locutorCor = {}, proximaCor = 0;
    var partes = [], algumaFala = false;
    linhas.forEach(function (linha) {
      var m = linha.match(regexFala);
      if (!m) {
        if (linha.trim()) partes.push('<div class="timeline-item-resumo">' + esc(linha) + '</div>');
        return;
      }
      algumaFala = true;
      var locutor = m[2];
      if (!(locutor in locutorCor)) { locutorCor[locutor] = proximaCor % 4; proximaCor++; }
      partes.push(
        '<div class="fala"><span class="fala-hora">' + esc(m[1]) + '</span>' +
        '<span class="fala-locutor fala-locutor-' + locutorCor[locutor] + '">Locutor ' + esc(locutor) + '</span>' +
        '<span class="fala-texto">' + esc(m[3]) + '</span></div>'
      );
    });
    if (!algumaFala) {
      return '<div class="timeline-item-resumo" style="white-space:pre-wrap;">' + esc(texto) + '</div>';
    }
    return '<div class="transcricao-dialogo">' + partes.join('') + '</div>';
  }

  function renderAudiencias(audiencias) {
    var container = document.getElementById('audiencias-lista');
    if (audiencias.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="msg">Nenhuma audiência processada ainda.</div></div>';
      return;
    }
    container.innerHTML = audiencias.map(function (a, idx) {
      var avisos = (a.avisos && a.avisos.length)
        ? '<div class="chip warn" style="margin-bottom:10px;">' + esc(a.avisos.join(' | ')) + '</div>' : '';
      var chips = '';
      if (a.duracao_segundos || a.duracao_segundos === 0) chips += '<span class="audiencia-chip">' + esc(fmtDuracao(a.duracao_segundos)) + '</span>';
      if (a.total_falas) chips += '<span class="audiencia-chip">' + a.total_falas + ' fala' + (a.total_falas === 1 ? '' : 's') + '</span>';
      if (a.total_locutores) chips += '<span class="audiencia-chip">' + a.total_locutores + ' pessoa' + (a.total_locutores === 1 ? '' : 's') + '</span>';
      return '<div class="processo-card" data-busca-audiencia="' + esc(normalizarBusca(a.cliente + ' ' + a.resumo)) + '">' +
        '<button type="button" class="processo-cabecalho" data-toggle-audiencia="' + idx + '" aria-expanded="false" aria-controls="audiencia-corpo-' + idx + '">' +
          '<div><div class="processo-numero">' + esc(a.cliente) + '</div>' +
          '<div class="processo-meta">' + esc(fmtDataCurta(a.data_processamento)) + (chips ? ' · ' : '') + '</div>' +
          (chips ? '<div style="margin-top:4px;">' + chips + '</div>' : '') + '</div>' +
        '</button>' +
        '<div class="processo-corpo" id="audiencia-corpo-' + idx + '">' + avisos +
          '<div class="timeline-item-resumo" style="white-space:pre-wrap;">' + esc(a.resumo) + '</div>' +
          '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">' +
            '<button data-ver-transcricao="' + idx + '" data-id-audiencia="' + esc(a.id) + '">Ver transcrição completa</button>' +
            '<button data-baixar-audiencia-pdf="' + esc(a.pdf_file_id) + '">Baixar PDF</button>' +
            '<button data-excluir-audiencia="' + esc(a.id) + '" class="btn-remover">Excluir</button></div>' +
          '<div style="margin-top:12px;" id="audiencia-transcricao-' + idx + '"></div>' +
        '</div></div>';
    }).join('');

    container.querySelectorAll('[data-toggle-audiencia]').forEach(function (el) {
      el.addEventListener('click', function () {
        var corpo = document.getElementById('audiencia-corpo-' + el.getAttribute('data-toggle-audiencia'));
        var aberto = corpo.classList.toggle('aberto');
        el.setAttribute('aria-expanded', aberto ? 'true' : 'false');
      });
    });

    container.querySelectorAll('[data-ver-transcricao]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var idx = btn.getAttribute('data-ver-transcricao');
        var id = btn.getAttribute('data-id-audiencia');
        var alvo = document.getElementById('audiencia-transcricao-' + idx);
        if (alvo.innerHTML) { alvo.innerHTML = ''; return; }
        var textoOriginal = btn.textContent;
        btn.textContent = 'Carregando...';
        apiGetJson('/api/painel?acao=audiencias&op=detalhe&id=' + encodeURIComponent(id))
          .then(function (dados) {
            var texto = (dados.audiencia && dados.audiencia.transcricao_completa) || '(vazio)';
            alvo.innerHTML = parseTranscricaoDialogo(texto);
            btn.textContent = textoOriginal;
          })
          .catch(function () {
            btn.textContent = textoOriginal;
            alert('Não foi possível carregar a transcrição agora.');
          });
      });
    });

    var buscaInput = document.getElementById('audiencias-busca-input');
    if (buscaInput && !buscaInput.dataset.wired) {
      buscaInput.dataset.wired = '1';
      buscaInput.addEventListener('input', function () {
        var termo = normalizarBusca(buscaInput.value);
        document.querySelectorAll('[data-busca-audiencia]').forEach(function (card) {
          card.style.display = card.getAttribute('data-busca-audiencia').indexOf(termo) === -1 ? 'none' : '';
        });
      });
    }

    container.querySelectorAll('[data-baixar-audiencia-pdf]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var textoOriginal = btn.textContent;
        btn.textContent = 'Abrindo...';
        apiGet('/api/painel?acao=audiencia_documento&id=' + encodeURIComponent(btn.getAttribute('data-baixar-audiencia-pdf')))
          .then(function (r) { if (!r.ok) throw new Error('falha'); return r.blob(); })
          .then(function (blob) {
            window.open(URL.createObjectURL(blob), '_blank', 'noopener');
            btn.textContent = textoOriginal;
          })
          .catch(function () {
            btn.textContent = textoOriginal;
            alert('Não foi possível abrir o PDF agora.');
          });
      });
    });

    container.querySelectorAll('[data-excluir-audiencia]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = btn.getAttribute('data-excluir-audiencia');
        if (!confirm('Excluir essa transcrição de audiência? O PDF também será apagado do Drive. Essa ação não pode ser desfeita.')) return;
        var textoOriginal = btn.textContent;
        btn.textContent = 'Excluindo...';
        btn.disabled = true;
        apiPost('/api/painel?acao=audiencias', { op: 'excluir', id: id })
          .then(function (r) { if (!r.ok) throw new Error('falha'); return r.json(); })
          .then(function () { carregarAudiencias(); })
          .catch(function () {
            btn.textContent = textoOriginal;
            btn.disabled = false;
            alert('Não foi possível excluir agora.');
          });
      });
    });
  }

  function carregarDados() {
    gateError.textContent = '';
    var carregandoInicial = document.getElementById('carregando-inicial');
    // 'secao' diz pro back-end qual pagina esta pedindo, pra pular as leituras de planilha
    // (financeiro/pje) que essa pagina especifica nem vai usar -- ver handle_dashboard_request.
    apiGet('/api/painel?acao=dados&secao=' + encodeURIComponent(PAGINA_ATUAL))
      .then(function (r) {
        if (r.status === 401) throw new Error('sessao');
        if (!r.ok) throw new Error('falha');
        return r.json();
      })
      .then(function (dados) {
        if (carregandoInicial) carregandoInicial.classList.add('hidden');
        gate.classList.add('hidden');
        shell.classList.remove('hidden');
        try {
          renderPainel(dados);
        } catch (erroRender) {
          // erro ao montar a pagina (bug de renderizacao) nao e a mesma coisa que sessao
          // expirada -- nao pode derrubar o login por causa disso, so avisar e deixar
          // registrado pra investigar.
          console.error('Erro ao montar o painel:', erroRender);
          conteudo.innerHTML = '<div class="empty-state"><div class="msg">' +
            'Ocorreu um erro ao carregar esta página (' + esc(erroRender.message || String(erroRender)) + '). ' +
            'Atualize a página e tente de novo; se persistir, avise o suporte.</div></div>';
        }
      })
      .catch(function (e) {
        sessionStorage.removeItem('painel_token');
        document.documentElement.removeAttribute('data-tem-sessao');
        if (carregandoInicial) carregandoInicial.classList.add('hidden');
        gate.classList.remove('hidden');
        shell.classList.add('hidden');
        gateError.textContent = e.message === 'sessao'
          ? 'Sua sessão expirou. Entre novamente.'
          : 'Não foi possível carregar os dados agora.';
      });
  }

  function carregarListaUsuarios() {
    apiGetJson('/api/painel?acao=usuarios_listar')
      .then(function (dados) {
        var container = document.getElementById('admin-lista-usuarios');
        if (!container || !dados.usuarios) return;
        if (dados.usuarios.length === 0) {
          container.innerHTML = '<div class="empty-state"><div class="msg">Nenhum usuario cadastrado.</div></div>';
          return;
        }
        var rotulos = { financeiro: 'Financeiro', pje: 'PJe', clientes: 'Clientes', processos: 'Processos', agenda: 'Agenda', automacoes: 'Automações' };
        var linhas = dados.usuarios.map(function (u) {
          var descPermissoes;
          if (u.admin) {
            descPermissoes = 'acesso total';
          } else if (!u.permissoes) {
            descPermissoes = 'acesso total (usuário antigo)';
          } else if (u.permissoes.length === 0) {
            descPermissoes = 'nenhuma seção liberada';
          } else {
            descPermissoes = u.permissoes.map(function (p) { return rotulos[p] || p; }).join(', ');
          }
          return '<tr><td>' + esc(u.nome) + '<div class="permissoes-usuario">' + esc(descPermissoes) + '</div></td><td>' + esc(u.usuario) + '</td>' +
            '<td>' + (u.admin ? '<span class="chip good">Admin</span>' : '<span class="chip neutral">Padrão</span>') + '</td>' +
            '<td style="text-align:right"><button class="btn-remover" data-login="' + esc(u.usuario) + '">Remover</button></td></tr>';
        }).join('');
        container.innerHTML =
          '<div class="table-scroll">' +
          '<table style="min-width:480px;"><thead><tr><th>Nome</th><th>Login</th><th>Nível</th><th></th></tr></thead>' +
          '<tbody>' + linhas + '</tbody></table>' +
          '</div>';
        var botoes = container.querySelectorAll('.btn-remover');
        for (var i = 0; i < botoes.length; i++) {
          botoes[i].addEventListener('click', function (e) {
            removerUsuarioAdmin(e.target.getAttribute('data-login'));
          });
        }
      });
  }

  function criarUsuarioAdmin() {
    var nome = document.getElementById('admin-nome').value;
    var login = document.getElementById('admin-login').value;
    var senha = document.getElementById('admin-senha').value;
    var ehAdmin = document.getElementById('admin-eh-admin').checked;
    var permissoes = Array.prototype.slice.call(document.querySelectorAll('[data-permissao]:checked'))
      .map(function (el) { return el.getAttribute('data-permissao'); });
    var msg = document.getElementById('admin-msg');
    msg.textContent = '';

    apiPost('/api/painel?acao=usuarios_criar', {
      nome: nome, login: login, senha: senha,
      admin: ehAdmin ? 'true' : 'false',
      permissoes: permissoes.join(',')
    })
      .then(function (r) { return r.json().then(function (c) { return { status: r.status, corpo: c }; }); })
      .then(function (resultado) {
        if (resultado.status !== 200) {
          msg.textContent = resultado.corpo.erro || 'Erro ao criar usuario.';
          return;
        }
        document.getElementById('admin-nome').value = '';
        document.getElementById('admin-login').value = '';
        document.getElementById('admin-senha').value = '';
        document.getElementById('admin-eh-admin').checked = false;
        document.querySelectorAll('[data-permissao]').forEach(function (el) { el.checked = false; });
        msg.textContent = 'Usuário adicionado com sucesso.';
        carregarListaUsuarios();
      });
  }

  function removerUsuarioAdmin(login) {
    var msg = document.getElementById('admin-msg');
    apiPost('/api/painel?acao=usuarios_remover', { login: login })
      .then(function (r) { return r.json().then(function (c) { return { status: r.status, corpo: c }; }); })
      .then(function (resultado) {
        if (resultado.status !== 200) {
          msg.textContent = resultado.corpo.erro || 'Erro ao remover usuario.';
          return;
        }
        msg.textContent = 'Usuário removido.';
        carregarListaUsuarios();
      });
  }

  function fazerLogin(usuario, senha) {
    gateError.textContent = '';
    var tenantId = tenantIdInput.value.trim();
    var acaoLogin = tenantId ? 'login_tenant' : 'login';
    var corpoLogin = tenantId ? { tenant_id: tenantId, usuario: usuario, senha: senha } : { usuario: usuario, senha: senha };
    fetch('/api/painel?acao=' + acaoLogin, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpoLogin)
    })
      .then(function (r) {
        return r.json().then(function (corpo) { return { status: r.status, corpo: corpo }; });
      })
      .then(function (resultado) {
        if (resultado.status === 429) {
          gateError.textContent = 'Muitas tentativas erradas. Tente novamente mais tarde.';
          return;
        }
        if (resultado.status !== 200 || !resultado.corpo.token) {
          gateError.textContent = 'Usuário ou senha incorretos.';
          return;
        }
        sessionStorage.setItem('painel_token', resultado.corpo.token);
        if (document.getElementById('gate-lembrar') && document.getElementById('gate-lembrar').checked) {
          localStorage.setItem('painel_usuario_lembrado', usuario);
        } else {
          localStorage.removeItem('painel_usuario_lembrado');
        }
        carregarDados();
      })
      .catch(function () {
        gateError.textContent = 'Não foi possível entrar agora. Tente novamente.';
      });
  }

  btnEntrar.addEventListener('click', function () {
    fazerLogin(usuarioInput.value, senhaInput.value);
  });
  senhaInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') fazerLogin(usuarioInput.value, senhaInput.value);
  });

  wireModalDrill();
  wireMenuMobile();

  var tokenSalvo = sessionStorage.getItem('painel_token');
  if (tokenSalvo) carregarDados();
})();
