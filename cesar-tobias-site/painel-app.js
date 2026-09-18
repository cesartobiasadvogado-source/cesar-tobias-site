(function () {
  var gate = document.getElementById('gate');
  var shell = document.getElementById('shell');
  var conteudo = document.getElementById('conteudo');
  var evolucaoMensalAtual = [];
  var filtroGraficoAtual = '6';
  var mesesGraficoExecAtual = 12;
  var dadosPainelAtual = null;
  var itensModalDrillAtual = [];
  // Receita/despesa por mes do ultimo desenho do grafico Receita x Despesas nesta sessao --
  // comparada a cada novo desenho (1o carregamento, refresh, troca de periodo, dado novo) pra
  // toda torre animar do valor anterior pro atual. null = ainda nao desenhou nenhuma vez (1o
  // desenho sempre anima 0 -> altura atual).
  var ultimaSerieExecPorMes = null;

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
    corpo.innerHTML = '<div class="table-scroll"><table>' +
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
    inicio: 'Início', financeiro_antigo: 'Notificação Extrajudicial', pje: 'Processual (PJe)', clientes: 'Clientes', ficha_processos: 'Processos Judiciais',
    processo_administrativo: 'Processo Administrativo',
    importar_oab: 'Importar pela OAB', criar_processo: 'Criar Processo', novo_cliente: 'Novo Cliente', prazos: 'Prazos processuais',
    tarefas: 'Tarefas', agenda_completa: 'Agenda', automacoes_gerais: 'Automações', procuracao_contrato: 'Procuração e Contrato', padrao_operacional: 'Padrão Operacional',
    audiencias: 'Audiências', admin: 'Conexões do escritório', configuracoes: 'Configurações do Escritório',
    triagem_trabalhista: 'Triagem Trabalhista', criar_triagem: 'Nova Triagem Trabalhista',
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

  function aplicarRecolhimentoMenu(recolhida) {
    if (recolhida) document.documentElement.setAttribute('data-sidebar-recolhida', '1');
    else document.documentElement.removeAttribute('data-sidebar-recolhida');
    localStorage.setItem('painel_sidebar_recolhida', recolhida ? '1' : '0');
    var iconeFechar = document.getElementById('icone-recolher-fechar');
    var iconeAbrir = document.getElementById('icone-recolher-abrir');
    if (iconeFechar) iconeFechar.classList.toggle('hidden', recolhida);
    if (iconeAbrir) iconeAbrir.classList.toggle('hidden', !recolhida);
  }

  var btnRecolherMenu = document.getElementById('btn-recolher-menu');
  if (btnRecolherMenu) {
    // sincroniza os icones do botao com o estado ja aplicado (o atributo em <html> ja foi
    // setado antes do body existir, ver script inline de cada pagina -- so os icones do
    // botao que ainda nao sabem disso nesse primeiro instante).
    aplicarRecolhimentoMenu(document.documentElement.getAttribute('data-sidebar-recolhida') === '1');
    btnRecolherMenu.addEventListener('click', function () {
      aplicarRecolhimentoMenu(document.documentElement.getAttribute('data-sidebar-recolhida') !== '1');
    });
  }

  // titulo com o nome de cada item -- vira tooltip nativo do navegador quando o texto esta
  // escondido (menu recolhido), sem precisar de nenhuma logica extra pra mostrar/escoder.
  document.querySelectorAll('.nav-item, .inicio-lit-cta').forEach(function (el) {
    if (!el.title) el.title = el.textContent.trim();
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
      { btn: document.getElementById('hdr-btn-avisos'), menu: document.getElementById('hdr-menu-avisos') },
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

  function wireBuscaTopo() {
    var input = document.getElementById('hdr-busca-input');
    var resultadosEl = document.getElementById('hdr-busca-resultados');
    if (!input || !resultadosEl || input._buscaTopoWired) return;
    input._buscaTopoWired = true;

    var clientesCache = null;
    var processosCache = null;
    var processosAdmCache = null;
    var tarefasCache = null;
    var prazosCache = null;
    var audienciasCache = null;
    var timerDebounce = null;

    function garantirDados() {
      var pendentes = [];
      if (clientesCache === null) {
        clientesCache = [];
        pendentes.push(apiGetJson('/api/painel?acao=clientes').then(function (d) { clientesCache = d.clientes || []; }).catch(function () {}));
      }
      if (processosCache === null) {
        processosCache = [];
        pendentes.push(apiGetJson('/api/painel?acao=processo_manual_listar').then(function (d) { processosCache = d.processos || []; }).catch(function () {}));
      }
      if (processosAdmCache === null) {
        processosAdmCache = [];
        pendentes.push(apiGetJson('/api/painel?acao=processos_administrativos&op=listar').then(function (d) { processosAdmCache = d.processos || []; }).catch(function () {}));
      }
      if (tarefasCache === null) {
        tarefasCache = [];
        pendentes.push(apiGetJson('/api/painel?acao=tarefa_listar').then(function (d) { tarefasCache = d.tarefas || []; }).catch(function () {}));
      }
      if (prazosCache === null) {
        prazosCache = [];
        pendentes.push(apiGetJson('/api/painel?acao=prazo_listar').then(function (d) { prazosCache = d.prazos || []; }).catch(function () {}));
      }
      if (audienciasCache === null) {
        audienciasCache = [];
        pendentes.push(apiGetJson('/api/painel?acao=pauta_audiencias').then(function (d) { audienciasCache = d.pauta || []; }).catch(function () {}));
      }
      return Promise.all(pendentes);
    }

    function _grupoBusca(rotulo, itens) {
      if (!itens.length) return '';
      return '<div style="padding:6px 10px 2px; font-size:10.5px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; color:var(--ink-faint);">' +
        rotulo + '</div>' + itens.join('');
    }

    function renderResultados(termo) {
      var termoLower = termo.toLowerCase();
      var clientesAchados = clientesCache.filter(function (c) { return (c.nome || '').toLowerCase().indexOf(termoLower) !== -1; }).slice(0, 5);
      var processosAchados = processosCache.filter(function (p) {
        return (p.numero_cnj || '').toLowerCase().indexOf(termoLower) !== -1 || (p.cliente_nome || '').toLowerCase().indexOf(termoLower) !== -1;
      }).slice(0, 5);
      var processosAdmAchados = processosAdmCache.filter(function (p) {
        return (p.cliente || '').toLowerCase().indexOf(termoLower) !== -1 ||
          (p.numero_protocolo || '').toLowerCase().indexOf(termoLower) !== -1 ||
          (p.orgao || '').toLowerCase().indexOf(termoLower) !== -1;
      }).slice(0, 5);
      var tarefasAchadas = tarefasCache.filter(function (t) {
        return (t.titulo || '').toLowerCase().indexOf(termoLower) !== -1;
      }).slice(0, 5);
      var prazosAchados = prazosCache.filter(function (pz) {
        return (pz.titulo || '').toLowerCase().indexOf(termoLower) !== -1 || (pz.numero_cnj || '').toLowerCase().indexOf(termoLower) !== -1;
      }).slice(0, 5);
      var audienciasAchadas = audienciasCache.filter(function (a) {
        return (a.cliente || '').toLowerCase().indexOf(termoLower) !== -1 || (a.numero_processo || '').toLowerCase().indexOf(termoLower) !== -1;
      }).slice(0, 5);

      var total = clientesAchados.length + processosAchados.length + processosAdmAchados.length +
        tarefasAchadas.length + prazosAchados.length + audienciasAchadas.length;
      if (total === 0) {
        resultadosEl.innerHTML = '<div class="hdr-avisos-vazio">Nada encontrado para "' + esc(termo) + '".</div>';
        resultadosEl.classList.remove('hidden');
        return;
      }

      var html = '';
      html += _grupoBusca('Clientes', clientesAchados.map(function (c) {
        return '<a href="painel-clientes.html?cliente=' + encodeURIComponent(c.nome) + '">' + esc(c.nome) + '</a>';
      }));
      html += _grupoBusca('Processos', processosAchados.map(function (p) {
        return '<a href="painel-processos.html?processo=' + p.id + '#sec-processos">' + esc(p.numero_cnj || p.cliente_nome) + '</a>';
      }));
      html += _grupoBusca('Processo Administrativo', processosAdmAchados.map(function (p) {
        return '<a href="painel-processo-administrativo.html#sec-processo-administrativo">' + esc(p.cliente) +
          (p.numero_protocolo ? ' — ' + esc(p.numero_protocolo) : '') + '</a>';
      }));
      html += _grupoBusca('Tarefas', tarefasAchadas.map(function (t) {
        return '<a href="painel-tarefas.html#sec-tarefas">' + esc(t.titulo) + '</a>';
      }));
      html += _grupoBusca('Prazos', prazosAchados.map(function (pz) {
        return '<a href="painel-prazos.html#sec-prazos">' + esc(pz.titulo) + (pz.numero_cnj ? ' — ' + esc(pz.numero_cnj) : '') + '</a>';
      }));
      html += _grupoBusca('Audiências', audienciasAchadas.map(function (a) {
        return '<a href="painel-audiencias.html#sec-audiencias">' + esc(a.cliente || a.tipo_audiencia || '—') +
          (a.numero_processo ? ' — ' + esc(a.numero_processo) : '') + '</a>';
      }));

      resultadosEl.innerHTML = html;
      resultadosEl.classList.remove('hidden');
    }

    input.addEventListener('input', function () {
      var termo = input.value.trim();
      clearTimeout(timerDebounce);
      if (termo.length < 2) {
        resultadosEl.classList.add('hidden');
        return;
      }
      timerDebounce = setTimeout(function () {
        garantirDados().then(function () { renderResultados(termo); });
      }, 220);
    });
    input.addEventListener('focus', function () {
      if (input.value.trim().length >= 2) resultadosEl.classList.remove('hidden');
    });
    document.addEventListener('click', function (ev) {
      if (!ev.target.closest('.hdr-busca')) resultadosEl.classList.add('hidden');
    });
  }

  function _prazoEstaVencendoEmBreve(p) {
    if (p.status === 'vencido') return true;
    if (p.status !== 'pendente') return false;
    var limite = new Date();
    limite.setDate(limite.getDate() + 3);
    return p.data_limite <= _fmtISOData(limite);
  }

  function carregarAvisosHeader() {
    Promise.all([
      apiGetJson('/api/painel?acao=avisos_listar&apenas_ativos=true').catch(function () { return { avisos: [] }; }),
      apiGetJson('/api/painel?acao=prazo_listar').catch(function () { return { prazos: [] }; }),
    ]).then(function (resultados) {
      var avisos = resultados[0].avisos || [];
      var prazosUrgentes = (resultados[1].prazos || []).filter(_prazoEstaVencendoEmBreve);
      var badge = document.getElementById('hdr-avisos-badge');
      var lista = document.getElementById('hdr-avisos-lista');
      var total = avisos.length + prazosUrgentes.length;

      if (total === 0) {
        badge.classList.add('hidden');
        lista.innerHTML = '<div class="hdr-avisos-vazio">Nada por aqui no momento.</div>';
        return;
      }
      badge.textContent = total;
      badge.classList.remove('hidden');

      var html = '';
      if (prazosUrgentes.length) {
        html += '<div style="padding:6px 10px 2px; font-size:10.5px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; color:var(--ink-faint);">Prazos vencendo</div>';
        html += prazosUrgentes.map(function (p) {
          var cor = p.status === 'vencido' ? 'var(--crit)' : 'var(--warn)';
          return '<a href="painel-prazos.html#sec-prazos" class="hdr-avisos-item" style="display:block;">' +
            '<strong style="color:' + cor + ';">' + (p.status === 'vencido' ? 'Vencido' : 'Vence em breve') + '</strong> — ' + esc(p.titulo) +
            '<div style="font-size:11px; color:var(--ink-faint);">' + fmtDataProcesso(p.data_limite) + (p.numero_cnj ? ' · ' + esc(p.numero_cnj) : '') + '</div>' +
          '</a>';
        }).join('');
      }
      if (avisos.length) {
        html += '<div style="padding:6px 10px 2px; font-size:10.5px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; color:var(--ink-faint);">Avisos do escritório</div>';
        html += avisos.map(function (a) {
          return '<div class="hdr-avisos-item">' + esc(a.mensagem) + '</div>';
        }).join('');
      }
      lista.innerHTML = html;
    }).catch(function () {
      var lista = document.getElementById('hdr-avisos-lista');
      if (lista) lista.innerHTML = '<div class="hdr-avisos-vazio">Não foi possível carregar os avisos.</div>';
      });
  }

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

  // Mascara de valor em R$ pra todo campo de dinheiro da plataforma -- o usuario so digita os
  // numeros (ex: "225750") e o campo formata sozinho como "2.257,50" a cada tecla, tratando os
  // dois ultimos digitos como centavos (padrao de caixa eletronico/maquininha, o mais comum em
  // apps financeiros BR). Existe porque <input type="number"> nao aceita virgula em nenhum
  // navegador (so ponto), e o back-end (valor_para_float) espera exatamente o formato BR --
  // por isso o campo precisa ser type="text", nao type="number", pra poder mostrar "2.257,50".
  function aplicarMascaraMoeda(input) {
    if (!input) return;
    input.setAttribute('inputmode', 'decimal');
    input.setAttribute('autocomplete', 'off');
    input.addEventListener('input', function () {
      var digitos = input.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
      input.value = digitos ? (parseInt(digitos, 10) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
    });
  }

  // Mascara do numero de processo no padrao CNJ (Resolucao 65/2008): NNNNNNN-DD.AAAA.J.TR.OOOO,
  // sempre 20 digitos. O usuario so digita os numeros e o traço/pontos entram sozinhos a cada
  // tecla -- mesmo motivo do valor em dinheiro nao usar <input type="number"> (aqui nem digito
  // seria, e a mascara tem separador variado por posicao).
  function aplicarMascaraNumeroCnj(input) {
    if (!input) return;
    input.setAttribute('inputmode', 'numeric');
    input.setAttribute('autocomplete', 'off');
    input.addEventListener('input', function () {
      var digitos = input.value.replace(/\D/g, '').slice(0, 20);
      var partes = [
        digitos.slice(0, 7), digitos.slice(7, 9), digitos.slice(9, 13),
        digitos.slice(13, 14), digitos.slice(14, 16), digitos.slice(16, 20),
      ];
      var formatado = partes[0];
      if (partes[1]) formatado += '-' + partes[1];
      if (partes[2]) formatado += '.' + partes[2];
      if (partes[3]) formatado += '.' + partes[3];
      if (partes[4]) formatado += '.' + partes[4];
      if (partes[5]) formatado += '.' + partes[5];
      input.value = formatado;
    });
  }

  var ESC_MAPA = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(valor) {
    return String(valor === null || valor === undefined ? '' : valor).replace(/[&<>"']/g, function (c) {
      return ESC_MAPA[c];
    });
  }

  // Siglas exatamente como o DataJud (base publica do CNJ) espera -- ver datajud.py,
  // _alias_tribunal monta a URL da API a partir dessa sigla, entao um valor fora dessa lista
  // nunca sincroniza (a consulta simplesmente nao acha nada, sem erro nenhum). Escolher aqui em
  // vez de digitar evita repetir o problema descoberto com o processo da Elen Samile (tribunal
  // salvo por extenso, "Tribunal de Justiça do Amapá", nunca batia com a sigla "TJAP" da API).
  var GRUPOS_TRIBUNAIS = [
    { grupo: 'Superiores', itens: [
      ['STF', 'STF — Supremo Tribunal Federal'], ['STJ', 'STJ — Superior Tribunal de Justiça'],
      ['TST', 'TST — Tribunal Superior do Trabalho'], ['TSE', 'TSE — Tribunal Superior Eleitoral'],
      ['STM', 'STM — Superior Tribunal Militar'],
    ] },
    { grupo: 'Justiça Estadual (TJ)', itens: [
      ['TJAC', 'TJAC — Acre'], ['TJAL', 'TJAL — Alagoas'], ['TJAP', 'TJAP — Amapá'],
      ['TJAM', 'TJAM — Amazonas'], ['TJBA', 'TJBA — Bahia'], ['TJCE', 'TJCE — Ceará'],
      ['TJDFT', 'TJDFT — Distrito Federal e Territórios'], ['TJES', 'TJES — Espírito Santo'],
      ['TJGO', 'TJGO — Goiás'], ['TJMA', 'TJMA — Maranhão'], ['TJMT', 'TJMT — Mato Grosso'],
      ['TJMS', 'TJMS — Mato Grosso do Sul'], ['TJMG', 'TJMG — Minas Gerais'], ['TJPA', 'TJPA — Pará'],
      ['TJPB', 'TJPB — Paraíba'], ['TJPR', 'TJPR — Paraná'], ['TJPE', 'TJPE — Pernambuco'],
      ['TJPI', 'TJPI — Piauí'], ['TJRJ', 'TJRJ — Rio de Janeiro'], ['TJRN', 'TJRN — Rio Grande do Norte'],
      ['TJRS', 'TJRS — Rio Grande do Sul'], ['TJRO', 'TJRO — Rondônia'], ['TJRR', 'TJRR — Roraima'],
      ['TJSC', 'TJSC — Santa Catarina'], ['TJSE', 'TJSE — Sergipe'], ['TJSP', 'TJSP — São Paulo'],
      ['TJTO', 'TJTO — Tocantins'],
    ] },
    { grupo: 'Justiça Federal (TRF)', itens: [
      ['TRF1', 'TRF1 — 1ª Região'], ['TRF2', 'TRF2 — 2ª Região'], ['TRF3', 'TRF3 — 3ª Região'],
      ['TRF4', 'TRF4 — 4ª Região'], ['TRF5', 'TRF5 — 5ª Região'], ['TRF6', 'TRF6 — 6ª Região'],
    ] },
    { grupo: 'Justiça do Trabalho (TRT)', itens: Array.from({ length: 24 }, function (_, i) {
      var n = i + 1;
      return ['TRT' + n, 'TRT' + n + ' — ' + n + 'ª Região'];
    }) },
    { grupo: 'Justiça Eleitoral (TRE)', itens: [
      ['TREAC', 'TRE-AC'], ['TREAL', 'TRE-AL'], ['TREAP', 'TRE-AP'], ['TREAM', 'TRE-AM'],
      ['TREBA', 'TRE-BA'], ['TRECE', 'TRE-CE'], ['TREDF', 'TRE-DF'], ['TREES', 'TRE-ES'],
      ['TREGO', 'TRE-GO'], ['TREMA', 'TRE-MA'], ['TREMT', 'TRE-MT'], ['TREMS', 'TRE-MS'],
      ['TREMG', 'TRE-MG'], ['TREPA', 'TRE-PA'], ['TREPB', 'TRE-PB'], ['TREPR', 'TRE-PR'],
      ['TREPE', 'TRE-PE'], ['TREPI', 'TRE-PI'], ['TRERJ', 'TRE-RJ'], ['TRERN', 'TRE-RN'],
      ['TRERS', 'TRE-RS'], ['TRERO', 'TRE-RO'], ['TRERR', 'TRE-RR'], ['TRESC', 'TRE-SC'],
      ['TRESE', 'TRE-SE'], ['TRESP', 'TRE-SP'], ['TRETO', 'TRE-TO'],
    ] },
    { grupo: 'Justiça Militar Estadual', itens: [
      ['TJMMG', 'TJM-MG — Minas Gerais'], ['TJMRS', 'TJM-RS — Rio Grande do Sul'], ['TJMSP', 'TJM-SP — São Paulo'],
    ] },
  ];

  function htmlOpcoesTribunal(valorSelecionado) {
    var atual = (valorSelecionado || '').trim().toUpperCase();
    var opcaoVazia = '<option value="">Selecione...</option>';
    var grupos = GRUPOS_TRIBUNAIS.map(function (g) {
      var opcoes = g.itens.map(function (item) {
        return '<option value="' + esc(item[0]) + '"' + (item[0] === atual ? ' selected' : '') + '>' + esc(item[1]) + '</option>';
      }).join('');
      return '<optgroup label="' + esc(g.grupo) + '">' + opcoes + '</optgroup>';
    }).join('');
    // se o processo ja tinha um valor que nao bate com nenhuma sigla conhecida (cadastro antigo,
    // por extenso ou de um tribunal fora dessa lista), preserva ele como opcao extra em vez de
    // trocar silenciosamente -- mesmo cuidado ja usado pro campo Situacao dos honorarios de exito.
    var conhecido = GRUPOS_TRIBUNAIS.some(function (g) { return g.itens.some(function (item) { return item[0] === atual; }); });
    var opcaoLivre = (atual && !conhecido) ? '<option value="' + esc(valorSelecionado) + '" selected>' + esc(valorSelecionado) + '</option>' : '';
    return opcaoVazia + opcaoLivre + grupos;
  }

  // Links confirmados da consulta publica oficial de cada tribunal (o DataJud so da o TIPO do
  // andamento, nunca o documento -- ver conversa com o usuario sobre "Peticao"/"Decisao
  // Interlocutoria" sem link pra abrir). So entram aqui tribunais com URL verificada de verdade
  // (busca feita, nao chute) -- pra qualquer outro, cai no fallback de busca no Google.
  var CONSULTA_PUBLICA_TRIBUNAL = {
    'TJAP': 'https://pje.tjap.jus.br/1g/ConsultaPublica/listView.seam',
    'TRT8': 'https://pje.trt8.jus.br/consultaprocessual/home',
    'TRF1': 'https://pje1g.trf1.jus.br/pje/ConsultaPublica/listView.seam',
  };

  function linkConsultaPublicaProcesso(tribunal, numeroCnj) {
    var sigla = (tribunal || '').trim().toUpperCase();
    if (CONSULTA_PUBLICA_TRIBUNAL[sigla]) return CONSULTA_PUBLICA_TRIBUNAL[sigla];
    // fallback honesto pra tribunal sem URL confirmada -- nunca inventa um link direto que pode
    // dar pagina quebrada, so ajuda a achar a consulta oficial certa.
    return 'https://www.google.com/search?q=' + encodeURIComponent((numeroCnj || '') + ' ' + (tribunal || '') + ' consulta processual pje');
  }

  function agruparAtosRepetidos(lista) {
    // O DataJud loga um "Peticao / Outros documentos" por ARQUIVO anexado (a peticao inicial
    // com 25 documentos vira 25 movimentos identicos, so alguns segundos de diferenca) --
    // dado real do tribunal, nao duplicata nossa, mas 25 linhas iguais na tela e ilegivel.
    // Junta tudo que tem a mesma origem+tipo+descricao+data numa linha so, com contador.
    var grupos = [];
    var indice = {};
    lista.forEach(function (a) {
      var chave = (a.origem || '') + '|' + (a.tipo || '') + '|' + (a.descricao || '') + '|' + (a.data || '');
      if (indice[chave] === undefined) {
        indice[chave] = grupos.length;
        grupos.push({ base: a, qtd: 1 });
      } else {
        grupos[indice[chave]].qtd += 1;
      }
    });
    return grupos;
  }

  function setSelectValueComFallback(select, valor) {
    if (!select) return;
    var v = valor || '';
    var existe = Array.prototype.some.call(select.options, function (o) { return o.value === v; });
    if (v && !existe) {
      var opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v;
      select.appendChild(opt);
    }
    select.value = v;
  }

  function _abrirCalendarioAoClicar(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', function () {
      if (this.showPicker) {
        try { this.showPicker(); } catch (e) { /* alguns navegadores exigem gesto direto do usuario -- clique ja e, so ignora se falhar */ }
      }
    });
  }

  // Substitui o confirm() nativo do navegador (que parece "sistema quebrado") por um modal no
  // estilo da plataforma. Uso: confirmarModal('mensagem').then(function (ok) { if (!ok) return; ... }).
  function confirmarModal(mensagem, opcoes) {
    opcoes = opcoes || {};
    return new Promise(function (resolve) {
      var overlay = document.getElementById('confirm-modal-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'confirm-modal-overlay';
        overlay.className = 'modal-overlay hidden';
        overlay.innerHTML =
          '<div class="confirm-modal-caixa">' +
            '<div class="confirm-modal-titulo" id="confirm-modal-titulo"></div>' +
            '<div class="confirm-modal-msg" id="confirm-modal-msg"></div>' +
            '<div class="confirm-modal-acoes">' +
              '<button type="button" class="btn-conexao-secundario" id="confirm-modal-cancelar"></button>' +
              '<button type="button" id="confirm-modal-ok"></button>' +
            '</div>' +
          '</div>';
        document.body.appendChild(overlay);
      }
      document.getElementById('confirm-modal-titulo').textContent = opcoes.titulo || 'Confirmar ação';
      document.getElementById('confirm-modal-msg').textContent = mensagem;
      var btnOk = document.getElementById('confirm-modal-ok');
      var btnCancelar = document.getElementById('confirm-modal-cancelar');
      btnOk.textContent = opcoes.textoOk || 'Excluir';
      btnCancelar.textContent = opcoes.textoCancelar || 'Cancelar';
      btnOk.className = opcoes.perigo === false ? 'btn-conexao' : 'btn-conexao-perigo';
      btnCancelar.classList.toggle('hidden', !!opcoes.somenteOk);

      function limpar(resultado) {
        overlay.classList.add('hidden');
        btnOk.removeEventListener('click', onOk);
        btnCancelar.removeEventListener('click', onCancelar);
        overlay.removeEventListener('click', onOverlay);
        document.removeEventListener('keydown', onEsc);
        resolve(resultado);
      }
      function onOk() { limpar(true); }
      function onCancelar() { limpar(false); }
      function onOverlay(e) { if (e.target === overlay) limpar(false); }
      function onEsc(e) { if (e.key === 'Escape') limpar(false); }

      btnOk.addEventListener('click', onOk);
      btnCancelar.addEventListener('click', onCancelar);
      overlay.addEventListener('click', onOverlay);
      document.addEventListener('keydown', onEsc);
      overlay.classList.remove('hidden');
      btnOk.focus();
    });
  }

  // Substitui o alert() nativo do navegador (feio, fora do visual do site) por um aviso no
  // mesmo estilo dos outros modais -- reaproveita confirmarModal, so escondendo o botao
  // "Cancelar" (somenteOk) e trocando o titulo padrao pra "Aviso".
  function mostrarAviso(mensagem, opcoes) {
    opcoes = opcoes || {};
    return confirmarModal(mensagem, {
      titulo: opcoes.titulo || 'Aviso',
      textoOk: opcoes.textoOk || 'OK',
      perigo: false,
      somenteOk: true,
    });
  }

  // Escolha de 3 vias (cancelar / só Pix / com Asaas) pro botão "Cobrar" -- confirmarModal só
  // tem ok/cancelar, e aqui o cliente as vezes prefere pagar direto na chave Pix do advogado
  // (sem taxa do Asaas) em vez do link automático. Resolve com 'asaas', 'pix' ou null (cancelou).
  function escolherTipoCobranca() {
    return new Promise(function (resolve) {
      var overlay = document.getElementById('tipo-cobranca-modal-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'tipo-cobranca-modal-overlay';
        overlay.className = 'modal-overlay hidden';
        overlay.innerHTML =
          '<div class="confirm-modal-caixa">' +
            '<div class="confirm-modal-titulo">Como cobrar?</div>' +
            '<div class="confirm-modal-msg">Escolha como enviar esta cobrança pro cliente.</div>' +
            '<div class="confirm-modal-acoes" style="flex-wrap:wrap;">' +
              '<button type="button" class="btn-conexao-secundario" id="tipo-cobranca-cancelar">Cancelar</button>' +
              '<button type="button" class="btn-conexao-secundario" id="tipo-cobranca-pix">Só Pix (sem taxas)</button>' +
              '<button type="button" class="btn-conexao" id="tipo-cobranca-asaas">Com Asaas (link automático)</button>' +
            '</div>' +
          '</div>';
        document.body.appendChild(overlay);
      }
      var btnCancelar = document.getElementById('tipo-cobranca-cancelar');
      var btnPix = document.getElementById('tipo-cobranca-pix');
      var btnAsaas = document.getElementById('tipo-cobranca-asaas');

      function limpar(resultado) {
        overlay.classList.add('hidden');
        btnCancelar.removeEventListener('click', onCancelar);
        btnPix.removeEventListener('click', onPix);
        btnAsaas.removeEventListener('click', onAsaas);
        overlay.removeEventListener('click', onOverlay);
        document.removeEventListener('keydown', onEsc);
        resolve(resultado);
      }
      function onCancelar() { limpar(null); }
      function onPix() { limpar('pix'); }
      function onAsaas() { limpar('asaas'); }
      function onOverlay(e) { if (e.target === overlay) limpar(null); }
      function onEsc(e) { if (e.key === 'Escape') limpar(null); }

      btnCancelar.addEventListener('click', onCancelar);
      btnPix.addEventListener('click', onPix);
      btnAsaas.addEventListener('click', onAsaas);
      overlay.addEventListener('click', onOverlay);
      document.addEventListener('keydown', onEsc);
      overlay.classList.remove('hidden');
      btnAsaas.focus();
    });
  }

  // Confirmacao "reforcada" pra acao sem volta nenhuma (apagar definitivamente): so libera o
  // botao quando a pessoa digita o texto exigido, igual GitHub/AWS pedem digitar o nome do
  // recurso antes de apagar de vez.
  function confirmarDigitando(mensagem, textoEsperado, opcoes) {
    opcoes = opcoes || {};
    return new Promise(function (resolve) {
      var overlay = document.getElementById('confirm-digitando-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'confirm-digitando-overlay';
        overlay.className = 'modal-overlay hidden';
        overlay.innerHTML =
          '<div class="confirm-modal-caixa">' +
            '<div class="confirm-modal-titulo" id="confirm-digitando-titulo"></div>' +
            '<div class="confirm-modal-msg" id="confirm-digitando-msg"></div>' +
            '<div class="ncontrato-campo" style="margin-top:14px;">' +
              '<input type="text" id="confirm-digitando-input" autocomplete="off">' +
            '</div>' +
            '<div class="confirm-modal-acoes">' +
              '<button type="button" class="btn-conexao-secundario" id="confirm-digitando-cancelar">Cancelar</button>' +
              '<button type="button" class="btn-conexao-perigo" id="confirm-digitando-ok" disabled></button>' +
            '</div>' +
          '</div>';
        document.body.appendChild(overlay);
      }
      document.getElementById('confirm-digitando-titulo').textContent = opcoes.titulo || 'Confirmar ação definitiva';
      document.getElementById('confirm-digitando-msg').textContent = mensagem;
      var input = document.getElementById('confirm-digitando-input');
      var btnOk = document.getElementById('confirm-digitando-ok');
      var btnCancelar = document.getElementById('confirm-digitando-cancelar');
      input.value = '';
      btnOk.textContent = opcoes.textoOk || 'Apagar definitivamente';
      btnOk.disabled = true;

      function onInput() { btnOk.disabled = input.value !== textoEsperado; }
      function limpar(resultado) {
        overlay.classList.add('hidden');
        input.removeEventListener('input', onInput);
        btnOk.removeEventListener('click', onOk);
        btnCancelar.removeEventListener('click', onCancelar);
        overlay.removeEventListener('click', onOverlay);
        document.removeEventListener('keydown', onEsc);
        resolve(resultado);
      }
      function onOk() { if (!btnOk.disabled) limpar(true); }
      function onCancelar() { limpar(false); }
      function onOverlay(e) { if (e.target === overlay) limpar(false); }
      function onEsc(e) { if (e.key === 'Escape') limpar(false); }

      input.addEventListener('input', onInput);
      btnOk.addEventListener('click', onOk);
      btnCancelar.addEventListener('click', onCancelar);
      overlay.addEventListener('click', onOverlay);
      document.addEventListener('keydown', onEsc);
      overlay.classList.remove('hidden');
      input.focus();
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

  var STATUS_PARCELA_CONFIG = [
    { chave: 'Vencida', rotulo: 'Vencidas', cor: 'var(--crit)' },
    { chave: 'Vence hoje', rotulo: 'Vencendo hoje', cor: 'var(--warn)' },
    { chave: 'A vencer', rotulo: 'A vencer', cor: 'var(--accent)' },
    { chave: 'Paga', rotulo: 'Pagas', cor: 'var(--good)' },
    { chave: 'Sem data de vencimento', rotulo: 'Sem data de vencimento', cor: 'var(--ink-faint)' },
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
    if (!evolucaoFiltrada.length) {
      wrap.innerHTML = '<div class="fluxo-vazio">Sem movimentação financeira registrada ainda.</div>' + tooltipHtml;
      return;
    }

    var maxValor = Math.max.apply(null, evolucaoFiltrada.map(function (m) { return Math.max(m.recebido, m.vencido || 0); }).concat([0.01]));
    var mesAtualChave = new Date().toISOString().slice(0, 7);
    var ticks = [1, 0.75, 0.5, 0.25, 0].map(function (f) { return f * maxValor; });

    var html = '<div class="fluxo-bars-wrap">';
    html += '<div class="fluxo-bars-eixo-y">' + ticks.map(function (v) { return '<span>' + fmtValorEixo(v) + '</span>'; }).join('') + '</div>';
    html += '<div class="fluxo-bars-grade">' + ticks.map(function () { return '<div></div>'; }).join('') + '</div>';
    html += '<div class="fluxo-bars-grupos">';
    evolucaoFiltrada.forEach(function (m) {
      var alturaRecebido = Math.max((m.recebido / maxValor) * 100, m.recebido > 0 ? 1.5 : 0);
      var alturaVencido = Math.max(((m.vencido || 0) / maxValor) * 100, m.vencido > 0 ? 1.5 : 0);
      html += '<div class="fluxo-grupo">' +
        '<div class="fluxo-barra fluxo-barra-recebido" style="height:' + alturaRecebido + '%;" ' +
          'data-mes="' + esc(m.mes) + '" data-recebido="' + m.recebido + '" data-a-receber="' + m.a_receber + '" data-vencido="' + (m.vencido || 0) + '"></div>' +
        '<div class="fluxo-barra fluxo-barra-vencido" style="height:' + alturaVencido + '%;" ' +
          'data-mes="' + esc(m.mes) + '" data-recebido="' + m.recebido + '" data-a-receber="' + m.a_receber + '" data-vencido="' + (m.vencido || 0) + '"></div>' +
      '</div>';
    });
    html += '</div>';
    html += '<div class="fluxo-bars-eixo-x">' + evolucaoFiltrada.map(function (m) {
      return '<span' + (m.mes === mesAtualChave ? ' class="atual"' : '') + '>' + esc(nomeMesAbrev(m.mes)) + '</span>';
    }).join('') + '</div>';
    html += '</div>';
    html += '<div class="fluxo-legenda">' +
      '<span class="fluxo-legenda-item"><span class="fluxo-legenda-swatch" style="background:var(--good-soft);border:1px solid var(--good);"></span>Recebido</span>' +
      '<span class="fluxo-legenda-item"><span class="fluxo-legenda-swatch" style="background:var(--crit-soft);border:1px solid var(--crit);"></span>Vencido</span>' +
    '</div>';

    wrap.innerHTML = html + tooltipHtml;
    wireHoverGrafico(wrap);
  }

  function fmtValorEixo(v) {
    if (v >= 1000) return 'R$ ' + Math.round(v / 1000) + 'k';
    return 'R$ ' + Math.round(v);
  }

  function wireHoverGrafico(wrap) {
    var tooltip = document.getElementById('grafico-tooltip');
    if (!tooltip) return;
    wrap.querySelectorAll('[data-mes]').forEach(function (barra) {
      barra.addEventListener('mousemove', function (ev) {
        var mes = barra.getAttribute('data-mes');
        var recebido = parseFloat(barra.getAttribute('data-recebido'));
        var aReceber = parseFloat(barra.getAttribute('data-a-receber'));
        var vencido = parseFloat(barra.getAttribute('data-vencido')) || 0;
        tooltip.innerHTML = '<div style="font-weight:600;margin-bottom:4px;">' + esc(nomeMesExtenso(mes)) + '</div>' +
          'Recebido: <b>R$ ' + fmtMoeda(recebido) + '</b><br>' +
          'A receber: <b>R$ ' + fmtMoeda(aReceber) + '</b>' +
          (vencido > 0 ? '<br>Vencido: <b style="color:var(--crit);">R$ ' + fmtMoeda(vencido) + '</b>' : '');
        var wrapRect = wrap.getBoundingClientRect();
        tooltip.style.left = (ev.clientX - wrapRect.left) + 'px';
        tooltip.style.top = (ev.clientY - wrapRect.top) + 'px';
        tooltip.classList.add('visivel');
      });
      barra.addEventListener('mouseleave', function () { tooltip.classList.remove('visivel'); });
    });
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

  // ---------------------------------------------------------------------------------------
  // Painel Executivo (Dashboard financeiro) -- cruza Contratos/Parcelas (receita) com
  // Despesas do Processo + Contas a Pagar (despesa) mes a mes, despesas por categoria e
  // proximos vencimentos. Grafico de linhas em SVG desenhado a mao (sem biblioteca): 2px de
  // traco, marcadores de 8px com anel na cor da superficie, area em ~10% de opacidade,
  // crosshair + tooltip por mes ao passar o mouse -- mesmas especificacoes do Fluxo de Caixa
  // acima, so que como linha (tendencia no tempo) em vez de barra.
  // ---------------------------------------------------------------------------------------

  function arredondarEixoValor(v) {
    if (v <= 0) return 1;
    var mag = Math.pow(10, Math.floor(Math.log(v) / Math.LN10));
    var passos = [1, 2, 2.5, 5, 10];
    for (var i = 0; i < passos.length; i++) {
      var candidato = passos[i] * mag;
      if (candidato >= v) return candidato;
    }
    return 10 * mag;
  }

  function desenharReceitaDespesas(serie) {
    var wrap = document.getElementById('exec-grafico-svg');
    if (!wrap) return;
    var tooltipHtml = '<div class="exec-tooltip" id="exec-grafico-tooltip"></div>';
    var temDado = serie.some(function (m) { return m.receita > 0 || m.despesa > 0; });
    if (!serie.length || !temDado) {
      wrap.innerHTML = '<div class="fluxo-vazio">Sem movimentação registrada no período.</div>' + tooltipHtml;
      return;
    }

    // Grafico ganhou o card inteiro pra ele (pedido do usuario: estava sobrando espaco vazio do
    // lado, nas outras duas colunas) -- H maior aproveita a largura nova sem ficar achatado.
    var W = 900, H = 340, padL = 48, padR = 20, padT = 20, padB = 28;
    var plotW = W - padL - padR, plotH = H - padT - padB;
    var baselineY = padT + plotH / 2;
    var meioAltura = plotH / 2;
    var maiorValor = Math.max.apply(null, serie.map(function (m) { return Math.max(m.receita, m.despesa); }).concat([1]));
    var maxEixo = arredondarEixoValor(maiorValor);
    var n = serie.length;
    var larguraSlot = plotW / n;
    var larguraBarra = Math.max(Math.min(larguraSlot * 0.42, 20), 3);

    function xAt(i) { return padL + (i + 0.5) * larguraSlot; }
    function yAtSigned(v) { return baselineY - (v / maxEixo) * meioAltura; }

    // So os rotulos do eixo Y, sem linhas de grade cruzando o grafico (nem a zero, quase) --
    // o mais perto do print de referencia do usuario, que nao tem "caixa com grade" nenhuma,
    // so os numeros do lado esquerdo. O calculo do eixo (maxEixo/yAtSigned) continua igual.
    var gridSvg = [1, 0.5, 0, -0.5, -1].map(function (f) {
      var v = f * maxEixo;
      var y = yAtSigned(v);
      var ehZero = f === 0;
      return (ehZero ? '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y + '" y2="' + y + '" stroke="var(--line)" stroke-width="0.75" opacity="0.5"/>' : '') +
        '<text x="' + (padL - 8) + '" y="' + (y + 3.5) + '" text-anchor="end" font-size="9.5" letter-spacing="0.02em" fill="var(--ink-faint)">' + fmtValorEixo(Math.abs(v)) + '</text>';
    }).join('');

    var idxPrimeiroPrevisto = serie.findIndex(function (m) { return m.previsto; });
    var xHoje = padL + idxPrimeiroPrevisto * larguraSlot;

    // Calculado cedo (nao so na hora de desenhar as torres) pra tambem alimentar o foco de
    // energia da plataforma holografica, que se concentra perto da torre de maior valor.
    var idxTorreMax = -1, alturaTorreMax = -1;
    serie.forEach(function (m, i) {
      if (m.previsto) return;
      if (m.receita > alturaTorreMax) { alturaTorreMax = m.receita; idxTorreMax = i; }
    });

    // Gradientes: dao uma sensacao sutil de profundidade nas barras (mais cheias perto da base,
    // esmaecendo pra ponta) e fazem a transicao historico -> previsto parecer uma "revelacao"
    // em vez de um corte seco -- o detalhe que o usuario pediu pra essa fronteira.
    // Material "vidro holografico" da torre de receita -- 3 tons de azul (profundo -> eletrico
    // -> neon), escopados so pra torre (nao mexe na variavel global --chart-receita usada em
    // outros lugares da plataforma). Historico e previsao usam O MESMO gradiente -- a diferenca
    // entre eles vira de um <g opacity> por fora, nunca de uma cor/gradiente exclusivo (pedido
    // explicito do usuario: "nao crie uma variavel de cor exclusiva pra previsao").
    var TORRE_AZUL_PROFUNDO = '#0066ff', TORRE_AZUL_ELETRICO = '#008cff', TORRE_AZUL_NEON = '#00b7ff', TORRE_CIANO = '#00e5ff';
    var defsSvg = '<defs>' +
      '<linearGradient id="gradReceita" gradientUnits="userSpaceOnUse" x1="0" y1="' + padT + '" x2="0" y2="' + baselineY + '">' +
        '<stop offset="0%" stop-color="' + TORRE_AZUL_PROFUNDO + '" stop-opacity="0.6"/>' +
        '<stop offset="55%" stop-color="' + TORRE_AZUL_ELETRICO + '" stop-opacity="0.8"/>' +
        '<stop offset="100%" stop-color="' + TORRE_AZUL_NEON + '" stop-opacity="0.95"/>' +
      '</linearGradient>' +
      '<linearGradient id="gradDespesa" gradientUnits="userSpaceOnUse" x1="0" y1="' + baselineY + '" x2="0" y2="' + (padT + plotH) + '">' +
        '<stop offset="0" stop-color="var(--chart-despesa)" stop-opacity="0.85"/>' +
        '<stop offset="1" stop-color="var(--chart-despesa)" stop-opacity="0.55"/>' +
      '</linearGradient>' +
      '<linearGradient id="gradCorredor" gradientUnits="userSpaceOnUse" x1="' + xHoje.toFixed(1) + '" y1="0" x2="' + (W - padR) + '" y2="0">' +
        '<stop offset="0" stop-color="var(--accent)" stop-opacity="0"/>' +
        '<stop offset="1" stop-color="var(--accent)" stop-opacity="0.07"/>' +
      '</linearGradient>' +
      '<linearGradient id="gradSaldoArea" gradientUnits="userSpaceOnUse" x1="0" y1="' + padT + '" x2="0" y2="' + (padT + plotH) + '">' +
        '<stop offset="0" stop-color="var(--accent)" stop-opacity="0.16"/>' +
        '<stop offset="0.5" stop-color="var(--accent)" stop-opacity="0"/>' +
        '<stop offset="1" stop-color="var(--accent)" stop-opacity="0.16"/>' +
      '</linearGradient>' +
      // Brilho ao longo do traçado do saldo (filtro reaproveitado, desenhado uma vez por baixo
      // da linha nitida) -- em vez de so um ponto de brilho fixo no "hoje".
      '<filter id="glowSaldo" x="-50%" y="-50%" width="200%" height="200%">' +
        '<feGaussianBlur stdDeviation="2.4" result="blur"/>' +
      '</filter>' +
      // Textura de scan-line bem discreta sobre a area prevista -- reforca "isso ainda nao
      // aconteceu de verdade" sem virar ruido visual.
      '<pattern id="scanlinesPrevisto" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
        '<line x1="0" y1="0" x2="0" y2="5" stroke="var(--accent)" stroke-width="1" opacity="0.5"/>' +
      '</pattern>' +
      // Brilho neon nas barras/pontos -- o usuario pediu pra ir mais fundo no "instrumento/HUD",
      // igual o print de referencia (barras com borda luminosa em vez de preenchimento chapado).
      '<filter id="glowBarra" x="-60%" y="-60%" width="220%" height="220%">' +
        '<feGaussianBlur stdDeviation="2.2"/>' +
      '</filter>' +
      // Anel decorativo sob o grafico, ecoando o halo do print de referencia -- 100% enfeite
      // (nao representa nenhum dado), so uma faixa de luz na base do plot.
      '<radialGradient id="gradAnelBase" cx="0.5" cy="0.5" r="0.5">' +
        '<stop offset="0%" stop-color="var(--accent)" stop-opacity="0.3"/>' +
        '<stop offset="65%" stop-color="var(--accent)" stop-opacity="0.08"/>' +
        '<stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>' +
      '</radialGradient>' +
      // "Feixe" de luz descendo de cada barra ate o anel -- mesmo espirito do halo, 100% enfeite.
      '<linearGradient id="gradFeixeBarra" gradientUnits="userSpaceOnUse" x1="0" y1="' + baselineY + '" x2="0" y2="' + (padT + plotH + 22) + '">' +
        '<stop offset="0" stop-color="var(--accent)" stop-opacity="0.28"/>' +
        '<stop offset="1" stop-color="var(--accent)" stop-opacity="0"/>' +
      '</linearGradient>' +
      // Ambient glow do fundo -- bem discreto, so pra dar profundidade/"ambiente digital" atras
      // de tudo (pedido do usuario), nunca competindo com os dados.
      '<radialGradient id="gradAmbiente" cx="0.5" cy="0.38" r="0.75">' +
        '<stop offset="0%" stop-color="var(--accent)" stop-opacity="0.05"/>' +
        '<stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>' +
      '</radialGradient>' +
      // Bloom mais forte, so pro ponto de maior valor (pico do periodo) -- efeito extra, usado
      // uma unica vez, pra nao virar "tudo brilhando igual".
      '<filter id="filtroBloomPico" x="-150%" y="-150%" width="400%" height="400%">' +
        '<feGaussianBlur stdDeviation="5"/>' +
      '</filter>' +
      // Glow dos aneis da plataforma -- blur moderado, reaproveitado em cada anel (mais forte
      // nos internos, mais suave nos externos, controlado pela opacidade de cada um).
      '<filter id="filtroGlowAnel" x="-80%" y="-200%" width="260%" height="500%">' +
        '<feGaussianBlur stdDeviation="2.2"/>' +
      '</filter>' +
      // Nucleo de luz azul/ciano no centro da plataforma, desaparecendo aos poucos pra fora --
      // "luz volumetrica" (Neon/Outer Glow combinados num unico gradiente).
      '<radialGradient id="gradNucleoPlataforma" cx="0.5" cy="0.5" r="0.5">' +
        '<stop offset="0%" stop-color="color-mix(in srgb, var(--accent) 55%, white)" stop-opacity="0.4"/>' +
        '<stop offset="40%" stop-color="var(--accent)" stop-opacity="0.16"/>' +
        '<stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>' +
      '</radialGradient>' +
      // Reflexo no piso, abaixo da plataforma -- a luz dos aneis "batendo" numa superficie escura.
      '<radialGradient id="gradReflexoPiso" cx="0.5" cy="0" r="0.7">' +
        '<stop offset="0%" stop-color="var(--accent)" stop-opacity="0.12"/>' +
        '<stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>' +
      '</radialGradient>' +
    '</defs>';

    // Nucleo claro dos pontos de dado (Data Point Glow: halo azul + nucleo branco/ciano) --
    // cor calculada uma vez, reaproveitada em todos os pontos da linha de saldo.
    var corNucleoPonto = 'color-mix(in srgb, var(--accent) 30%, white)';

    // Ambient glow (fundo) + particulas extremamente sutis -- 100% decorativo, posicoes fixas
    // (nao regeneradas a cada render, pra nao "piscar" toda vez que o grafico redesenha).
    var ambienteSvg = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="url(#gradAmbiente)" aria-hidden="true"/>';
    var PARTICULAS_FUNDO = [
      [0.08, 0.22], [0.19, 0.62], [0.31, 0.15], [0.44, 0.78], [0.57, 0.3],
      [0.68, 0.68], [0.77, 0.2], [0.85, 0.5], [0.93, 0.75], [0.62, 0.12],
    ];
    var particulasSvg = PARTICULAS_FUNDO.map(function (p, i) {
      var cx = padL + p[0] * plotW, cy = padT + p[1] * plotH;
      return '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + (i % 3 === 0 ? 1.1 : 0.7) +
        '" fill="var(--ink-faint)" opacity="0.18" aria-hidden="true"/>';
    }).join('');

    // Plataforma holografica 3D: nao e mais uma elipse so -- e um "tambor" raso (aro de cima +
    // aro de baixo + parede entre eles, dando altura de verdade) com varios aneis concentricos
    // sobrepostos, marcadores tecnicos e um nucleo de energia central. Sempre desenhada ANTES
    // das torres/linha, pra nunca atrapalhar a leitura dos meses/valores/barras.
    var anelCx = padL + plotW / 2, anelCy = padT + plotH, anelRx = plotW * 0.6, anelRy = 20;
    var drumAltura = anelRy * 0.9; // "espessura" visual da plataforma
    var anelCyBase = anelCy + drumAltura;

    // Parede do tambor (a face frontal, entre o aro de cima e o de baixo) -- e isso que da
    // profundidade/altura de verdade, em vez de tudo ficar num unico plano achatado.
    var defsParede = '<defs><linearGradient id="gradParedeTambor" gradientUnits="userSpaceOnUse" x1="0" y1="' + anelCy + '" x2="0" y2="' + anelCyBase + '">' +
      '<stop offset="0" stop-color="var(--accent)" stop-opacity="0.22"/>' +
      '<stop offset="1" stop-color="var(--accent)" stop-opacity="0"/>' +
    '</linearGradient></defs>';
    function paredeTambor(rx, ry) {
      var xE = (anelCx - rx).toFixed(1), xD = (anelCx + rx).toFixed(1);
      return 'M' + xE + ',' + anelCy.toFixed(1) +
        ' A' + rx.toFixed(1) + ',' + ry.toFixed(1) + ' 0 0 0 ' + xD + ',' + anelCy.toFixed(1) +
        ' L' + xD + ',' + anelCyBase.toFixed(1) +
        ' A' + rx.toFixed(1) + ',' + ry.toFixed(1) + ' 0 0 1 ' + xE + ',' + anelCyBase.toFixed(1) + ' Z';
    }
    var paredeSvg =
      '<path d="' + paredeTambor(anelRx, anelRy) + '" fill="url(#gradParedeTambor)" aria-hidden="true"/>' +
      '<ellipse cx="' + anelCx.toFixed(1) + '" cy="' + anelCyBase.toFixed(1) + '" rx="' + anelRx.toFixed(1) + '" ry="' + anelRy.toFixed(1) +
        '" fill="none" stroke="var(--accent)" stroke-width="1" opacity="0.14" filter="url(#filtroGlowAnel)" aria-hidden="true"/>';

    // 5 aneis concentricos: externo grande e continuo, alguns segmentados/pontilhados no meio,
    // e os mais internos com brilho mais forte (sensacao de "nucleo energetico").
    var ANEIS_PLATAFORMA = [
      { f: 1.00, opacidade: 0.32, largura: 1.3, dash: '' },
      { f: 0.82, opacidade: 0.16, largura: 0.8, dash: '4 6' },
      { f: 0.63, opacidade: 0.26, largura: 1, dash: '' },
      { f: 0.44, opacidade: 0.20, largura: 0.8, dash: '1 4' },
      { f: 0.25, opacidade: 0.40, largura: 1.2, dash: '' },
    ];
    // Cada anel ganha uma copia borrada por baixo (Neon/Outer Glow) alem do traco nitido -- os
    // mais internos (f menor) brilham mais forte, os externos ficam mais suaves ("nucleo mais
    // intenso, halo desaparecendo aos poucos pra fora").
    var aneisSvg = ANEIS_PLATAFORMA.map(function (a) {
      var glowOpacidade = 0.16 + (1 - a.f) * 0.3;
      var glow = '<ellipse cx="' + anelCx.toFixed(1) + '" cy="' + anelCy.toFixed(1) + '" rx="' + (anelRx * a.f).toFixed(1) + '" ry="' + (anelRy * a.f).toFixed(1) +
        '" fill="none" stroke="var(--accent)" stroke-width="' + (a.largura * 2.6) + '" opacity="' + glowOpacidade.toFixed(2) +
        '" filter="url(#filtroGlowAnel)" aria-hidden="true"/>';
      var nitido = '<ellipse cx="' + anelCx.toFixed(1) + '" cy="' + anelCy.toFixed(1) + '" rx="' + (anelRx * a.f).toFixed(1) + '" ry="' + (anelRy * a.f).toFixed(1) +
        '" fill="none" stroke="var(--accent)" stroke-width="' + a.largura + '" opacity="' + a.opacidade + '"' +
        (a.dash ? ' stroke-dasharray="' + a.dash + '"' : '') + ' aria-hidden="true"/>';
      return glow + nitido;
    }).join('');

    // Marcadores tecnicos: pequenas "tralhas" (tracinhos e retangulos) apoiadas em 2 dos aneis,
    // como leituras de uma interface holografica de dados -- puramente decorativo.
    function pontoNoAnel(f, angGraus) {
      var rad = angGraus * Math.PI / 180;
      return { x: anelCx + Math.cos(rad) * anelRx * f, y: anelCy + Math.sin(rad) * anelRy * f };
    }
    var marcadoresSvg = [
      { f: 1.00, ang: 20 }, { f: 1.00, ang: 160 }, { f: 0.63, ang: 250 }, { f: 0.63, ang: 80 }, { f: 0.44, ang: 320 },
    ].map(function (m, idx) {
      var p = pontoNoAnel(m.f, m.ang);
      return idx % 2 === 0
        ? '<rect x="' + (p.x - 1.6).toFixed(1) + '" y="' + (p.y - 1.6).toFixed(1) + '" width="3.2" height="3.2" fill="var(--accent)" opacity="0.5" transform="rotate(45 ' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ')" aria-hidden="true"/>'
        : '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="1.4" fill="' + corNucleoPonto + '" opacity="0.6" aria-hidden="true"/>';
    }).join('');

    // Reflexo no piso, projetado abaixo da plataforma -- mais forte perto do centro, some pras
    // bordas -- completando a sequencia anel -> luz intensa -> halo difuso -> reflexo no piso.
    var reflexoPisoSvg = '<ellipse cx="' + anelCx.toFixed(1) + '" cy="' + (anelCyBase + anelRy * 0.5).toFixed(1) +
      '" rx="' + (anelRx * 0.85).toFixed(1) + '" ry="' + (anelRy * 1.6).toFixed(1) + '" fill="url(#gradReflexoPiso)" aria-hidden="true"/>';

    // Foco de energia concentrado perto da torre de maior valor do periodo -- o mesmo ponto por
    // onde o "feixe" daquela torre atravessa a plataforma.
    var focoTorreMaxSvg = idxTorreMax === -1 ? '' : (function () {
      var xFoco = xAt(idxTorreMax);
      return '<ellipse cx="' + xFoco.toFixed(1) + '" cy="' + anelCy.toFixed(1) + '" rx="' + (larguraBarra * 1.8).toFixed(1) + '" ry="' + (anelRy * 0.7).toFixed(1) +
          '" fill="var(--accent)" opacity="0.32" filter="url(#filtroBloomPico)" aria-hidden="true"/>' +
        '<circle cx="' + xFoco.toFixed(1) + '" cy="' + anelCy.toFixed(1) + '" r="2" fill="' + corNucleoPonto + '" opacity="0.85" style="filter:drop-shadow(0 0 3px var(--accent));" aria-hidden="true"/>';
    })();

    // Nucleo de energia central: halo difuso + ponto luminoso, como o coracao da plataforma
    // (Bloom + Ambient Glow do centro) -- sem as linhas em cruz (removidas a pedido do usuario,
    // ficavam parecendo um "X" sobre o grafico).
    var nucleoCentralSvg =
      '<ellipse cx="' + anelCx.toFixed(1) + '" cy="' + anelCy.toFixed(1) + '" rx="' + (anelRx * 0.16).toFixed(1) + '" ry="' + (anelRy * 0.16).toFixed(1) +
        '" fill="var(--accent)" opacity="0.5" filter="url(#filtroGlowAnel)" aria-hidden="true"/>' +
      '<circle cx="' + anelCx.toFixed(1) + '" cy="' + anelCy.toFixed(1) + '" r="2.2" fill="' + corNucleoPonto + '" opacity="0.9" style="filter:drop-shadow(0 0 4px var(--accent));" aria-hidden="true"/>';

    // Conectores radiais (curtos, so sugerindo "linhas tecnologicas" entre os aneis).
    var conectoresSvg = [30, 100, 170, 260, 330].map(function (ang) {
      var rad = ang * Math.PI / 180;
      var r1 = 0.25, r2 = 0.44; // fracao do raio externo, do anel interno ate o intermediario
      var x1 = anelCx + Math.cos(rad) * anelRx * r1, y1 = anelCy + Math.sin(rad) * anelRy * r1;
      var x2 = anelCx + Math.cos(rad) * anelRx * r2, y2 = anelCy + Math.sin(rad) * anelRy * r2;
      return '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) +
        '" stroke="var(--accent)" stroke-width="0.6" opacity="0.18" aria-hidden="true"/>';
    }).join('');

    // Pontos de luz percorrendo 3 dos aneis (SMIL animateMotion, nativo do SVG -- sem custo de
    // JS por frame), deixando um rastro curto (Light Trail). Extremamente lento e sutil -- com
    // "reduzir movimento" ativado, os pontos ficam parados num angulo fixo, sem animar.
    function caminhoElipse(f) {
      var rx = anelRx * f, ry = anelRy * f;
      return 'M' + (anelCx - rx).toFixed(1) + ',' + anelCy.toFixed(1) +
        ' A' + rx.toFixed(1) + ',' + ry.toFixed(1) + ' 0 1,0 ' + (anelCx + rx).toFixed(1) + ',' + anelCy.toFixed(1) +
        ' A' + rx.toFixed(1) + ',' + ry.toFixed(1) + ' 0 1,0 ' + (anelCx - rx).toFixed(1) + ',' + anelCy.toFixed(1);
    }
    var semMovimento = reduzMotion();
    var pontosOrbitaSvg = [
      { f: 1.00, dur: '22s', r: 1.6 },
      { f: 0.63, dur: '17s', r: 1.3 },
      { f: 0.25, dur: '12s', r: 1 },
    ].map(function (o, idx) {
      var idPath = 'exec-plataforma-orbita-' + idx;
      var caminho = '<path id="' + idPath + '" d="' + caminhoElipse(o.f) + '" fill="none" stroke="none"/>';
      if (semMovimento) {
        var rx = anelRx * o.f;
        return caminho + '<circle cx="' + (anelCx - rx).toFixed(1) + '" cy="' + anelCy.toFixed(1) + '" r="' + o.r +
          '" fill="' + corNucleoPonto + '" opacity="0.6" style="filter:drop-shadow(0 0 2px var(--accent));" aria-hidden="true"/>';
      }
      // rastro curto: 3 copias do ponto, um pouco atrasadas no tempo (begin negativo) e mais
      // fracas, dando a sensacao de "cauda" de luz em vez de so um ponto viajando.
      var rastro = [0.3, 0.15].map(function (op, k) {
        return '<circle r="' + (o.r * 0.7) + '" fill="' + corNucleoPonto + '" opacity="' + op + '" aria-hidden="true">' +
          '<animateMotion dur="' + o.dur + '" begin="-' + ((k + 1) * 0.4) + 's" repeatCount="indefinite"><mpath href="#' + idPath + '" xlink:href="#' + idPath + '"/></animateMotion>' +
        '</circle>';
      }).join('');
      return caminho + rastro +
        '<circle r="' + o.r + '" fill="' + corNucleoPonto + '" opacity="0.75" style="filter:drop-shadow(0 0 2px var(--accent));" aria-hidden="true">' +
          '<animateMotion dur="' + o.dur + '" repeatCount="indefinite"><mpath href="#' + idPath + '" xlink:href="#' + idPath + '"/></animateMotion>' +
        '</circle>';
    }).join('');

    var anelDecorativo =
      defsParede +
      reflexoPisoSvg +
      '<ellipse cx="' + anelCx.toFixed(1) + '" cy="' + anelCy.toFixed(1) +
        '" rx="' + (anelRx * 1.08).toFixed(1) + '" ry="' + (anelRy * 1.15).toFixed(1) + '" fill="url(#gradAnelBase)" aria-hidden="true"/>' +
      paredeSvg +
      '<ellipse cx="' + anelCx.toFixed(1) + '" cy="' + anelCy.toFixed(1) +
        '" rx="' + (anelRx * 0.7).toFixed(1) + '" ry="' + (anelRy * 0.7).toFixed(1) + '" fill="url(#gradNucleoPlataforma)" aria-hidden="true"/>' +
      conectoresSvg + aneisSvg + marcadoresSvg + focoTorreMaxSvg + nucleoCentralSvg + pontosOrbitaSvg;

    var feixesSvg = serie.map(function (m, i) {
      if (m.previsto) return '';
      var intensidade = Math.min(Math.max(m.receita, m.despesa) / maiorValor, 1);
      if (intensidade < 0.08) return '';
      return '<rect x="' + (xAt(i) - larguraBarra * 0.7).toFixed(1) + '" y="' + baselineY.toFixed(1) + '" width="' + (larguraBarra * 1.4).toFixed(1) +
        '" height="' + (plotH / 2 + 22).toFixed(1) + '" fill="url(#gradFeixeBarra)" opacity="' + intensidade.toFixed(2) + '" aria-hidden="true"/>';
    }).join('');

    // "Torres de dados" 3D: um UNICO renderizador de segmento (renderSegmentoTorre3D), chamado
    // de forma IDENTICA pra receita/despesa, historico/previsao -- nenhuma geometria/estilo
    // manual por mes ou por estado. dx/dy definem o angulo isometrico, proporcional a largura da
    // barra (nao a altura), pra uma torre baixinha continuar tendo lateral/topo visiveis em vez
    // de virar um retangulo chapado.
    var dxProf = Math.min(larguraBarra * 0.32, 6);
    var dyProf = -dxProf * 0.6;
    function faceLateral(xEsq, yTopo, altura, cor, opacidade) {
      var xD = xEsq + larguraBarra;
      var p = [
        [xD, yTopo], [xD + dxProf, yTopo + dyProf],
        [xD + dxProf, yTopo + altura + dyProf], [xD, yTopo + altura],
      ].map(function (pt) { return pt[0].toFixed(1) + ',' + pt[1].toFixed(1); }).join(' ');
      return '<polygon points="' + p + '" fill="' + cor + '" opacity="' + opacidade + '" aria-hidden="true"/>';
    }
    function faceTopo(xEsq, y, cor, opacidade) {
      var xD = xEsq + larguraBarra;
      var p = [
        [xEsq, y], [xEsq + dxProf, y + dyProf],
        [xD + dxProf, y + dyProf], [xD, y],
      ].map(function (pt) { return pt[0].toFixed(1) + ',' + pt[1].toFixed(1); }).join(' ');
      return '<polygon points="' + p + '" fill="' + cor + '" opacity="' + opacidade + '" aria-hidden="true"/>';
    }

    // Unica diferenca entre historico e previsao: um <g opacity="..."> por fora de TUDO (mesma
    // geometria, mesmo gradiente, mesmas camadas) -- nao uma cor/gradiente separado. O contorno
    // pontilhado da face frontal e a unica outra diferenca visual, tambem controlada aqui.
    var OPACIDADE_TORRE_PREVISTA = 0.62;

    // Crescimento animado (SMIL, sem JS por frame): TODA vez que o grafico e desenhado (primeiro
    // carregamento, refresh, troca de periodo, novo dado chegando), cada torre nasce na altura
    // anterior (0 no primeiro carregamento) e anima y/height juntos ate a altura atual -- como os
    // dois atributos sao funcoes lineares do mesmo intervalo, a base (y+height) fica sempre colada
    // na plataforma durante toda a animacao, tanto subindo quanto descendo. Lateral/topo ficam na
    // geometria final (discrepancia breve demais pra valer interpolar os poligonos). Pedido do
    // usuario: cubic-bezier(0.22, 1, 0.36, 1) -- mesma parametrizacao do calcMode="spline" do SMIL
    // (keySplines usa os mesmos 4 numeros do cubic-bezier do CSS).
    var DUR_CRESCIMENTO_TORRE_NUM = 1.2;
    var DUR_CRESCIMENTO_TORRE = DUR_CRESCIMENTO_TORRE_NUM + 's';
    var KEYSPLINES_TORRE = '0.22 1 0.36 1';
    // Cascata sutil: cada mes comeca um pouco depois do anterior (esquerda -> direita), pedido do
    // usuario. Intervalo pequeno pra nao alongar demais o total em periodos longos (24M).
    var STAGGER_MES_S = 0.03;
    function animSmil(atributo, de, para, beginOffset) {
      return '<animate attributeName="' + atributo + '" from="' + de.toFixed(1) + '" to="' + para.toFixed(1) +
        '" begin="' + beginOffset.toFixed(2) + 's" dur="' + DUR_CRESCIMENTO_TORRE + '" calcMode="spline" keySplines="' + KEYSPLINES_TORRE + '" fill="freeze"/>';
    }
    // Faisca de energia holografica (nucleo branco + centro ciano + halo azul eletrico, sempre
    // nessa familia de cor -- mesmo numa torre de despesa -- nunca fogo/amarelo) que acompanha
    // exatamente o topo da torre enquanto ela cresce (presa matematicamente ao mesmo y animado),
    // solta 2 micropar­ticulas curtas pro lado, e produz um pulso+bloom rapido quando chega no topo.
    function faiscaCrescimento(cx, yAntigo, yNovo, beginOffset) {
      var yFinal = yNovo - 10;
      var b = beginOffset.toFixed(2) + 's';
      var animCy = '<animate attributeName="cy" from="' + yAntigo.toFixed(1) + '" to="' + yFinal.toFixed(1) + '" begin="' + b + '" dur="' + DUR_CRESCIMENTO_TORRE + '" calcMode="spline" keySplines="' + KEYSPLINES_TORRE + '" fill="freeze"/>';
      var animOpacidade = '<animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.06;0.85;1" begin="' + b + '" dur="' + DUR_CRESCIMENTO_TORRE + '" fill="freeze"/>';
      var svg =
        // halo azul eletrico (Outer Glow, maior e mais suave, atras das outras 2 camadas)
        '<circle cx="' + cx.toFixed(1) + '" cy="' + yAntigo.toFixed(1) + '" r="6" fill="' + TORRE_AZUL_ELETRICO + '" opacity="0" filter="url(#filtroGlowAnel)" aria-hidden="true">' + animCy + animOpacidade + '</circle>' +
        // centro ciano (Bloom via drop-shadow)
        '<circle cx="' + cx.toFixed(1) + '" cy="' + yAntigo.toFixed(1) + '" r="3.4" fill="' + TORRE_CIANO + '" opacity="0" style="filter:drop-shadow(0 0 4px ' + TORRE_CIANO + ');" aria-hidden="true">' + animCy + animOpacidade +
          '<animate attributeName="r" values="3.4;1.6" begin="' + b + '" dur="' + DUR_CRESCIMENTO_TORRE + '" fill="freeze"/>' +
        '</circle>' +
        // nucleo branco (centro solido da particula)
        '<circle cx="' + cx.toFixed(1) + '" cy="' + yAntigo.toFixed(1) + '" r="1.3" fill="white" opacity="0" aria-hidden="true">' + animCy + animOpacidade + '</circle>';

      // 2 micropar­ticulas curtas saindo pro lado (energia se dissipando) -- poucas e leves, so
      // nas torres que estao realmente animando (nunca centenas simultaneas).
      [-4, 3].forEach(function (dx, idx) {
        var durMicro = (0.3 + idx * 0.06).toFixed(2) + 's';
        svg += '<circle cx="' + cx.toFixed(1) + '" cy="' + yAntigo.toFixed(1) + '" r="1" fill="' + TORRE_CIANO + '" opacity="0" aria-hidden="true">' +
          '<animate attributeName="cx" from="' + cx.toFixed(1) + '" to="' + (cx + dx).toFixed(1) + '" begin="' + b + '" dur="' + durMicro + '" fill="freeze"/>' +
          '<animate attributeName="cy" from="' + yAntigo.toFixed(1) + '" to="' + (yAntigo - 5 - idx * 2).toFixed(1) + '" begin="' + b + '" dur="' + durMicro + '" fill="freeze"/>' +
          '<animate attributeName="opacity" values="0;0.9;0" begin="' + b + '" dur="' + durMicro + '" fill="freeze"/>' +
        '</circle>';
      });

      // Pulse + Bloom + Light Burst rapido quando a faisca chega ao topo final -- depois disso ela
      // desaparece (a faisca em si ja terminou de sumir pela animacao de opacidade acima) e sobra
      // so o ponto luminoso normal da torre (faceTopo/brilho do topo, ja existentes).
      var tChegada = (beginOffset + DUR_CRESCIMENTO_TORRE_NUM).toFixed(2) + 's';
      svg +=
        '<circle cx="' + cx.toFixed(1) + '" cy="' + yFinal.toFixed(1) + '" r="1" fill="' + TORRE_CIANO + '" opacity="0" filter="url(#filtroBloomPico)" aria-hidden="true">' +
          '<animate attributeName="r" values="1;11;6" keyTimes="0;0.4;1" begin="' + tChegada + '" dur="0.45s" fill="freeze"/>' +
          '<animate attributeName="opacity" values="0;0.9;0" keyTimes="0;0.3;1" begin="' + tChegada + '" dur="0.45s" fill="freeze"/>' +
        '</circle>' +
        '<circle cx="' + cx.toFixed(1) + '" cy="' + yFinal.toFixed(1) + '" r="1.6" fill="white" opacity="0" aria-hidden="true">' +
          '<animate attributeName="opacity" values="0;1;0" keyTimes="0;0.25;1" begin="' + tChegada + '" dur="0.4s" fill="freeze"/>' +
        '</circle>';
      return svg;
    }

    function renderSegmentoTorre3D(opts) {
      // opts: xEsqNum, topoNum, altura, gradienteFrente (url), corBorda, corSombra, corLuz,
      // previsto, desenharTopo, desenharBase, ehTorrePico, topoAnteriorNum, alturaAnteriorNum,
      // beginOffset (os 3 ultimos opcionais -- so quando essa torre esta animando desde o ultimo
      // desenho; beginOffset e o atraso em segundos da cascata, sempre presente quando os outros 2
      // estao).
      var xEsq = opts.xEsqNum.toFixed(1);
      var partes = '';
      var animando = opts.topoAnteriorNum != null && Math.abs(opts.topoAnteriorNum - opts.topoNum) > 0.1;
      var yAtributo = (animando ? opts.topoAnteriorNum : opts.topoNum).toFixed(1);
      var hAtributo = (animando ? opts.alturaAnteriorNum : opts.altura).toFixed(1);
      var animY = animando ? animSmil('y', opts.topoAnteriorNum, opts.topoNum, opts.beginOffset) : '';
      var animH = animando ? animSmil('height', opts.alturaAnteriorNum, opts.altura, opts.beginOffset) : '';

      // 1) face lateral direita -- sombra, da a sensacao de profundidade/extrusao pra tras.
      partes += faceLateral(opts.xEsqNum, opts.topoNum, opts.altura, opts.corSombra, 0.5);

      // 2) face frontal -- MESMO gradiente pra historico e previsao; so o contorno muda
      // (pontilhado na previsao) e o glow (so no historico, mais "aceso").
      partes += '<rect x="' + xEsq + '" y="' + yAtributo + '" width="' + larguraBarra.toFixed(1) +
        '" height="' + hAtributo + '" fill="' + opts.gradienteFrente + '" rx="2" stroke="' + opts.corBorda + '" stroke-width="' + (opts.previsto ? 1 : 0.75) + '"' +
        (opts.previsto ? ' stroke-dasharray="2.5 2.5"' : '') + ' filter="url(#glowBarra)">' + animY + animH + '</rect>';

      // 3) borda esquerda iluminada (edge glow) -- faixa fina e clara ao longo da borda
      // esquerda inteira, simulando luz vindo de um lado (perspectiva de prisma, nao de cubo).
      partes += '<rect x="' + xEsq + '" y="' + yAtributo + '" width="1.3" height="' + hAtributo +
        '" rx="0.65" fill="' + opts.corLuz + '" opacity="0.6" aria-hidden="true">' + animY + animH + '</rect>';

      // 4) nucleo interno (energia passando pelo centro da torre).
      partes += '<rect x="' + (opts.xEsqNum + larguraBarra * 0.34).toFixed(1) + '" y="' + yAtributo + '" width="' + (larguraBarra * 0.32).toFixed(1) +
        '" height="' + hAtributo + '" rx="1.3" fill="' + opts.corLuz + '" opacity="0.3" aria-hidden="true">' + animY + animH + '</rect>';

      if (animando) {
        partes += faiscaCrescimento(opts.xEsqNum + larguraBarra / 2, opts.topoAnteriorNum, opts.topoNum, opts.beginOffset);
      }

      if (opts.desenharTopo) {
        partes += faceTopo(opts.xEsqNum, opts.topoNum, opts.corLuz, opts.ehTorrePico ? 0.8 : 0.6);
        var raioBrilhoTopo = opts.ehTorrePico ? 3.5 : 1.6;
        partes += '<circle cx="' + (opts.xEsqNum + larguraBarra / 2 + dxProf / 2).toFixed(1) + '" cy="' + (opts.topoNum + dyProf / 2).toFixed(1) +
          '" r="' + raioBrilhoTopo + '" fill="white" opacity="' + (opts.ehTorrePico ? 0.9 : 0.65) + '" style="filter:blur(' + (opts.ehTorrePico ? 1.5 : 0.8) + 'px);" aria-hidden="true"/>';
      }
      if (opts.desenharBase) {
        // brilho na base -- pequeno reflexo onde a torre encosta na plataforma.
        partes += '<ellipse cx="' + (opts.xEsqNum + larguraBarra / 2).toFixed(1) + '" cy="' + (opts.topoNum + opts.altura).toFixed(1) +
          '" rx="' + (larguraBarra * 0.55).toFixed(1) + '" ry="1.6" fill="' + opts.corLuz + '" opacity="0.4" aria-hidden="true"/>';
      }

      return opts.previsto ? '<g opacity="' + OPACIDADE_TORRE_PREVISTA + '">' + partes + '</g>' : partes;
    }

    // Snapshot do desenho anterior, capturado ANTES de qualquer leitura -- ultimaSerieExecPorMes
    // so e sobrescrita com os valores atuais no fim da funcao (depois que barrasSvg E pontosSaldo
    // ja leram o valor antigo pra saber de onde cada animacao comeca).
    var serieAnteriorPorMes = ultimaSerieExecPorMes;

    // Geometria (topo/altura) de uma torre pra um valor generico -- reaproveitada tanto pro
    // valor atual quanto pro valor "anterior" (usado so pra calcular de onde a animacao comeca).
    function geometriaTorreReceita(valor) {
      var yTopo = yAtSigned(valor);
      return { topo: Math.min(yTopo, baselineY), altura: Math.max(Math.abs(baselineY - yTopo), 1) };
    }
    function geometriaTorreDespesa(valor) {
      var yBase = yAtSigned(-valor);
      return { topo: Math.min(baselineY, yBase), altura: Math.max(Math.abs(yBase - baselineY), 1) };
    }

    var barrasSvg = serie.map(function (m, i) {
      var xEsqNum = xAt(i) - larguraBarra / 2;
      var geoReceita = geometriaTorreReceita(m.receita);
      var ehTorrePico = i === idxTorreMax;
      var beginOffset = i * STAGGER_MES_S;

      // Toda vez que o grafico e desenhado (1o carregamento, refresh, troca de periodo, dado
      // novo), cada torre anima do valor anterior pro atual -- 0 quando nao ha desenho anterior
      // nesta sessao (1o carregamento) ou quando o mes nao existia no desenho anterior (ex: abriu
      // um periodo mais longo). Sobe OU desce, historico OU previsto -- sem excecao (pedido do
      // usuario). So nao anima com "reduzir movimento" ativado.
      var receitaAnterior = semMovimento ? m.receita : (serieAnteriorPorMes && serieAnteriorPorMes[m.mes] ? serieAnteriorPorMes[m.mes].receita : 0);
      var geoReceitaAnterior = geometriaTorreReceita(receitaAnterior);

      var partesReceita = m.receita > 0
        ? renderSegmentoTorre3D({
            xEsqNum: xEsqNum, topoNum: geoReceita.topo, altura: geoReceita.altura,
            gradienteFrente: 'url(#gradReceita)', corBorda: TORRE_AZUL_NEON,
            corSombra: 'color-mix(in srgb, ' + TORRE_AZUL_PROFUNDO + ' 70%, black)', corLuz: TORRE_CIANO,
            previsto: m.previsto, desenharTopo: true, desenharBase: m.despesa <= 0, ehTorrePico: ehTorrePico,
            topoAnteriorNum: geoReceitaAnterior.topo, alturaAnteriorNum: geoReceitaAnterior.altura, beginOffset: beginOffset,
          })
        : '';

      var geoDespesa = geometriaTorreDespesa(m.despesa);
      var despesaAnterior = semMovimento ? m.despesa : (serieAnteriorPorMes && serieAnteriorPorMes[m.mes] ? serieAnteriorPorMes[m.mes].despesa : 0);
      var geoDespesaAnterior = geometriaTorreDespesa(despesaAnterior);
      var barraDespesa = m.despesa > 0
        ? renderSegmentoTorre3D({
            xEsqNum: xEsqNum, topoNum: geoDespesa.topo, altura: geoDespesa.altura,
            gradienteFrente: 'url(#gradDespesa)', corBorda: 'var(--chart-despesa)',
            corSombra: 'color-mix(in srgb, var(--chart-despesa) 55%, black)', corLuz: 'color-mix(in srgb, var(--chart-despesa) 40%, white)',
            previsto: m.previsto, desenharTopo: false, desenharBase: true, ehTorrePico: false,
            topoAnteriorNum: geoDespesaAnterior.topo, alturaAnteriorNum: geoDespesaAnterior.altura, beginOffset: beginOffset,
          })
        : '';

      // Bloom + Light Burst concentrado so na torre mais alta do periodo (pico, sempre um mes ja
      // realizado) -- reforco extra em cima do que ja existe, marcando ela como "a maior" tambem.
      var bloomTorrePico = ehTorrePico
        ? '<ellipse cx="' + (xEsqNum + larguraBarra / 2).toFixed(1) + '" cy="' + geoReceita.topo.toFixed(1) + '" rx="' + (larguraBarra * 1.6).toFixed(1) +
            '" ry="10" fill="' + TORRE_AZUL_NEON + '" opacity="0.22" filter="url(#filtroBloomPico)" aria-hidden="true"/>'
        : '';

      return bloomTorrePico + partesReceita + barraDespesa;
    }).join('');

    var fimRealizado = idxPrimeiroPrevisto === -1 ? n - 1 : idxPrimeiroPrevisto;
    var idxRealizados = [];
    for (var ir = 0; ir <= fimRealizado; ir++) idxRealizados.push(ir);
    var idxPrevistos = [];
    if (idxPrimeiroPrevisto !== -1) for (var ip = fimRealizado; ip < n; ip++) idxPrevistos.push(ip);

    // Curva suave (Catmull-Rom convertido pra Bezier cubica) passando exatamente pelos MESMOS
    // pontos de sempre -- nenhum valor muda, so a linha entre um mes e outro deixa de ser reta
    // e vira uma transicao suave, como pedido ("a linha deve acompanhar suavemente a curva").
    function xyPonto(idx) { return [xAt(idx), yAtSigned(serie[idx].receita - serie[idx].despesa)]; }
    function caminhoSuave(indices) {
      if (!indices.length) return '';
      var pts = indices.map(xyPonto);
      if (pts.length === 1) return 'M' + pts[0][0].toFixed(1) + ',' + pts[0][1].toFixed(1);
      var d = 'M' + pts[0][0].toFixed(1) + ',' + pts[0][1].toFixed(1);
      for (var k = 0; k < pts.length - 1; k++) {
        var p0 = pts[k - 1] || pts[k], p1 = pts[k], p2 = pts[k + 1], p3 = pts[k + 2] || p2;
        var cp1x = p1[0] + (p2[0] - p0[0]) / 6, cp1y = p1[1] + (p2[1] - p0[1]) / 6;
        var cp2x = p2[0] - (p3[0] - p1[0]) / 6, cp2y = p2[1] - (p3[1] - p1[1]) / 6;
        d += ' C' + cp1x.toFixed(1) + ',' + cp1y.toFixed(1) + ' ' + cp2x.toFixed(1) + ',' + cp2y.toFixed(1) + ' ' + p2[0].toFixed(1) + ',' + p2[1].toFixed(1);
      }
      return d;
    }
    function caminhoArea(indices) {
      if (indices.length < 2) return '';
      var topo = caminhoSuave(indices);
      var ultimo = indices[indices.length - 1], primeiro = indices[0];
      return topo + ' L' + xAt(ultimo).toFixed(1) + ',' + baselineY.toFixed(1) + ' L' + xAt(primeiro).toFixed(1) + ',' + baselineY.toFixed(1) + ' Z';
    }
    var pathSaldoRealizado = caminhoSuave(idxRealizados);
    var pathSaldoPrevisto = caminhoSuave(idxPrevistos);
    var areaSaldoSvg = caminhoArea(idxRealizados) ? '<path d="' + caminhoArea(idxRealizados) + '" fill="url(#gradSaldoArea)"/>' : '';
    var areaSaldoPrevistaSvg = caminhoArea(idxPrevistos) ? '<path d="' + caminhoArea(idxPrevistos) + '" fill="url(#gradSaldoArea)" opacity="0.6"/>' : '';

    // Data Point Glow: cada ponto vira 2 camadas -- um halo azul difuso (drop-shadow) por baixo
    // e um pequeno nucleo branco/ciano por cima, em vez de um circulo solido unico. O ponto
    // "hoje" continua o mais forte, marcando a fronteira historico/previsto.
    var idxPico = -1, valorPico = -Infinity;
    serie.forEach(function (m, i) {
      if (m.previsto) return;
      var v = m.receita - m.despesa;
      if (v > valorPico) { valorPico = v; idxPico = i; }
    });
    var pontosSaldo = serie.map(function (m, i) {
      var ehHoje = i === fimRealizado && idxPrimeiroPrevisto > 0;
      var ehPico = i === idxPico && idxPico !== -1;
      var r = ehHoje || ehPico ? 4 : 2.5;
      var raioGlow = ehHoje || ehPico ? 4 : 2;
      var raioNucleo = ehHoje || ehPico ? 1.8 : 1.2;
      var opacidade = m.previsto ? 0.45 : 1;
      var cx = xAt(i).toFixed(1), cyNum = yAtSigned(m.receita - m.despesa);

      // Sincroniza o ponto da linha com a mesma cascata/duracao/facilitacao das torres daquele
      // mes -- termina de se mover exatamente quando a torre termina de subir/descer (pedido do
      // usuario). O ponto continua representando o SALDO (nunca a receita isolada), so a
      // ANIMACAO que fica coordenada com a torre, nao a posicao final. O atributo cy estatico
      // (antes do SMIL comecar) tem que ser o valor ANTIGO, senao o ponto pisca na posicao final
      // durante o atraso da cascata e "volta" quando a animacao de fato comeca.
      var anim = '';
      var cyNumInicial = cyNum;
      if (!semMovimento && serieAnteriorPorMes && serieAnteriorPorMes[m.mes]) {
        var anteriorPonto = serieAnteriorPorMes[m.mes];
        var cyAnteriorNum = yAtSigned(anteriorPonto.receita - anteriorPonto.despesa);
        if (Math.abs(cyAnteriorNum - cyNum) > 0.1) {
          anim = animSmil('cy', cyAnteriorNum, cyNum, i * STAGGER_MES_S);
          cyNumInicial = cyAnteriorNum;
        }
      }
      var cy = cyNumInicial.toFixed(1);

      return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r +
          '" fill="var(--accent)" opacity="' + opacidade + '" style="filter:drop-shadow(0 0 ' + raioGlow + 'px var(--accent));">' + anim + '</circle>' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + raioNucleo + '" fill="' + corNucleoPonto + '" opacity="' + opacidade + '">' + anim + '</circle>';
    }).join('');

    // Bloom + Light Burst -- so no ponto de maior valor do periodo (o "pico"), um brilho mais
    // concentrado e um feixe em cruz bem discreto, simulando luz se acumulando ali. Unico ponto
    // com esse reforco, pra nao competir com o resto do grafico.
    var bloomPicoSvg = '';
    if (idxPico !== -1) {
      var cxPico = xAt(idxPico).toFixed(1), cyPico = yAtSigned(valorPico).toFixed(1);
      bloomPicoSvg =
        '<circle cx="' + cxPico + '" cy="' + cyPico + '" r="9" fill="var(--accent)" opacity="0.28" filter="url(#filtroBloomPico)" aria-hidden="true"/>' +
        '<g opacity="0.22" aria-hidden="true">' +
          '<line x1="' + (cxPico - 8) + '" y1="' + cyPico + '" x2="' + (Number(cxPico) + 8) + '" y2="' + cyPico + '" stroke="' + corNucleoPonto + '" stroke-width="0.75"/>' +
          '<line x1="' + cxPico + '" y1="' + (cyPico - 8) + '" x2="' + cxPico + '" y2="' + (Number(cyPico) + 8) + '" stroke="' + corNucleoPonto + '" stroke-width="0.75"/>' +
        '</g>';
    }

    var corredorPrevisto = idxPrimeiroPrevisto <= 0 ? '' : (
      '<rect x="' + xHoje.toFixed(1) + '" y="' + padT + '" width="' + (W - padR - xHoje).toFixed(1) + '" height="' + plotH + '" fill="url(#gradCorredor)"/>' +
      '<rect x="' + xHoje.toFixed(1) + '" y="' + padT + '" width="' + (W - padR - xHoje).toFixed(1) + '" height="' + plotH + '" fill="url(#scanlinesPrevisto)" opacity="0.06"/>'
    );
    var divisorHoje = idxPrimeiroPrevisto <= 0 ? '' : (
      '<line x1="' + xHoje.toFixed(1) + '" x2="' + xHoje.toFixed(1) +
      '" y1="' + padT + '" y2="' + (padT + plotH) + '" stroke="var(--accent)" stroke-width="1" stroke-dasharray="1 3" opacity="0.55"/>' +
      '<circle class="exec-hoje-pulso" cx="' + xHoje.toFixed(1) + '" cy="' + (padT - 6) + '" r="3" fill="none" stroke="var(--accent)" stroke-width="1"/>' +
      '<circle cx="' + xHoje.toFixed(1) + '" cy="' + (padT - 6) + '" r="2.5" fill="var(--accent)" style="filter:drop-shadow(0 0 3px var(--accent));"/>' +
      '<text x="' + xHoje.toFixed(1) + '" y="' + (padT - 12) + '" text-anchor="middle" font-size="8" font-weight="600" letter-spacing="0.08em" fill="var(--accent)">HOJE</text>'
    );

    var labelStep = n > 18 ? 3 : (n > 12 ? 2 : 1);
    var eixoX = serie.map(function (m, i) {
      if (i % labelStep !== 0 && i !== n - 1) return '';
      return '<text x="' + xAt(i).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="9.5" fill="var(--ink-faint)"' + (m.previsto ? ' font-style="italic"' : '') + '>' + esc(nomeMesAbrev(m.mes)) + '</text>';
    }).join('');

    var hoverCols = serie.map(function (m, i) {
      var xEsq = padL + i * larguraSlot;
      return '<rect data-idx="' + i + '" x="' + xEsq.toFixed(1) + '" y="' + padT + '" width="' + larguraSlot.toFixed(1) + '" height="' + plotH + '" fill="transparent" style="cursor:crosshair;"/>';
    }).join('');

    var glowSaldoSvg =
      '<path d="' + pathSaldoRealizado + '" fill="none" stroke="var(--accent)" stroke-width="4" opacity="0.35" filter="url(#glowSaldo)" stroke-linejoin="round" stroke-linecap="round"/>' +
      (pathSaldoPrevisto ? '<path d="' + pathSaldoPrevisto + '" fill="none" stroke="var(--accent)" stroke-width="4" opacity="0.2" filter="url(#glowSaldo)" stroke-linejoin="round" stroke-linecap="round"/>' : '');

    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%; height:auto; display:block;" id="exec-grafico-svg-el">' +
      defsSvg + ambienteSvg + particulasSvg + gridSvg + anelDecorativo + feixesSvg + corredorPrevisto + barrasSvg + areaSaldoSvg + areaSaldoPrevistaSvg + divisorHoje + glowSaldoSvg +
      '<path d="' + pathSaldoRealizado + '" fill="none" stroke="var(--accent)" stroke-width="1.75" stroke-linejoin="round" stroke-linecap="round"/>' +
      (pathSaldoPrevisto ? '<path d="' + pathSaldoPrevisto + '" fill="none" stroke="var(--accent)" stroke-width="1.75" stroke-dasharray="1 4" opacity="0.7" stroke-linejoin="round" stroke-linecap="round"/>' : '') +
      bloomPicoSvg + pontosSaldo + eixoX +
      '<line id="exec-crosshair" x1="0" x2="0" y1="' + padT + '" y2="' + (padT + plotH) + '" stroke="var(--ink-faint)" stroke-width="1" style="display:none; pointer-events:none;"/>' +
      hoverCols +
      '</svg>';

    wrap.innerHTML = svg + tooltipHtml;
    wireHoverExecGrafico(wrap, serie, xAt);

    // Guarda a receita/despesa deste desenho pra comparar no proximo (mesma sessao) -- so agora,
    // depois que barrasSvg E pontosSaldo ja leram serieAnteriorPorMes pra saber de onde cada
    // animacao (torres + ponto da linha) comecou.
    ultimaSerieExecPorMes = {};
    serie.forEach(function (m) { ultimaSerieExecPorMes[m.mes] = { receita: m.receita, despesa: m.despesa }; });

    var elMarco = document.getElementById('exec-marco-linha');
    if (elMarco) {
      elMarco.innerHTML = idxPrimeiroPrevisto > 0
        ? '<span>← Histórico efetivado</span><span style="color:var(--chart-receita);">Previsto →</span>'
        : '';
    }
  }

  function wireHoverExecGrafico(wrap, serie, xAtFn) {
    var tooltip = document.getElementById('exec-grafico-tooltip');
    var crosshair = document.getElementById('exec-crosshair');
    if (!tooltip) return;
    wrap.querySelectorAll('[data-idx]').forEach(function (rect) {
      rect.addEventListener('mousemove', function (ev) {
        var idx = parseInt(rect.getAttribute('data-idx'), 10);
        var m = serie[idx];
        var saldo = m.receita - m.despesa;
        var tituloMes = esc(nomeMesExtenso(m.mes)) + (m.previsto ? ' <span style="font-weight:400;color:var(--ink-faint);">(previsão)</span>' : '');
        tooltip.innerHTML = '<div style="font-weight:600; margin-bottom:4px;">' + tituloMes + '</div>' +
          '<span style="color:var(--chart-receita);">●</span> Receita: <b>R$ ' + fmtMoeda(m.receita) + '</b><br>' +
          '<span style="color:var(--chart-despesa);">●</span> Despesas: <b>R$ ' + fmtMoeda(m.despesa) + '</b><br>' +
          'Saldo: <b style="color:' + (saldo >= 0 ? 'var(--good)' : 'var(--crit)') + ';">R$ ' + fmtMoeda(saldo) + '</b>';
        var wrapRect = wrap.getBoundingClientRect();
        tooltip.style.left = (ev.clientX - wrapRect.left) + 'px';
        tooltip.style.top = (ev.clientY - wrapRect.top) + 'px';
        tooltip.classList.add('visivel');
        if (crosshair) {
          var x = xAtFn(idx);
          crosshair.setAttribute('x1', x);
          crosshair.setAttribute('x2', x);
          crosshair.style.display = 'block';
        }
      });
      rect.addEventListener('mouseleave', function () {
        tooltip.classList.remove('visivel');
        if (crosshair) crosshair.style.display = 'none';
      });
    });
  }

  function renderExecCategorias(lista) {
    var container = document.getElementById('exec-categorias-lista');
    if (!container) return;
    if (!lista.length) {
      container.innerHTML = '<div class="empty-state"><div class="msg">Nenhuma despesa registrada no período.</div></div>';
      return;
    }
    var total = lista.reduce(function (acc, c) { return acc + c.valor; }, 0) || 1;
    var raio = 38, circunferencia = 2 * Math.PI * raio;
    var offsetAcumulado = 0;
    var segmentosSvg = lista.map(function (c, i) {
      var cor = 'var(--chart-cat-' + ((i % 8) + 1) + ')';
      var dashLen = (c.valor / total) * circunferencia;
      var segmento = '<circle cx="50" cy="50" r="' + raio + '" fill="none" stroke="' + cor + '" stroke-width="12" ' +
        'stroke-dasharray="' + dashLen.toFixed(2) + ' ' + Math.max(circunferencia - dashLen, 0).toFixed(2) + '" ' +
        'stroke-dashoffset="' + (-offsetAcumulado).toFixed(2) + '"/>';
      offsetAcumulado += dashLen;
      return segmento;
    }).join('');

    var legendaHtml = lista.map(function (c, i) {
      var cor = 'var(--chart-cat-' + ((i % 8) + 1) + ')';
      var pct = Math.round((c.valor / total) * 100);
      return '<div class="exec-cat-legend-row">' +
        '<span class="exec-cat-legend-dot" style="background:' + cor + ';"></span>' +
        '<span class="exec-cat-legend-nome" title="' + esc(c.categoria) + '">' + esc(c.categoria) + '</span>' +
        '<span class="exec-cat-legend-valor">R$ ' + fmtMoeda(c.valor) + '</span>' +
        '<span class="exec-cat-legend-pct">' + pct + '%</span>' +
      '</div>';
    }).join('');

    container.innerHTML =
      '<div class="exec-cat-donut-wrap">' +
        '<div class="exec-cat-donut">' +
          '<svg viewBox="0 0 100 100" style="transform:rotate(-90deg);">' +
            '<circle cx="50" cy="50" r="' + raio + '" fill="none" stroke="var(--surface-sunken)" stroke-width="12"/>' +
            segmentosSvg +
          '</svg>' +
          '<div class="exec-cat-donut-centro"><span class="exec-cat-donut-label">Total</span><span class="exec-cat-donut-valor">R$ ' + fmtMoeda(total) + '</span></div>' +
        '</div>' +
        '<div class="exec-cat-legend">' + legendaHtml + '</div>' +
      '</div>';
  }

  var ICONE_VENCIMENTO_PADRAO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="17" rx="2"></rect><path d="M3 9h18M8 2v4M16 2v4"></path></svg>';
  var ICONE_VENCIMENTO_VENCIDA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 9v4"></path><path d="M10.3 3.9 1.8 18a1.5 1.5 0 0 0 1.3 2.2h17.8a1.5 1.5 0 0 0 1.3-2.2L13.7 3.9a1.5 1.5 0 0 0-2.6 0z"></path><path d="M12 16h.01"></path></svg>';

  function renderExecProximos(lista) {
    var container = document.getElementById('exec-proximos-lista');
    if (!container) return;
    if (!lista.length) {
      container.innerHTML = '<div class="empty-state"><div class="glyph">✓</div><div class="msg">Nenhuma conta a pagar em aberto agora.</div></div>';
      return;
    }
    var chips = { Vencida: '<span class="chip crit">Vencida</span>', Parcial: '<span class="chip neutral">Parcial</span>', Aberta: '<span class="chip neutral">Aberta</span>' };
    container.innerHTML = lista.map(function (c) {
      var vencida = c.status_exibicao === 'Vencida';
      return '<div class="exec-venc-card">' +
        '<div class="exec-venc-icon" style="' + (vencida ? 'color:var(--crit);background:var(--crit-soft);' : 'color:var(--accent);background:var(--accent-soft);') + '">' +
          (vencida ? ICONE_VENCIMENTO_VENCIDA : ICONE_VENCIMENTO_PADRAO) +
        '</div>' +
        '<div class="exec-venc-corpo">' +
          '<span class="exec-venc-titulo">' + esc(c.descricao) + '</span>' +
          '<span class="exec-venc-sub">' + esc(c.categoria || 'Sem categoria') + '</span>' +
        '</div>' +
        '<div class="exec-venc-lado">' +
          '<span class="exec-venc-valor">R$ ' + fmtMoeda(c.saldo) + '</span>' +
          '<span class="exec-venc-data">' + (chips[c.status_exibicao] || chips.Aberta) + (c.vencimento ? ' · ' + esc(fmtDataCurta(c.vencimento)) : '') + '</span>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  var ICONE_INSIGHT_CATEGORIA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M11 3a8 8 0 1 0 8 8h-8z"></path><path d="M15 3.5A8 8 0 0 1 20.5 9H15z"></path></svg>';
  var ICONE_INSIGHT_RECORRENTE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M17 2 21 6 17 10"></path><path d="M3 12v-2a4 4 0 0 1 4-4h14"></path><path d="M7 22 3 18 7 14"></path><path d="M21 12v2a4 4 0 0 1-4 4H3"></path></svg>';
  var ICONE_INSIGHT_ALERTA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 9v4"></path><path d="M10.3 3.9 1.8 18a1.5 1.5 0 0 0 1.3 2.2h17.8a1.5 1.5 0 0 0 1.3-2.2L13.7 3.9a1.5 1.5 0 0 0-2.6 0z"></path><path d="M12 16h.01"></path></svg>';
  var ICONE_INSIGHT_OK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"></circle><path d="m8 12 3 3 5-6"></path></svg>';

  function renderExecInsights(resumo) {
    var container = document.getElementById('exec-insights');
    if (!container) return;
    var kpis = resumo.kpis || {};
    var categorias = resumo.despesas_por_categoria || [];
    var serie = resumo.receita_x_despesas || [];
    var cartoes = [];

    if (categorias.length) {
      var totalDespesas = categorias.reduce(function (acc, c) { return acc + c.valor; }, 0) || 1;
      var maior = categorias[0];
      var pct = Math.round((maior.valor / totalDespesas) * 100);
      cartoes.push({
        icone: ICONE_INSIGHT_CATEGORIA, cor: 'var(--chart-cat-1)',
        titulo: 'Maior gasto do período',
        texto: esc(maior.categoria) + ' responde por <b>' + pct + '%</b> das despesas (R$ ' + fmtMoeda(maior.valor) + ').',
      });
    }

    var mesesRealizados = serie.filter(function (m) { return !m.previsto; });
    var receitaMediaMensal = mesesRealizados.length
      ? mesesRealizados.reduce(function (acc, m) { return acc + m.receita; }, 0) / mesesRealizados.length
      : 0;
    if (receitaMediaMensal > 0) {
      var pctComprometido = Math.round(((kpis.comprometido_mensal || 0) / receitaMediaMensal) * 100);
      cartoes.push({
        icone: ICONE_INSIGHT_RECORRENTE, cor: 'var(--accent)',
        titulo: 'Comprometido com recorrentes',
        texto: 'As contas recorrentes ativas comprometem <b>' + pctComprometido + '%</b> da receita média mensal realizada.',
      });
    }

    var mesesPrevistos = serie.filter(function (m) { return m.previsto; });
    if (mesesPrevistos.length) {
      var piorMes = mesesPrevistos.reduce(function (pior, m) {
        var saldo = m.receita - m.despesa;
        return (!pior || saldo < pior.saldo) ? { mes: m.mes, saldo: saldo } : pior;
      }, null);
      if (piorMes && piorMes.saldo < 0) {
        cartoes.push({
          icone: ICONE_INSIGHT_ALERTA, cor: 'var(--crit)',
          titulo: 'Saldo previsto negativo',
          texto: esc(nomeMesExtenso(piorMes.mes)) + ' tem saldo previsto de <b style="color:var(--crit);">-R$ ' + fmtMoeda(Math.abs(piorMes.saldo)) + '</b>.',
        });
      } else {
        cartoes.push({
          icone: ICONE_INSIGHT_OK, cor: 'var(--good)',
          titulo: 'Previsão de caixa positiva',
          texto: 'Nenhum dos próximos meses previstos fecha no negativo, considerando o que já está agendado.',
        });
      }
    }

    if (!cartoes.length) { container.innerHTML = ''; return; }
    container.innerHTML = cartoes.map(function (c) {
      return '<div class="exec-insight-card">' +
        '<div class="exec-insight-icon" style="color:' + c.cor + ';">' + c.icone + '</div>' +
        '<div class="exec-insight-corpo"><span class="exec-insight-titulo">' + esc(c.titulo) + '</span>' +
          '<p class="exec-insight-texto">' + c.texto + '</p></div>' +
      '</div>';
    }).join('');
  }

  var ROTULO_HORIZONTE_DIAS = { 30: 'Próximos 30 dias', 60: 'Próximos 60 dias', 90: 'Próximos 90 dias', 180: 'Próximos 6 meses', 365: 'Próximos 12 meses' };

  function renderExecHorizontes(horizontes) {
    var container = document.getElementById('exec-horizontes');
    if (!container) return;
    if (!horizontes.length) { container.innerHTML = ''; return; }
    container.innerHTML = horizontes.map(function (h) {
      var saldoNegativo = h.saldo < 0;
      return '<div class="exec-horizonte-card">' +
        '<div class="exec-horizonte-titulo">' + esc(ROTULO_HORIZONTE_DIAS[h.dias] || (h.dias + ' dias')) + '</div>' +
        '<div class="exec-horizonte-linhas">' +
          '<div class="exec-horizonte-linha"><span>Receitas:</span><span class="exec-horizonte-valor">R$ ' + fmtMoeda(h.receita) + '</span></div>' +
          '<div class="exec-horizonte-linha"><span>Despesas:</span><span class="exec-horizonte-valor" style="color:var(--crit);">R$ ' + fmtMoeda(h.despesa) + '</span></div>' +
        '</div>' +
        '<div class="exec-horizonte-rodape"><span>Saldo estimado:</span>' +
          '<span class="exec-horizonte-saldo" style="color:' + (saldoNegativo ? 'var(--crit)' : 'var(--good)') + ';">' +
            (saldoNegativo ? '-' : '+') + 'R$ ' + fmtMoeda(Math.abs(h.saldo)) + '</span></div>' +
      '</div>';
    }).join('');
  }

  function preencherExecKpisContratos() {
    var f = dadosPainelAtual && dadosPainelAtual.financeiro;
    if (!f) return;
    var elValorTotal = document.getElementById('exec-kpi-valor-total');
    if (elValorTotal) elValorTotal.textContent = fmtMoeda(f.valor_total_geral || 0);
    var elRecebido = document.getElementById('exec-kpi-recebido');
    if (elRecebido) elRecebido.textContent = fmtMoeda(f.valor_recebido_geral || 0);
    var elPendente = document.getElementById('exec-kpi-pendente');
    if (elPendente) elPendente.textContent = fmtMoeda(f.total_a_receber || 0);
    var elAtraso = document.getElementById('exec-kpi-atraso');
    if (elAtraso) elAtraso.textContent = fmtMoeda(f.total_vencido || 0);
    var elAtrasoSub = document.getElementById('exec-kpi-atraso-sub');
    if (elAtrasoSub) {
      var qtdVencidas = (f.parcelas_vencidas || []).length;
      elAtrasoSub.textContent = qtdVencidas ? qtdVencidas + ' parcela(s) vencida(s)' : 'nenhuma parcela vencida';
    }
    var elContratosAtivos = document.getElementById('exec-kpi-contratos-ativos');
    if (elContratosAtivos) elContratosAtivos.textContent = f.contratos_ativos || 0;
  }

  var ICONE_EXEC_INSIGHT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"></path><path d="M10 21h4"></path><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.45.98 1.16 1.05 1.95L9.5 16h5l.05-.25c.07-.79.45-1.5 1.05-1.95A6 6 0 0 0 12 3z"></path></svg>';

  function carregarPainelExecutivo() {
    var wrap = document.getElementById('exec-grafico-svg');
    if (!wrap) return;
    preencherExecKpisContratos();
    apiPostJson('/api/painel?acao=executar', { tipo: 'financeiro_resumo_executivo', meses: mesesGraficoExecAtual })
      .then(function (dados) {
        var r = dados.resumo || {};
        var kpis = r.kpis || {};
        desenharReceitaDespesas(r.receita_x_despesas || []);
        renderExecAcumulado(r);
        renderExecCategorias(r.despesas_por_categoria || []);
        renderExecProximos(r.proximos_vencimentos || []);
        renderExecInsights(r);
        renderExecHorizontes(r.horizontes || []);
        renderVisaoGeral(r);

        var horizonte90 = (r.horizontes || []).filter(function (h) { return h.dias === 90; })[0];
        var elProjetado = document.getElementById('exec-kpi-projetado-90d');
        if (elProjetado && horizonte90) {
          var saldoProjNegativo = horizonte90.saldo < 0;
          elProjetado.textContent = (saldoProjNegativo ? '-' : '') + fmtMoeda(Math.abs(horizonte90.saldo));
          elProjetado.style.color = saldoProjNegativo ? 'var(--crit)' : 'var(--good)';
        }
        var elProjetadoSub = document.getElementById('exec-kpi-projetado-90d-sub');
        if (elProjetadoSub && horizonte90) {
          elProjetadoSub.textContent = 'receita R$ ' + fmtMoeda(horizonte90.receita) + ' · despesas R$ ' + fmtMoeda(horizonte90.despesa);
        }

        var elSaldo = document.getElementById('exec-kpi-saldo');
        if (elSaldo) {
          var saldoNegativo = (kpis.saldo_mes || 0) < 0;
          elSaldo.textContent = (saldoNegativo ? '-' : '') + fmtMoeda(Math.abs(kpis.saldo_mes || 0));
          elSaldo.style.color = saldoNegativo ? 'var(--crit)' : 'var(--good)';
        }
        var elSaldoSub = document.getElementById('exec-kpi-saldo-sub');
        if (elSaldoSub) {
          elSaldoSub.textContent = 'receita R$ ' + fmtMoeda(kpis.receita_mes || 0) + ' · despesas R$ ' + fmtMoeda(kpis.despesa_mes || 0);
        }
        var elAPagar = document.getElementById('exec-kpi-a-pagar');
        if (elAPagar) elAPagar.textContent = fmtMoeda(kpis.total_a_pagar || 0);
        var elVencidoSub = document.getElementById('exec-kpi-vencido-sub');
        if (elVencidoSub) {
          if (kpis.total_vencido_pagar > 0) {
            elVencidoSub.innerHTML = '<span style="color:var(--crit);">R$ ' + fmtMoeda(kpis.total_vencido_pagar) + ' vencido(s)</span>';
          } else {
            elVencidoSub.textContent = 'nenhuma conta vencida';
          }
        }
        var elRecorrentes = document.getElementById('exec-kpi-recorrentes');
        if (elRecorrentes) elRecorrentes.textContent = kpis.recorrentes_ativas || 0;
        var elComprometidoSub = document.getElementById('exec-kpi-comprometido-sub');
        if (elComprometidoSub) elComprometidoSub.textContent = 'R$ ' + fmtMoeda(kpis.comprometido_mensal || 0) + ' comprometidos/mês';

        var notaSemData = document.getElementById('exec-nota-sem-data');
        if (notaSemData) {
          if (kpis.receita_sem_data > 0) {
            notaSemData.classList.remove('hidden');
            notaSemData.innerHTML =
              '<div class="exec-nota-icone" aria-hidden="true">' + ICONE_EXEC_INSIGHT + '</div>' +
              '<div class="exec-nota-texto"><b>R$ ' + fmtMoeda(kpis.receita_sem_data) + '</b> recebidos não aparecem no gráfico acima, porque são lançamentos antigos sem data de pagamento registrada — esse valor já entrou, só não dá pra saber em qual mês.</div>' +
              '<button type="button" class="exec-nota-cta">Ver detalhes <span class="exec-nota-cta-seta" aria-hidden="true">→</span></button>';
          } else {
            notaSemData.classList.add('hidden');
          }
        }
      })
      .catch(function () {
        wrap.innerHTML = '<div class="fluxo-vazio">Não foi possível carregar o painel executivo agora.</div>';
      });
  }

  var ROTULO_PERIODO_EXEC = { 1: 'Último mês', 3: 'Últimos 3 meses', 6: 'Últimos 6 meses', 12: 'Últimos 12 meses', 24: 'Últimos 24 meses' };

  function wireExecPeriodoFiltros() {
    var wrap = document.getElementById('exec-periodo-filtros');
    if (!wrap) return;
    wrap.querySelectorAll('.exec-periodo-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var meses = parseInt(btn.getAttribute('data-meses'), 10);
        if (meses === mesesGraficoExecAtual) return;
        mesesGraficoExecAtual = meses;
        wrap.querySelectorAll('.exec-periodo-btn').forEach(function (b) { b.classList.toggle('ativo', b === btn); });
        var rotuloBase = ROTULO_PERIODO_EXEC[meses] || ('Últimos ' + meses + ' meses');
        var label = document.getElementById('exec-grafico-periodo-label');
        if (label) label.textContent = rotuloBase + ' + próximos 6 (previsão)';
        var labelCategorias = document.getElementById('exec-categorias-periodo-label');
        if (labelCategorias) labelCategorias.textContent = rotuloBase;
        carregarPainelExecutivo();
      });
    });
  }

  var ICONE_TENDENCIA_ALTA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 17 9 11 13 15 21 7"></path><path d="M15 7h6v6"></path></svg>';
  var ICONE_TENDENCIA_BAIXA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7 9 13 13 9 21 17"></path><path d="M15 17h6v-6"></path></svg>';
  var ICONE_CARTEIRA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><path d="M16 12h.01"></path><path d="M3 9h18"></path></svg>';

  // Variacao percentual real vs. periodo anterior equivalente -- nao e enfeite, vem de
  // resumo.comparativo_periodo_anterior (banco.gerar_resumo_executivo), calculado no backend
  // comparando o periodo selecionado (1M/3M/6M/12M/24M) com o mesmo tanto de meses imediatamente
  // antes (pedido do usuario, a partir de um mockup com "+12,5% vs. periodo anterior").
  function calcularVariacaoPct(atual, anterior) {
    if (!anterior) return atual > 0 ? { pct: null, novo: true } : { pct: 0, novo: false };
    return { pct: ((atual - anterior) / Math.abs(anterior)) * 100, novo: false };
  }

  function htmlChipVariacao(atual, anterior, maiorEhMelhor) {
    var v = calcularVariacaoPct(atual, anterior);
    if (v.novo) return '<span class="exec-variacao-chip neutro">novo</span>';
    if (v.pct === 0 && anterior === 0) return '<span class="exec-variacao-chip neutro">—</span>';
    var subiu = v.pct >= 0;
    var favoravel = maiorEhMelhor ? subiu : !subiu;
    var seta = subiu ? '▲' : '▼';
    return '<span class="exec-variacao-chip ' + (favoravel ? 'bom' : 'ruim') + '">' + seta + ' ' + Math.abs(v.pct).toFixed(1).replace('.', ',') + '%</span>';
  }

  function renderExecAcumulado(resumo) {
    var container = document.getElementById('exec-acumulado');
    if (!container) return;
    var serie = resumo.receita_x_despesas || [];
    if (!serie.length) { container.innerHTML = ''; return; }
    var cmp = resumo.comparativo_periodo_anterior || {};
    var totalReceita = cmp.receita_atual || 0;
    var totalDespesa = cmp.despesa_atual || 0;
    var saldoTotal = cmp.saldo_atual != null ? cmp.saldo_atual : (totalReceita - totalDespesa);

    container.innerHTML =
      '<div class="exec-periodo-card">' +
        '<div class="exec-periodo-card-top">' +
          '<span class="exec-periodo-card-label">Receita no período</span>' +
          '<span class="exec-periodo-card-icone" style="color:var(--chart-receita);background:color-mix(in srgb, var(--chart-receita) 16%, transparent);">' + ICONE_TENDENCIA_ALTA + '</span>' +
        '</div>' +
        '<span class="exec-periodo-card-valor" style="color:var(--chart-receita);">R$ ' + fmtMoeda(totalReceita) + '</span>' +
        '<div class="exec-periodo-card-rodape">' + htmlChipVariacao(cmp.receita_atual || 0, cmp.receita_anterior || 0, true) + '<span class="exec-periodo-card-vs">vs. período anterior</span></div>' +
      '</div>' +
      '<div class="exec-periodo-card">' +
        '<div class="exec-periodo-card-top">' +
          '<span class="exec-periodo-card-label">Despesas no período</span>' +
          '<span class="exec-periodo-card-icone" style="color:var(--chart-despesa);background:color-mix(in srgb, var(--chart-despesa) 16%, transparent);">' + ICONE_TENDENCIA_BAIXA + '</span>' +
        '</div>' +
        '<span class="exec-periodo-card-valor" style="color:var(--chart-despesa);">R$ ' + fmtMoeda(totalDespesa) + '</span>' +
        '<div class="exec-periodo-card-rodape">' + htmlChipVariacao(cmp.despesa_atual || 0, cmp.despesa_anterior || 0, false) + '<span class="exec-periodo-card-vs">vs. período anterior</span></div>' +
      '</div>' +
      '<div class="exec-periodo-card">' +
        '<div class="exec-periodo-card-top">' +
          '<span class="exec-periodo-card-label">Saldo do período</span>' +
          '<span class="exec-periodo-card-icone" style="color:var(--accent);background:var(--accent-soft);">' + ICONE_CARTEIRA + '</span>' +
        '</div>' +
        '<span class="exec-periodo-card-valor" style="color:' + (saldoTotal >= 0 ? 'var(--good)' : 'var(--crit)') + ';">' +
          (saldoTotal < 0 ? '-' : '') + 'R$ ' + fmtMoeda(Math.abs(saldoTotal)) + '</span>' +
        '<div class="exec-periodo-card-rodape">' + htmlChipVariacao(cmp.saldo_atual || 0, cmp.saldo_anterior || 0, true) + '<span class="exec-periodo-card-vs">vs. período anterior</span></div>' +
      '</div>';
  }

  function htmlSparkline(valores, cor) {
    if (!valores.length) return '';
    var W = 60, H = 22, pad = 2;
    if (valores.length === 1) valores = [valores[0], valores[0]];
    var min = Math.min.apply(null, valores), max = Math.max.apply(null, valores);
    var amplitude = (max - min) || 1;
    var passo = (W - pad * 2) / (valores.length - 1);
    var pontos = valores.map(function (v, i) {
      var x = pad + i * passo;
      var y = H - pad - ((v - min) / amplitude) * (H - pad * 2);
      return x.toFixed(1) + ',' + y.toFixed(1);
    });
    return '<svg class="exec-sparkline" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' +
      '<polyline points="' + pontos.join(' ') + '" fill="none" stroke="' + cor + '" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle cx="' + pontos[pontos.length - 1].split(',')[0] + '" cy="' + pontos[pontos.length - 1].split(',')[1] + '" r="1.8" fill="' + cor + '"/>' +
    '</svg>';
  }

  // "Visao Geral": painel lateral decorativo (orbita/brilho, sem dado nenhum atras -- o usuario
  // pediu pra manter so como enfeite visual, ver AskUserQuestion desta sessao) + 3 linhas com
  // dado real (mesmo comparativo_periodo_anterior dos cartoes acima) e um sparkline de verdade
  // dos ultimos meses realizados.
  function renderVisaoGeral(resumo) {
    var container = document.getElementById('exec-visao-geral-corpo');
    if (!container) return;
    var cmp = resumo.comparativo_periodo_anterior || {};
    var serieRealizada = (resumo.receita_x_despesas || []).filter(function (m) { return !m.previsto; }).slice(-6);
    var receitas = serieRealizada.map(function (m) { return m.receita || 0; });
    var despesas = serieRealizada.map(function (m) { return m.despesa || 0; });
    var saldos = serieRealizada.map(function (m) { return (m.receita || 0) - (m.despesa || 0); });

    function linha(label, valor, anterior, cor, icone, valores) {
      return '<div class="exec-vg-linha">' +
        '<span class="exec-vg-icone" style="color:' + cor + ';background:color-mix(in srgb, ' + cor + ' 16%, transparent);">' + icone + '</span>' +
        '<div class="exec-vg-info">' +
          '<span class="exec-vg-label">' + esc(label) + '</span>' +
          '<span class="exec-vg-valor">R$ ' + fmtMoeda(Math.abs(valor)) + '</span>' +
          htmlChipVariacao(valor, anterior, label !== 'Despesa') +
        '</div>' +
        htmlSparkline(valores, cor) +
      '</div>';
    }

    container.innerHTML =
      linha('Receita', cmp.receita_atual || 0, cmp.receita_anterior || 0, 'var(--chart-receita)', ICONE_TENDENCIA_ALTA, receitas) +
      linha('Despesa', cmp.despesa_atual || 0, cmp.despesa_anterior || 0, 'var(--chart-despesa)', ICONE_TENDENCIA_BAIXA, despesas) +
      linha('Saldo', cmp.saldo_atual || 0, cmp.saldo_anterior || 0, 'var(--accent)', ICONE_CARTEIRA, saldos);
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
            '<div class="chip warn" style="margin-bottom:12px;">Total a receber no mês: R$ ' + fmtMoeda(corpo.total_devedores) + '</div>' +
            '<div class="table-scroll"><table><thead><tr><th>Cliente</th><th>Parcela</th><th>Vencimento</th><th style="text-align:right">Valor</th></tr></thead>' +
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
          '<div class="table-scroll"><table><thead><tr><th>Cliente</th><th>Status</th><th style="text-align:right">Valor total</th><th></th></tr></thead>' +
          '<tbody>' + linhas + '</tbody></table></div>';
        wrap.querySelectorAll('[data-remover-cliente]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var nome = btn.getAttribute('data-remover-cliente');
            confirmarModal('Remover "' + nome + '" da planilha de honorários? Essa ação não pode ser desfeita pelo painel.').then(function (ok) {
              if (!ok) return;
              btn.disabled = true; btn.textContent = 'Removendo...';
              apiPostJson('/api/painel?acao=executar', { tipo: 'remover_cliente_financeiro', nome: nome })
                .then(function () { carregarListaClientesFinanceiro(); })
                .catch(function () {
                  btn.disabled = false; btn.textContent = 'Remover';
                  mostrarAviso('Não foi possível remover agora. Tente de novo.');
                });
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
              '<a class="inicio-checklist-btn" href="painel-prazos.html#sec-prazos">Criar prazo</a>' +
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
          '<table><thead><tr><th>Cliente</th><th style="text-align:right">Saldo</th><th>Vencimento</th><th style="text-align:right">Atraso</th><th></th></tr></thead>' +
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
            '<div><div class="fluxo-titulo">Fluxo de Caixa</div>' +
            '<div class="fluxo-subtitulo">Recebido e vencido por mês — ' + esc(rotuloFiltro(filtroGraficoAtual)) + '</div></div>' +
          '</div>' +
          '<div class="fluxo-svg-wrap" id="grafico-financeiro-svg" style="position:relative;"><div class="fluxo-tooltip" id="grafico-tooltip"></div></div>' +
          '<div id="grafico-tabela-wrap" class="hidden table-scroll" style="margin-top:14px;">' +
            '<table><thead><tr><th>Mês</th><th style="text-align:right">Recebido</th><th style="text-align:right">A receber</th><th style="text-align:right">Vencido</th></tr></thead>' +
            '<tbody id="grafico-tabela-corpo"></tbody></table>' +
          '</div>' +
          '<button type="button" class="fluxo-tabela-toggle" id="grafico-tabela-toggle">Ver como tabela</button>' +
          (f.recebido_sem_data > 0
            ? '<div style="margin-top:14px;padding:10px 13px;border-radius:6px;background:var(--warn-soft);border:1px solid var(--warn);color:var(--warn);font-size:12.5px;line-height:1.5;font-family:\'IBM Plex Sans\',sans-serif;">' +
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
        htmlListaExito = '<div class="table-scroll"><table>' +
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
        htmlRanking = '<div class="table-scroll"><table>' +
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
        '<div class="panel">' +
          '<div class="panel-header"><span class="panel-title">Clientes cadastrados</span></div>' +
          '<div style="padding:14px 20px 4px;"><a href="painel-novo-cliente.html#sec-novo-cliente" class="procpage-btn procpage-btn-primary" style="display:inline-block; text-decoration:none;">+ Novo cliente</a></div>' +
          '<div id="clientes-cadastrados-lista" style="padding:6px 20px 18px;"><div class="empty-state"><div class="msg">Carregando…</div></div></div>' +
        '</div>' +
        '<div class="panel" style="margin-top:14px;"><div class="panel-header"><span class="panel-title">Visão consolidada</span></div>' +
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
              '<div><label>Tribunal</label><select id="procman-tribunal">' + htmlOpcoesTribunal('') + '</select></div>' +
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
                  '<div id="cliente-foto-preview" style="width:56px; height:56px; border-radius:50%; background:var(--bg); border:1px solid var(--line); display:flex; align-items:center; justify-content:center; color:var(--ink-faint); overflow:hidden; flex-shrink:0;">' +
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
                  '<div><label>CEP</label><input id="cliente-cep" placeholder="00000-000" maxlength="9"><span id="cliente-cep-status" style="display:block; font-size:11px; color:var(--ink-faint); margin-top:3px;">Busca automática ao digitar</span></div>' +
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
                '<textarea id="cliente-observacoes" rows="3" placeholder="Observações gerais, combinados, informações complementares sobre o cliente..." style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--line);border-radius:6px;font-size:13px;font-family:inherit;background:var(--bg);color:var(--ink);resize:vertical;"></textarea>' +
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
                '<div style="display:flex; justify-content:space-between; font-size:11px; color:var(--ink-faint); margin-bottom:4px;"><span>Completude</span><span id="cliente-progresso-pct">0%</span></div>' +
                '<div style="height:6px; background:var(--bg); border-radius:999px; overflow:hidden;"><div id="cliente-progresso-barra" style="height:100%; width:0%; background:var(--accent); transition:width .2s;"></div></div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</section>';

    var htmlPrazos = perms.indexOf('processos') === -1 ? '' :
      '<section id="sec-prazos">' +
        '<div class="procpage-dark">' +
          '<div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:16px;">' +
            '<div>' +
              '<h2 class="procpage-titulo" style="margin:0;">Prazos processuais</h2>' +
              '<p style="margin:4px 0 0; font-size:12.5px; color:var(--ink-faint);">Acompanhe os prazos de todos os processos. Para adicionar um prazo, use o botão abaixo ou abra o processo e use a aba Prazos.</p>' +
            '</div>' +
            '<a class="procpage-btn" href="painel-processos.html#sec-processos">Ir para Processos</a>' +
          '</div>' +

          '<div class="procpage-filtros">' +
            '<p style="margin:0 0 10px; font-size:12.5px; font-weight:600; color:var(--ink-faint);">Busca avançada</p>' +
            '<div style="display:flex; gap:12px; flex-wrap:wrap; align-items:flex-end;">' +
              '<div><label style="display:block; font-size:11.5px; color:var(--ink-faint); margin-bottom:4px;">Status</label>' +
                '<select id="prazos-filtro-status" style="padding:8px 10px; border-radius:7px; border:1px solid var(--line); background:var(--bg); color:var(--ink);">' +
                  '<option value="">Todos</option><option value="pendente">Pendente</option>' +
                  '<option value="cumprido">Cumprido</option><option value="vencido">Vencido</option>' +
                '</select></div>' +
              '<div><label style="display:block; font-size:11.5px; color:var(--ink-faint); margin-bottom:4px;">Tipo</label>' +
                '<select id="prazos-filtro-tipo" style="padding:8px 10px; border-radius:7px; border:1px solid var(--line); background:var(--bg); color:var(--ink);">' +
                  '<option value="">Todos</option><option value="legal">Legal</option><option value="interno">Interno</option>' +
                '</select></div>' +
              '<button type="button" class="procpage-btn procpage-btn-primary" id="prazos-btn-buscar">Buscar</button>' +
              '<button type="button" class="procpage-btn" id="prazos-btn-limpar">Limpar</button>' +
              '<button type="button" class="procpage-btn procpage-btn-primary" id="prazos-btn-adicionar" style="margin-left:auto;">+ Adicionar prazo</button>' +
            '</div>' +
          '</div>' +

          '<div id="prazos-lista" style="margin-top:16px;"><div class="empty-state"><div class="msg" style="color:var(--ink-faint);">Carregando…</div></div></div>' +
        '</div>' +
      '</section>';

    var htmlProcessos = perms.indexOf('processos') === -1 ? '' :
      '<section id="sec-processos">' +
        '<div class="procpage-dark">' +
          '<div id="procpage-view-lista">' +
            '<div class="procpage-topo">' +
              '<h2 class="procpage-titulo">Processos Judiciais</h2>' +
              '<div class="procpage-acoes-topo">' +
                '<a class="procpage-btn" href="painel-importar-oab.html#sec-importar-oab">' +
                  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"></circle><path d="m21 21-4.3-4.3"></path></svg>' +
                  'Busca OAB</a>' +
                '<a class="procpage-btn procpage-btn-primary" href="painel-criar-processo.html#sec-criar-processo">' +
                  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"></path></svg>' +
                  'Novo processo</a>' +
              '</div>' +
            '</div>' +

            '<div id="procpage-aviso-nao-cadastrados"></div>' +

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
              '<div id="procman-lista"><div class="empty-state"><div class="msg" style="color:var(--ink-faint);">Carregando…</div></div></div>' +
            '</div>' +
          '</div>' +

          '<div id="procpage-view-ficha" class="hidden"></div>' +
        '</div>' +
      '</section>';

    var htmlTriagemDashboard = perms.indexOf('processos') === -1 ? '' :
      '<section id="sec-triagem-trabalhista">' +
        '<div class="procpage-dark">' +
          '<div class="procpage-topo">' +
            '<h2 class="procpage-titulo">Triagem Trabalhista</h2>' +
            '<div class="procpage-acoes-topo">' +
              '<a class="procpage-btn procpage-btn-primary" href="painel-criar-triagem.html#sec-criar-triagem">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"></path></svg>' +
                'Nova Triagem Trabalhista</a>' +
            '</div>' +
          '</div>' +

          '<div class="procpage-filtros">' +
            '<div class="procpage-filtros-grid">' +
              '<div><label>Cliente ou empresa</label><input type="text" id="triagem-filtro-busca" placeholder="Buscar por cliente ou empresa..."></div>' +
              '<div><label>Status</label><select id="triagem-filtro-status">' +
                '<option value="">Todas (exceto arquivadas)</option>' +
                '<option value="nao_iniciada">Não iniciada</option>' +
                '<option value="em_andamento">Em andamento</option>' +
                '<option value="aguardando_documentos">Aguardando documentos</option>' +
                '<option value="aguardando_informacoes">Aguardando informações</option>' +
                '<option value="concluida">Concluída</option>' +
                '<option value="convertida">Convertida em caso/processo</option>' +
                '<option value="arquivada">Arquivadas</option>' +
              '</select></div>' +
              '<div class="procpage-filtros-botoes">' +
                '<button type="button" class="procpage-btn" id="triagem-filtro-limpar">Limpar</button>' +
              '</div>' +
            '</div>' +
          '</div>' +

          '<div class="procpage-tabela-wrap">' +
            '<div id="triagem-lista"><div class="empty-state"><div class="msg" style="color:var(--ink-faint);">Carregando…</div></div></div>' +
          '</div>' +
        '</div>' +
      '</section>';

    // Wizard da Triagem Trabalhista -- fase 1 do plano aprovado: so os passos Cliente, Empresa
    // e Contrato ficam de fato funcionais aqui (Jornada e os demais entram nas fases seguintes,
    // cada uma com sua propria migracao). #triagem-wizard-conteudo e reconstruido a cada passo
    // por renderPassoTriagem*(), mesmo padrao de troca de tela do wizard de onboarding
    // (cadastro-advogado.html), so que usando as classes .triagem-passos/.procficha-painel do
    // painel.css compartilhado em vez de <style> proprio da pagina.
    var htmlCriarTriagem = perms.indexOf('processos') === -1 ? '' :
      '<section id="sec-criar-triagem">' +
        '<div class="procpage-dark">' +
          '<div class="procficha-topo">' +
            '<div class="procficha-titulo-wrap">' +
              '<a class="procficha-voltar" href="painel-triagem-trabalhista.html#sec-triagem-trabalhista">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M19 12H5M11 18l-6-6 6-6"></path></svg>' +
                '<span>Voltar</span>' +
              '</a>' +
              '<h2 class="procficha-numero" id="triagem-wizard-titulo">Nova Triagem Trabalhista</h2>' +
            '</div>' +
            '<button type="button" class="procpage-btn" id="triagem-btn-pendencias">Verificar pendências</button>' +
          '</div>' +

          '<div class="triagem-passos" id="triagem-passos-barra"></div>' +
          '<div class="triagem-passo-legenda"><span id="triagem-passo-atual-label"></span><span id="triagem-passo-pct-label"></span></div>' +

          '<div id="triagem-wizard-erro"></div>' +
          '<div id="triagem-painel-pendencias" class="triagem-campo-condicional hidden" style="margin-bottom:16px;"></div>' +
          '<div id="triagem-wizard-conteudo" class="procficha-painel"></div>' +

          '<div class="triagem-nav-passos">' +
            '<button type="button" class="procpage-btn" id="triagem-btn-voltar">← Voltar</button>' +
            '<button type="button" class="procpage-btn procpage-btn-primary" id="triagem-btn-avancar">Avançar →</button>' +
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

    var htmlTarefas = perms.indexOf('agenda') === -1 ? '' :
      '<section id="sec-tarefas">' +
        '<div class="procpage-dark">' +
          '<div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:16px;">' +
            '<div>' +
              '<h2 class="procpage-titulo" style="margin:0;">Tarefas</h2>' +
              '<p style="margin:4px 0 0; font-size:12.5px; color:var(--ink-faint);">Tarefas operacionais com responsável, prioridade e acompanhamento de status.</p>' +
            '</div>' +
            '<button type="button" class="procpage-btn procpage-btn-primary" id="tarefas-btn-adicionar">+ Nova tarefa</button>' +
          '</div>' +

          '<div class="procpage-filtros">' +
            '<p style="margin:0 0 10px; font-size:12.5px; font-weight:600; color:var(--ink-faint);">Busca avançada</p>' +
            '<div style="display:flex; gap:12px; flex-wrap:wrap; align-items:flex-end;">' +
              '<div><label style="display:block; font-size:11.5px; color:var(--ink-faint); margin-bottom:4px;">Responsável</label>' +
                '<select id="tarefas-filtro-responsavel" style="padding:8px 10px; border-radius:7px; border:1px solid var(--line); background:var(--bg); color:var(--ink);">' +
                  '<option value="">Todos</option>' +
                '</select></div>' +
              '<div><label style="display:block; font-size:11.5px; color:var(--ink-faint); margin-bottom:4px;">Status</label>' +
                '<select id="tarefas-filtro-status" style="padding:8px 10px; border-radius:7px; border:1px solid var(--line); background:var(--bg); color:var(--ink);">' +
                  '<option value="">Todos</option><option value="pendente">Pendente</option>' +
                  '<option value="em_andamento">Em andamento</option><option value="concluida">Concluída</option>' +
                '</select></div>' +
              '<div><label style="display:block; font-size:11.5px; color:var(--ink-faint); margin-bottom:4px;">Prioridade</label>' +
                '<select id="tarefas-filtro-prioridade" style="padding:8px 10px; border-radius:7px; border:1px solid var(--line); background:var(--bg); color:var(--ink);">' +
                  '<option value="">Todas</option><option value="baixa">Baixa</option>' +
                  '<option value="media">Média</option><option value="alta">Alta</option>' +
                '</select></div>' +
              '<div><label style="display:block; font-size:11.5px; color:var(--ink-faint); margin-bottom:4px;">Data de</label>' +
                '<input type="date" id="tarefas-filtro-data-de" style="padding:7px 10px; border-radius:7px; border:1px solid var(--line); background:var(--bg); color:var(--ink);"></div>' +
              '<div><label style="display:block; font-size:11.5px; color:var(--ink-faint); margin-bottom:4px;">Data até</label>' +
                '<input type="date" id="tarefas-filtro-data-ate" style="padding:7px 10px; border-radius:7px; border:1px solid var(--line); background:var(--bg); color:var(--ink);"></div>' +
              '<button type="button" class="procpage-btn procpage-btn-primary" id="tarefas-btn-buscar">Buscar</button>' +
              '<button type="button" class="procpage-btn" id="tarefas-btn-limpar">Limpar</button>' +
            '</div>' +
          '</div>' +

          '<div id="tarefas-lista" style="margin-top:16px;"><div class="empty-state"><div class="msg" style="color:var(--ink-faint);">Carregando…</div></div></div>' +
        '</div>' +
      '</section>';

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
      '<section id="sec-contrato"><p class="section-label">Procuração e Contrato</p>' +
        '<div class="panel">' +
          '<div class="panel-header"><span class="panel-title">Verificar/extrair dados do cliente</span></div>' +
          '<div class="automacao-desc" style="padding:0 20px;">Vasculha a pasta do cliente no Drive (fotos e PDFs de RG, CPF, comprovante etc.) e extrai os dados de acesso com IA -- útil quando o cliente já mandou os documentos, mas ninguém preencheu os dados ainda. Também confere se já existe contrato e procuração salvos.</div>' +
          '<div class="proposta-form">' +
            '<input type="text" list="verificar-dados-clientes-lista" placeholder="Nome do cliente" data-campo="nome" data-form="verificar_dados_cliente">' +
            '<datalist id="verificar-dados-clientes-lista"></datalist>' +
            '<button data-tipo="verificar_dados_cliente" class="btn-automacao">Verificar/extrair dados</button>' +
          '</div>' +
          '<div class="automacao-resultado" data-resultado="verificar_dados_cliente" aria-live="polite" style="white-space:pre-wrap;user-select:text;padding:0 20px 16px;"></div>' +
        '</div>' +
        '<div class="panel" style="margin-top:16px;">' +
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
        '<div class="panel" style="margin-top:16px;" id="card-assinatura">' +
          '<div class="panel-header"><span class="panel-title">Enviar procuração/contrato para assinatura</span></div>' +
          '<div class="automacao-desc" style="padding:0 20px;">Manda o PDF (procuração, contrato ou outro documento da pasta de honorários) direto pro cliente assinar pela Autentique, sem precisar do WhatsApp.</div>' +
          '<div class="proposta-form">' +
            '<input type="text" placeholder="Nome do cliente" id="assinatura-nome">' +
            '<button type="button" id="assinatura-buscar" class="btn-automacao">Buscar documentos</button>' +
          '</div>' +
          '<div id="assinatura-passo2" class="hidden" style="margin:0 20px 16px;display:flex;flex-direction:column;gap:8px;">' +
            '<div class="hidden" id="assinatura-campo-telefone" style="display:flex;flex-direction:column;gap:4px;">' +
              '<label for="assinatura-telefone" style="font-size:13px;color:var(--ink-soft);">Não achei telefone cadastrado -- informe (com DDD):</label>' +
              '<input type="text" id="assinatura-telefone" placeholder="Ex: 5599999999999">' +
            '</div>' +
            '<div id="assinatura-lista-docs"></div>' +
            '<button type="button" id="assinatura-enviar" class="btn-automacao">Enviar para assinatura</button>' +
          '</div>' +
          '<div class="automacao-resultado" data-resultado="enviar_assinatura" id="assinatura-resultado" aria-live="polite" style="padding:0 20px 16px;"></div>' +
        '</div>' +
      '</section>';

    var htmlCadastroCliente = perms.indexOf('financeiro') === -1 ? '' :
      '<section id="sec-cadastro-cliente"><p class="section-label">Clientes da planilha</p>' +
        '<div class="panel">' +
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
            '<div class="audiencia-upload-area" style="margin-bottom:16px;">' +
              '<p style="margin:0 0 8px;font-size:11px;font-weight:700;color:var(--ink-faint);text-transform:uppercase;letter-spacing:.05em;">Transcrição ao vivo</p>' +
              '<input type="text" id="audiencia-vivo-cliente" list="audiencia-upload-clientes-lista" placeholder="Nome do cliente">' +
              '<div style="display:flex;align-items:center;gap:10px;margin-top:8px;flex-wrap:wrap;">' +
                '<button type="button" id="audiencia-vivo-iniciar" class="procpage-btn procpage-btn-primary">🎙️ Iniciar transcrição ao vivo</button>' +
                '<button type="button" id="audiencia-vivo-finalizar" class="procpage-btn hidden">Finalizar audiência</button>' +
                '<span id="audiencia-vivo-status" style="font-size:12.5px;color:var(--ink-soft);"></span>' +
              '</div>' +
              '<div id="audiencia-vivo-transcricao" class="hidden" style="margin-top:10px;max-height:220px;overflow-y:auto;padding:12px;border:1px solid var(--line);border-radius:8px;background:var(--surface-sunken);font-size:13px;line-height:1.6;white-space:pre-wrap;color:var(--ink);"></div>' +
            '</div>' +
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
            '<label><input type="checkbox" data-permissao="agenda"> Tarefas e Agenda</label>' +
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

    // "Escritorios da plataforma" -- so aparece pra voce (Cesar), nao pra outros tenants: eles
    // veem "Conexoes" (htmlConexoes, acima) na mesma pagina/secao; voce ve isto, pra gerenciar
    // (suspender/reativar/excluir) os escritorios de outros advogados cadastrados na plataforma.
    var htmlEscritoriosPlataforma = (!dados.usuario_admin || sessaoEhTenant) ? '' :
      '<section id="sec-escritorios-plataforma"><p class="section-label">Escritórios da plataforma</p>' +
        '<div class="panel">' +
          '<div class="panel-header"><span class="panel-title">Escritórios cadastrados</span></div>' +
          '<div id="escritorios-plataforma-lista"><div class="empty-state"><div class="msg">Carregando…</div></div></div>' +
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

    var TIPOS_COMPROMISSO = [
      ['audiencia', 'Audiência'], ['reuniao', 'Reunião'], ['atendimento', 'Atendimento'],
      ['prazo', 'Prazo'], ['visita', 'Visita'], ['administrativo', 'Administrativo'],
      ['pessoal', 'Pessoal'], ['outro', 'Outro'],
    ];

    var htmlAgendaCompleta = perms.indexOf('agenda') === -1 ? '' :
      '<section id="sec-agenda-completa">' +
        '<div class="procpage-dark">' +
          '<div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:14px;">' +
            '<h2 class="procpage-titulo" style="margin:0;">Agenda</h2>' +
            '<button type="button" class="procpage-btn procpage-btn-primary" id="ag-btn-novo">+ Novo compromisso</button>' +
          '</div>' +

          '<div class="procpage-filtros">' +
            '<div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">' +
              '<div class="subtabs">' +
                '<button type="button" class="subtab-btn ativo" data-ag-view="lista">Lista</button>' +
                '<button type="button" class="subtab-btn" data-ag-view="mensal">Mensal</button>' +
                '<button type="button" class="subtab-btn" data-ag-view="semanal">Semanal</button>' +
              '</div>' +
              '<select id="ag-filtro-tipo" style="padding:8px 10px; border-radius:7px; border:1px solid var(--line); background:var(--bg); color:var(--ink);">' +
                '<option value="">Todos os tipos</option>' +
                TIPOS_COMPROMISSO.map(function (t) { return '<option value="' + t[0] + '">' + t[1] + '</option>'; }).join('') +
              '</select>' +
              '<button type="button" class="procpage-btn" id="ag-btn-mais-filtros">☰ Mais filtros</button>' +
              '<button type="button" class="procpage-btn" id="ag-btn-atualizar" style="margin-left:auto;" title="Atualizar">⟳</button>' +
            '</div>' +
            '<div id="ag-mais-filtros" class="hidden" style="display:flex; gap:10px; flex-wrap:wrap; margin-top:10px;">' +
              '<select id="ag-filtro-responsavel" style="padding:8px 10px; border-radius:7px; border:1px solid var(--line); background:var(--bg); color:var(--ink);">' +
                '<option value="">Todos os responsáveis</option>' +
              '</select>' +
              '<select id="ag-filtro-vinculo" style="padding:8px 10px; border-radius:7px; border:1px solid var(--line); background:var(--bg); color:var(--ink);">' +
                '<option value="">Todos os vínculos</option><option value="com_processo">Com processo</option><option value="sem_processo">Sem processo</option>' +
              '</select>' +
            '</div>' +
          '</div>' +

          '<div id="ag-nav" class="hidden" style="display:flex; align-items:center; justify-content:center; gap:14px; margin:14px 0;">' +
            '<button type="button" class="procpage-btn" id="ag-nav-anterior">‹</button>' +
            '<strong id="ag-nav-titulo" style="color:var(--ink); font-size:14px; min-width:180px; text-align:center;">—</strong>' +
            '<button type="button" class="procpage-btn" id="ag-nav-hoje">Hoje</button>' +
            '<button type="button" class="procpage-btn" id="ag-nav-proximo">›</button>' +
          '</div>' +

          '<div id="ag-conteudo" style="margin-top:14px;"><div class="empty-state"><div class="msg" style="color:var(--ink-faint);">Carregando…</div></div></div>' +
        '</div>' +

        '<div id="modal-compromisso" class="modal-overlay hidden">' +
          '<div class="modal-drill-caixa" style="max-width:520px;">' +
            '<div class="modal-drill-cabecalho">' +
              '<span class="modal-drill-titulo" id="ag-modal-titulo">Novo compromisso</span>' +
              '<button type="button" class="modal-drill-fechar" id="ag-modal-fechar" aria-label="Fechar">✕</button>' +
            '</div>' +
            '<div style="padding:18px 20px; max-height:74vh; overflow-y:auto;">' +
              '<div id="ag-form-erro"></div>' +
              '<label>Título *</label>' +
              '<input type="text" id="ag-form-titulo" placeholder="Ex.: Dentista, Audiência de instrução..." style="width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid var(--line);border-radius:7px;font-size:13.5px;background:var(--bg);color:var(--ink);margin-bottom:14px;">' +
              '<div style="display:flex; gap:10px;">' +
                '<div style="flex:1;"><label>Tipo *</label>' +
                  '<select id="ag-form-tipo" style="width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid var(--line);border-radius:7px;font-size:13.5px;background:var(--bg);color:var(--ink);margin-bottom:14px;">' +
                    TIPOS_COMPROMISSO.map(function (t) { return '<option value="' + t[0] + '"' + (t[0] === 'reuniao' ? ' selected' : '') + '>' + t[1] + '</option>'; }).join('') +
                  '</select></div>' +
                '<div style="flex:1;"><label>Responsável</label>' +
                  '<select id="ag-form-responsavel" style="width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid var(--line);border-radius:7px;font-size:13.5px;background:var(--bg);color:var(--ink);margin-bottom:14px;">' +
                    '<option value="">Selecione</option>' +
                  '</select></div>' +
              '</div>' +
              '<label>Data e hora *</label>' +
              '<div style="display:flex; gap:8px; margin-bottom:6px;">' +
                '<input type="date" id="ag-form-data" style="flex:1;padding:9px 10px;border:1px solid var(--line);border-radius:7px;font-size:13.5px;background:var(--bg);color:var(--ink);">' +
                '<input type="time" id="ag-form-hora" style="flex:1;padding:9px 10px;border:1px solid var(--line);border-radius:7px;font-size:13.5px;background:var(--bg);color:var(--ink);">' +
                '<button type="button" id="ag-btn-agora" style="padding:9px 12px;border:1px solid var(--line);border-radius:7px;background:var(--surface-sunken);color:var(--ink-soft);font-size:12.5px;cursor:pointer;">Agora</button>' +
                '<button type="button" id="ag-btn-hoje" style="padding:9px 12px;border:1px solid var(--line);border-radius:7px;background:var(--surface-sunken);color:var(--ink-soft);font-size:12.5px;cursor:pointer;">Hoje</button>' +
              '</div>' +
              '<div style="display:flex; gap:10px; margin-bottom:14px;">' +
                '<div style="flex:1;"><label>Término</label>' +
                  '<input type="time" id="ag-form-hora-fim" style="width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid var(--line);border-radius:7px;font-size:13.5px;background:var(--bg);color:var(--ink);"></div>' +
                '<div style="flex:1;"><label>Repetir</label>' +
                  '<select id="ag-form-repetir" style="width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid var(--line);border-radius:7px;font-size:13.5px;background:var(--bg);color:var(--ink);">' +
                    '<option value="nao_repete">Não repetir</option><option value="diariamente">Diariamente</option>' +
                    '<option value="semanalmente">Semanalmente</option><option value="mensalmente">Mensalmente</option>' +
                  '</select></div>' +
              '</div>' +
              '<label>Local</label>' +
              '<input type="text" id="ag-form-local" placeholder="Fórum, escritório, online..." style="width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid var(--line);border-radius:7px;font-size:13.5px;background:var(--bg);color:var(--ink);margin-bottom:14px;">' +
              '<label style="display:flex; align-items:center; gap:8px; font-weight:400; margin-bottom:14px;">' +
                '<input type="checkbox" id="ag-form-meet" style="width:auto;"> Gerar link do Meet</label>' +
              '<label style="display:flex; align-items:center; gap:8px; font-weight:400; margin-bottom:18px;">' +
                '<input type="checkbox" id="ag-form-privado" style="width:auto;"> Marcar como compromisso privado</label>' +
              '<button type="button" id="ag-btn-mais-opcoes" style="background:none; border:none; color:var(--accent); font-size:12.5px; cursor:pointer; padding:0; margin-bottom:14px;">› Mais opções</button>' +
              '<div id="ag-mais-opcoes" class="hidden">' +
                '<label>Cliente</label>' +
                '<input type="text" id="ag-form-cliente" placeholder="Opcional" style="width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid var(--line);border-radius:7px;font-size:13.5px;background:var(--bg);color:var(--ink);margin-bottom:14px;">' +
                '<label>Processo</label>' +
                '<select id="ag-form-processo" style="width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid var(--line);border-radius:7px;font-size:13.5px;background:var(--bg);color:var(--ink);margin-bottom:14px;">' +
                  '<option value="">Nenhum</option>' +
                '</select>' +
                '<label>Descrição</label>' +
                '<textarea id="ag-form-descricao" rows="3" style="width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid var(--line);border-radius:7px;font-size:13.5px;font-family:inherit;background:var(--bg);color:var(--ink);resize:vertical;margin-bottom:14px;"></textarea>' +
              '</div>' +
              '<div id="ag-link-meet-resultado" class="hidden" style="font-size:12.5px; margin-bottom:14px;"></div>' +
              '<div style="display:flex; gap:8px; justify-content:flex-end;">' +
                '<button type="button" id="ag-btn-cancelar" style="padding:9px 16px;border:1px solid var(--line);border-radius:7px;background:var(--surface-sunken);color:var(--ink-soft);font-size:13px;cursor:pointer;">Cancelar</button>' +
                '<button type="button" id="ag-btn-salvar" style="padding:9px 16px;border:none;border-radius:7px;background:var(--accent);color:#fff;font-size:13px;font-weight:600;cursor:pointer;">Salvar</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</section>';

    function htmlFinEmBreve(mensagem) {
      return '<div class="fin-em-breve"><div class="glyph">em breve</div><div class="msg">' + esc(mensagem) + '</div></div>';
    }

    var htmlHonorariosContratos =
      '<div class="panel" style="margin-bottom:14px;">' +
        '<div class="panel-header"><span class="panel-title">Filtros</span></div>' +
        '<div style="padding:16px 20px; display:flex; gap:12px; flex-wrap:wrap; align-items:flex-end;">' +
          '<div style="min-width:180px;">' +
            '<label style="display:block; font-size:12px; font-weight:600; color:var(--ink-soft); margin-bottom:6px;">Processo</label>' +
            '<select id="honfiltro-processo" style="width:100%; box-sizing:border-box; padding:9px 10px; border:1px solid var(--line); border-radius:7px; font-size:13px; background:var(--bg); color:var(--ink); font-family:inherit;">' +
              '<option value="">Todos os processos</option>' +
            '</select>' +
          '</div>' +
          '<div style="min-width:180px;">' +
            '<label style="display:block; font-size:12px; font-weight:600; color:var(--ink-soft); margin-bottom:6px;">Cliente</label>' +
            '<select id="honfiltro-cliente" style="width:100%; box-sizing:border-box; padding:9px 10px; border:1px solid var(--line); border-radius:7px; font-size:13px; background:var(--bg); color:var(--ink); font-family:inherit;">' +
              '<option value="">Todos os clientes</option>' +
            '</select>' +
          '</div>' +
          '<div style="min-width:160px;">' +
            '<label style="display:block; font-size:12px; font-weight:600; color:var(--ink-soft); margin-bottom:6px;">Tipo</label>' +
            '<select id="honfiltro-tipo" style="width:100%; box-sizing:border-box; padding:9px 10px; border:1px solid var(--line); border-radius:7px; font-size:13px; background:var(--bg); color:var(--ink); font-family:inherit;">' +
              '<option value="">Todos os tipos</option>' +
              '<option value="fixo">Fixo</option>' +
              '<option value="exito">Êxito</option>' +
              '<option value="valor_exito">Valor + Êxito</option>' +
              '<option value="mensal">Mensal</option>' +
              '<option value="vinculado_processo">Vinculado ao processo</option>' +
            '</select>' +
          '</div>' +
          '<div style="min-width:150px;">' +
            '<label style="display:block; font-size:12px; font-weight:600; color:var(--ink-soft); margin-bottom:6px;">Status</label>' +
            '<select id="honfiltro-status" style="width:100%; box-sizing:border-box; padding:9px 10px; border:1px solid var(--line); border-radius:7px; font-size:13px; background:var(--bg); color:var(--ink); font-family:inherit;">' +
              '<option value="">Todos os status</option>' +
              '<option value="ativo">Ativo</option>' +
              '<option value="quitado">Quitado</option>' +
            '</select>' +
          '</div>' +
          '<button type="button" class="btn-conexao" id="honfiltro-buscar">Buscar</button>' +
          '<button type="button" class="btn-conexao-secundario" id="honfiltro-limpar">Limpar</button>' +
        '</div>' +
      '</div>' +
      '<div class="panel">' +
        '<div class="panel-header"><span class="panel-title">Contratos e honorários</span>' +
          '<button type="button" class="btn-conexao" id="btn-novo-contrato-honorarios">+ Novo contrato de honorários</button>' +
        '</div>' +
        '<div id="honorarios-contratos-lista"><div class="empty-state"><div class="msg">Carregando…</div></div></div>' +
      '</div>' +
      '<div class="panel" style="margin-top:14px;">' +
        '<div class="panel-header"><span class="panel-title">Honorários de Êxito — Estimativa × Realizado</span></div>' +
        '<div class="exito-estimativa-resumo" id="exito-estimativa-resumo"></div>' +
        '<div class="exito-estimativa-legend">' +
          '<span class="exec-legend-item"><span class="exec-legend-swatch" style="background:var(--accent);"></span>Estimado (em andamento)</span>' +
          '<span class="exec-legend-item"><span class="exec-legend-swatch" style="background:var(--warn);"></span>Apurado, a receber</span>' +
          '<span class="exec-legend-item"><span class="exec-legend-swatch" style="background:var(--good);"></span>Já recebido</span>' +
        '</div>' +
        '<div id="exito-estimativa-grafico"><div class="empty-state"><div class="msg">Carregando…</div></div></div>' +
      '</div>' +
      '<div class="modal-overlay hidden" id="modal-novo-contrato">' +
        '<div class="ncontrato-modal-caixa">' +
          '<h3>Novo contrato de honorários<button type="button" class="modal-drill-fechar" id="ncontrato-fechar">✕</button></h3>' +
          '<div class="ncontrato-campo">' +
            '<label for="ncontrato-processo">Processo (opcional — consultivo/mensal)</label>' +
            '<select id="ncontrato-processo"><option value="">Nenhum (contrato consultivo/mensal)</option></select>' +
          '</div>' +
          '<div class="ncontrato-campo">' +
            '<label for="ncontrato-cliente">Cliente *</label>' +
            '<select id="ncontrato-cliente"><option value="">Selecione o cliente</option></select>' +
          '</div>' +
          '<div class="ncontrato-campo">' +
            '<label for="ncontrato-tipo">Tipo</label>' +
            '<select id="ncontrato-tipo">' +
              '<option value="fixo">Fixo</option>' +
              '<option value="exito">Êxito</option>' +
              '<option value="valor_exito">Valor + Êxito</option>' +
              '<option value="mensal">Mensal</option>' +
              '<option value="vinculado_processo">Vinculado ao processo</option>' +
            '</select>' +
          '</div>' +
          '<div class="ncontrato-campo" id="ncontrato-campo-valor">' +
            '<label for="ncontrato-valor">Valor base (R$)</label>' +
            '<input type="text" id="ncontrato-valor" placeholder="0,00">' +
          '</div>' +
          '<div class="ncontrato-campo hidden" id="ncontrato-campo-percentual">' +
            '<label for="ncontrato-percentual">% de honorários de êxito</label>' +
            '<input type="number" step="0.01" min="0" max="100" id="ncontrato-percentual" placeholder="ex: 30">' +
          '</div>' +
          '<div class="ncontrato-campo hidden" id="ncontrato-campo-valor-causa">' +
            '<label for="ncontrato-valor-causa">Valor da causa (R$) — opcional</label>' +
            '<input type="text" id="ncontrato-valor-causa" placeholder="0,00">' +
          '</div>' +
          '<div class="ncontrato-linha2 hidden" id="ncontrato-linha-entrada">' +
            '<div class="ncontrato-campo">' +
              '<label for="ncontrato-valor-entrada">Valor de entrada (R$)</label>' +
              '<input type="text" id="ncontrato-valor-entrada" placeholder="0,00">' +
            '</div>' +
            '<div class="ncontrato-campo">' +
              '<label for="ncontrato-data-entrada">Data de pagamento da entrada</label>' +
              '<input type="date" id="ncontrato-data-entrada">' +
            '</div>' +
          '</div>' +
          '<div class="ncontrato-campo">' +
            '<label for="ncontrato-data-inicio">Data início</label>' +
            '<input type="date" id="ncontrato-data-inicio">' +
          '</div>' +
          '<div class="ncontrato-linha2" id="ncontrato-linha-parcelas">' +
            '<div class="ncontrato-campo">' +
              '<label for="ncontrato-parcelas">Nº de parcelas</label>' +
              '<input type="number" step="1" min="1" id="ncontrato-parcelas" value="1">' +
            '</div>' +
            '<div class="ncontrato-campo hidden" id="ncontrato-campo-periodicidade">' +
              '<label for="ncontrato-periodicidade">Periodicidade</label>' +
              '<select id="ncontrato-periodicidade">' +
                '<option value="Mensal">Mensal</option>' +
                '<option value="Quinzenal">Quinzenal</option>' +
                '<option value="Semanal">Semanal</option>' +
              '</select>' +
            '</div>' +
          '</div>' +
          '<div class="ncontrato-erro" id="ncontrato-erro"></div>' +
          '<div class="ncontrato-acoes">' +
            '<button type="button" class="btn-conexao-secundario" id="ncontrato-cancelar">Cancelar</button>' +
            '<button type="button" class="btn-conexao" id="ncontrato-salvar">Salvar</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="modal-overlay hidden" id="modal-editar-contrato">' +
        '<div class="ncontrato-modal-caixa">' +
          '<h3>Editar<button type="button" class="modal-drill-fechar" id="econtrato-fechar">✕</button></h3>' +
          '<div class="ncontrato-campo">' +
            '<label for="econtrato-cliente">Cliente *</label>' +
            '<input type="text" id="econtrato-cliente">' +
          '</div>' +
          '<div class="ncontrato-campo">' +
            '<label for="econtrato-servico">Serviço</label>' +
            '<input type="text" id="econtrato-servico">' +
          '</div>' +
          '<div class="ncontrato-campo hidden" id="econtrato-campo-status-contrato">' +
            '<label for="econtrato-status-contrato">Status</label>' +
            '<select id="econtrato-status-contrato">' +
              '<option value="Ativo">Ativo</option>' +
              '<option value="Cancelado">Cancelado</option>' +
            '</select>' +
          '</div>' +
          '<div class="ncontrato-linha2 hidden" id="econtrato-linha-exito">' +
            '<div class="ncontrato-campo">' +
              '<label for="econtrato-percentual">% de honorários de êxito</label>' +
              '<input type="number" step="0.01" min="0" max="100" id="econtrato-percentual">' +
            '</div>' +
            '<div class="ncontrato-campo">' +
              '<label for="econtrato-valor-recebido">Valor recebido pelo cliente (R$)</label>' +
              '<input type="text" id="econtrato-valor-recebido" placeholder="deixe em branco se ainda não recebeu">' +
            '</div>' +
          '</div>' +
          '<div class="ncontrato-linha2 hidden" id="econtrato-linha-exito-causa">' +
            '<div class="ncontrato-campo">' +
              '<label for="econtrato-valor-causa">Valor da causa (R$)</label>' +
              '<input type="text" id="econtrato-valor-causa" placeholder="opcional">' +
            '</div>' +
            '<div class="ncontrato-campo">' +
              '<label for="econtrato-valor-ganho-causa">Valor ganho na causa (R$)</label>' +
              '<input type="text" id="econtrato-valor-ganho-causa" placeholder="opcional">' +
            '</div>' +
          '</div>' +
          '<div class="ncontrato-linha2 hidden" id="econtrato-linha-exito-estimativa">' +
            '<div class="ncontrato-campo">' +
              '<label for="econtrato-valor-estimado">Estimativa de ganho (R$)</label>' +
              '<input type="text" id="econtrato-valor-estimado" placeholder="opcional, enquanto aguarda o resultado">' +
            '</div>' +
            '<div class="ncontrato-campo">' +
              '<label>Honorário estimado</label>' +
              '<div id="econtrato-honorario-estimado" style="padding:9px 10px; color:var(--ink-soft); font-size:13.5px;">—</div>' +
            '</div>' +
          '</div>' +
          '<div class="ncontrato-campo hidden" id="econtrato-campo-situacao">' +
            '<label for="econtrato-situacao">Situação</label>' +
            '<select id="econtrato-situacao">' +
              '<option value="Aguardando resultado">Aguardando resultado</option>' +
              '<option value="Recebido">Recebido</option>' +
              '<option value="Processo perdido">Processo perdido</option>' +
            '</select>' +
          '</div>' +
          '<div class="ncontrato-linha2 hidden" id="econtrato-linha-exito-recebimento">' +
            '<div class="ncontrato-campo">' +
              '<label for="econtrato-valor-ja-recebido">Valor já recebido por você (R$)</label>' +
              '<input type="text" id="econtrato-valor-ja-recebido" placeholder="0,00">' +
            '</div>' +
            '<div class="ncontrato-campo">' +
              '<label>Ainda a receber</label>' +
              '<div id="econtrato-a-receber-exito" style="padding:9px 10px; color:var(--ink-soft); font-size:13.5px;">—</div>' +
            '</div>' +
          '</div>' +
          '<div class="ncontrato-campo hidden" id="econtrato-campo-valores">' +
            '<label style="display:flex;align-items:center;gap:6px;font-weight:400;">' +
              '<input type="checkbox" id="econtrato-alterar-valores" style="width:auto;"> ' +
              'Também alterar valor total, entrada ou parcelas' +
            '</label>' +
            '<div class="ncontrato-aviso-valores" id="econtrato-aviso-sem-pagamento">' +
              'Só funciona se o contrato ainda não recebeu nada (nem entrada, nem parcela) -- ' +
              'senão os números ficariam desencontrados com o que já foi pago.' +
            '</div>' +
            '<div class="hidden" id="econtrato-subcampos-valores" style="margin-top:10px;display:flex;flex-direction:column;gap:10px;">' +
              '<div class="ncontrato-linha2">' +
                '<div class="ncontrato-campo"><label for="econtrato-valor-total">Valor total (R$)</label>' +
                  '<input type="text" id="econtrato-valor-total"></div>' +
                '<div class="ncontrato-campo"><label for="econtrato-valor-entrada">Entrada (R$)</label>' +
                  '<input type="text" id="econtrato-valor-entrada"></div>' +
              '</div>' +
              '<div class="ncontrato-linha2">' +
                '<div class="ncontrato-campo"><label for="econtrato-num-parcelas">Nº de parcelas</label>' +
                  '<input type="number" min="1" id="econtrato-num-parcelas"></div>' +
                '<div class="ncontrato-campo"><label for="econtrato-periodicidade">Periodicidade</label>' +
                  '<select id="econtrato-periodicidade"><option value="Mensal">Mensal</option>' +
                  '<option value="Quinzenal">Quinzenal</option><option value="Semanal">Semanal</option></select></div>' +
              '</div>' +
              '<div class="ncontrato-linha2">' +
                '<div class="ncontrato-campo"><label for="econtrato-data-inicio">Data de início do contrato</label>' +
                  '<input type="date" id="econtrato-data-inicio"></div>' +
                '<div class="ncontrato-campo"><label for="econtrato-data-entrada">Data de pagamento da entrada</label>' +
                  '<input type="date" id="econtrato-data-entrada"></div>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="ncontrato-erro" id="econtrato-erro"></div>' +
          '<div class="ncontrato-acoes">' +
            '<button type="button" class="btn-conexao-secundario" id="econtrato-cancelar">Cancelar</button>' +
            '<button type="button" class="btn-conexao" id="econtrato-salvar">Salvar</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '';

    // Fica FORA de qualquer fin-tab-panel de proposito -- e disparado a partir da aba "Contas
    // a receber", nao de "Honorarios e Contratos". Se ficasse dentro de um painel de aba
    // (como estava antes), o modal abria de verdade mas continuava invisivel enquanto aquele
    // painel estivesse com a classe "hidden" (display:none no ancestral esconde tudo dentro,
    // mesmo remove o "hidden" do proprio modal) -- so aparecia depois de trocar de aba pra
    // "Honorarios e Contratos" e o painel-pai ficar visivel (bug relatado pelo usuario).
    var htmlModalEditarParcela =
      '<div class="modal-overlay hidden" id="modal-editar-parcela">' +
        '<div class="ncontrato-modal-caixa">' +
          '<h3>Editar parcela<button type="button" class="modal-drill-fechar" id="eparcela-fechar">✕</button></h3>' +
          '<div class="ncontrato-campo">' +
            '<label for="eparcela-descricao">Descrição</label>' +
            '<input type="text" id="eparcela-descricao">' +
          '</div>' +
          '<div class="ncontrato-linha2">' +
            '<div class="ncontrato-campo">' +
              '<label for="eparcela-valor">Valor da parcela (R$)</label>' +
              '<input type="text" id="eparcela-valor">' +
            '</div>' +
            '<div class="ncontrato-campo">' +
              '<label for="eparcela-vencimento">Vencimento</label>' +
              '<input type="date" id="eparcela-vencimento">' +
            '</div>' +
          '</div>' +
          '<div class="ncontrato-erro" id="eparcela-erro"></div>' +
          '<div class="ncontrato-acoes">' +
            '<button type="button" class="btn-conexao-secundario" id="eparcela-cancelar">Cancelar</button>' +
            '<button type="button" class="btn-conexao" id="eparcela-salvar">Salvar</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    var htmlDespesasProcesso =
      '<div class="panel" style="margin-bottom:14px;">' +
        '<div class="panel-header"><span class="panel-title">Filtros</span></div>' +
        '<div style="padding:16px 20px; display:flex; gap:12px; flex-wrap:wrap; align-items:flex-end;">' +
          '<div style="min-width:200px;">' +
            '<label style="display:block; font-size:12px; font-weight:600; color:var(--ink-soft); margin-bottom:6px;">Processo</label>' +
            '<select id="despfiltro-processo" style="width:100%; box-sizing:border-box; padding:9px 10px; border:1px solid var(--line); border-radius:7px; font-size:13px; background:var(--bg); color:var(--ink); font-family:inherit;">' +
              '<option value="">Todos os processos</option>' +
            '</select>' +
          '</div>' +
          '<div style="min-width:160px;">' +
            '<label style="display:block; font-size:12px; font-weight:600; color:var(--ink-soft); margin-bottom:6px;">Tipo</label>' +
            '<select id="despfiltro-tipo" style="width:100%; box-sizing:border-box; padding:9px 10px; border:1px solid var(--line); border-radius:7px; font-size:13px; background:var(--bg); color:var(--ink); font-family:inherit;">' +
              '<option value="">Todos os tipos</option>' +
              '<option value="Custas">Custas</option>' +
              '<option value="Honorários de terceiros">Honorários de terceiros</option>' +
              '<option value="Outros">Outros</option>' +
            '</select>' +
          '</div>' +
          '<div style="min-width:150px;">' +
            '<label style="display:block; font-size:12px; font-weight:600; color:var(--ink-soft); margin-bottom:6px;">Data de</label>' +
            '<input type="date" id="despfiltro-data-de" style="width:100%; box-sizing:border-box; padding:8px 10px; border:1px solid var(--line); border-radius:7px; font-size:13px; background:var(--bg); color:var(--ink); font-family:inherit;">' +
          '</div>' +
          '<div style="min-width:150px;">' +
            '<label style="display:block; font-size:12px; font-weight:600; color:var(--ink-soft); margin-bottom:6px;">Data até</label>' +
            '<input type="date" id="despfiltro-data-ate" style="width:100%; box-sizing:border-box; padding:8px 10px; border:1px solid var(--line); border-radius:7px; font-size:13px; background:var(--bg); color:var(--ink); font-family:inherit;">' +
          '</div>' +
          '<button type="button" class="btn-conexao" id="despfiltro-buscar">Buscar</button>' +
          '<button type="button" class="btn-conexao-secundario" id="despfiltro-limpar">Limpar</button>' +
        '</div>' +
      '</div>' +
      '<div class="panel">' +
        '<div class="panel-header"><span class="panel-title">Despesas do processo</span>' +
          '<button type="button" class="btn-conexao" id="btn-nova-despesa">+ Nova despesa</button>' +
        '</div>' +
        '<div id="despesas-processo-lista"><div class="empty-state"><div class="msg">Carregando…</div></div></div>' +
      '</div>' +
      '<div class="modal-overlay hidden" id="modal-nova-despesa">' +
        '<div class="ncontrato-modal-caixa">' +
          '<h3 id="ndespesa-titulo">Nova despesa<button type="button" class="modal-drill-fechar" id="ndespesa-fechar">✕</button></h3>' +
          '<div class="ncontrato-campo">' +
            '<label for="ndespesa-processo">Processo *</label>' +
            '<select id="ndespesa-processo"><option value="">Selecione</option></select>' +
          '</div>' +
          '<div class="ncontrato-campo">' +
            '<label for="ndespesa-tipo">Tipo</label>' +
            '<select id="ndespesa-tipo">' +
              '<option value="Custas">Custas</option>' +
              '<option value="Honorários de terceiros">Honorários de terceiros</option>' +
              '<option value="Outros">Outros</option>' +
            '</select>' +
          '</div>' +
          '<div class="ncontrato-campo">' +
            '<label for="ndespesa-descricao">Descrição</label>' +
            '<input type="text" id="ndespesa-descricao">' +
          '</div>' +
          '<div class="ncontrato-linha2">' +
            '<div class="ncontrato-campo">' +
              '<label for="ndespesa-valor">Valor (R$)</label>' +
              '<input type="text" id="ndespesa-valor" placeholder="0,00">' +
            '</div>' +
            '<div class="ncontrato-campo">' +
              '<label for="ndespesa-data">Data</label>' +
              '<input type="date" id="ndespesa-data">' +
            '</div>' +
          '</div>' +
          '<div class="ncontrato-campo">' +
            '<label style="display:flex; align-items:center; gap:8px; font-weight:500;">' +
              '<input type="checkbox" id="ndespesa-reembolsavel" checked style="width:auto;"> Reembolsável pelo cliente' +
            '</label>' +
          '</div>' +
          '<div class="ncontrato-erro" id="ndespesa-erro"></div>' +
          '<div class="ncontrato-acoes">' +
            '<button type="button" class="btn-conexao-secundario" id="ndespesa-cancelar">Cancelar</button>' +
            '<button type="button" class="btn-conexao" id="ndespesa-salvar">Salvar</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    var htmlContasPagar =
      '<div style="display:flex; gap:14px; flex-wrap:wrap; margin-bottom:14px;">' +
        '<div class="stat-card"><div class="stat-value money" id="cpagar-total-pendente" style="color:var(--warn);">0,00</div><div class="stat-label">Total pendente</div></div>' +
        '<div class="stat-card"><div class="stat-value money" id="cpagar-total-pago" style="color:var(--good);">0,00</div><div class="stat-label">Total pago</div></div>' +
        '<div class="stat-card"><div class="stat-value money" id="cpagar-total-atraso" style="color:var(--crit);">0,00</div><div class="stat-label">Total em atraso</div></div>' +
      '</div>' +
      '<div class="panel" style="margin-bottom:14px;">' +
        '<div class="panel-header"><span class="panel-title">Filtros</span></div>' +
        '<div style="padding:16px 20px; display:flex; gap:12px; flex-wrap:wrap; align-items:flex-end;">' +
          '<div style="min-width:160px;">' +
            '<label style="display:block; font-size:12px; font-weight:600; color:var(--ink-soft); margin-bottom:6px;">Status</label>' +
            '<select id="cpagarfiltro-status" style="width:100%; box-sizing:border-box; padding:9px 10px; border:1px solid var(--line); border-radius:7px; font-size:13px; background:var(--bg); color:var(--ink); font-family:inherit;">' +
              '<option value="">Todos os status</option>' +
              '<option value="Aberta">Aberta</option>' +
              '<option value="Parcial">Parcial</option>' +
              '<option value="Paga">Paga</option>' +
              '<option value="Cancelada">Cancelada</option>' +
              '<option value="Vencida">Vencidas</option>' +
            '</select>' +
          '</div>' +
          '<div style="min-width:150px;">' +
            '<label style="display:block; font-size:12px; font-weight:600; color:var(--ink-soft); margin-bottom:6px;">Vencimento de</label>' +
            '<div style="display:flex; gap:6px;">' +
              '<input type="date" id="cpagarfiltro-data-de" style="width:100%; box-sizing:border-box; padding:8px 10px; border:1px solid var(--line); border-radius:7px; font-size:13px; background:var(--bg); color:var(--ink); font-family:inherit;">' +
              '<button type="button" class="btn-conexao-secundario" id="cpagarfiltro-data-de-hoje" style="padding:4px 10px; font-size:12.5px;">Hoje</button>' +
            '</div>' +
          '</div>' +
          '<div style="min-width:150px;">' +
            '<label style="display:block; font-size:12px; font-weight:600; color:var(--ink-soft); margin-bottom:6px;">Vencimento até</label>' +
            '<div style="display:flex; gap:6px;">' +
              '<input type="date" id="cpagarfiltro-data-ate" style="width:100%; box-sizing:border-box; padding:8px 10px; border:1px solid var(--line); border-radius:7px; font-size:13px; background:var(--bg); color:var(--ink); font-family:inherit;">' +
              '<button type="button" class="btn-conexao-secundario" id="cpagarfiltro-data-ate-hoje" style="padding:4px 10px; font-size:12.5px;">Hoje</button>' +
            '</div>' +
          '</div>' +
          '<div style="min-width:160px;">' +
            '<label style="display:block; font-size:12px; font-weight:600; color:var(--ink-soft); margin-bottom:6px;">Categoria</label>' +
            '<input type="text" id="cpagarfiltro-categoria" list="ncpagar-categoria-lista" placeholder="Buscar categoria" style="width:100%; box-sizing:border-box; padding:8px 10px; border:1px solid var(--line); border-radius:7px; font-size:13px; background:var(--bg); color:var(--ink); font-family:inherit;">' +
          '</div>' +
          '<button type="button" class="btn-conexao" id="cpagarfiltro-buscar">Buscar</button>' +
          '<button type="button" class="btn-conexao-secundario" id="cpagarfiltro-limpar">Limpar</button>' +
        '</div>' +
      '</div>' +
      '<div class="panel">' +
        '<div class="panel-header"><span class="panel-title">Contas a pagar</span>' +
          '<button type="button" class="btn-conexao" id="btn-nova-conta-pagar">+ Nova conta</button>' +
        '</div>' +
        '<div id="contas-pagar-lista"><div class="empty-state"><div class="msg">Carregando…</div></div></div>' +
      '</div>' +
      '<div class="modal-overlay hidden" id="modal-nova-conta-pagar">' +
        '<div class="ncontrato-modal-caixa">' +
          '<h3 id="ncpagar-titulo">Nova conta a pagar<button type="button" class="modal-drill-fechar" id="ncpagar-fechar">✕</button></h3>' +
          '<div class="ncontrato-campo">' +
            '<label for="ncpagar-descricao">Descrição *</label>' +
            '<input type="text" id="ncpagar-descricao">' +
          '</div>' +
          '<div class="ncontrato-campo">' +
            '<label for="ncpagar-categoria">Categoria</label>' +
            '<input type="text" id="ncpagar-categoria" list="ncpagar-categoria-lista" placeholder="ex: aluguel, internet, software">' +
            '<datalist id="ncpagar-categoria-lista">' +
              '<option value="Aluguel">' + '<option value="Internet">' + '<option value="Contador">' +
              '<option value="Software">' + '<option value="Taxas">' + '<option value="Energia">' + '<option value="Água">' +
            '</datalist>' +
          '</div>' +
          '<div class="ncontrato-campo">' +
            '<label for="ncpagar-valor">Valor (R$) *</label>' +
            '<input type="text" id="ncpagar-valor">' +
          '</div>' +
          '<div class="ncontrato-campo">' +
            '<label for="ncpagar-vencimento">Data vencimento *</label>' +
            '<div style="display:flex; gap:6px;">' +
              '<input type="date" id="ncpagar-vencimento" style="flex:1;">' +
              '<button type="button" class="btn-conexao-secundario" id="ncpagar-vencimento-hoje" style="padding:4px 10px; font-size:12.5px;">Hoje</button>' +
            '</div>' +
          '</div>' +
          '<div class="ncontrato-campo">' +
            '<label for="ncpagar-observacoes">Observações</label>' +
            '<textarea id="ncpagar-observacoes" rows="3" style="width:100%; box-sizing:border-box; padding:9px 10px; border:1px solid var(--line); border-radius:7px; font-size:13px; background:var(--bg); color:var(--ink); font-family:inherit; resize:vertical;"></textarea>' +
          '</div>' +
          '<div class="ncontrato-erro" id="ncpagar-erro"></div>' +
          '<div class="ncontrato-acoes">' +
            '<button type="button" class="btn-conexao-secundario" id="ncpagar-cancelar">Cancelar</button>' +
            '<button type="button" class="btn-conexao" id="ncpagar-salvar">Salvar</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="modal-overlay hidden" id="modal-pagar-conta-pagar">' +
        '<div class="ncontrato-modal-caixa">' +
          '<h3>Registrar pagamento<button type="button" class="modal-drill-fechar" id="pcpagar-fechar">✕</button></h3>' +
          '<div class="ncontrato-campo">' +
            '<label for="pcpagar-valor">Valor pago (R$)</label>' +
            '<input type="text" id="pcpagar-valor">' +
          '</div>' +
          '<div class="ncontrato-erro" id="pcpagar-erro"></div>' +
          '<div class="ncontrato-acoes">' +
            '<button type="button" class="btn-conexao-secundario" id="pcpagar-cancelar">Cancelar</button>' +
            '<button type="button" class="btn-conexao" id="pcpagar-salvar">Confirmar</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    var htmlContasRecorrentes =
      '<div class="panel" style="margin-bottom:14px;">' +
        '<div class="panel-header"><span class="panel-title">Filtros</span></div>' +
        '<div style="padding:16px 20px; display:flex; gap:12px; flex-wrap:wrap; align-items:flex-end;">' +
          '<div style="min-width:160px;">' +
            '<label style="display:block; font-size:12px; font-weight:600; color:var(--ink-soft); margin-bottom:6px;">Status</label>' +
            '<select id="crecfiltro-status" style="width:100%; box-sizing:border-box; padding:9px 10px; border:1px solid var(--line); border-radius:7px; font-size:13px; background:var(--bg); color:var(--ink); font-family:inherit;">' +
              '<option value="">Todos os status</option>' +
              '<option value="Ativa">Ativa</option>' +
              '<option value="Pausada">Pausada</option>' +
            '</select>' +
          '</div>' +
          '<div style="min-width:160px;">' +
            '<label style="display:block; font-size:12px; font-weight:600; color:var(--ink-soft); margin-bottom:6px;">Categoria</label>' +
            '<input type="text" id="crecfiltro-categoria" list="ncpagar-categoria-lista" placeholder="Buscar categoria" style="width:100%; box-sizing:border-box; padding:8px 10px; border:1px solid var(--line); border-radius:7px; font-size:13px; background:var(--bg); color:var(--ink); font-family:inherit;">' +
          '</div>' +
          '<button type="button" class="btn-conexao" id="crecfiltro-buscar">Buscar</button>' +
          '<button type="button" class="btn-conexao-secundario" id="crecfiltro-limpar">Limpar</button>' +
        '</div>' +
      '</div>' +
      '<div class="panel">' +
        '<div class="panel-header"><span class="panel-title">Contas recorrentes</span>' +
          '<button type="button" class="btn-conexao" id="btn-nova-conta-recorrente">+ Nova conta recorrente</button>' +
        '</div>' +
        '<div id="contas-recorrentes-lista"><div class="empty-state"><div class="msg">Carregando…</div></div></div>' +
      '</div>' +
      '<div class="modal-overlay hidden" id="modal-nova-conta-recorrente">' +
        '<div class="ncontrato-modal-caixa">' +
          '<h3 id="ncrec-titulo">Nova conta recorrente<button type="button" class="modal-drill-fechar" id="ncrec-fechar">✕</button></h3>' +
          '<div class="ncontrato-campo">' +
            '<label for="ncrec-descricao">Descrição *</label>' +
            '<input type="text" id="ncrec-descricao">' +
          '</div>' +
          '<div class="ncontrato-campo">' +
            '<label for="ncrec-categoria">Categoria</label>' +
            '<input type="text" id="ncrec-categoria" list="ncpagar-categoria-lista">' +
          '</div>' +
          '<div class="ncontrato-campo">' +
            '<label for="ncrec-valor">Valor (R$) *</label>' +
            '<input type="text" id="ncrec-valor">' +
          '</div>' +
          '<div class="ncontrato-campo">' +
            '<label for="ncrec-periodicidade">Periodicidade *</label>' +
            '<select id="ncrec-periodicidade">' +
              '<option value="Semanal">Semanal</option>' +
              '<option value="Quinzenal">Quinzenal</option>' +
              '<option value="Mensal" selected>Mensal</option>' +
              '<option value="Anual">Anual</option>' +
            '</select>' +
          '</div>' +
          '<div class="ncontrato-campo">' +
            '<label for="ncrec-dia-vencimento">Dia do vencimento (1-31) *</label>' +
            '<input type="number" step="1" min="1" max="31" id="ncrec-dia-vencimento">' +
          '</div>' +
          '<div class="ncontrato-campo">' +
            '<label for="ncrec-data-inicio">Data início *</label>' +
            '<div style="display:flex; gap:6px;">' +
              '<input type="date" id="ncrec-data-inicio" style="flex:1;">' +
              '<button type="button" class="btn-conexao-secundario" id="ncrec-data-inicio-hoje" style="padding:4px 10px; font-size:12.5px;">Hoje</button>' +
            '</div>' +
          '</div>' +
          '<div class="ncontrato-campo">' +
            '<label for="ncrec-data-termino">Data término (opcional)</label>' +
            '<div style="display:flex; gap:6px;">' +
              '<input type="date" id="ncrec-data-termino" style="flex:1;">' +
              '<button type="button" class="btn-conexao-secundario" id="ncrec-data-termino-hoje" style="padding:4px 10px; font-size:12.5px;">Hoje</button>' +
            '</div>' +
          '</div>' +
          '<div class="ncontrato-campo">' +
            '<label for="ncrec-forma-pagamento">Forma de pagamento padrão</label>' +
            '<select id="ncrec-forma-pagamento">' +
              '<option value="">Selecione</option>' +
              '<option value="Pix">Pix</option>' +
              '<option value="Boleto">Boleto</option>' +
              '<option value="Cartão de crédito">Cartão de crédito</option>' +
              '<option value="Transferência">Transferência</option>' +
              '<option value="Débito automático">Débito automático</option>' +
            '</select>' +
          '</div>' +
          '<div class="ncontrato-campo">' +
            '<label for="ncrec-status">Status</label>' +
            '<select id="ncrec-status">' +
              '<option value="Ativa">Ativa</option>' +
              '<option value="Pausada">Pausada</option>' +
            '</select>' +
          '</div>' +
          '<div class="ncontrato-erro" id="ncrec-erro"></div>' +
          '<div class="ncontrato-acoes">' +
            '<button type="button" class="btn-conexao-secundario" id="ncrec-cancelar">Cancelar</button>' +
            '<button type="button" class="btn-conexao" id="ncrec-salvar">Salvar</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    var ICONE_EXEC_SALDO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><path d="M16 12h.01"></path><path d="M3 9h18"></path></svg>';
    var ICONE_EXEC_A_PAGAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 17 17 7"></path><path d="M8 7h9v9"></path></svg>';
    var ICONE_EXEC_RECORRENTE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M17 2 21 6 17 10"></path><path d="M3 12v-2a4 4 0 0 1 4-4h14"></path><path d="M7 22 3 18 7 14"></path><path d="M21 12v2a4 4 0 0 1-4 4H3"></path></svg>';
    var ICONE_EXEC_CONTRATO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 2h6l5 5v13a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"></path><path d="M15 2v5h5"></path></svg>';
    var ICONE_EXEC_RECEBIDO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"></circle><path d="m8 12 3 3 5-6"></path></svg>';
    var ICONE_EXEC_PENDENTE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3.5 2"></path></svg>';
    var ICONE_EXEC_ATRASO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 9v4"></path><path d="M10.3 3.9 1.8 18a1.5 1.5 0 0 0 1.3 2.2h17.8a1.5 1.5 0 0 0 1.3-2.2L13.7 3.9a1.5 1.5 0 0 0-2.6 0z"></path><path d="M12 16h.01"></path></svg>';
    var ICONE_EXEC_ATIVOS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="7" width="18" height="13" rx="2"></rect><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
    var ICONE_EXEC_PROJETADO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 17 9 11 13 15 21 7"></path><path d="M15 7h6v6"></path></svg>';

    function execStatCard(opts) {
      var corValor = opts.cor ? (' style="color:' + opts.cor + ';"') : '';
      var money = opts.money !== false ? ' money' : '';
      return '<div class="exec-stat-card">' +
        '<div class="exec-stat-top"><span class="exec-stat-label">' + esc(opts.label) + '</span>' +
          '<span class="exec-stat-icon">' + opts.icone + '</span></div>' +
        '<div class="exec-stat-value' + money + '" id="' + opts.id + '"' + corValor + '>0,00</div>' +
        '<div class="exec-stat-foot" id="' + opts.idSub + '">' + esc(opts.subInicial || '—') + '</div>' +
      '</div>';
    }

    var htmlPainelExecutivo =
      '<section id="sec-painel-executivo" style="margin-top:28px;">' +
        '<p class="section-label">Painel Executivo</p>' +
        '<div class="exec-stat-grid">' +
          execStatCard({ id: 'exec-kpi-saldo', idSub: 'exec-kpi-saldo-sub', label: 'Saldo do mês', icone: ICONE_EXEC_SALDO }) +
          execStatCard({ id: 'exec-kpi-projetado-90d', idSub: 'exec-kpi-projetado-90d-sub', label: 'Previsto (90 dias)', icone: ICONE_EXEC_PROJETADO, cor: 'var(--accent)' }) +
          execStatCard({ id: 'exec-kpi-pendente', idSub: 'exec-kpi-pendente-sub', label: 'A receber previsto', icone: ICONE_EXEC_PENDENTE, subInicial: 'pelo vencimento' }) +
          execStatCard({ id: 'exec-kpi-a-pagar', idSub: 'exec-kpi-vencido-sub', label: 'A pagar previsto', icone: ICONE_EXEC_A_PAGAR }) +
          execStatCard({ id: 'exec-kpi-atraso', idSub: 'exec-kpi-atraso-sub', label: 'Em atraso', icone: ICONE_EXEC_ATRASO, cor: 'var(--crit)' }) +
          execStatCard({ id: 'exec-kpi-contratos-ativos', idSub: 'exec-kpi-contratos-ativos-sub', label: 'Contratos ativos', icone: ICONE_EXEC_ATIVOS, money: false, subInicial: 'em andamento agora' }) +
        '</div>' +
        '<p class="exec-card-sub" style="margin:16px 0 8px;">Honorários e Contratos</p>' +
        '<div class="exec-stat-grid exec-stat-grid-secundaria">' +
          execStatCard({ id: 'exec-kpi-valor-total', idSub: 'exec-kpi-valor-total-sub', label: 'Valor total de contratos', icone: ICONE_EXEC_CONTRATO, subInicial: 'fechados até hoje' }) +
          execStatCard({ id: 'exec-kpi-recebido', idSub: 'exec-kpi-recebido-sub', label: 'Total recebido', icone: ICONE_EXEC_RECEBIDO, cor: 'var(--good)', subInicial: 'entradas + parcelas pagas' }) +
          execStatCard({ id: 'exec-kpi-recorrentes', idSub: 'exec-kpi-comprometido-sub', label: 'Contas recorrentes ativas', icone: ICONE_EXEC_RECORRENTE, money: false }) +
        '</div>' +
        '<div class="exec-card exec-card-grafico-principal">' +
          '<div class="exec-card-titulo-row">' +
            '<div><div class="exec-card-titulo exec-card-titulo-icone">' + ICONE_TENDENCIA_ALTA + '<span>Histórico de Fluxo Financeiro</span></div>' +
              '<div class="exec-card-sub" id="exec-grafico-periodo-label">Últimos 12 meses + próximos 6 (previsão)</div></div>' +
            '<div class="fluxo-filtros" id="exec-periodo-filtros">' +
              '<button type="button" class="exec-periodo-btn" data-meses="1">1M</button>' +
              '<button type="button" class="exec-periodo-btn" data-meses="3">3M</button>' +
              '<button type="button" class="exec-periodo-btn" data-meses="6">6M</button>' +
              '<button type="button" class="exec-periodo-btn ativo" data-meses="12">12M</button>' +
              '<button type="button" class="exec-periodo-btn" data-meses="24">24M</button>' +
            '</div>' +
          '</div>' +
          '<div class="exec-legend-simples">' +
            '<span class="exec-legend-item"><span class="exec-legend-swatch" style="background:var(--chart-receita);"></span>Receita</span>' +
            '<span class="exec-legend-item"><span class="exec-legend-swatch" style="background:var(--chart-despesa);"></span>Despesa</span>' +
            '<span class="exec-legend-item"><span class="exec-legend-swatch" style="background:var(--accent);"></span>Saldo</span>' +
          '</div>' +
          '<div class="exec-acumulado" id="exec-acumulado"></div>' +
          '<div class="exec-marco-linha" id="exec-marco-linha"></div>' +
          '<div class="exec-svg-wrap" id="exec-grafico-svg"><div class="empty-state"><div class="msg">Carregando…</div></div></div>' +
          '<div id="exec-nota-sem-data" class="exec-nota hidden"></div>' +
        '</div>' +
        '<div class="exec-grid">' +
          '<div class="exec-card">' +
            '<div class="exec-card-titulo">Despesas por categoria</div>' +
            '<div class="exec-card-sub" id="exec-categorias-periodo-label">Últimos 12 meses</div>' +
            '<div id="exec-categorias-lista"><div class="empty-state"><div class="msg">Carregando…</div></div></div>' +
          '</div>' +
          '<div class="exec-card exec-visao-geral">' +
            '<div class="exec-vg-orbita" aria-hidden="true">' +
              '<svg viewBox="0 0 200 200">' +
                '<circle cx="100" cy="100" r="70" fill="none" stroke="var(--accent)" stroke-width="1" opacity="0.35"/>' +
                '<circle cx="100" cy="100" r="46" fill="none" stroke="var(--accent)" stroke-width="1" opacity="0.5" stroke-dasharray="2 5"/>' +
                '<circle cx="100" cy="100" r="20" fill="var(--accent)" opacity="0.18"/>' +
                '<circle cx="100" cy="100" r="6" fill="var(--accent)" style="filter:drop-shadow(0 0 8px var(--accent));"/>' +
              '</svg>' +
            '</div>' +
            '<div class="exec-card-titulo">Visão Geral</div>' +
            '<div class="exec-card-sub">Seu desempenho financeiro em um só lugar</div>' +
            '<div id="exec-visao-geral-corpo"></div>' +
          '</div>' +
        '</div>' +
        '<div class="exec-horizontes-cabecalho" style="margin-top:20px;">' +
          '<p class="section-label" style="margin-bottom:2px;">Horizontes estratégicos de fluxo de caixa</p>' +
          '<span class="exec-card-sub">Baseado no que já está agendado -- contas a pagar e parcelas a receber pelo vencimento</span>' +
        '</div>' +
        '<div class="exec-horizontes-grid" id="exec-horizontes"></div>' +
        '<div class="exec-insights-grid" id="exec-insights"></div>' +
        '<div class="panel" style="margin-top:16px;">' +
          '<div class="panel-header"><span class="panel-title">Próximos vencimentos</span></div>' +
          '<div id="exec-proximos-lista"><div class="empty-state"><div class="msg">Carregando…</div></div></div>' +
        '</div>' +
      '</section>';

    var htmlFinanceiroNovo =
      '<section id="sec-financeiro-novo">' +
        '<p class="section-label">Financeiro</p>' +
        '<div class="subtabs" role="tablist" style="margin-bottom:16px; flex-wrap:wrap;">' +
          '<button type="button" class="subtab-btn ativo" data-fin-tab="dashboard">Dashboard</button>' +
          '<button type="button" class="subtab-btn" data-fin-tab="contratos">Honorários e Contratos</button>' +
          '<button type="button" class="subtab-btn" data-fin-tab="receber">Contas a receber</button>' +
          '<button type="button" class="subtab-btn" data-fin-tab="despesas">Despesas do Processo</button>' +
          '<button type="button" class="subtab-btn" data-fin-tab="pagar">Contas a pagar</button>' +
          '<button type="button" class="subtab-btn" data-fin-tab="recorrentes">Contas recorrentes</button>' +
        '</div>' +
        // htmlFinanceiro (Visao Financeira antiga) e htmlExito (Casos cadastrados + "Registrar
        // valor recebido pelo cliente") NAO entram mais aqui -- o Painel Executivo cobre a
        // Visao Financeira, e a aba "Honorarios e Contratos" (Editar/Excluir de verdade) ja
        // cobre os casos de exito, com filtro. Ambos continuam calculados (variaveis
        // compartilhadas com outras funcoes), so nao sao mais renderizados nesta aba.
        '<div class="fin-tab-panel" data-fin-panel="dashboard">' + htmlPainelExecutivo + '</div>' +
        '<div class="fin-tab-panel hidden" data-fin-panel="contratos">' + htmlHonorariosContratos + '</div>' +
        '<div class="fin-tab-panel hidden" data-fin-panel="receber">' +
          '<div class="panel">' +
            '<div class="panel-header"><span class="panel-title">Contas a receber</span></div>' +
            '<div id="financeiro-parcelas-lista"><div class="empty-state"><div class="msg">Carregando…</div></div></div>' +
          '</div>' +
        '</div>' +
        '<div class="fin-tab-panel hidden" data-fin-panel="despesas">' + htmlDespesasProcesso + '</div>' +
        '<div class="fin-tab-panel hidden" data-fin-panel="pagar">' + htmlContasPagar + '</div>' +
        '<div class="fin-tab-panel hidden" data-fin-panel="recorrentes">' + htmlContasRecorrentes + '</div>' +
        htmlModalEditarParcela +
      '</section>';

    // cada pagina mostra so a area que e dela -- PAGINA_ATUAL e definido inline em cada HTML
    // (painel-financeiro-antigo.html = 'financeiro_antigo', painel-pje.html = 'pje', etc.). Tudo acima continua calculado
    // do mesmo jeito de sempre (nao muda a logica de nenhuma secao), so a montagem final escolhe
    // o que realmente entra na pagina.
    var MAPA_CONTEUDO_POR_PAGINA = {
      inicio: htmlInicio,
      // O Financeiro antigo (dashboard/fluxo de caixa) foi descontinuado -- ja existe uma
      // versao melhor em painel.html (financeiro_novo, com Painel Executivo). Notificacao
      // Extrajudicial e Clientes da planilha continuam aqui, sao features proprias, nao parte
      // do dashboard antigo.
      financeiro_antigo: htmlNotificacaoExtrajudicial + htmlCadastroCliente,
      financeiro_novo: htmlFinanceiroNovo,
      pje: htmlPje,
      clientes: htmlClientes,
      ficha_processos: htmlProcessos,
      processo_administrativo: htmlProcessoAdministrativo,
      importar_oab: htmlImportarOab,
      criar_processo: htmlCriarProcesso,
      novo_cliente: htmlNovoCliente,
      prazos: htmlPrazos,
      tarefas: htmlTarefas,
      agenda_completa: htmlAgendaCompleta,
      automacoes_gerais: htmlPropostas + htmlAutomacoes,
      procuracao_contrato: htmlContrato,
      padrao_operacional: htmlPadraoOperacional,
      audiencias: htmlAudiencias,
      admin: htmlConexoes + htmlEscritoriosPlataforma,
      configuracoes: htmlConfiguracoes,
      triagem_trabalhista: htmlTriagemDashboard,
      criar_triagem: htmlCriarTriagem,
    };
    var MAPA_PERMISSAO_POR_PAGINA = {
      financeiro_antigo: 'financeiro', financeiro_novo: 'financeiro', pje: 'pje', clientes: 'clientes', ficha_processos: 'processos',
      processo_administrativo: 'processos',
      importar_oab: 'processos', criar_processo: 'processos', novo_cliente: 'clientes', prazos: 'processos',
      tarefas: 'agenda', agenda_completa: 'agenda', automacoes_gerais: 'automacoes', procuracao_contrato: 'automacoes', padrao_operacional: 'padrao_operacional',
      audiencias: 'audiencias', admin: null, configuracoes: null,
      triagem_trabalhista: 'processos', criar_triagem: 'processos',
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
        '<div class="masthead-name">' +
          '<img class="masthead-logo masthead-logo-dark" src="/logo-vero-juridico.png" alt="Vero Jurídico">' +
          '<img class="masthead-logo masthead-logo-light" src="/logo-vero-juridico-branca.png" alt="Vero Jurídico">' +
          '<small>Painel do escritório</small>' +
        '</div>' +
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
    if (navAdminEl) {
      navAdminEl.classList.toggle('hidden', !dados.usuario_admin);
      // pra voce (Cesar), o mesmo link do menu leva pra "Escritorios da plataforma" em vez de
      // "Conexoes" (que so faz sentido pra outro tenant conectar o proprio WhatsApp/Asaas) --
      // troca so o texto visivel, o href continua o mesmo (painel-admin.html#sec-admin).
      if (!sessaoEhTenant) {
        var textoNavAdmin = navAdminEl.childNodes[navAdminEl.childNodes.length - 1];
        if (textoNavAdmin && textoNavAdmin.nodeType === 3) textoNavAdmin.textContent = 'Escritórios';
      }
    }
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

    if (document.getElementById('hdr-btn-avisos')) carregarAvisosHeader();
    if (document.getElementById('hdr-busca-input')) wireBuscaTopo();

    if (!temAcessoPagina) return;

    if (PAGINA_ATUAL === 'automacoes_gerais') { wireAutomacoes(); }
    if (PAGINA_ATUAL === 'procuracao_contrato') { wireAutomacoes(); wireContrato(); wireAssinaturaDireta(); }
    if (PAGINA_ATUAL === 'tarefas') { wireListaTarefas(); }
    if (PAGINA_ATUAL === 'agenda_completa') { wireAgendaCompleta(); }
    if (PAGINA_ATUAL === 'financeiro_antigo') { wireCobranca(); wireOlhinhos(dados); wireNotificacaoExtrajudicial(); wireVisaoFinanceira(); wireDevedoresMes(); carregarListaClientesFinanceiro(); wireFormExito(); }
    if (PAGINA_ATUAL === 'financeiro_novo') {
      wireFinTabs(); wireCobranca(); wireOlhinhos(dados); wireVisaoFinanceira(); wireDevedoresMes(); wireFormExito();
      carregarHonorariosContratos(); wireNovoContratoModal(); wireEditarContratoModal(); wireFiltroHonorarios();
      wireEditarParcelaModal(); carregarParcelasAReceber();
      wireFiltroDespesas(); wireNovaDespesaModal(); carregarDespesasProcesso();
      wireFiltroContasPagar(); wireNovaContaPagarModal(); wirePagarContaPagarModal(); carregarContasPagar();
      wireFiltroContasRecorrentes(); wireNovaContaRecorrenteModal(); carregarContasRecorrentes();
      wireExecPeriodoFiltros(); carregarPainelExecutivo();
    }
    if (PAGINA_ATUAL === 'ficha_processos') { wireProcessosHub(); }
    if (PAGINA_ATUAL === 'triagem_trabalhista') { wireTriagemDashboard(); carregarTriagens(); }
    if (PAGINA_ATUAL === 'criar_triagem') { wireTriagemWizard(); }
    if (PAGINA_ATUAL === 'processo_administrativo') { wireProcessosAdministrativos(); }
    if (PAGINA_ATUAL === 'importar_oab') { wireImportarOab(dados); }
    if (PAGINA_ATUAL === 'criar_processo') { wireProcessoManual(); }
    if (PAGINA_ATUAL === 'novo_cliente') { wireNovoCliente(); }
    if (PAGINA_ATUAL === 'prazos') { wireListaPrazos(); }
    if (PAGINA_ATUAL === 'clientes') { carregarClientes(); carregarClientesCadastrados(); }
    if (PAGINA_ATUAL === 'padrao_operacional') carregarPadraoOperacional();
    if (PAGINA_ATUAL === 'audiencias') { wireAudienciasSubtabs(); wireUploadAudiencia(); wireAudienciaAoVivo(); carregarAudiencias(); carregarPautaAudiencias(); }
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
      if (document.getElementById('sec-escritorios-plataforma')) carregarEscritoriosPlataforma();
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
        container.innerHTML = '<div class="table-scroll"><table class="aviso-tabela">' +
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
            confirmarModal('Excluir este aviso?').then(function (ok) {
              if (!ok) return;
              apiPost('/api/painel?acao=aviso_excluir', { id: btn.getAttribute('data-aviso-excluir') }).then(carregarAvisos);
            });
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
      container.innerHTML = '<div class="table-scroll"><table>' +
        '<thead><tr><th>Data/Hora</th><th>Usuário</th><th>Ação</th><th>Entidade</th><th>Detalhes</th></tr></thead>' +
        '<tbody>' + d.registros.map(function (r) {
          return '<tr><td>' + fmtDataHora(r.criado_em) + '</td><td>' + esc(r.usuario || '—') + '</td>' +
            '<td>' + esc(r.acao) + '</td><td>' + esc(r.entidade) + (r.entidade_id ? ' #' + esc(r.entidade_id) : '') + '</td>' +
            '<td>' + esc(r.detalhes || '') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    });
  }

  function carregarEscritoriosPlataforma() {
    var container = document.getElementById('escritorios-plataforma-lista');
    if (!container) return;
    apiGetJson('/api/painel?acao=plataforma_tenants_listar')
      .then(function (dados) {
        var lista = dados.tenants || [];
        if (lista.length === 0) {
          container.innerHTML = '<div class="empty-state"><div class="msg">Nenhum outro escritório cadastrado ainda.</div></div>';
          return;
        }
        var catalogoPlanos = dados.planos || [];
        container.innerHTML = '<div class="table-scroll"><table>' +
          '<thead><tr><th>Escritório</th><th>Advogado</th><th>OAB</th><th>Conexões</th><th>Plano</th><th>Status</th><th>Ações</th></tr></thead>' +
          '<tbody>' + lista.map(function (t) {
            var conexoes = [
              t.google_conectado ? 'Google' : null,
              t.whatsapp_conectado ? 'WhatsApp' : null,
              t.asaas_conectado ? 'Asaas' : null,
            ].filter(Boolean);
            var chipsPorStatus = {
              ativo: '<span class="chip good">Ativo</span>',
              suspenso: '<span class="chip crit">Suspenso</span>',
              excluido: '<span class="chip neutral">Excluído' + (t.excluido_em ? ' em ' + fmtDataCurta(t.excluido_em) : '') + '</span>',
            };
            var chipStatus = chipsPorStatus[t.status] || chipsPorStatus.ativo;
            var nomeExibicao = t.nome_escritorio || t.tenant_id;

            var selectPlano = '<select data-tenant-plano="' + esc(t.tenant_id) + '" style="font-size:12.5px; padding:4px 6px; border-radius:6px; border:1px solid var(--line); background:var(--bg); color:var(--ink);">' +
              catalogoPlanos.map(function (p) {
                return '<option value="' + esc(p.chave) + '"' + (p.chave === t.plano ? ' selected' : '') + '>' +
                  esc(p.nome) + ' (' + p.max_usuarios + ' usuário(s), ' + p.max_processos + ' processos)</option>';
              }).join('') + '</select>';

            var acoesHtml;
            if (t.status === 'excluido') {
              acoesHtml =
                '<button type="button" class="btn-editar" data-tenant-restaurar="' + esc(t.tenant_id) + '">Restaurar</button> ' +
                '<button type="button" class="btn-remover" data-tenant-apagar="' + esc(t.tenant_id) + '" data-tenant-apagar-nome="' + esc(nomeExibicao) + '">Apagar definitivamente</button>';
            } else {
              var suspenso = t.status === 'suspenso';
              acoesHtml =
                '<button type="button" class="btn-editar" data-tenant-status="' + esc(t.tenant_id) + '" data-status-alvo="' + (suspenso ? 'ativo' : 'suspenso') + '">' +
                  (suspenso ? 'Reativar' : 'Suspender') + '</button> ' +
                '<button type="button" class="btn-remover" data-tenant-excluir="' + esc(t.tenant_id) + '" data-tenant-nome="' + esc(nomeExibicao) + '">Excluir</button>';
            }

            return '<tr><td>' + esc(t.nome_escritorio || '—') + '</td>' +
              '<td>' + esc(t.nome_advogado || '—') + '</td>' +
              '<td>' + esc((t.oab_numero || '—') + (t.oab_uf ? '/' + t.oab_uf : '')) + '</td>' +
              '<td>' + (conexoes.length ? conexoes.map(function (c) { return '<span class="chip neutral">' + c + '</span>'; }).join(' ') : '—') + '</td>' +
              '<td>' + selectPlano + '</td>' +
              '<td>' + chipStatus + '</td>' +
              '<td><div style="display:flex; flex-wrap:wrap; gap:6px;">' + acoesHtml + '</div></td></tr>';
          }).join('') + '</tbody></table></div>';

        container.querySelectorAll('[data-tenant-plano]').forEach(function (select) {
          select.addEventListener('change', function () {
            var tenantId = select.getAttribute('data-tenant-plano');
            select.disabled = true;
            apiPostJson('/api/painel?acao=plataforma_tenant_plano', { tenant_id: tenantId, plano: select.value })
              .catch(function (e) {
                mostrarAviso(e.message || 'Não foi possível trocar o plano agora.');
              })
              .finally(function () { select.disabled = false; });
          });
        });

        container.querySelectorAll('[data-tenant-status]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var statusAlvo = btn.getAttribute('data-status-alvo');
            var acaoTexto = statusAlvo === 'suspenso' ? 'Suspender' : 'Reativar';
            confirmarModal(
              (statusAlvo === 'suspenso'
                ? 'Suspender este escritório? Ele deixa de conseguir fazer login imediatamente, mas nenhum dado é apagado.'
                : 'Reativar este escritório? Ele volta a conseguir fazer login normalmente.'),
              { perigo: statusAlvo === 'suspenso', textoOk: acaoTexto }
            ).then(function (ok) {
              if (!ok) return;
              btn.disabled = true;
              apiPostJson('/api/painel?acao=plataforma_tenant_status', { tenant_id: btn.getAttribute('data-tenant-status'), status: statusAlvo })
                .then(carregarEscritoriosPlataforma)
                .catch(function (e) {
                  btn.disabled = false;
                  mostrarAviso(e.message || 'Não foi possível atualizar o status agora.');
                });
            });
          });
        });
        // "Excluir" = exclusao reversivel (soft delete, igual Google Workspace/GitHub/AWS): bloqueia
        // o acesso na hora, mas nao apaga nada -- fica em "Excluído", com "Restaurar" disponivel.
        container.querySelectorAll('[data-tenant-excluir]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var nome = btn.getAttribute('data-tenant-nome');
            confirmarModal('Excluir o escritório "' + nome + '" da plataforma? Ele perde o acesso imediatamente, mas o cadastro fica guardado — dá pra restaurar depois, se precisar.', { textoOk: 'Excluir' }).then(function (ok) {
              if (!ok) return;
              btn.disabled = true;
              apiPostJson('/api/painel?acao=plataforma_tenant_status', { tenant_id: btn.getAttribute('data-tenant-excluir'), status: 'excluido' })
                .then(carregarEscritoriosPlataforma)
                .catch(function (e) {
                  btn.disabled = false;
                  mostrarAviso(e.message || 'Não foi possível excluir agora.');
                });
            });
          });
        });
        container.querySelectorAll('[data-tenant-restaurar]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            confirmarModal('Restaurar este escritório? Ele volta a conseguir fazer login normalmente.', { perigo: false, textoOk: 'Restaurar' }).then(function (ok) {
              if (!ok) return;
              btn.disabled = true;
              apiPostJson('/api/painel?acao=plataforma_tenant_status', { tenant_id: btn.getAttribute('data-tenant-restaurar'), status: 'ativo' })
                .then(carregarEscritoriosPlataforma)
                .catch(function (e) {
                  btn.disabled = false;
                  mostrarAviso(e.message || 'Não foi possível restaurar agora.');
                });
            });
          });
        });
        // "Apagar definitivamente" = sem volta -- so aparece pra quem ja esta excluido, e exige
        // digitar o nome do escritorio pra confirmar (mesmo padrao do GitHub/AWS).
        container.querySelectorAll('[data-tenant-apagar]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var nome = btn.getAttribute('data-tenant-apagar-nome');
            confirmarDigitando(
              'Isso apaga o cadastro de "' + nome + '" pra sempre — não dá mais pra restaurar. ' +
              'Dados que já foram gravados em nome dele (contratos, processos, arquivos no Drive) não são apagados por essa ação, só o acesso/cadastro. ' +
              'Digite o nome do escritório exatamente como mostrado (' + nome + ') pra confirmar.',
              nome,
              { titulo: 'Apagar definitivamente' }
            ).then(function (ok) {
              if (!ok) return;
              btn.disabled = true;
              apiPostJson('/api/painel?acao=plataforma_tenant_excluir', { tenant_id: btn.getAttribute('data-tenant-apagar'), confirmacao: nome })
                .then(carregarEscritoriosPlataforma)
                .catch(function (e) {
                  btn.disabled = false;
                  mostrarAviso(e.message || 'Não foi possível apagar agora.');
                });
            });
          });
        });
      })
      .catch(function () {
        container.innerHTML = '<div class="empty-state"><div class="msg">Não foi possível carregar os escritórios agora.</div></div>';
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
          var avisoWebhook = '';
          if (dados.webhook_url && dados.webhook_token) {
            avisoWebhook =
              '<div style="margin-top:8px; font-size:12.5px;">' +
                'Pra receber a confirmação automática de pagamento, configure um webhook na sua conta Asaas ' +
                '(Configurações → Integrações → Webhooks) com:<br>' +
                '<b>URL:</b> ' + esc(dados.webhook_url) + '<br>' +
                '<b>Token de acesso:</b> ' + esc(dados.webhook_token) + '<br>' +
                '<b>Eventos:</b> Pagamento recebido / Pagamento confirmado' +
              '</div>';
          }
          erroDiv.innerHTML = '<div class="aviso-tenant" style="background:var(--good-soft); color:var(--good);">Conectado! Conta: ' + esc(dados.nome_conta || '') + avisoWebhook + '</div>';
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

  // Compartilhadas entre wireUploadAudiencia (upload de arquivo ja gravado) e
  // wireAudienciaAoVivo (grava na hora, pelo microfone, e manda o resultado por este mesmo
  // caminho no final) -- o pedaco em si nao depende de nada do formulario, so dos argumentos.
  function arrayBufferParaBase64(buffer) {
    var binario = '';
    var bytes = new Uint8Array(buffer);
    for (var i = 0; i < bytes.length; i++) binario += String.fromCharCode(bytes[i]);
    return btoa(binario);
  }

  function enviarPedacosAudiencia(arquivo, uploadId, tamanhoChunk, progressoEl) {
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

    function processarUploadAudiencia(arquivo) {
      var nomeCliente = (campoCliente.value || '').trim();
      if (!nomeCliente) {
        mostrarAviso('Informe o nome do cliente antes de enviar o áudio.');
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
          return enviarPedacosAudiencia(arquivo, dados.upload_id, dados.tamanho_chunk, progressoEl);
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
          mostrarAviso(dados.resposta || 'Áudio processado.');
        })
        .catch(function (e) {
          msg.innerHTML = '<strong>Arraste a gravação aqui</strong><span>Áudio ou vídeo de audiência, reunião ou atendimento.</span>' +
            '<button type="button" id="audiencia-upload-escolher">Escolher arquivo</button>';
          document.getElementById('audiencia-upload-escolher').addEventListener('click', function () { input.click(); });
          mostrarAviso('Não foi possível processar o áudio: ' + (e.message || 'erro desconhecido'));
        });
    }
  }

  // Grava pelo microfone do navegador durante a audiência (em vez de subir um arquivo já
  // pronto depois) -- vai transcrevendo pedaços curtos ao vivo, só como prévia na tela (essa
  // transcrição rápida pode errar uma palavra aqui e ali, sem problema). Quando finaliza, junta
  // tudo que foi gravado num único arquivo e manda pelo MESMO caminho de sempre
  // (iniciar_upload_audiencia/audiencia_chunk/finalizar_upload_audiencia, via
  // enviarPedacosAudiencia) -- é esse envio final, do áudio completo, que gera o resumo e o PDF
  // definitivos (mais confiável que somar os pedaços da prévia, que podem cortar uma palavra no
  // meio na fronteira entre um pedaço e outro).
  function wireAudienciaAoVivo() {
    var btnIniciar = document.getElementById('audiencia-vivo-iniciar');
    var btnFinalizar = document.getElementById('audiencia-vivo-finalizar');
    var campoCliente = document.getElementById('audiencia-vivo-cliente');
    var statusEl = document.getElementById('audiencia-vivo-status');
    var transcricaoEl = document.getElementById('audiencia-vivo-transcricao');
    if (!btnIniciar) return;

    var DURACAO_PEDACO_MS = 20000;
    var mediaRecorder = null;
    var streamAtual = null;
    var todosPedacos = [];
    var cronometroInterval = null;
    var inicioGravacao = null;

    function formatarDuracao(ms) {
      var totalSeg = Math.floor(ms / 1000);
      var m = Math.floor(totalSeg / 60);
      var s = totalSeg % 60;
      return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }

    function transcreverPedacoAoVivo(blob) {
      blob.arrayBuffer().then(function (buffer) {
        return apiPost('/api/painel?acao=audiencia_pedaco_ao_vivo', {
          dados_base64: arrayBufferParaBase64(buffer), mimetype: blob.type || 'audio/webm'
        }).then(function (r) { return r.json(); });
      }).then(function (dados) {
        if (dados && dados.texto) {
          transcricaoEl.textContent += (transcricaoEl.textContent ? '\n\n' : '') + dados.texto;
          transcricaoEl.scrollTop = transcricaoEl.scrollHeight;
        }
      }).catch(function () {
        // uma falha na previa de um pedaco nao pode travar a gravacao -- a transcricao
        // definitiva, no final, reprocessa o audio completo de qualquer jeito.
      });
    }

    function resetarControles() {
      btnIniciar.classList.remove('hidden');
      btnFinalizar.classList.add('hidden');
      btnFinalizar.disabled = false;
      campoCliente.disabled = false;
      statusEl.textContent = '';
    }

    btnIniciar.addEventListener('click', function () {
      var nomeCliente = (campoCliente.value || '').trim();
      if (!nomeCliente) {
        mostrarAviso('Informe o nome do cliente antes de iniciar.');
        return;
      }
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (streamCapturado) {
        streamAtual = streamCapturado;
        todosPedacos = [];
        transcricaoEl.textContent = '';
        transcricaoEl.classList.remove('hidden');
        btnIniciar.classList.add('hidden');
        btnFinalizar.classList.remove('hidden');
        campoCliente.disabled = true;

        mediaRecorder = new MediaRecorder(streamAtual);
        mediaRecorder.addEventListener('dataavailable', function (ev) {
          if (!ev.data || ev.data.size === 0) return;
          todosPedacos.push(ev.data);
          transcreverPedacoAoVivo(ev.data);
        });
        mediaRecorder.start(DURACAO_PEDACO_MS);

        inicioGravacao = Date.now();
        statusEl.textContent = '🔴 Gravando 00:00';
        cronometroInterval = setInterval(function () {
          statusEl.textContent = '🔴 Gravando ' + formatarDuracao(Date.now() - inicioGravacao);
        }, 1000);
      }).catch(function () {
        mostrarAviso('Não consegui acessar o microfone -- verifique a permissão do navegador.');
      });
    });

    btnFinalizar.addEventListener('click', function () {
      if (!mediaRecorder) return;
      btnFinalizar.disabled = true;
      clearInterval(cronometroInterval);
      statusEl.textContent = 'Finalizando gravação…';

      mediaRecorder.addEventListener('stop', function () {
        streamAtual.getTracks().forEach(function (t) { t.stop(); });
        var mimeGravado = mediaRecorder.mimeType || 'audio/webm';
        var blobCompleto = new Blob(todosPedacos, { type: mimeGravado });
        var nomeCliente = (campoCliente.value || '').trim();
        var extensao = mimeGravado.indexOf('mp4') !== -1 ? '.mp4' : '.webm';
        var arquivo = new File([blobCompleto], 'Audiencia ao vivo - ' + nomeCliente + extensao, { type: mimeGravado });
        mediaRecorder = null;
        transcricaoEl.classList.add('hidden');

        statusEl.textContent = 'Enviando gravação completa…';
        apiPost('/api/painel?acao=audiencias', {
          op: 'iniciar_upload_audiencia', cliente: nomeCliente,
          nome_arquivo: arquivo.name, mimetype: arquivo.type, tamanho_total: arquivo.size
        })
          .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.erro || 'falha'); return d; }); })
          .then(function (dados) {
            return enviarPedacosAudiencia(arquivo, dados.upload_id, dados.tamanho_chunk, statusEl);
          })
          .then(function (uploadId) {
            statusEl.textContent = 'Transcrevendo (pode levar alguns minutos)…';
            return apiPost('/api/painel?acao=audiencias', { op: 'finalizar_upload_audiencia', upload_id: uploadId })
              .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.erro || 'falha'); return d; }); });
          })
          .then(function (dados) {
            campoCliente.value = '';
            resetarControles();
            carregarAudiencias();
            mostrarAviso(dados.resposta || 'Áudio processado.');
          })
          .catch(function (e) {
            resetarControles();
            mostrarAviso('Não foi possível processar a gravação: ' + (e.message || 'erro desconhecido'));
          });
      }, { once: true });
      mediaRecorder.stop();
    });
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

      var partesHref = item.getAttribute('href').split('#');
      var arquivoAlvo = partesHref[0];
      var ancora = partesHref[1];
      // financeiro.html (antigo) e painel.html (novo, com abas) compartilham data-secao="financeiro"
      // pra permissao, mas sao paginas diferentes -- acende pelo arquivo de verdade, nao so pela secao,
      // senao os dois links do grupo "Financeiro" acendiam juntos (ou nenhum) na pagina errada.
      // nav-configuracoes e nav-admin sao os 2 unicos itens sem data-secao (nao tem permissao
      // propria, so dados.usuario_admin) -- cada um precisa do seu proprio "apelido" aqui, senao
      // os dois caem no mesmo fallback e acendem juntos sempre que PAGINA_ATUAL for "admin"
      // (era o bug: clicar em "Escritórios" tambem acendia "Configurações").
      var secaoParaAtivo = secao || (item.id === 'nav-admin' ? 'admin' : item.id === 'nav-configuracoes' ? 'configuracoes' : null);
      item.classList.toggle('ativo', arquivoAlvo === arquivoAtual || secaoParaAtivo === PAGINA_ATUAL);
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

    wireScrollSpyMenu(itensNav, arquivoAtual);
  }

  function wireScrollSpyMenu(itensNav, arquivoAtual) {
    // paginas com mais de uma sub-secao no menu (ex: Financeiro e Ficha de processos/Processo
    // Administrativo) -- acende so a que esta visivel na tela agora, em vez do grupo inteiro
    // junto. Agrupa pelo ARQUIVO de destino (varios itens do menu podem apontar pro mesmo html,
    // so mudando a ancora), nunca por data-secao -- esse e so o rotulo de permissao e pode ser
    // compartilhado por itens de paginas diferentes (ex: "processos"), o que acendia o grupo errado.
    var itensDoGrupo = Array.prototype.filter.call(itensNav, function (item) {
      return item.getAttribute('href').split('#')[0] === arquivoAtual;
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

  function wireFinTabs() {
    var botoes = document.querySelectorAll('.subtabs [data-fin-tab]');
    if (!botoes.length) return;
    botoes.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var alvo = btn.getAttribute('data-fin-tab');
        botoes.forEach(function (b) { b.classList.toggle('ativo', b === btn); });
        document.querySelectorAll('[data-fin-panel]').forEach(function (p) {
          p.classList.toggle('hidden', p.getAttribute('data-fin-panel') !== alvo);
        });
        // Volta pro Dashboard busca os dados de novo (nao so troca a aba) -- e o que permite a
        // torre do grafico "crescer" na hora, se algo foi recebido/lancado enquanto o usuario
        // estava numa aba diferente (pedido do usuario).
        if (alvo === 'dashboard') carregarPainelExecutivo();
      });
    });
  }

  var honorariosContratosCache = { contratos: [], exitos: [] };
  var ROTULOS_TIPO_CONTRATO = {
    fixo: 'Honorários', valor_exito: 'Honorários + êxito',
    mensal: 'Honorários mensais', vinculado_processo: 'Honorários vinculados ao processo',
  };

  function honorariosPassaFiltro(item, ehExito, filtros) {
    if (filtros.cliente && item.nome_cliente !== filtros.cliente) return false;
    if (filtros.processo && (item.tipo_servico || '').indexOf('Processo ' + filtros.processo) === -1) return false;
    if (filtros.tipo) {
      if (ehExito) {
        if (filtros.tipo !== 'exito') return false;
      } else {
        var rotulo = ROTULOS_TIPO_CONTRATO[filtros.tipo];
        if (!rotulo || (item.tipo_servico || '').indexOf(rotulo) !== 0) return false;
      }
    }
    if (filtros.status) {
      var quitado = ehExito
        ? false
        : (item.valor_total > 0 && ((item.entrada_recebida || 0) + (item.valor_pago_parcelas || 0)) >= item.valor_total);
      if (filtros.status === 'quitado' && !quitado) return false;
      if (filtros.status === 'ativo' && quitado) return false;
    }
    return true;
  }

  function lerFiltrosHonorarios() {
    var elProcesso = document.getElementById('honfiltro-processo');
    var elCliente = document.getElementById('honfiltro-cliente');
    var elTipo = document.getElementById('honfiltro-tipo');
    var elStatus = document.getElementById('honfiltro-status');
    return {
      processo: elProcesso ? elProcesso.value : '',
      cliente: elCliente ? elCliente.value : '',
      tipo: elTipo ? elTipo.value : '',
      status: elStatus ? elStatus.value : '',
    };
  }

  function renderHonorariosContratos() {
    var container = document.getElementById('honorarios-contratos-lista');
    if (!container) return;
    var filtros = lerFiltrosHonorarios();
    var contratos = honorariosContratosCache.contratos.filter(function (c) { return honorariosPassaFiltro(c, false, filtros); });
    var exitos = honorariosContratosCache.exitos.filter(function (e) { return honorariosPassaFiltro(e, true, filtros); });

    if (contratos.length === 0 && exitos.length === 0) {
      var temFiltroAtivo = filtros.processo || filtros.cliente || filtros.tipo || filtros.status;
      container.innerHTML = '<div class="empty-state"><div class="msg">' +
        (temFiltroAtivo ? 'Nenhum contrato encontrado com esses filtros.' : 'Nenhum contrato cadastrado ainda. Use "+ Novo contrato de honorários" pra adicionar.') +
        '</div></div>';
      return;
    }
    var linhasContratos = contratos.map(function (c) {
      var pago = (c.entrada_recebida || 0) + (c.valor_pago_parcelas || 0);
      var statusChip = c.valor_total > 0 && pago >= c.valor_total
        ? '<span class="chip good">Quitado</span>'
        : '<span class="chip neutral">' + esc(c.status_pagamento || c.status_contrato || '—') + '</span>';
      return '<tr><td>' + esc(c.nome_cliente) + '</td><td>' + esc(c.tipo_servico || '—') + '</td>' +
        '<td class="num">R$ ' + fmtMoeda(c.valor_total) + '</td>' +
        '<td class="num">R$ ' + fmtMoeda(c.valor_entrada) + '</td>' +
        '<td>' + (c.num_parcelas || 1) + 'x</td>' +
        '<td>' + statusChip + '</td>' +
        '<td>' +
          '<button type="button" class="btn-editar" data-editar-contrato="' + c.id + '">Editar</button> ' +
          '<button type="button" class="btn-remover" data-excluir-contrato="' + c.id + '" data-excluir-contrato-nome="' + esc(c.nome_cliente) + '">Excluir</button>' +
        '</td></tr>';
    }).join('');
    var linhasExito = exitos.map(function (e) {
      return '<tr><td>' + esc(e.nome_cliente) + '</td><td>' + esc(e.servico || '—') + '</td>' +
        '<td class="num">' + Math.round((e.percentual || 0) * 10000) / 100 + '%</td>' +
        '<td class="num">—</td><td>Êxito</td>' +
        '<td><span class="chip neutral">' + esc(e.situacao || '—') + '</span></td>' +
        '<td>' +
          '<button type="button" class="btn-editar" data-editar-exito="' + e.id + '">Editar</button> ' +
          '<button type="button" class="btn-remover" data-excluir-exito="' + e.id + '" data-excluir-contrato-nome="' + esc(e.nome_cliente) + '">Excluir</button>' +
        '</td></tr>';
    }).join('');
    container.innerHTML = '<div class="table-scroll"><table>' +
      '<thead><tr><th>Cliente</th><th>Serviço</th><th style="text-align:right">Valor total / %</th>' +
      '<th style="text-align:right">Entrada</th><th>Parcelas</th><th>Status</th><th>Ações</th></tr></thead>' +
      '<tbody>' + linhasContratos + linhasExito + '</tbody></table></div>';

    function excluirRegistro(tipoRegistro, id, nome, botao) {
      confirmarModal('Excluir o contrato de ' + nome + '? Essa ação não pode ser desfeita.').then(function (ok) {
        if (!ok) return;
        botao.disabled = true;
        apiPost('/api/painel?acao=executar', { tipo: 'financeiro_contrato_excluir', tipo_registro: tipoRegistro, id: id })
          .then(function (r) { return r.json().then(function (c) { return { status: r.status, corpo: c }; }); })
          .then(function (resultado) {
            if (resultado.status === 200) {
              carregarHonorariosContratos();
            } else {
              botao.disabled = false;
              mostrarAviso(resultado.corpo.erro || 'Não foi possível excluir agora.');
            }
          })
          .catch(function () {
            botao.disabled = false;
            mostrarAviso('Erro de conexão ao excluir.');
          });
      });
    }
    container.querySelectorAll('[data-excluir-contrato]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        excluirRegistro('contrato', btn.getAttribute('data-excluir-contrato'), btn.getAttribute('data-excluir-contrato-nome'), btn);
      });
    });
    container.querySelectorAll('[data-excluir-exito]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        excluirRegistro('exito', btn.getAttribute('data-excluir-exito'), btn.getAttribute('data-excluir-contrato-nome'), btn);
      });
    });
    container.querySelectorAll('[data-editar-contrato]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var item = honorariosContratosCache.contratos.filter(function (c) { return String(c.id) === btn.getAttribute('data-editar-contrato'); })[0];
        if (item && window.abrirModalEditarContrato) window.abrirModalEditarContrato('contrato', item);
      });
    });
    container.querySelectorAll('[data-editar-exito]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var item = honorariosContratosCache.exitos.filter(function (e) { return String(e.id) === btn.getAttribute('data-editar-exito'); })[0];
        if (item && window.abrirModalEditarContrato) window.abrirModalEditarContrato('exito', item);
      });
    });
  }

  var EXITO_ESTADO_INFO = {
    estimado: { cor: 'var(--accent)', rotulo: 'Estimado', chip: 'neutral' },
    a_receber: { cor: 'var(--warn)', rotulo: 'A receber', chip: 'warn' },
    recebido: { cor: 'var(--good)', rotulo: 'Recebido', chip: 'good' },
  };

  function renderExitoEstimativaChart() {
    var container = document.getElementById('exito-estimativa-grafico');
    var resumoEl = document.getElementById('exito-estimativa-resumo');
    if (!container) return;
    var exitos = honorariosContratosCache.exitos || [];
    var itens = exitos.map(function (e) {
      var baseEstimativa = e.valor_estimado_ganho != null ? e.valor_estimado_ganho : (e.valor_causa || 0);
      var valorEstimado = (e.percentual || 0) * baseEstimativa;
      var apurado = (e.honorario || 0) > 0; // ja tem valor_recebido_cliente informado -- honorario calculado de verdade
      var estado;
      var valor;
      if (e.situacao === 'Processo perdido') {
        // processo perdido nao gera honorario -- some do grafico em vez de aparecer como
        // estimado ou a receber pra sempre.
        estado = null;
        valor = 0;
      } else if (e.situacao === 'Recebido') {
        // a Situacao manda: se o usuario marcou "Recebido" ali, o grafico segue essa escolha,
        // mesmo que "Valor ja recebido por voce" ainda nao tenha sido preenchido a parte.
        estado = 'recebido';
        valor = apurado ? e.honorario : valorEstimado;
      } else if (!apurado) {
        // ainda sem resultado -- so a estimativa (% x estimativa de ganho, ou valor da causa
        // se ninguem salvou uma estimativa propria ainda).
        estado = 'estimado';
        valor = valorEstimado;
      } else if ((e.a_receber || 0) > 0.004) {
        // resultado ja saiu e o honorario ja foi apurado, mas o advogado ainda nao recebeu
        // (nem tudo, nem parte) -- diferente de "valor_recebido_cliente", que e so o que o
        // CLIENTE ganhou na causa, base pra calcular o honorario (relatado pelo usuario: um
        // honorario apurado aparecia como "Recebido" so por ja ter esse valor informado,
        // mesmo sem o advogado ter visto um centavo ainda).
        estado = 'a_receber';
        valor = e.honorario || 0;
      } else {
        estado = 'recebido';
        valor = e.honorario || 0;
      }
      return { nome: e.nome_cliente, servico: e.servico || '', estado: estado, valor: valor };
    }).filter(function (i) { return i.estado && i.valor > 0.004; });

    var totais = { estimado: 0, a_receber: 0, recebido: 0 };
    itens.forEach(function (i) { totais[i.estado] += i.valor; });
    if (resumoEl) {
      resumoEl.innerHTML =
        '<div class="exito-estimativa-card" data-estado="estimado"><span class="exito-estimativa-label">Estimado em andamento</span>' +
          '<span class="exito-estimativa-valor">R$ ' + fmtMoeda(totais.estimado) + '</span></div>' +
        '<div class="exito-estimativa-card" data-estado="a_receber"><span class="exito-estimativa-label">A receber (já apurado)</span>' +
          '<span class="exito-estimativa-valor">R$ ' + fmtMoeda(totais.a_receber) + '</span></div>' +
        '<div class="exito-estimativa-card" data-estado="recebido"><span class="exito-estimativa-label">Já recebido</span>' +
          '<span class="exito-estimativa-valor">R$ ' + fmtMoeda(totais.recebido) + '</span></div>';
    }

    if (!itens.length) {
      container.innerHTML = '<div class="empty-state"><div class="msg">Nenhum honorário de êxito com estimativa (% + estimativa de ganho) ou já apurado ainda.</div></div>';
      return;
    }

    itens.sort(function (a, b) { return b.valor - a.valor; });
    var maior = Math.max.apply(null, itens.map(function (i) { return i.valor; }).concat([1]));
    // Anel de progresso por caso: mesmo dado que a barra horizontal antiga mostrava (valor em
    // relacao ao maior caso da lista), so que como um arco em vez de uma barra -- pedido do
    // usuario por um visual mais "instrumento/HUD" e menos "grafico de dashboard generico".
    var RAIO_ANEL = 15;
    var CIRCUNFERENCIA_ANEL = 2 * Math.PI * RAIO_ANEL;
    container.innerHTML = itens.map(function (i) {
      var fracao = Math.max(i.valor / maior, 0.04);
      var info = EXITO_ESTADO_INFO[i.estado];
      var offset = CIRCUNFERENCIA_ANEL * (1 - fracao);
      var tituloAnel = esc(i.nome + (i.servico ? ' — ' + i.servico : '') + ': R$ ' + fmtMoeda(i.valor));
      return '<div class="exito-anel-row">' +
        '<svg class="exito-anel-svg" width="36" height="36" viewBox="0 0 36 36" role="img" aria-label="' + tituloAnel + '"><title>' + tituloAnel + '</title>' +
          '<circle class="exito-anel-track" cx="18" cy="18" r="' + RAIO_ANEL + '"></circle>' +
          '<circle class="exito-anel-fill' + (i.estado === 'recebido' ? ' recebido' : '') + '" cx="18" cy="18" r="' + RAIO_ANEL + '" ' +
            'transform="rotate(-90 18 18)" ' +
            'style="color:' + info.cor + '; stroke:' + info.cor + '; stroke-dasharray:' + CIRCUNFERENCIA_ANEL + '; stroke-dashoffset:' + offset + ';"></circle>' +
        '</svg>' +
        '<div class="exito-linha-info">' +
          '<span class="exito-linha-nome">' + esc(i.nome) + '</span>' +
          (i.servico ? '<span class="exito-linha-servico">' + esc(i.servico) + '</span>' : '') +
        '</div>' +
        '<span class="exito-linha-valor">R$ ' + fmtMoeda(i.valor) + '</span>' +
        '<span class="exito-linha-estado" style="color:' + info.cor + ';">' + esc(info.rotulo) + '</span>' +
      '</div>';
    }).join('');
  }

  function carregarHonorariosContratos() {
    var container = document.getElementById('honorarios-contratos-lista');
    if (!container) return;
    apiPostJson('/api/painel?acao=executar', { tipo: 'financeiro_contrato_listar' })
      .then(function (dados) {
        honorariosContratosCache.contratos = dados.contratos || [];
        honorariosContratosCache.exitos = dados.honorarios_exito || [];
        renderHonorariosContratos();
        renderExitoEstimativaChart();
        // se chamou depois de criar/excluir um contrato, recarrega Contas a receber tambem
        // (mesmos dados, aba diferente) -- assim o cadastro novo ja aparece la sem precisar
        // trocar de aba e voltar.
        if (document.getElementById('financeiro-parcelas-lista')) carregarParcelasAReceber();
      })
      .catch(function () {
        container.innerHTML = '<div class="empty-state"><div class="msg">Não foi possível carregar os contratos agora.</div></div>';
      });
  }

  function wireFiltroHonorarios() {
    var selectProcesso = document.getElementById('honfiltro-processo');
    var selectCliente = document.getElementById('honfiltro-cliente');
    if (!selectProcesso || !selectCliente) return;

    apiGetJson('/api/painel?acao=cliente_cadastro_listar').then(function (d) {
      selectCliente.innerHTML = '<option value="">Todos os clientes</option>' +
        (d.clientes || []).map(function (c) { return '<option value="' + esc(c.nome) + '">' + esc(c.nome) + '</option>'; }).join('');
    }).catch(function () {});
    apiGetJson('/api/painel?acao=processo_manual_listar').then(function (d) {
      selectProcesso.innerHTML = '<option value="">Todos os processos</option>' +
        (d.processos || []).map(function (p) { return '<option value="' + esc(p.numero_cnj) + '">' + esc(p.numero_cnj) + '</option>'; }).join('');
    }).catch(function () {});

    document.getElementById('honfiltro-buscar').addEventListener('click', renderHonorariosContratos);
    document.getElementById('honfiltro-limpar').addEventListener('click', function () {
      selectProcesso.value = '';
      selectCliente.value = '';
      document.getElementById('honfiltro-tipo').value = '';
      document.getElementById('honfiltro-status').value = '';
      renderHonorariosContratos();
    });
  }

  var parcelasAReceberCache = [];
  var gruposParcelasExpandidos = {}; // lembra quais grupos (ex: parcelamento de um contrato)
  // o usuario deixou abertos, pra nao fechar tudo de novo a cada "Receber"/"Cobrar" (o
  // carregarParcelasAReceber recria a tabela inteira do zero a cada chamada).

  var CHIPS_STATUS_PARCELA = {
    Paga: '<span class="chip good">Paga</span>',
    Vencida: '<span class="chip crit">Vencida</span>',
    Aberta: '<span class="chip neutral">Aberta</span>',
  };

  function linhaParcelaHtml(p, comIndentacao) {
    var matchProcesso = /Processo (\S+)/.exec(p.tipo_servico || '');
    var descricao = (p.tipo_servico || 'Honorários').replace(/\s*—\s*Processo \S+/, '');
    if (p.numero_parcela === 0) descricao += ' (Entrada)';
    else if (p.total_parcelas && p.total_parcelas > 1) descricao += ' (' + p.numero_parcela + '/' + p.total_parcelas + ')';
    var acoesPrincipais = '';
    if (p.status !== 'Paga') {
      acoesPrincipais +=
        '<button type="button" class="btn-conexao" data-receber-parcela-id="' + esc(p.id) + '" style="padding:4px 10px; font-size:12.5px;">Receber</button>' +
        '<button type="button" class="btn-conexao-secundario" data-cobrar-parcela-id="' + esc(p.id) + '" style="padding:4px 10px; font-size:12.5px;">Cobrar</button>';
    }
    var acoesMenu =
      '<span class="procman-acoes-wrap">' +
        '<button type="button" class="parcela-btn-mais" data-parcela-mais="' + esc(p.id) + '" aria-label="Mais opções" title="Mais opções">⋮</button>' +
        '<div class="procman-acoes-menu hidden" data-parcela-menu="' + esc(p.id) + '">' +
          '<button type="button" data-editar-parcela-id="' + esc(p.id) + '">Editar</button>' +
          '<button type="button" class="procman-acao-excluir" data-excluir-parcela-id="' + esc(p.id) + '">Excluir</button>' +
        '</div>' +
      '</span>';
    return '<tr>' +
      '<td' + (comIndentacao ? ' style="padding-left:34px; color:var(--ink-soft);"' : '') + '>' + esc(p.nome_cliente) + '</td>' +
      '<td>' + (matchProcesso ? esc(matchProcesso[1]) : '—') + '</td>' +
      '<td>' + esc(descricao) + '</td>' +
      '<td class="num">R$ ' + fmtMoeda(p.status === 'Paga' ? p.valor_parcela : p.saldo) +
        (p.status !== 'Paga' && p.valor_pago > 0 ? '<div style="font-size:11px;color:var(--good);font-weight:400;">R$ ' + fmtMoeda(p.valor_pago) + ' já pago</div>' : '') +
      '</td>' +
      '<td>' + (p.data_vencimento ? fmtDataCurta(p.data_vencimento) : '—') + '</td>' +
      '<td>' + (CHIPS_STATUS_PARCELA[p.status] || CHIPS_STATUS_PARCELA.Aberta) + '</td>' +
      '<td><div class="parcela-acoes-linha">' + acoesPrincipais + acoesMenu + '</div></td></tr>';
  }

  // Agrupa por contrato (mesmo contrato = mesmas parcelas de um unico lancamento) -- clientes
  // sem contrato_id (fluxo bem antigo) caem num grupo por nome+servico, pra nunca perder uma
  // parcela por falta de id.
  function agruparParcelas(parcelas) {
    var grupos = {}, ordem = [];
    parcelas.forEach(function (p) {
      var chave = p.contrato_id != null ? ('c' + p.contrato_id) : ('n' + p.nome_cliente + '|' + p.tipo_servico);
      if (!grupos[chave]) {
        grupos[chave] = { chave: chave, nome_cliente: p.nome_cliente, tipo_servico: p.tipo_servico, itens: [] };
        ordem.push(chave);
      }
      grupos[chave].itens.push(p);
    });
    return ordem.map(function (chave) { return grupos[chave]; });
  }

  function renderParcelasAgrupadas(parcelas) {
    var grupos = agruparParcelas(parcelas);
    return grupos.map(function (g) {
      if (g.itens.length === 1) return linhaParcelaHtml(g.itens[0], false);

      var matchProcesso = /Processo (\S+)/.exec(g.tipo_servico || '');
      var descricaoBase = (g.tipo_servico || 'Honorários').replace(/\s*—\s*Processo \S+/, '');
      var pagas = g.itens.filter(function (p) { return p.status === 'Paga'; }).length;
      var temVencida = g.itens.some(function (p) { return p.status === 'Vencida'; });
      var saldoAberto = g.itens.reduce(function (acc, p) { return acc + (p.status === 'Paga' ? 0 : p.saldo); }, 0);
      var valorTotalGrupo = g.itens.reduce(function (acc, p) { return acc + p.valor_parcela; }, 0);
      var totalPagoGrupo = g.itens.reduce(function (acc, p) { return acc + (p.valor_pago || 0); }, 0);
      var proximaAberta = g.itens
        .filter(function (p) { return p.status !== 'Paga' && p.data_vencimento; })
        .sort(function (a, b) { return a.data_vencimento < b.data_vencimento ? -1 : 1; })[0];
      var chipResumo = pagas === g.itens.length
        ? '<span class="chip good">Paga (' + pagas + '/' + g.itens.length + ')</span>'
        : '<span class="chip ' + (temVencida ? 'crit' : 'neutral') + '">' + pagas + '/' + g.itens.length + ' pagas</span>';
      var notaPago = '<div style="font-size:11px;color:var(--good);margin-top:3px;">' +
        (totalPagoGrupo > 0 ? 'R$ ' + fmtMoeda(totalPagoGrupo) + ' já pago' : 'nada pago ainda') + '</div>';

      var idGrupo = esc(g.chave);
      var estaAberto = !!gruposParcelasExpandidos[idGrupo];
      var linhaGrupo = '<tr class="parcela-grupo-linha" data-grupo-linha="' + idGrupo + '">' +
        '<td><button type="button" class="parcela-grupo-seta" data-grupo-seta="' + idGrupo + '" aria-expanded="' + (estaAberto ? 'true' : 'false') + '" aria-label="Ver parcelas de ' + esc(g.nome_cliente) + '">' + (estaAberto ? '▾' : '▸') + '</button> ' + esc(g.nome_cliente) + '</td>' +
        '<td>' + (matchProcesso ? esc(matchProcesso[1]) : '—') + '</td>' +
        '<td>' + esc(descricaoBase) + ' (' + g.itens.length + 'x)</td>' +
        '<td class="num">R$ ' + fmtMoeda(saldoAberto > 0 ? saldoAberto : valorTotalGrupo) + '</td>' +
        '<td>' + (proximaAberta ? fmtDataCurta(proximaAberta.data_vencimento) : '—') + '</td>' +
        '<td>' + chipResumo + notaPago + '</td>' +
        '<td></td></tr>';

      var linhasFilhas = g.itens.map(function (p) {
        return linhaParcelaHtml(p, true);
      }).join('');
      var linhasFilhasEnvolvidas = '<tbody class="' + (estaAberto ? '' : 'hidden') + '" data-grupo-filhas="' + idGrupo + '">' + linhasFilhas + '</tbody>';

      return '<tbody>' + linhaGrupo + '</tbody>' + linhasFilhasEnvolvidas;
    }).join('');
  }

  function carregarParcelasAReceber() {
    var container = document.getElementById('financeiro-parcelas-lista');
    if (!container) return;
    apiPostJson('/api/painel?acao=executar', { tipo: 'financeiro_parcelas_listar' })
      .then(function (dados) {
        var parcelas = dados.parcelas || [];
        parcelasAReceberCache = parcelas;
        if (parcelas.length === 0) {
          container.innerHTML = '<div class="empty-state"><div class="msg">Nenhuma conta a receber ainda. Cadastre um contrato em "Honorários e Contratos" que ela aparece aqui.</div></div>';
          return;
        }
        container.innerHTML = '<div class="table-scroll"><table>' +
          '<thead><tr><th>Cliente/Contrato</th><th>Processo</th><th>Descrição</th>' +
          '<th style="text-align:right">Valor</th><th>Vencimento</th><th>Status</th><th></th></tr></thead>' +
          renderParcelasAgrupadas(parcelas) + '</table></div>';
      })
      .catch(function () {
        container.innerHTML = '<div class="empty-state"><div class="msg">Não foi possível carregar as contas a receber agora.</div></div>';
      });
    if (!container.dataset.cobrarWired) {
      container.dataset.cobrarWired = '1';
      container.addEventListener('click', function (ev) {
        var btnSeta = ev.target.closest('[data-grupo-seta]');
        if (btnSeta) {
          var idGrupo = btnSeta.getAttribute('data-grupo-seta');
          var filhas = container.querySelector('[data-grupo-filhas="' + idGrupo + '"]');
          if (!filhas) return;
          var abrindo = filhas.classList.contains('hidden');
          filhas.classList.toggle('hidden', !abrindo);
          btnSeta.textContent = abrindo ? '▾' : '▸';
          btnSeta.setAttribute('aria-expanded', abrindo ? 'true' : 'false');
          gruposParcelasExpandidos[idGrupo] = abrindo;
          return;
        }

        var btnCobrar = ev.target.closest('[data-cobrar-parcela-id]');
        if (btnCobrar) {
          escolherTipoCobranca().then(function (tipo) {
            if (!tipo) return;
            var textoOriginal = btnCobrar.textContent;
            btnCobrar.disabled = true;
            btnCobrar.textContent = 'Enviando...';
            apiPostJson('/api/painel?acao=executar', {
              tipo: 'financeiro_parcela_cobrar',
              id: btnCobrar.getAttribute('data-cobrar-parcela-id'),
              usar_asaas: tipo === 'asaas' ? 'true' : 'false'
            })
              .then(function (dados) {
                mostrarAviso(dados.resposta || dados.erro || 'Concluído.');
                carregarParcelasAReceber();
              })
              .catch(function () {
                mostrarAviso('Não foi possível enviar a cobrança agora.');
                btnCobrar.disabled = false;
                btnCobrar.textContent = textoOriginal;
              });
          });
          return;
        }

        var btnReceber = ev.target.closest('[data-receber-parcela-id]');
        if (btnReceber) {
          var idReceber = btnReceber.getAttribute('data-receber-parcela-id');
          var itemReceber = parcelasAReceberCache.filter(function (p) { return String(p.id) === idReceber; })[0];
          if (!itemReceber) { window.alert('Não encontrei essa parcela na lista carregada (id ' + idReceber + '). Atualize a página e tente de novo.'); return; }
          pedirValorRecebido(itemReceber).then(function (recebimentoDigitado) {
            if (recebimentoDigitado === null) return;
            var textoOriginalReceber = btnReceber.textContent;
            btnReceber.disabled = true;
            btnReceber.textContent = 'Registrando...';
            apiPostJson('/api/painel?acao=executar', { tipo: 'financeiro_parcela_receber', id: idReceber, valor: recebimentoDigitado.valor, data_pagamento: recebimentoDigitado.data })
              .then(function () { carregarParcelasAReceber(); })
              .catch(function (e) {
                window.alert(e.message || 'Não foi possível registrar o recebimento agora.');
                btnReceber.disabled = false;
                btnReceber.textContent = textoOriginalReceber;
              });
          });
          return;
        }

        var btnMaisParcela = ev.target.closest('[data-parcela-mais]');
        if (btnMaisParcela) {
          var menuParcelaAlvo = container.querySelector('[data-parcela-menu="' + btnMaisParcela.getAttribute('data-parcela-mais') + '"]');
          var parcelaMenuJaAberto = menuParcelaAlvo && !menuParcelaAlvo.classList.contains('hidden');
          container.querySelectorAll('.procman-acoes-menu').forEach(function (m) { m.classList.add('hidden'); m.classList.remove('abre-para-cima'); });
          if (menuParcelaAlvo && !parcelaMenuJaAberto) {
            menuParcelaAlvo.classList.remove('hidden');
            var retanguloParcela = menuParcelaAlvo.getBoundingClientRect();
            if (retanguloParcela.bottom > window.innerHeight) menuParcelaAlvo.classList.add('abre-para-cima');
          }
          return;
        }

        var btnEditar = ev.target.closest('[data-editar-parcela-id]');
        if (btnEditar) {
          container.querySelectorAll('.procman-acoes-menu').forEach(function (m) { m.classList.add('hidden'); });
          var itemEditar = parcelasAReceberCache.filter(function (p) { return String(p.id) === btnEditar.getAttribute('data-editar-parcela-id'); })[0];
          if (itemEditar && window.abrirModalEditarParcela) window.abrirModalEditarParcela(itemEditar);
          return;
        }

        var btnExcluir = ev.target.closest('[data-excluir-parcela-id]');
        if (btnExcluir) {
          container.querySelectorAll('.procman-acoes-menu').forEach(function (m) { m.classList.add('hidden'); });
          var idExcluir = btnExcluir.getAttribute('data-excluir-parcela-id');
          confirmarModal('Excluir essa parcela? Essa ação não pode ser desfeita.').then(function (ok) {
            if (!ok) return;
            btnExcluir.disabled = true;
            apiPostJson('/api/painel?acao=executar', { tipo: 'financeiro_parcela_excluir', id: idExcluir })
              .then(function () { carregarParcelasAReceber(); })
              .catch(function (e) {
                mostrarAviso(e.message || 'Não foi possível excluir agora.');
                btnExcluir.disabled = false;
              });
          });
          return;
        }

        if (!ev.target.closest('.procman-acoes-wrap')) {
          container.querySelectorAll('.procman-acoes-menu').forEach(function (m) { m.classList.add('hidden'); });
        }
      });
      document.addEventListener('click', function (ev) {
        if (!ev.target.closest('.procman-acoes-wrap')) {
          container.querySelectorAll('.procman-acoes-menu').forEach(function (m) { m.classList.add('hidden'); });
        }
      });
    }
  }

  // Edicao dos campos de uma parcela isolada (descricao, valor, vencimento) -- separado do
  // modal de edicao de contrato (wireEditarContratoModal): aqui e uma parcela especifica de
  // 'Contas a receber', nao o contrato inteiro.
  function wireEditarParcelaModal() {
    var modal = document.getElementById('modal-editar-parcela');
    if (!modal) return;
    var campoDescricao = document.getElementById('eparcela-descricao');
    var campoValor = document.getElementById('eparcela-valor');
    var campoVencimento = document.getElementById('eparcela-vencimento');
    var erroEl = document.getElementById('eparcela-erro');
    var btnSalvar = document.getElementById('eparcela-salvar');
    var idAtual = null;
    aplicarMascaraMoeda(campoValor);

    function fecharModal() { modal.classList.add('hidden'); }

    window.abrirModalEditarParcela = function (item) {
      idAtual = item.id;
      erroEl.textContent = '';
      campoDescricao.value = item.tipo_servico || '';
      campoValor.value = fmtMoeda(item.status === 'Paga' ? item.valor_parcela : item.saldo);
      campoVencimento.value = item.data_vencimento ? item.data_vencimento.split('T')[0] : '';
      modal.classList.remove('hidden');
    };

    document.getElementById('eparcela-fechar').addEventListener('click', fecharModal);
    document.getElementById('eparcela-cancelar').addEventListener('click', fecharModal);
    modal.addEventListener('click', function (e) { if (e.target === modal) fecharModal(); });

    btnSalvar.addEventListener('click', function () {
      erroEl.textContent = '';
      var corpo = { tipo: 'financeiro_parcela_editar', id: idAtual, tipo_servico: campoDescricao.value.trim() };
      if (campoValor.value) corpo.valor = campoValor.value;
      if (campoVencimento.value) corpo.vencimento = fmtDataCurta(campoVencimento.value);
      btnSalvar.disabled = true;
      btnSalvar.textContent = 'Salvando…';
      apiPostJson('/api/painel?acao=executar', corpo)
        .then(function () {
          fecharModal();
          carregarParcelasAReceber();
        })
        .catch(function (e) { erroEl.textContent = e.message || 'Não foi possível salvar agora.'; })
        .finally(function () { btnSalvar.disabled = false; btnSalvar.textContent = 'Salvar'; });
    });
  }

  // Registrar recebimento de uma parcela -- pre-preenche com o saldo em aberto, mas deixa
  // editar (cliente as vezes manda so parte da parcela); manda pro mesmo
  // financeiro_parcela_receber, que ja aceita um valor customizado (default: saldo cheio).
  // Cria o overlay direto no <body> (mesmo padrao de escolherTipoCobranca/confirmarDigitando)
  // em vez de deixar o HTML dentro do conteudo da aba -- um modal embutido la dentro nao estava
  // aparecendo (provavel ancestral com transform/contain quebrando o position:fixed).
  function pedirValorRecebido(item) {
    return new Promise(function (resolve) {
      var overlay = document.getElementById('receber-valor-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'receber-valor-overlay';
        overlay.className = 'modal-overlay hidden';
        overlay.innerHTML =
          '<div class="confirm-modal-caixa">' +
            '<div class="confirm-modal-titulo" id="receber-valor-titulo"></div>' +
            '<div class="ncontrato-campo" style="margin-top:14px; text-align:left;">' +
              '<label for="receber-valor-input">Valor recebido (R$)</label>' +
              '<input type="text" id="receber-valor-input" autocomplete="off">' +
            '</div>' +
            '<div class="ncontrato-campo" style="margin-top:10px; text-align:left;">' +
              '<label for="receber-valor-data">Data do pagamento</label>' +
              '<input type="date" id="receber-valor-data">' +
            '</div>' +
            '<div class="ncontrato-erro" id="receber-valor-erro"></div>' +
            '<div class="confirm-modal-acoes">' +
              '<button type="button" class="btn-conexao-secundario" id="receber-valor-cancelar">Cancelar</button>' +
              '<button type="button" class="btn-conexao" id="receber-valor-ok">Confirmar</button>' +
            '</div>' +
          '</div>';
        document.body.appendChild(overlay);
        aplicarMascaraMoeda(document.getElementById('receber-valor-input'));
      }
      document.getElementById('receber-valor-titulo').textContent = 'Valor recebido de ' + item.nome_cliente;
      var input = document.getElementById('receber-valor-input');
      var inputData = document.getElementById('receber-valor-data');
      var erroEl = document.getElementById('receber-valor-erro');
      var btnOk = document.getElementById('receber-valor-ok');
      var btnCancelar = document.getElementById('receber-valor-cancelar');
      erroEl.textContent = '';
      input.value = fmtMoeda(item.saldo);
      var hoje = new Date();
      inputData.value = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0') + '-' + String(hoje.getDate()).padStart(2, '0');
      inputData.max = inputData.value;

      function limpar(resultado) {
        overlay.classList.add('hidden');
        btnCancelar.removeEventListener('click', onCancelar);
        btnOk.removeEventListener('click', onOk);
        overlay.removeEventListener('click', onOverlay);
        document.removeEventListener('keydown', onEsc);
        input.removeEventListener('keydown', onEnter);
        resolve(resultado);
      }
      function onCancelar() { limpar(null); }
      function onOk() {
        if (!input.value.trim()) { erroEl.textContent = 'Informe o valor recebido.'; return; }
        if (!inputData.value) { erroEl.textContent = 'Informe a data do pagamento.'; return; }
        limpar({ valor: input.value.trim(), data: fmtDataCurta(inputData.value) });
      }
      function onOverlay(e) { if (e.target === overlay) limpar(null); }
      function onEsc(e) { if (e.key === 'Escape') limpar(null); }
      function onEnter(e) { if (e.key === 'Enter') onOk(); }

      btnCancelar.addEventListener('click', onCancelar);
      btnOk.addEventListener('click', onOk);
      overlay.addEventListener('click', onOverlay);
      document.addEventListener('keydown', onEsc);
      input.addEventListener('keydown', onEnter);
      overlay.classList.remove('hidden');
      input.focus();
      input.select();
    });
  }

  var despesasProcessoCache = [];

  function lerFiltrosDespesas() {
    var elProcesso = document.getElementById('despfiltro-processo');
    var elTipo = document.getElementById('despfiltro-tipo');
    var elDataDe = document.getElementById('despfiltro-data-de');
    var elDataAte = document.getElementById('despfiltro-data-ate');
    return {
      processo: elProcesso ? elProcesso.value : '',
      tipo: elTipo ? elTipo.value : '',
      dataDe: elDataDe ? elDataDe.value : '',
      dataAte: elDataAte ? elDataAte.value : '',
    };
  }

  function despesaPassaFiltro(d, filtros) {
    if (filtros.processo && d.processo_numero !== filtros.processo) return false;
    if (filtros.tipo && d.tipo !== filtros.tipo) return false;
    var dataDespesa = (d.data || '').split('T')[0];
    if (filtros.dataDe && dataDespesa && dataDespesa < filtros.dataDe) return false;
    if (filtros.dataAte && dataDespesa && dataDespesa > filtros.dataAte) return false;
    return true;
  }

  function renderDespesasProcesso() {
    var container = document.getElementById('despesas-processo-lista');
    if (!container) return;
    var filtros = lerFiltrosDespesas();
    var despesas = despesasProcessoCache.filter(function (d) { return despesaPassaFiltro(d, filtros); });
    if (despesas.length === 0) {
      var temFiltroAtivo = filtros.processo || filtros.tipo || filtros.dataDe || filtros.dataAte;
      container.innerHTML = '<div class="empty-state"><div class="msg">' +
        (temFiltroAtivo ? 'Nenhuma despesa encontrada com esses filtros.' : 'Nenhuma despesa cadastrada ainda. Use "+ Nova despesa" pra adicionar.') +
        '</div></div>';
      return;
    }
    var linhas = despesas.map(function (d) {
      return '<tr><td>' + esc(d.processo_numero) + '</td>' +
        '<td>' + esc(d.tipo) + '</td>' +
        '<td>' + esc(d.descricao || '—') + '</td>' +
        '<td>' + (d.data ? fmtDataCurta(d.data) : '—') + '</td>' +
        '<td class="num">R$ ' + fmtMoeda(d.valor) + '</td>' +
        '<td>' + (d.reembolsavel ? '<span class="chip neutral">Sim</span>' : '<span class="chip neutral">Não</span>') + '</td>' +
        '<td><div style="display:flex; flex-wrap:wrap; gap:6px;">' +
          '<button type="button" class="btn-editar" data-editar-despesa-id="' + esc(d.id) + '">Editar</button>' +
          '<button type="button" class="btn-remover" data-excluir-despesa-id="' + esc(d.id) + '">Excluir</button>' +
        '</div></td></tr>';
    }).join('');
    container.innerHTML = '<div class="table-scroll"><table>' +
      '<thead><tr><th>Processo</th><th>Tipo</th><th>Descrição</th><th>Data</th>' +
      '<th style="text-align:right">Valor</th><th>Reemb.</th><th>Ações</th></tr></thead>' +
      '<tbody>' + linhas + '</tbody></table></div>';

    container.querySelectorAll('[data-editar-despesa-id]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var item = despesasProcessoCache.filter(function (d) { return String(d.id) === btn.getAttribute('data-editar-despesa-id'); })[0];
        if (item && window.abrirModalDespesa) window.abrirModalDespesa(item);
      });
    });
    container.querySelectorAll('[data-excluir-despesa-id]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idExcluir = btn.getAttribute('data-excluir-despesa-id');
        confirmarModal('Excluir essa despesa? Essa ação não pode ser desfeita.').then(function (ok) {
          if (!ok) return;
          btn.disabled = true;
          apiPostJson('/api/painel?acao=executar', { tipo: 'despesa_processo_excluir', id: idExcluir })
            .then(function () { carregarDespesasProcesso(); })
            .catch(function (e) {
              mostrarAviso(e.message || 'Não foi possível excluir agora.');
              btn.disabled = false;
            });
        });
      });
    });
  }

  function carregarDespesasProcesso() {
    var container = document.getElementById('despesas-processo-lista');
    if (!container) return;
    apiPostJson('/api/painel?acao=executar', { tipo: 'despesa_processo_listar' })
      .then(function (dados) {
        despesasProcessoCache = dados.despesas || [];
        renderDespesasProcesso();
      })
      .catch(function () {
        container.innerHTML = '<div class="empty-state"><div class="msg">Não foi possível carregar as despesas agora.</div></div>';
      });
  }

  function wireFiltroDespesas() {
    var selectProcesso = document.getElementById('despfiltro-processo');
    if (!selectProcesso) return;
    apiGetJson('/api/painel?acao=processo_manual_listar').then(function (d) {
      selectProcesso.innerHTML = '<option value="">Todos os processos</option>' +
        (d.processos || []).map(function (p) {
          return '<option value="' + esc(p.numero_cnj) + '">' + esc(p.numero_cnj) + (p.cliente_nome ? ' — ' + esc(p.cliente_nome) : '') + '</option>';
        }).join('');
    }).catch(function () {});
    document.getElementById('despfiltro-buscar').addEventListener('click', renderDespesasProcesso);
    document.getElementById('despfiltro-limpar').addEventListener('click', function () {
      selectProcesso.value = '';
      document.getElementById('despfiltro-tipo').value = '';
      document.getElementById('despfiltro-data-de').value = '';
      document.getElementById('despfiltro-data-ate').value = '';
      renderDespesasProcesso();
    });
  }

  // Modal unico de "Nova despesa" / "Editar despesa" -- idAtual null = criar, preenchido = editar
  // (mesmo padrao de reaproveitar um so modal ja usado em wireEditarContratoModal).
  function wireNovaDespesaModal() {
    var btnAbrir = document.getElementById('btn-nova-despesa');
    var modal = document.getElementById('modal-nova-despesa');
    if (!btnAbrir || !modal) return;
    var titulo = document.getElementById('ndespesa-titulo');
    var selectProcesso = document.getElementById('ndespesa-processo');
    var selectTipo = document.getElementById('ndespesa-tipo');
    var campoDescricao = document.getElementById('ndespesa-descricao');
    var campoValor = document.getElementById('ndespesa-valor');
    var campoData = document.getElementById('ndespesa-data');
    var campoReembolsavel = document.getElementById('ndespesa-reembolsavel');
    var erroEl = document.getElementById('ndespesa-erro');
    var btnSalvar = document.getElementById('ndespesa-salvar');
    var opcoesCarregadas = false;
    var idAtual = null;
    aplicarMascaraMoeda(campoValor);

    function carregarOpcoesProcesso() {
      if (opcoesCarregadas) return;
      opcoesCarregadas = true;
      apiGetJson('/api/painel?acao=processo_manual_listar').then(function (d) {
        selectProcesso.innerHTML = '<option value="">Selecione</option>' +
          (d.processos || []).map(function (p) {
            return '<option value="' + esc(p.numero_cnj) + '">' + esc(p.numero_cnj) + (p.cliente_nome ? ' — ' + esc(p.cliente_nome) : '') + '</option>';
          }).join('');
      }).catch(function () {});
    }

    function abrirModalCriar() {
      idAtual = null;
      titulo.firstChild.textContent = 'Nova despesa';
      erroEl.textContent = '';
      carregarOpcoesProcesso();
      selectProcesso.value = '';
      selectTipo.value = 'Custas';
      campoDescricao.value = '';
      campoValor.value = '';
      campoData.value = new Date().toISOString().slice(0, 10);
      campoReembolsavel.checked = true;
      modal.classList.remove('hidden');
    }

    window.abrirModalDespesa = function (item) {
      idAtual = item.id;
      titulo.firstChild.textContent = 'Editar despesa';
      erroEl.textContent = '';
      carregarOpcoesProcesso();
      selectProcesso.value = item.processo_numero || '';
      selectTipo.value = item.tipo || 'Outros';
      campoDescricao.value = item.descricao || '';
      campoValor.value = item.valor ? fmtMoeda(item.valor) : '';
      campoData.value = item.data ? item.data.split('T')[0] : '';
      campoReembolsavel.checked = !!item.reembolsavel;
      modal.classList.remove('hidden');
    };

    function fecharModal() { modal.classList.add('hidden'); }

    btnAbrir.addEventListener('click', abrirModalCriar);
    document.getElementById('ndespesa-fechar').addEventListener('click', fecharModal);
    document.getElementById('ndespesa-cancelar').addEventListener('click', fecharModal);
    modal.addEventListener('click', function (e) { if (e.target === modal) fecharModal(); });

    btnSalvar.addEventListener('click', function () {
      erroEl.textContent = '';
      if (!selectProcesso.value) { erroEl.textContent = 'Selecione o processo.'; return; }
      var corpo = {
        tipo: idAtual ? 'despesa_processo_editar' : 'despesa_processo_criar',
        processo_numero: selectProcesso.value,
        tipo_despesa: selectTipo.value,
        descricao: campoDescricao.value.trim(),
        valor: campoValor.value,
        data_despesa: campoData.value ? fmtDataCurta(campoData.value) : '',
        reembolsavel: campoReembolsavel.checked ? 'true' : 'false',
      };
      if (idAtual) corpo.id = idAtual;
      btnSalvar.disabled = true;
      btnSalvar.textContent = 'Salvando…';
      apiPostJson('/api/painel?acao=executar', corpo)
        .then(function () {
          fecharModal();
          carregarDespesasProcesso();
        })
        .catch(function (e) { erroEl.textContent = e.message || 'Não foi possível salvar agora.'; })
        .finally(function () { btnSalvar.disabled = false; btnSalvar.textContent = 'Salvar'; });
    });
  }

  var contasPagarCache = [];

  var CHIPS_STATUS_CONTA_PAGAR = {
    Aberta: '<span class="chip neutral">Aberta</span>',
    Parcial: '<span class="chip neutral">Parcial</span>',
    Paga: '<span class="chip good">Paga</span>',
    Cancelada: '<span class="chip neutral">Cancelada</span>',
    Vencida: '<span class="chip crit">Vencida</span>',
  };

  function lerFiltrosContasPagar() {
    var elStatus = document.getElementById('cpagarfiltro-status');
    var elDataDe = document.getElementById('cpagarfiltro-data-de');
    var elDataAte = document.getElementById('cpagarfiltro-data-ate');
    var elCategoria = document.getElementById('cpagarfiltro-categoria');
    return {
      status: elStatus ? elStatus.value : '',
      dataDe: elDataDe ? elDataDe.value : '',
      dataAte: elDataAte ? elDataAte.value : '',
      categoria: elCategoria ? elCategoria.value.toLowerCase().trim() : '',
    };
  }

  function contaPagarPassaFiltro(c, filtros) {
    if (filtros.status && c.status_exibicao !== filtros.status) return false;
    var vencimento = (c.vencimento || '').split('T')[0];
    if (filtros.dataDe && vencimento && vencimento < filtros.dataDe) return false;
    if (filtros.dataAte && vencimento && vencimento > filtros.dataAte) return false;
    if (filtros.categoria && (c.categoria || '').toLowerCase().indexOf(filtros.categoria) === -1) return false;
    return true;
  }

  function atualizarTotaisContasPagar() {
    var pendente = 0, pago = 0, atraso = 0;
    contasPagarCache.forEach(function (c) {
      if (c.status === 'Cancelada') return;
      pago += c.valor_pago || 0;
      var saldo = (c.valor || 0) - (c.valor_pago || 0);
      if (c.status_exibicao === 'Vencida') atraso += saldo;
      if (c.status !== 'Paga') pendente += saldo;
    });
    var elPendente = document.getElementById('cpagar-total-pendente');
    var elPago = document.getElementById('cpagar-total-pago');
    var elAtraso = document.getElementById('cpagar-total-atraso');
    if (elPendente) elPendente.textContent = fmtMoeda(pendente);
    if (elPago) elPago.textContent = fmtMoeda(pago);
    if (elAtraso) elAtraso.textContent = fmtMoeda(atraso);
  }

  function renderContasPagar() {
    var container = document.getElementById('contas-pagar-lista');
    if (!container) return;
    atualizarTotaisContasPagar();
    var filtros = lerFiltrosContasPagar();
    var contas = contasPagarCache.filter(function (c) { return contaPagarPassaFiltro(c, filtros); });
    if (contas.length === 0) {
      var temFiltroAtivo = filtros.status || filtros.dataDe || filtros.dataAte || filtros.categoria;
      container.innerHTML = '<div class="empty-state"><div class="msg">' +
        (temFiltroAtivo ? 'Nenhuma conta encontrada com esses filtros.' : 'Nenhuma conta a pagar cadastrada ainda. Use "+ Nova conta" pra adicionar.') +
        '</div></div>';
      return;
    }
    var linhas = contas.map(function (c) {
      var podePagar = c.status !== 'Paga' && c.status !== 'Cancelada';
      var acoes = '';
      if (podePagar) {
        acoes += '<button type="button" class="btn-conexao" data-pagar-conta-id="' + esc(c.id) + '" style="padding:4px 10px; font-size:12.5px;">Pagar</button>';
      }
      acoes +=
        '<button type="button" class="btn-editar" data-editar-conta-id="' + esc(c.id) + '">Editar</button>' +
        '<button type="button" class="btn-remover" data-excluir-conta-id="' + esc(c.id) + '">Excluir</button>';
      return '<tr><td>' + esc(c.descricao) + '</td>' +
        '<td>' + esc(c.categoria || '—') + '</td>' +
        '<td class="num">R$ ' + fmtMoeda(c.valor) + '</td>' +
        '<td>' + (c.vencimento ? fmtDataCurta(c.vencimento) : '—') + '</td>' +
        '<td class="num">R$ ' + fmtMoeda(c.valor_pago) + '</td>' +
        '<td>' + (CHIPS_STATUS_CONTA_PAGAR[c.status_exibicao] || CHIPS_STATUS_CONTA_PAGAR.Aberta) + '</td>' +
        '<td><div style="display:flex; flex-wrap:wrap; gap:6px;">' + acoes + '</div></td></tr>';
    }).join('');
    container.innerHTML = '<div class="table-scroll"><table>' +
      '<thead><tr><th>Descrição</th><th>Categoria</th><th style="text-align:right">Valor</th>' +
      '<th>Vencimento</th><th style="text-align:right">Pago</th><th>Status</th><th>Ações</th></tr></thead>' +
      '<tbody>' + linhas + '</tbody></table></div>';

    container.querySelectorAll('[data-editar-conta-id]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var item = contasPagarCache.filter(function (c) { return String(c.id) === btn.getAttribute('data-editar-conta-id'); })[0];
        if (item && window.abrirModalContaPagar) window.abrirModalContaPagar(item);
      });
    });
    container.querySelectorAll('[data-pagar-conta-id]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var item = contasPagarCache.filter(function (c) { return String(c.id) === btn.getAttribute('data-pagar-conta-id'); })[0];
        if (item && window.abrirModalPagarConta) window.abrirModalPagarConta(item);
      });
    });
    container.querySelectorAll('[data-excluir-conta-id]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idExcluir = btn.getAttribute('data-excluir-conta-id');
        confirmarModal('Excluir essa conta a pagar? Essa ação não pode ser desfeita.').then(function (ok) {
          if (!ok) return;
          btn.disabled = true;
          apiPostJson('/api/painel?acao=executar', { tipo: 'conta_pagar_excluir', id: idExcluir })
            .then(function () { carregarContasPagar(); })
            .catch(function (e) {
              mostrarAviso(e.message || 'Não foi possível excluir agora.');
              btn.disabled = false;
            });
        });
      });
    });
  }

  function carregarContasPagar() {
    var container = document.getElementById('contas-pagar-lista');
    if (!container) return;
    apiPostJson('/api/painel?acao=executar', { tipo: 'conta_pagar_listar' })
      .then(function (dados) {
        contasPagarCache = dados.contas || [];
        renderContasPagar();
      })
      .catch(function () {
        container.innerHTML = '<div class="empty-state"><div class="msg">Não foi possível carregar as contas a pagar agora.</div></div>';
      });
  }

  function wireFiltroContasPagar() {
    var selectStatus = document.getElementById('cpagarfiltro-status');
    if (!selectStatus) return;
    document.getElementById('cpagarfiltro-data-de-hoje').addEventListener('click', function () {
      document.getElementById('cpagarfiltro-data-de').value = new Date().toISOString().slice(0, 10);
    });
    document.getElementById('cpagarfiltro-data-ate-hoje').addEventListener('click', function () {
      document.getElementById('cpagarfiltro-data-ate').value = new Date().toISOString().slice(0, 10);
    });
    document.getElementById('cpagarfiltro-buscar').addEventListener('click', renderContasPagar);
    document.getElementById('cpagarfiltro-limpar').addEventListener('click', function () {
      selectStatus.value = '';
      document.getElementById('cpagarfiltro-data-de').value = '';
      document.getElementById('cpagarfiltro-data-ate').value = '';
      document.getElementById('cpagarfiltro-categoria').value = '';
      renderContasPagar();
    });
  }

  // Modal unico de "Nova conta a pagar" / "Editar" -- idAtual null = criar, preenchido = editar
  // (mesmo padrao ja usado em wireNovaDespesaModal/wireEditarContratoModal).
  function wireNovaContaPagarModal() {
    var btnAbrir = document.getElementById('btn-nova-conta-pagar');
    var modal = document.getElementById('modal-nova-conta-pagar');
    if (!btnAbrir || !modal) return;
    var titulo = document.getElementById('ncpagar-titulo');
    var campoDescricao = document.getElementById('ncpagar-descricao');
    var campoCategoria = document.getElementById('ncpagar-categoria');
    var campoValor = document.getElementById('ncpagar-valor');
    var campoVencimento = document.getElementById('ncpagar-vencimento');
    var campoObservacoes = document.getElementById('ncpagar-observacoes');
    var erroEl = document.getElementById('ncpagar-erro');
    var btnSalvar = document.getElementById('ncpagar-salvar');
    var idAtual = null;
    aplicarMascaraMoeda(campoValor);

    function abrirModalCriar() {
      idAtual = null;
      titulo.firstChild.textContent = 'Nova conta a pagar';
      erroEl.textContent = '';
      campoDescricao.value = '';
      campoCategoria.value = '';
      campoValor.value = '';
      campoVencimento.value = new Date().toISOString().slice(0, 10);
      campoObservacoes.value = '';
      modal.classList.remove('hidden');
    }

    window.abrirModalContaPagar = function (item) {
      idAtual = item.id;
      titulo.firstChild.textContent = 'Editar conta a pagar';
      erroEl.textContent = '';
      campoDescricao.value = item.descricao || '';
      campoCategoria.value = item.categoria || '';
      campoValor.value = item.valor ? fmtMoeda(item.valor) : '';
      campoVencimento.value = item.vencimento ? item.vencimento.split('T')[0] : '';
      campoObservacoes.value = item.observacoes || '';
      modal.classList.remove('hidden');
    };

    function fecharModal() { modal.classList.add('hidden'); }

    btnAbrir.addEventListener('click', abrirModalCriar);
    document.getElementById('ncpagar-fechar').addEventListener('click', fecharModal);
    document.getElementById('ncpagar-cancelar').addEventListener('click', fecharModal);
    document.getElementById('ncpagar-vencimento-hoje').addEventListener('click', function () {
      campoVencimento.value = new Date().toISOString().slice(0, 10);
    });
    modal.addEventListener('click', function (e) { if (e.target === modal) fecharModal(); });

    btnSalvar.addEventListener('click', function () {
      erroEl.textContent = '';
      if (!campoDescricao.value.trim()) { erroEl.textContent = 'Informe a descrição.'; return; }
      if (!campoValor.value) { erroEl.textContent = 'Informe o valor.'; return; }
      if (!campoVencimento.value) { erroEl.textContent = 'Informe o vencimento.'; return; }
      var corpo = {
        tipo: idAtual ? 'conta_pagar_editar' : 'conta_pagar_criar',
        descricao: campoDescricao.value.trim(),
        categoria: campoCategoria.value.trim(),
        valor: campoValor.value,
        vencimento: fmtDataCurta(campoVencimento.value),
        observacoes: campoObservacoes.value.trim(),
      };
      if (idAtual) corpo.id = idAtual;
      btnSalvar.disabled = true;
      btnSalvar.textContent = 'Salvando…';
      apiPostJson('/api/painel?acao=executar', corpo)
        .then(function () {
          fecharModal();
          carregarContasPagar();
        })
        .catch(function (e) { erroEl.textContent = e.message || 'Não foi possível salvar agora.'; })
        .finally(function () { btnSalvar.disabled = false; btnSalvar.textContent = 'Salvar'; });
    });
  }

  function wirePagarContaPagarModal() {
    var modal = document.getElementById('modal-pagar-conta-pagar');
    if (!modal) return;
    var campoValor = document.getElementById('pcpagar-valor');
    var erroEl = document.getElementById('pcpagar-erro');
    var btnSalvar = document.getElementById('pcpagar-salvar');
    var idAtual = null;
    aplicarMascaraMoeda(campoValor);

    window.abrirModalPagarConta = function (item) {
      idAtual = item.id;
      erroEl.textContent = '';
      campoValor.value = fmtMoeda(Math.max((item.valor || 0) - (item.valor_pago || 0), 0));
      modal.classList.remove('hidden');
    };

    function fecharModal() { modal.classList.add('hidden'); }

    document.getElementById('pcpagar-fechar').addEventListener('click', fecharModal);
    document.getElementById('pcpagar-cancelar').addEventListener('click', fecharModal);
    modal.addEventListener('click', function (e) { if (e.target === modal) fecharModal(); });

    btnSalvar.addEventListener('click', function () {
      erroEl.textContent = '';
      if (!campoValor.value || Number(campoValor.value) <= 0) { erroEl.textContent = 'Informe um valor maior que zero.'; return; }
      btnSalvar.disabled = true;
      btnSalvar.textContent = 'Confirmando…';
      apiPostJson('/api/painel?acao=executar', { tipo: 'conta_pagar_pagar', id: idAtual, valor: campoValor.value })
        .then(function () {
          fecharModal();
          carregarContasPagar();
        })
        .catch(function (e) { erroEl.textContent = e.message || 'Não foi possível registrar o pagamento agora.'; })
        .finally(function () { btnSalvar.disabled = false; btnSalvar.textContent = 'Confirmar'; });
    });
  }

  var contasRecorrentesCache = [];

  function lerFiltrosContasRecorrentes() {
    var elStatus = document.getElementById('crecfiltro-status');
    var elCategoria = document.getElementById('crecfiltro-categoria');
    return {
      status: elStatus ? elStatus.value : '',
      categoria: elCategoria ? elCategoria.value.toLowerCase().trim() : '',
    };
  }

  function contaRecorrentePassaFiltro(c, filtros) {
    if (filtros.status && c.status !== filtros.status) return false;
    if (filtros.categoria && (c.categoria || '').toLowerCase().indexOf(filtros.categoria) === -1) return false;
    return true;
  }

  function renderContasRecorrentes() {
    var container = document.getElementById('contas-recorrentes-lista');
    if (!container) return;
    var filtros = lerFiltrosContasRecorrentes();
    var contas = contasRecorrentesCache.filter(function (c) { return contaRecorrentePassaFiltro(c, filtros); });
    if (contas.length === 0) {
      var temFiltroAtivo = filtros.status || filtros.categoria;
      container.innerHTML = '<div class="empty-state"><div class="msg">' +
        (temFiltroAtivo ? 'Nenhuma conta recorrente encontrada com esses filtros.' : 'Nenhuma conta recorrente cadastrada ainda. Use "+ Nova conta recorrente" pra adicionar.') +
        '</div></div>';
      return;
    }
    var linhas = contas.map(function (c) {
      return '<tr><td>' + esc(c.descricao) + '</td>' +
        '<td>' + esc(c.categoria || '—') + '</td>' +
        '<td class="num">R$ ' + fmtMoeda(c.valor) + '</td>' +
        '<td>' + esc(c.periodicidade) + '</td>' +
        '<td>' + esc(c.dia_vencimento) + '</td>' +
        '<td>' + (c.data_inicio ? fmtDataCurta(c.data_inicio) : '—') + '</td>' +
        '<td>' + (c.data_termino ? fmtDataCurta(c.data_termino) : '—') + '</td>' +
        '<td>' + (c.status === 'Ativa' ? '<span class="chip good">Ativa</span>' : '<span class="chip neutral">Pausada</span>') + '</td>' +
        '<td><div style="display:flex; flex-wrap:wrap; gap:6px;">' +
          '<button type="button" class="btn-editar" data-editar-conta-rec-id="' + esc(c.id) + '">Editar</button>' +
          '<button type="button" class="btn-remover" data-excluir-conta-rec-id="' + esc(c.id) + '">Excluir</button>' +
        '</div></td></tr>';
    }).join('');
    container.innerHTML = '<div class="table-scroll"><table>' +
      '<thead><tr><th>Descrição</th><th>Categoria</th><th style="text-align:right">Valor</th>' +
      '<th>Periodicidade</th><th>Dia Venc.</th><th>Início</th><th>Término</th><th>Status</th><th>Ações</th></tr></thead>' +
      '<tbody>' + linhas + '</tbody></table></div>';

    container.querySelectorAll('[data-editar-conta-rec-id]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var item = contasRecorrentesCache.filter(function (c) { return String(c.id) === btn.getAttribute('data-editar-conta-rec-id'); })[0];
        if (item && window.abrirModalContaRecorrente) window.abrirModalContaRecorrente(item);
      });
    });
    container.querySelectorAll('[data-excluir-conta-rec-id]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idExcluir = btn.getAttribute('data-excluir-conta-rec-id');
        confirmarModal('Excluir essa conta recorrente? Essa ação não pode ser desfeita.').then(function (ok) {
          if (!ok) return;
          btn.disabled = true;
          apiPostJson('/api/painel?acao=executar', { tipo: 'conta_recorrente_excluir', id: idExcluir })
            .then(function () { carregarContasRecorrentes(); })
            .catch(function (e) {
              mostrarAviso(e.message || 'Não foi possível excluir agora.');
              btn.disabled = false;
            });
        });
      });
    });
  }

  function carregarContasRecorrentes() {
    var container = document.getElementById('contas-recorrentes-lista');
    if (!container) return;
    apiPostJson('/api/painel?acao=executar', { tipo: 'conta_recorrente_listar' })
      .then(function (dados) {
        contasRecorrentesCache = dados.recorrentes || [];
        renderContasRecorrentes();
      })
      .catch(function () {
        container.innerHTML = '<div class="empty-state"><div class="msg">Não foi possível carregar as contas recorrentes agora.</div></div>';
      });
  }

  function wireFiltroContasRecorrentes() {
    var selectStatus = document.getElementById('crecfiltro-status');
    if (!selectStatus) return;
    document.getElementById('crecfiltro-buscar').addEventListener('click', renderContasRecorrentes);
    document.getElementById('crecfiltro-limpar').addEventListener('click', function () {
      selectStatus.value = '';
      document.getElementById('crecfiltro-categoria').value = '';
      renderContasRecorrentes();
    });
  }

  // Modal unico de "Nova conta recorrente" / "Editar" -- idAtual null = criar, preenchido = editar.
  function wireNovaContaRecorrenteModal() {
    var btnAbrir = document.getElementById('btn-nova-conta-recorrente');
    var modal = document.getElementById('modal-nova-conta-recorrente');
    if (!btnAbrir || !modal) return;
    var titulo = document.getElementById('ncrec-titulo');
    var campoDescricao = document.getElementById('ncrec-descricao');
    var campoCategoria = document.getElementById('ncrec-categoria');
    var campoValor = document.getElementById('ncrec-valor');
    var selectPeriodicidade = document.getElementById('ncrec-periodicidade');
    var campoDiaVencimento = document.getElementById('ncrec-dia-vencimento');
    var campoDataInicio = document.getElementById('ncrec-data-inicio');
    var campoDataTermino = document.getElementById('ncrec-data-termino');
    var selectFormaPagamento = document.getElementById('ncrec-forma-pagamento');
    var selectStatus = document.getElementById('ncrec-status');
    var erroEl = document.getElementById('ncrec-erro');
    var btnSalvar = document.getElementById('ncrec-salvar');
    var idAtual = null;
    aplicarMascaraMoeda(campoValor);

    function abrirModalCriar() {
      idAtual = null;
      titulo.firstChild.textContent = 'Nova conta recorrente';
      erroEl.textContent = '';
      campoDescricao.value = '';
      campoCategoria.value = '';
      campoValor.value = '';
      selectPeriodicidade.value = 'Mensal';
      campoDiaVencimento.value = '10';
      campoDataInicio.value = new Date().toISOString().slice(0, 10);
      campoDataTermino.value = '';
      selectFormaPagamento.value = '';
      selectStatus.value = 'Ativa';
      modal.classList.remove('hidden');
    }

    window.abrirModalContaRecorrente = function (item) {
      idAtual = item.id;
      titulo.firstChild.textContent = 'Editar conta recorrente';
      erroEl.textContent = '';
      campoDescricao.value = item.descricao || '';
      campoCategoria.value = item.categoria || '';
      campoValor.value = item.valor ? fmtMoeda(item.valor) : '';
      selectPeriodicidade.value = item.periodicidade || 'Mensal';
      campoDiaVencimento.value = item.dia_vencimento || '';
      campoDataInicio.value = item.data_inicio ? item.data_inicio.split('T')[0] : '';
      campoDataTermino.value = item.data_termino ? item.data_termino.split('T')[0] : '';
      selectFormaPagamento.value = item.forma_pagamento || '';
      selectStatus.value = item.status || 'Ativa';
      modal.classList.remove('hidden');
    };

    function fecharModal() { modal.classList.add('hidden'); }

    btnAbrir.addEventListener('click', abrirModalCriar);
    document.getElementById('ncrec-fechar').addEventListener('click', fecharModal);
    document.getElementById('ncrec-cancelar').addEventListener('click', fecharModal);
    document.getElementById('ncrec-data-inicio-hoje').addEventListener('click', function () {
      campoDataInicio.value = new Date().toISOString().slice(0, 10);
    });
    document.getElementById('ncrec-data-termino-hoje').addEventListener('click', function () {
      campoDataTermino.value = new Date().toISOString().slice(0, 10);
    });
    modal.addEventListener('click', function (e) { if (e.target === modal) fecharModal(); });

    btnSalvar.addEventListener('click', function () {
      erroEl.textContent = '';
      if (!campoDescricao.value.trim()) { erroEl.textContent = 'Informe a descrição.'; return; }
      if (!campoValor.value) { erroEl.textContent = 'Informe o valor.'; return; }
      if (!campoDiaVencimento.value) { erroEl.textContent = 'Informe o dia do vencimento.'; return; }
      if (!campoDataInicio.value) { erroEl.textContent = 'Informe a data de início.'; return; }
      var corpo = {
        tipo: idAtual ? 'conta_recorrente_editar' : 'conta_recorrente_criar',
        descricao: campoDescricao.value.trim(),
        categoria: campoCategoria.value.trim(),
        valor: campoValor.value,
        periodicidade: selectPeriodicidade.value,
        dia_vencimento: campoDiaVencimento.value,
        data_inicio: fmtDataCurta(campoDataInicio.value),
        data_termino: campoDataTermino.value ? fmtDataCurta(campoDataTermino.value) : '',
        forma_pagamento: selectFormaPagamento.value,
        status: selectStatus.value,
      };
      if (idAtual) corpo.id = idAtual;
      btnSalvar.disabled = true;
      btnSalvar.textContent = 'Salvando…';
      apiPostJson('/api/painel?acao=executar', corpo)
        .then(function () {
          fecharModal();
          carregarContasRecorrentes();
        })
        .catch(function (e) { erroEl.textContent = e.message || 'Não foi possível salvar agora.'; })
        .finally(function () { btnSalvar.disabled = false; btnSalvar.textContent = 'Salvar'; });
    });
  }

  function wireNovoContratoModal() {
    var btnAbrir = document.getElementById('btn-novo-contrato-honorarios');
    var modal = document.getElementById('modal-novo-contrato');
    if (!btnAbrir || !modal) return;
    var selectCliente = document.getElementById('ncontrato-cliente');
    var selectProcesso = document.getElementById('ncontrato-processo');
    var selectTipo = document.getElementById('ncontrato-tipo');
    var campoValor = document.getElementById('ncontrato-campo-valor');
    var campoPercentual = document.getElementById('ncontrato-campo-percentual');
    var campoValorCausa = document.getElementById('ncontrato-campo-valor-causa');
    var linhaEntrada = document.getElementById('ncontrato-linha-entrada');
    var linhaParcelas = document.getElementById('ncontrato-linha-parcelas');
    var campoPeriodicidade = document.getElementById('ncontrato-campo-periodicidade');
    var inputParcelas = document.getElementById('ncontrato-parcelas');
    var inputDataInicio = document.getElementById('ncontrato-data-inicio');
    var erroEl = document.getElementById('ncontrato-erro');
    var btnSalvar = document.getElementById('ncontrato-salvar');
    var opcoesCarregadas = false;
    var clientePorProcesso = {}; // valor do <option> de processo -> nome do cliente (pra auto-selecionar)
    aplicarMascaraMoeda(document.getElementById('ncontrato-valor'));
    aplicarMascaraMoeda(document.getElementById('ncontrato-valor-entrada'));
    aplicarMascaraMoeda(document.getElementById('ncontrato-valor-causa'));

    function atualizarCamposPorTipo() {
      var tipo = selectTipo.value;
      var temValor = tipo === 'fixo' || tipo === 'valor_exito' || tipo === 'mensal' || tipo === 'vinculado_processo';
      var temExito = tipo === 'exito' || tipo === 'valor_exito';
      campoValor.classList.toggle('hidden', !temValor);
      campoPercentual.classList.toggle('hidden', !temExito);
      campoValorCausa.classList.toggle('hidden', !temExito);
      linhaEntrada.classList.toggle('hidden', !temValor);
      linhaParcelas.classList.toggle('hidden', !temValor);
    }

    function atualizarPeriodicidade() {
      var n = parseInt(inputParcelas.value, 10) || 1;
      campoPeriodicidade.classList.toggle('hidden', n <= 1);
    }

    function abrirModal() {
      erroEl.textContent = '';
      selectTipo.value = 'fixo';
      document.getElementById('ncontrato-valor').value = '';
      document.getElementById('ncontrato-percentual').value = '';
      document.getElementById('ncontrato-valor-causa').value = '';
      document.getElementById('ncontrato-valor-entrada').value = '';
      document.getElementById('ncontrato-data-entrada').value = '';
      inputParcelas.value = '1';
      document.getElementById('ncontrato-periodicidade').value = 'Mensal';
      inputDataInicio.value = new Date().toISOString().slice(0, 10);
      selectCliente.value = '';
      selectProcesso.value = '';
      atualizarCamposPorTipo();
      atualizarPeriodicidade();
      modal.classList.remove('hidden');
      if (!opcoesCarregadas) {
        opcoesCarregadas = true;
        apiGetJson('/api/painel?acao=cliente_cadastro_listar').then(function (d) {
          selectCliente.innerHTML = '<option value="">Selecione o cliente</option>' +
            (d.clientes || []).map(function (c) { return '<option value="' + esc(c.nome) + '">' + esc(c.nome) + '</option>'; }).join('');
        }).catch(function () {});
        Promise.all([
          apiGetJson('/api/painel?acao=processo_manual_listar').catch(function () { return { processos: [] }; }),
          apiGetJson('/api/painel?acao=processos_administrativos&op=listar').catch(function () { return { processos: [] }; }),
        ]).then(function (resultados) {
          var judiciais = resultados[0].processos || [];
          var administrativos = resultados[1].processos || [];
          clientePorProcesso = {};
          var optionsJudiciais = judiciais.map(function (p) {
            if (p.cliente_nome) clientePorProcesso[p.numero_cnj] = p.cliente_nome;
            return '<option value="' + esc(p.numero_cnj) + '">' + esc(p.numero_cnj) + (p.cliente_nome ? ' — ' + esc(p.cliente_nome) : '') + '</option>';
          }).join('');
          var optionsAdministrativos = administrativos.map(function (p) {
            var rotulo = (p.numero_protocolo || '(sem protocolo)') + (p.orgao ? ' — ' + p.orgao : '') + (p.cliente ? ' — ' + p.cliente : '');
            if (p.cliente) clientePorProcesso[rotulo] = p.cliente;
            return '<option value="' + esc(rotulo) + '">' + esc(rotulo) + '</option>';
          }).join('');
          selectProcesso.innerHTML = '<option value="">Nenhum (contrato consultivo/mensal)</option>' +
            (optionsJudiciais ? '<optgroup label="Processos judiciais">' + optionsJudiciais + '</optgroup>' : '') +
            (optionsAdministrativos ? '<optgroup label="Processos administrativos">' + optionsAdministrativos + '</optgroup>' : '');
        }).catch(function () {});
      }
    }

    function fecharModal() { modal.classList.add('hidden'); }

    btnAbrir.addEventListener('click', abrirModal);
    document.getElementById('ncontrato-fechar').addEventListener('click', fecharModal);
    document.getElementById('ncontrato-cancelar').addEventListener('click', fecharModal);
    modal.addEventListener('click', function (e) { if (e.target === modal) fecharModal(); });
    selectTipo.addEventListener('change', atualizarCamposPorTipo);
    inputParcelas.addEventListener('input', atualizarPeriodicidade);
    selectProcesso.addEventListener('change', function () {
      var nomeCliente = clientePorProcesso[selectProcesso.value];
      if (!nomeCliente) return;
      // so seleciona se o cliente do processo estiver mesmo na lista (evita deixar o campo
      // apontando pra um nome que nao existe como <option>).
      var existe = Array.prototype.some.call(selectCliente.options, function (o) { return o.value === nomeCliente; });
      if (existe) selectCliente.value = nomeCliente;
    });

    btnSalvar.addEventListener('click', function () {
      var nome = selectCliente.value;
      if (!nome) { erroEl.textContent = 'Selecione o cliente.'; return; }
      var corpo = {
        tipo: 'financeiro_contrato_criar',
        nome: nome,
        tipo_contrato: selectTipo.value,
        processo_numero: selectProcesso.value,
        valor_total: document.getElementById('ncontrato-valor').value,
        percentual_exito: document.getElementById('ncontrato-percentual').value,
        valor_causa: document.getElementById('ncontrato-valor-causa').value,
        valor_entrada: document.getElementById('ncontrato-valor-entrada').value,
        data_entrada: document.getElementById('ncontrato-data-entrada').value ? fmtDataCurta(document.getElementById('ncontrato-data-entrada').value) : '',
        data_inicio: inputDataInicio.value ? fmtDataCurta(inputDataInicio.value) : '',
        num_parcelas: inputParcelas.value,
        periodicidade: document.getElementById('ncontrato-periodicidade').value,
      };
      btnSalvar.disabled = true;
      btnSalvar.textContent = 'Salvando…';
      erroEl.textContent = '';
      apiPost('/api/painel?acao=executar', corpo)
        .then(function (r) { return r.json().then(function (c) { return { status: r.status, corpo: c }; }); })
        .then(function (resultado) {
          if (resultado.status === 200) {
            fecharModal();
            carregarHonorariosContratos();
          } else {
            erroEl.textContent = resultado.corpo.erro || 'Não foi possível salvar o contrato.';
          }
        })
        .catch(function () { erroEl.textContent = 'Erro de conexão ao salvar o contrato.'; })
        .finally(function () { btnSalvar.disabled = false; btnSalvar.textContent = 'Salvar'; });
    });
  }

  // Edicao dos campos descritivos (cliente, servico, status/situacao e, pro exito, percentual +
  // valor recebido) de um contrato ou honorario de exito ja lancado -- de proposito NAO deixa
  // mudar valor_total/parcelas de um contrato (ver banco.atualizar_contrato: as parcelas ja
  // foram geradas e podem ja ter pagamento registrado; pra corrigir valor, exclua e recrie).
  function wireEditarContratoModal() {
    var modal = document.getElementById('modal-editar-contrato');
    if (!modal) return;
    var campoCliente = document.getElementById('econtrato-cliente');
    var campoServico = document.getElementById('econtrato-servico');
    var campoStatusContratoWrap = document.getElementById('econtrato-campo-status-contrato');
    var selectStatusContrato = document.getElementById('econtrato-status-contrato');
    var linhaExito = document.getElementById('econtrato-linha-exito');
    var linhaExitoCausa = document.getElementById('econtrato-linha-exito-causa');
    var linhaExitoEstimativa = document.getElementById('econtrato-linha-exito-estimativa');
    var campoPercentual = document.getElementById('econtrato-percentual');
    var campoValorRecebido = document.getElementById('econtrato-valor-recebido');
    var campoValorCausaEditar = document.getElementById('econtrato-valor-causa');
    var campoValorGanhoCausa = document.getElementById('econtrato-valor-ganho-causa');
    var campoValorEstimado = document.getElementById('econtrato-valor-estimado');
    var elHonorarioEstimado = document.getElementById('econtrato-honorario-estimado');
    var campoSituacaoWrap = document.getElementById('econtrato-campo-situacao');
    var campoSituacao = document.getElementById('econtrato-situacao');
    var linhaExitoRecebimento = document.getElementById('econtrato-linha-exito-recebimento');
    var campoValorJaRecebido = document.getElementById('econtrato-valor-ja-recebido');
    var elAReceberExito = document.getElementById('econtrato-a-receber-exito');
    var honorarioAtualExito = 0;
    var campoValoresWrap = document.getElementById('econtrato-campo-valores');
    var checkboxAlterarValores = document.getElementById('econtrato-alterar-valores');
    var subcamposValores = document.getElementById('econtrato-subcampos-valores');
    var campoValorTotal = document.getElementById('econtrato-valor-total');
    var campoValorEntradaNovo = document.getElementById('econtrato-valor-entrada');
    var campoNumParcelas = document.getElementById('econtrato-num-parcelas');
    var selectPeriodicidade = document.getElementById('econtrato-periodicidade');
    var campoDataInicio = document.getElementById('econtrato-data-inicio');
    var campoDataEntrada = document.getElementById('econtrato-data-entrada');
    var erroEl = document.getElementById('econtrato-erro');
    var btnSalvar = document.getElementById('econtrato-salvar');
    var tipoRegistroAtual = null;
    var idAtual = null;
    aplicarMascaraMoeda(campoValorRecebido);
    aplicarMascaraMoeda(campoValorTotal);
    aplicarMascaraMoeda(campoValorEntradaNovo);
    aplicarMascaraMoeda(campoValorCausaEditar);
    aplicarMascaraMoeda(campoValorGanhoCausa);
    aplicarMascaraMoeda(campoValorEstimado);
    aplicarMascaraMoeda(campoValorJaRecebido);

    checkboxAlterarValores.addEventListener('change', function () {
      subcamposValores.classList.toggle('hidden', !checkboxAlterarValores.checked);
    });

    var estimativaEditadaManualmente = false;

    function atualizarHonorarioEstimado() {
      var percentual = parseFloat((campoPercentual.value || '').replace(',', '.'));
      var estimativa = parseFloat((campoValorEstimado.value || '').replace(/\./g, '').replace(',', '.'));
      if (!percentual || !estimativa) { elHonorarioEstimado.textContent = '—'; return; }
      elHonorarioEstimado.textContent = 'R$ ' + fmtMoeda(estimativa * (percentual / 100));
    }
    campoPercentual.addEventListener('input', atualizarHonorarioEstimado);
    campoValorEstimado.addEventListener('input', function () {
      // usuario digitou a propria estimativa -- para de preencher sozinho a partir do valor da
      // causa, senao apagaria o que ele acabou de escrever.
      estimativaEditadaManualmente = true;
      atualizarHonorarioEstimado();
    });
    campoValorEstimado.addEventListener('blur', atualizarHonorarioEstimado);
    // enquanto o usuario nao digitar a propria estimativa, ela acompanha o valor da causa
    // automaticamente (pedido do usuario: preencher % + valor da causa ja calcula sozinho) --
    // assume que, sem outra informacao, o ganho esperado e o valor total pedido na causa.
    campoValorCausaEditar.addEventListener('input', function () {
      if (!estimativaEditadaManualmente) {
        campoValorEstimado.value = campoValorCausaEditar.value;
        atualizarHonorarioEstimado();
      }
    });

    function honorarioAtualCalculado() {
      var percentual = parseFloat((campoPercentual.value || '').replace(',', '.')) || 0;
      var valorRecebidoClienteAtual = parseFloat((campoValorRecebido.value || '').replace(/\./g, '').replace(',', '.'));
      // se o usuario ja digitou (ou o contrato ja tinha) o valor recebido pelo cliente, o
      // honorario e recalculado na hora; senao usa o ultimo honorario ja salvo (contrato
      // resolvido antes desta edicao).
      if (valorRecebidoClienteAtual) return (percentual / 100) * valorRecebidoClienteAtual;
      return honorarioAtualExito;
    }
    function atualizarAReceberExito() {
      var honorario = honorarioAtualCalculado();
      var jaRecebido = parseFloat((campoValorJaRecebido.value || '').replace(/\./g, '').replace(',', '.')) || 0;
      if (!honorario) { elAReceberExito.textContent = '—'; return; }
      elAReceberExito.textContent = 'R$ ' + fmtMoeda(Math.max(honorario - jaRecebido, 0));
    }
    campoValorJaRecebido.addEventListener('input', atualizarAReceberExito);
    campoValorJaRecebido.addEventListener('blur', atualizarAReceberExito);
    campoValorRecebido.addEventListener('input', atualizarAReceberExito);
    campoPercentual.addEventListener('input', atualizarAReceberExito);

    function fecharModal() { modal.classList.add('hidden'); }

    window.abrirModalEditarContrato = function (tipoRegistro, item) {
      tipoRegistroAtual = tipoRegistro;
      idAtual = item.id;
      erroEl.textContent = '';
      campoCliente.value = item.nome_cliente || '';
      var ehExito = tipoRegistro === 'exito';
      campoServico.value = (ehExito ? item.servico : item.tipo_servico) || '';
      campoStatusContratoWrap.classList.toggle('hidden', ehExito);
      linhaExito.classList.toggle('hidden', !ehExito);
      linhaExitoCausa.classList.toggle('hidden', !ehExito);
      linhaExitoEstimativa.classList.toggle('hidden', !ehExito);
      linhaExitoRecebimento.classList.toggle('hidden', !ehExito);
      campoSituacaoWrap.classList.toggle('hidden', !ehExito);
      campoValoresWrap.classList.toggle('hidden', ehExito);
      checkboxAlterarValores.checked = false;
      subcamposValores.classList.add('hidden');
      if (ehExito) {
        campoPercentual.value = item.percentual ? Math.round(item.percentual * 10000) / 100 : '';
        campoValorRecebido.value = '';
        honorarioAtualExito = item.honorario || 0;
        campoValorJaRecebido.value = item.valor_ja_recebido ? fmtMoeda(item.valor_ja_recebido) : '';
        atualizarAReceberExito();
        campoValorCausaEditar.value = item.valor_causa ? fmtMoeda(item.valor_causa) : '';
        campoValorGanhoCausa.value = item.valor_ganho_causa ? fmtMoeda(item.valor_ganho_causa) : '';
        if (item.valor_estimado_ganho) {
          // ja tem uma estimativa propria salva (diferente do valor da causa) -- respeita ela,
          // nao sobrescreve automaticamente se o usuario mexer no valor da causa de novo.
          campoValorEstimado.value = fmtMoeda(item.valor_estimado_ganho);
          estimativaEditadaManualmente = true;
        } else {
          // sem estimativa propria ainda -- comeca igual ao valor da causa (pedido do usuario:
          // preencher % + valor da causa ja calcula o honorário estimado sozinho).
          campoValorEstimado.value = campoValorCausaEditar.value;
          estimativaEditadaManualmente = false;
        }
        atualizarHonorarioEstimado();
        var situacaoAtual = item.situacao || 'Aguardando resultado';
        var opcaoExistente = Array.prototype.some.call(campoSituacao.options, function (o) { return o.value === situacaoAtual; });
        if (!opcaoExistente) {
          // situacao antiga em texto livre, salva antes deste campo virar select -- preserva
          // como opcao extra em vez de trocar silenciosamente pro valor padrao.
          var opcaoLivre = document.createElement('option');
          opcaoLivre.value = situacaoAtual;
          opcaoLivre.textContent = situacaoAtual;
          campoSituacao.appendChild(opcaoLivre);
        }
        campoSituacao.value = situacaoAtual;
      } else {
        selectStatusContrato.value = item.status_contrato === 'Cancelado' ? 'Cancelado' : 'Ativo';
        campoValorTotal.value = item.valor_total ? fmtMoeda(item.valor_total) : '';
        campoValorEntradaNovo.value = item.valor_entrada ? fmtMoeda(item.valor_entrada) : '';
        campoNumParcelas.value = item.num_parcelas || 1;
        selectPeriodicidade.value = 'Mensal';
        campoDataInicio.value = item.data_inicio ? String(item.data_inicio).slice(0, 10) : '';
        campoDataEntrada.value = item.data_vencimento_entrada ? String(item.data_vencimento_entrada).slice(0, 10) : '';
      }
      modal.classList.remove('hidden');
    };

    document.getElementById('econtrato-fechar').addEventListener('click', fecharModal);
    document.getElementById('econtrato-cancelar').addEventListener('click', fecharModal);
    modal.addEventListener('click', function (e) { if (e.target === modal) fecharModal(); });

    btnSalvar.addEventListener('click', function () {
      erroEl.textContent = '';
      var nome = campoCliente.value.trim();
      if (!nome) { erroEl.textContent = 'Informe o cliente.'; return; }
      var corpo = {
        tipo: 'financeiro_contrato_editar', tipo_registro: tipoRegistroAtual, id: idAtual,
        nome: nome, tipo_servico: campoServico.value.trim(),
      };
      if (tipoRegistroAtual === 'exito') {
        corpo.percentual_exito = campoPercentual.value;
        corpo.valor_recebido_cliente = campoValorRecebido.value;
        corpo.valor_causa = campoValorCausaEditar.value;
        corpo.valor_ganho_causa = campoValorGanhoCausa.value;
        corpo.valor_estimado_ganho = campoValorEstimado.value;
        corpo.valor_ja_recebido = campoValorJaRecebido.value;
        corpo.status = campoSituacao.value.trim();
      } else {
        corpo.status = selectStatusContrato.value;
        if (checkboxAlterarValores.checked) {
          corpo.valor_total = campoValorTotal.value;
          corpo.valor_entrada = campoValorEntradaNovo.value;
          corpo.num_parcelas = campoNumParcelas.value;
          corpo.periodicidade = selectPeriodicidade.value;
          corpo.data_inicio = campoDataInicio.value ? fmtDataCurta(campoDataInicio.value) : '';
          corpo.data_entrada = campoDataEntrada.value ? fmtDataCurta(campoDataEntrada.value) : '';
        }
      }
      btnSalvar.disabled = true;
      btnSalvar.textContent = 'Salvando…';
      apiPostJson('/api/painel?acao=executar', corpo)
        .then(function () {
          fecharModal();
          carregarHonorariosContratos();
        })
        .catch(function (e) { erroEl.textContent = e.message || 'Não foi possível salvar agora.'; })
        .finally(function () { btnSalvar.disabled = false; btnSalvar.textContent = 'Salvar'; });
    });
  }

  function carregarClientesCadastrados() {
    var container = document.getElementById('clientes-cadastrados-lista');
    if (!container) return;
    apiGetJson('/api/painel?acao=cliente_cadastro_listar')
      .then(function (dados) {
        var lista = dados.clientes || [];
        if (lista.length === 0) {
          container.innerHTML = '<div class="empty-state"><div class="msg">Nenhum cliente cadastrado ainda. Use "+ Novo cliente" pra adicionar.</div></div>';
          return;
        }
        container.innerHTML = '<div class="table-scroll"><table>' +
          '<thead><tr><th>Nome</th><th>Tipo</th><th>Telefone</th><th>E-mail</th><th>Etiquetas</th><th>Ações</th></tr></thead>' +
          '<tbody>' + lista.map(function (c) {
            return '<tr><td>' + esc(c.nome) + '</td><td>' + esc(c.tipo || '—') + '</td>' +
              '<td>' + esc(c.telefone || '—') + '</td><td>' + esc(c.email || '—') + '</td>' +
              '<td>' + (c.etiquetas && c.etiquetas.length ? c.etiquetas.map(function (e) { return '<span class="chip neutral">' + esc(e) + '</span>'; }).join(' ') : '—') + '</td>' +
              '<td><a href="painel-novo-cliente.html?cliente=' + c.id + '#sec-novo-cliente" class="btn-conexao-secundario" style="display:inline-block; text-decoration:none;">Editar</a> ' +
                '<button type="button" class="btn-remover" data-excluir-cliente-cadastrado="' + c.id + '" data-nome-cliente="' + esc(c.nome) + '">Excluir</button></td></tr>';
          }).join('') + '</tbody></table></div>';
        container.querySelectorAll('[data-excluir-cliente-cadastrado]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var nome = btn.getAttribute('data-nome-cliente');
            confirmarModal('Excluir o cadastro de ' + nome + '? Essa ação não pode ser desfeita.').then(function (ok) {
              if (!ok) return;
              btn.disabled = true;
              apiPostJson('/api/painel?acao=cliente_cadastro_excluir', { id: btn.getAttribute('data-excluir-cliente-cadastrado') })
                .then(carregarClientesCadastrados)
                .catch(function (e) {
                  btn.disabled = false;
                  mostrarAviso(e.message || 'Não foi possível excluir o cliente agora.');
                });
            });
          });
        });
      })
      .catch(function () {
        container.innerHTML = '<div class="empty-state"><div class="msg">Não foi possível carregar os clientes cadastrados.</div></div>';
      });
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

  function _htmlTimelinePje(timeline) {
    return (timeline || []).map(function (item) {
      var classeAndamento = item.tipo_registro === 'andamento' ? ' timeline-item-andamento' : '';
      return '<div class="timeline-item' + classeAndamento + '">' +
        '<div class="timeline-item-data">' + esc(item.data) + (item.prazo ? ' · prazo ' + esc(item.prazo) : '') + '</div>' +
        '<div class="timeline-item-tipo">' + esc(item.tipo) + (item.tribunal ? ' — ' + esc(item.tribunal) : '') + '</div>' +
        (item.orgao ? '<div class="prazo-orgao">' + esc(item.orgao) + '</div>' : '') +
        (item.resumo ? '<div class="timeline-item-resumo">' + esc(item.resumo) + '</div>' : '') +
        (item.link ? '<div style="margin-top:4px;"><a href="' + esc(item.link) + '" target="_blank" rel="noopener" class="link-original">Ver comunicação original</a></div>' : '') +
      '</div>';
    }).join('');
  }

  // Traz pra dentro da aba "Andamentos" da ficha a timeline completa de comunicações que a
  // Comunica PJe tem pra este processo (com link "ver original") -- antes so existia numa lista
  // solta, separada do cadastro oficial (painel-processos.html). Casa por numero CNJ (so
  // digitos) no backend (processos_manuais.obter_dados_pje_processo); se nao achar nada (processo
  // sem nenhuma comunicacao do PJe ainda), simplesmente nao mostra a secao.
  function carregarComunicacoesPjeDaFicha(processo) {
    var alvo = document.getElementById('procficha-pje-corpo');
    if (!alvo || !processo.numero_cnj) return;
    apiGetJson('/api/painel?acao=processo_manual_pje_dados&numero_cnj=' + encodeURIComponent(processo.numero_cnj))
      .then(function (resp) {
        var dadosPje = resp.dados;
        if (!dadosPje) { alvo.closest('.procficha-pje-secao').classList.add('hidden'); return; }
        alvo.closest('.procficha-pje-secao').classList.remove('hidden');
        alvo.innerHTML = '<div class="timeline">' + _htmlTimelinePje(dadosPje.timeline) + '</div>';
      })
      .catch(function () { alvo.closest('.procficha-pje-secao').classList.add('hidden'); });
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
      corpo.innerHTML = agruparAtosRepetidos(filtrados).map(function (g) {
        var a = g.base;
        var selo = g.qtd > 1
          ? ' <span class="chip neutral" title="O tribunal registrou este mesmo andamento ' + g.qtd + ' vezes nesse dia (comum quando vários documentos são anexados de uma vez, ex: petição inicial com vários anexos)">×' + g.qtd + '</span>'
          : '';
        return '<div class="prazo-card">' +
          '<div class="prazo-card-topo">' +
            '<div><span class="chip ' + (a.origem === 'Tribunal' ? 'neutral' : 'good') + '">' + esc(a.origem === 'Tribunal' ? 'Tribunal' : 'Escritório') + '</span> ' +
              '<strong style="font-size:13.5px;">' + esc(a.tipo || 'Ato') + '</strong>' + selo + '</div>' +
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
    _abrirCalendarioAoClicar('atos-form-data');
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

  function _chipStatusPrazo(status) {
    var mapa = { pendente: ['neutral', 'Pendente'], cumprido: ['good', 'Cumprido'], vencido: ['crit', 'Vencido'] };
    var par = mapa[status] || ['neutral', status];
    return '<span class="chip ' + par[0] + '">' + par[1] + '</span>';
  }

  function _garantirModalPrazo() {
    if (document.getElementById('modal-prazo')) return;
    var div = document.createElement('div');
    div.innerHTML =
      '<div id="modal-prazo" class="modal-overlay hidden">' +
        '<div class="modal-drill-caixa" style="max-width:460px;">' +
          '<div class="modal-drill-cabecalho">' +
            '<span class="modal-drill-titulo" id="prazo-modal-titulo">Novo prazo</span>' +
            '<button type="button" class="modal-drill-fechar" id="prazo-modal-fechar" aria-label="Fechar">✕</button>' +
          '</div>' +
          '<div style="padding:18px 20px;">' +
            '<div id="prazo-form-erro"></div>' +
            '<div id="prazo-form-processo-select-wrap">' +
              '<label>Processo</label>' +
              '<select id="prazo-form-processo" style="width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid var(--line);border-radius:7px;font-size:13.5px;background:var(--bg);color:var(--ink);margin-bottom:14px;">' +
                '<option value="">Selecione o processo</option>' +
              '</select>' +
            '</div>' +
            '<div id="prazo-form-processo-fixo" class="hidden" style="font-size:13px; color:var(--ink-soft); margin-bottom:14px;"></div>' +
            '<label>Título</label>' +
            '<input type="text" id="prazo-form-titulo" style="width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid var(--line);border-radius:7px;font-size:13.5px;background:var(--bg);color:var(--ink);margin-bottom:14px;">' +
            '<label>Data limite</label>' +
            '<div style="display:flex; gap:8px; margin-bottom:14px;">' +
              '<input type="date" id="prazo-form-data" style="flex:1;padding:9px 10px;border:1px solid var(--line);border-radius:7px;font-size:13.5px;background:var(--bg);color:var(--ink);">' +
              '<button type="button" id="prazo-btn-hoje" style="padding:9px 14px;border:1px solid var(--line);border-radius:7px;background:var(--surface-sunken);color:var(--ink-soft);font-size:13px;cursor:pointer;">Hoje</button>' +
            '</div>' +
            '<label>Tipo</label>' +
            '<select id="prazo-form-tipo" style="width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid var(--line);border-radius:7px;font-size:13.5px;background:var(--bg);color:var(--ink);margin-bottom:14px;">' +
              '<option value="legal">Legal</option>' +
              '<option value="interno">Interno</option>' +
            '</select>' +
            '<label>Observação</label>' +
            '<textarea id="prazo-form-observacao" rows="3" style="width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid var(--line);border-radius:7px;font-size:13.5px;font-family:inherit;background:var(--bg);color:var(--ink);resize:vertical;margin-bottom:18px;"></textarea>' +
            '<div style="display:flex; gap:8px; justify-content:flex-end;">' +
              '<button type="button" id="prazo-btn-cancelar" style="padding:9px 16px;border:1px solid var(--line);border-radius:7px;background:var(--surface-sunken);color:var(--ink-soft);font-size:13px;cursor:pointer;">Cancelar</button>' +
              '<button type="button" id="prazo-btn-salvar" style="padding:9px 16px;border:none;border-radius:7px;background:var(--accent);color:#fff;font-size:13px;font-weight:600;cursor:pointer;">Salvar</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(div.firstChild);

    var overlay = document.getElementById('modal-prazo');
    var processoFixo = null;
    var prazoEmEdicao = null;
    var callbackSalvo = null;

    function fechar() { overlay.classList.add('hidden'); }
    document.getElementById('prazo-modal-fechar').addEventListener('click', fechar);
    document.getElementById('prazo-btn-cancelar').addEventListener('click', fechar);
    overlay.addEventListener('click', function (ev) { if (ev.target === overlay) fechar(); });
    _abrirCalendarioAoClicar('prazo-form-data');
    document.getElementById('prazo-btn-hoje').addEventListener('click', function () {
      document.getElementById('prazo-form-data').value = new Date().toISOString().slice(0, 10);
    });

    document.getElementById('prazo-btn-salvar').addEventListener('click', function () {
      var btn = this;
      var erroDiv = document.getElementById('prazo-form-erro');
      erroDiv.innerHTML = '';
      var processoId = processoFixo ? processoFixo.id : document.getElementById('prazo-form-processo').value;
      if (!processoId) {
        erroDiv.innerHTML = '<div class="aviso-tenant">Selecione o processo.</div>';
        return;
      }
      var corpo = {
        processo_id: processoId,
        titulo: document.getElementById('prazo-form-titulo').value.trim(),
        data_limite: document.getElementById('prazo-form-data').value,
        tipo: document.getElementById('prazo-form-tipo').value,
        observacao: document.getElementById('prazo-form-observacao').value.trim(),
      };
      if (prazoEmEdicao) corpo.id = prazoEmEdicao.id;
      var acao = prazoEmEdicao ? 'prazo_atualizar' : 'prazo_criar';
      btn.disabled = true; btn.textContent = 'Salvando...';
      apiPostJson('/api/painel?acao=' + acao, corpo)
        .then(function () {
          btn.disabled = false; btn.textContent = 'Salvar';
          fechar();
          if (callbackSalvo) callbackSalvo();
        })
        .catch(function (e) {
          btn.disabled = false; btn.textContent = 'Salvar';
          erroDiv.innerHTML = '<div class="aviso-tenant">' + esc(e.message || 'Não foi possível salvar o prazo agora.') + '</div>';
        });
    });

    overlay._abrir = function (processo, prazoExistente, onSalvo) {
      processoFixo = processo || null;
      prazoEmEdicao = prazoExistente || null;
      callbackSalvo = onSalvo || null;
      document.getElementById('prazo-modal-titulo').textContent = prazoExistente ? 'Editar prazo' : 'Novo prazo';
      document.getElementById('prazo-form-erro').innerHTML = '';
      document.getElementById('prazo-form-titulo').value = prazoExistente ? prazoExistente.titulo : '';
      document.getElementById('prazo-form-data').value = prazoExistente ? prazoExistente.data_limite : '';
      document.getElementById('prazo-form-tipo').value = prazoExistente ? prazoExistente.tipo : 'legal';
      document.getElementById('prazo-form-observacao').value = prazoExistente ? (prazoExistente.observacao || '') : '';

      var wrapSelect = document.getElementById('prazo-form-processo-select-wrap');
      var fixoEl = document.getElementById('prazo-form-processo-fixo');
      if (processoFixo) {
        wrapSelect.classList.add('hidden');
        fixoEl.classList.remove('hidden');
        fixoEl.textContent = 'Processo: ' + (processoFixo.numero_cnj || processoFixo.cliente_nome);
        overlay.classList.remove('hidden');
      } else {
        fixoEl.classList.add('hidden');
        wrapSelect.classList.remove('hidden');
        var selectEl = document.getElementById('prazo-form-processo');
        selectEl.innerHTML = '<option value="">Carregando...</option>';
        apiGetJson('/api/painel?acao=processo_manual_listar').then(function (dados) {
          var processos = dados.processos || [];
          selectEl.innerHTML = '<option value="">Selecione o processo</option>' +
            processos.map(function (p) {
              return '<option value="' + p.id + '">' + esc(p.numero_cnj || p.cliente_nome) + '</option>';
            }).join('');
          if (prazoExistente) selectEl.value = prazoExistente.processo_id;
        });
        overlay.classList.remove('hidden');
      }
    };
  }

  function abrirModalPrazo(processo, prazoExistente, onSalvo) {
    _garantirModalPrazo();
    document.getElementById('modal-prazo')._abrir(processo, prazoExistente, onSalvo);
  }

  function wireListaPrazos() {
    var statusEl = document.getElementById('prazos-filtro-status');
    var tipoEl = document.getElementById('prazos-filtro-tipo');
    var prazosCarregados = [];

    function carregar() {
      document.getElementById('prazos-lista').innerHTML = '<div class="empty-state"><div class="msg" style="color:var(--ink-faint);">Carregando…</div></div>';
      var qs = '';
      if (statusEl.value) qs += '&status=' + encodeURIComponent(statusEl.value);
      if (tipoEl.value) qs += '&tipo=' + encodeURIComponent(tipoEl.value);
      apiGetJson('/api/painel?acao=prazo_listar' + qs)
        .then(function (dados) {
          prazosCarregados = dados.prazos || [];
          renderLista();
        })
        .catch(function () {
          document.getElementById('prazos-lista').innerHTML = '<div class="empty-state"><div class="msg" style="color:var(--ink-faint);">Não foi possível carregar os prazos agora.</div></div>';
        });
    }

    function abrirNovoPrazoGeral() { abrirModalPrazo(null, null, carregar); }

    function renderLista() {
      var container = document.getElementById('prazos-lista');
      if (prazosCarregados.length === 0) {
        container.innerHTML =
          '<div style="padding:48px 24px; text-align:center; border:1px solid var(--line); border-radius:10px; background:var(--surface-sunken);">' +
            '<div style="font-size:30px; margin-bottom:8px;">📅</div>' +
            '<p style="margin:0 0 4px; font-size:11px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--warn);">Nunca perca um prazo</p>' +
            '<p style="margin:0 0 8px; font-size:15px; font-weight:600; color:var(--ink);">Nenhum prazo registrado</p>' +
            '<p style="margin:0 auto 14px; font-size:13px; color:var(--ink-faint); max-width:420px;">Adicione prazos aos processos para receber alertas e acompanhar tudo que precisa ser feito no prazo.</p>' +
            '<ul style="text-align:left; display:inline-block; margin:0 0 18px; padding-left:18px; font-size:12.5px; color:var(--ink-soft);">' +
              '<li>receber alertas de vencimento</li><li>diferenciar prazos legais e internos</li><li>marcar como cumprido e manter histórico</li>' +
            '</ul><br>' +
            '<button type="button" class="procpage-btn procpage-btn-primary" id="prazos-btn-adicionar-vazio">+ Adicionar prazo</button>' +
          '</div>';
        document.getElementById('prazos-btn-adicionar-vazio').addEventListener('click', abrirNovoPrazoGeral);
        return;
      }
      container.innerHTML = prazosCarregados.map(function (pz) {
        return '<div class="prazo-card" style="background:var(--bg);border-color:var(--line); margin-bottom:10px;">' +
          '<div class="prazo-card-topo">' +
            '<div>' + _chipStatusPrazo(pz.status) + ' <span class="chip neutral">' + esc(pz.tipo === 'interno' ? 'Interno' : 'Legal') + '</span> ' +
              '<strong style="font-size:13px;color:var(--ink);">' + esc(pz.titulo) + '</strong>' +
              '<div style="font-size:12px; color:var(--ink-faint); margin-top:2px;">' + esc(pz.numero_cnj || '') + '</div></div>' +
            '<span class="prazo-meta" style="color:var(--ink-faint);">' + fmtDataProcesso(pz.data_limite) + '</span>' +
          '</div>' +
          (pz.observacao ? '<div class="prazo-resumo" style="color:var(--ink-soft);">' + esc(pz.observacao) + '</div>' : '') +
          '<div style="margin-top:8px; display:flex; gap:8px;">' +
            (pz.status !== 'cumprido' ? '<button type="button" class="btn-conexao-secundario" data-prazo-cumprir="' + pz.id + '">Marcar como cumprido</button>' : '') +
            '<button type="button" class="btn-conexao-secundario" data-prazo-editar="' + pz.id + '">Editar</button>' +
            '<button type="button" class="btn-remover" data-prazo-excluir="' + pz.id + '">Excluir</button>' +
          '</div>' +
        '</div>';
      }).join('');
      container.querySelectorAll('[data-prazo-cumprir]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          apiPostJson('/api/painel?acao=prazo_atualizar', { id: btn.getAttribute('data-prazo-cumprir'), cumprido: true }).then(carregar);
        });
      });
      container.querySelectorAll('[data-prazo-editar]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var pz = prazosCarregados.filter(function (x) { return String(x.id) === btn.getAttribute('data-prazo-editar'); })[0];
          if (pz) abrirModalPrazo({ id: pz.processo_id, numero_cnj: pz.numero_cnj }, pz, carregar);
        });
      });
      container.querySelectorAll('[data-prazo-excluir]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          confirmarModal('Excluir este prazo?').then(function (ok) {
            if (!ok) return;
            apiPostJson('/api/painel?acao=prazo_excluir', { id: btn.getAttribute('data-prazo-excluir') }).then(carregar);
          });
        });
      });
    }

    document.getElementById('prazos-btn-buscar').addEventListener('click', carregar);
    document.getElementById('prazos-btn-limpar').addEventListener('click', function () {
      statusEl.value = ''; tipoEl.value = ''; carregar();
    });
    document.getElementById('prazos-btn-adicionar').addEventListener('click', abrirNovoPrazoGeral);
    carregar();
  }

  function _chipStatusTarefa(status) {
    var mapa = { pendente: ['neutral', 'Pendente'], em_andamento: ['warn', 'Em andamento'], concluida: ['good', 'Concluída'] };
    var par = mapa[status] || ['neutral', status];
    return '<span class="chip ' + par[0] + '">' + par[1] + '</span>';
  }

  function _chipPrioridadeTarefa(prioridade) {
    var mapa = { baixa: ['neutral', 'Baixa'], media: ['warn', 'Média'], alta: ['crit', 'Alta'] };
    var par = mapa[prioridade] || ['neutral', prioridade];
    return '<span class="chip ' + par[0] + '">' + par[1] + '</span>';
  }

  function _garantirModalTarefa() {
    if (document.getElementById('modal-tarefa')) return;
    var div = document.createElement('div');
    div.innerHTML =
      '<div id="modal-tarefa" class="modal-overlay hidden">' +
        '<div class="modal-drill-caixa" style="max-width:480px;">' +
          '<div class="modal-drill-cabecalho">' +
            '<span class="modal-drill-titulo" id="tarefa-modal-titulo">Nova tarefa</span>' +
            '<button type="button" class="modal-drill-fechar" id="tarefa-modal-fechar" aria-label="Fechar">✕</button>' +
          '</div>' +
          '<div style="padding:18px 20px; max-height:70vh; overflow-y:auto;">' +
            '<div id="tarefa-form-erro"></div>' +
            '<label>Título</label>' +
            '<input type="text" id="tarefa-form-titulo" style="width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid var(--line);border-radius:7px;font-size:13.5px;background:var(--bg);color:var(--ink);margin-bottom:14px;">' +
            '<label>Responsável</label>' +
            '<select id="tarefa-form-responsavel" style="width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid var(--line);border-radius:7px;font-size:13.5px;background:var(--bg);color:var(--ink);margin-bottom:14px;">' +
              '<option value="">Selecione</option>' +
            '</select>' +
            '<div style="display:flex; gap:10px;">' +
              '<div style="flex:1;"><label>Prioridade</label>' +
                '<select id="tarefa-form-prioridade" style="width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid var(--line);border-radius:7px;font-size:13.5px;background:var(--bg);color:var(--ink);margin-bottom:14px;">' +
                  '<option value="baixa">Baixa</option><option value="media" selected>Média</option><option value="alta">Alta</option>' +
                '</select></div>' +
              '<div id="tarefa-form-status-wrap" class="hidden" style="flex:1;"><label>Status</label>' +
                '<select id="tarefa-form-status" style="width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid var(--line);border-radius:7px;font-size:13.5px;background:var(--bg);color:var(--ink);margin-bottom:14px;">' +
                  '<option value="pendente">Pendente</option><option value="em_andamento">Em andamento</option><option value="concluida">Concluída</option>' +
                '</select></div>' +
            '</div>' +
            '<label>Vencimento</label>' +
            '<div style="display:flex; gap:8px; margin-bottom:14px;">' +
              '<input type="date" id="tarefa-form-vencimento" style="flex:1;padding:9px 10px;border:1px solid var(--line);border-radius:7px;font-size:13.5px;background:var(--bg);color:var(--ink);">' +
              '<button type="button" id="tarefa-btn-hoje" style="padding:9px 14px;border:1px solid var(--line);border-radius:7px;background:var(--surface-sunken);color:var(--ink-soft);font-size:13px;cursor:pointer;">Hoje</button>' +
            '</div>' +
            '<label>Cliente</label>' +
            '<input type="text" id="tarefa-form-cliente" placeholder="Opcional" style="width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid var(--line);border-radius:7px;font-size:13.5px;background:var(--bg);color:var(--ink);margin-bottom:14px;">' +
            '<label>Processo</label>' +
            '<select id="tarefa-form-processo" style="width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid var(--line);border-radius:7px;font-size:13.5px;background:var(--bg);color:var(--ink);margin-bottom:14px;">' +
              '<option value="">Nenhum</option>' +
            '</select>' +
            '<label>Observação</label>' +
            '<textarea id="tarefa-form-observacao" rows="3" style="width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid var(--line);border-radius:7px;font-size:13.5px;font-family:inherit;background:var(--bg);color:var(--ink);resize:vertical;margin-bottom:18px;"></textarea>' +
            '<div style="display:flex; gap:8px; justify-content:flex-end;">' +
              '<button type="button" id="tarefa-btn-cancelar" style="padding:9px 16px;border:1px solid var(--line);border-radius:7px;background:var(--surface-sunken);color:var(--ink-soft);font-size:13px;cursor:pointer;">Cancelar</button>' +
              '<button type="button" id="tarefa-btn-salvar" style="padding:9px 16px;border:none;border-radius:7px;background:var(--accent);color:#fff;font-size:13px;font-weight:600;cursor:pointer;">Salvar</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(div.firstChild);

    var overlay = document.getElementById('modal-tarefa');
    var tarefaEmEdicao = null;
    var callbackSalvo = null;

    function fechar() { overlay.classList.add('hidden'); }
    document.getElementById('tarefa-modal-fechar').addEventListener('click', fechar);
    document.getElementById('tarefa-btn-cancelar').addEventListener('click', fechar);
    overlay.addEventListener('click', function (ev) { if (ev.target === overlay) fechar(); });
    _abrirCalendarioAoClicar('tarefa-form-vencimento');
    document.getElementById('tarefa-btn-hoje').addEventListener('click', function () {
      document.getElementById('tarefa-form-vencimento').value = new Date().toISOString().slice(0, 10);
    });

    document.getElementById('tarefa-btn-salvar').addEventListener('click', function () {
      var btn = this;
      var erroDiv = document.getElementById('tarefa-form-erro');
      erroDiv.innerHTML = '';
      var corpo = {
        titulo: document.getElementById('tarefa-form-titulo').value.trim(),
        responsavel: document.getElementById('tarefa-form-responsavel').value,
        prioridade: document.getElementById('tarefa-form-prioridade').value,
        vencimento: document.getElementById('tarefa-form-vencimento').value,
        cliente_nome: document.getElementById('tarefa-form-cliente').value.trim(),
        processo_id: document.getElementById('tarefa-form-processo').value,
        observacao: document.getElementById('tarefa-form-observacao').value.trim(),
      };
      var acao = 'tarefa_criar';
      if (tarefaEmEdicao) {
        corpo.id = tarefaEmEdicao.id;
        corpo.status = document.getElementById('tarefa-form-status').value;
        acao = 'tarefa_atualizar';
      }
      btn.disabled = true; btn.textContent = 'Salvando...';
      apiPostJson('/api/painel?acao=' + acao, corpo)
        .then(function () {
          btn.disabled = false; btn.textContent = 'Salvar';
          fechar();
          if (callbackSalvo) callbackSalvo();
        })
        .catch(function (e) {
          btn.disabled = false; btn.textContent = 'Salvar';
          erroDiv.innerHTML = '<div class="aviso-tenant">' + esc(e.message || 'Não foi possível salvar a tarefa agora.') + '</div>';
        });
    });

    overlay._abrir = function (tarefaExistente, onSalvo) {
      tarefaEmEdicao = tarefaExistente || null;
      callbackSalvo = onSalvo || null;
      document.getElementById('tarefa-modal-titulo').textContent = tarefaExistente ? 'Editar tarefa' : 'Nova tarefa';
      document.getElementById('tarefa-form-erro').innerHTML = '';
      document.getElementById('tarefa-form-titulo').value = tarefaExistente ? tarefaExistente.titulo : '';
      document.getElementById('tarefa-form-prioridade').value = tarefaExistente ? tarefaExistente.prioridade : 'media';
      document.getElementById('tarefa-form-vencimento').value = tarefaExistente ? (tarefaExistente.vencimento || '') : '';
      document.getElementById('tarefa-form-cliente').value = tarefaExistente ? (tarefaExistente.cliente_nome || '') : '';
      document.getElementById('tarefa-form-observacao').value = tarefaExistente ? (tarefaExistente.observacao || '') : '';

      var statusWrap = document.getElementById('tarefa-form-status-wrap');
      if (tarefaExistente) {
        statusWrap.classList.remove('hidden');
        document.getElementById('tarefa-form-status').value = tarefaExistente.status;
      } else {
        statusWrap.classList.add('hidden');
      }

      var selectResp = document.getElementById('tarefa-form-responsavel');
      apiGetJson('/api/painel?acao=usuarios_nomes').then(function (dados) {
        var usuarios = dados.usuarios || [];
        selectResp.innerHTML = '<option value="">Selecione</option>' +
          usuarios.map(function (u) { return '<option value="' + esc(u.usuario) + '">' + esc(u.nome) + '</option>'; }).join('');
        if (tarefaExistente) selectResp.value = tarefaExistente.responsavel || '';
      });

      var selectProc = document.getElementById('tarefa-form-processo');
      apiGetJson('/api/painel?acao=processo_manual_listar').then(function (dados) {
        var processos = dados.processos || [];
        selectProc.innerHTML = '<option value="">Nenhum</option>' +
          processos.map(function (p) { return '<option value="' + p.id + '">' + esc(p.numero_cnj || p.cliente_nome) + '</option>'; }).join('');
        if (tarefaExistente) selectProc.value = tarefaExistente.processo_id || '';
      });

      overlay.classList.remove('hidden');
    };
  }

  function abrirModalTarefa(tarefaExistente, onSalvo) {
    _garantirModalTarefa();
    document.getElementById('modal-tarefa')._abrir(tarefaExistente, onSalvo);
  }

  function wireListaTarefas() {
    var responsavelEl = document.getElementById('tarefas-filtro-responsavel');
    var statusEl = document.getElementById('tarefas-filtro-status');
    var prioridadeEl = document.getElementById('tarefas-filtro-prioridade');
    var dataDeEl = document.getElementById('tarefas-filtro-data-de');
    var dataAteEl = document.getElementById('tarefas-filtro-data-ate');
    var tarefasCarregadas = [];
    _abrirCalendarioAoClicar('tarefas-filtro-data-de');
    _abrirCalendarioAoClicar('tarefas-filtro-data-ate');

    apiGetJson('/api/painel?acao=usuarios_nomes').then(function (dados) {
      var usuarios = dados.usuarios || [];
      responsavelEl.innerHTML = '<option value="">Todos</option>' +
        usuarios.map(function (u) { return '<option value="' + esc(u.usuario) + '">' + esc(u.nome) + '</option>'; }).join('');
    });

    function carregar() {
      document.getElementById('tarefas-lista').innerHTML = '<div class="empty-state"><div class="msg" style="color:var(--ink-faint);">Carregando…</div></div>';
      var qs = '';
      if (responsavelEl.value) qs += '&responsavel=' + encodeURIComponent(responsavelEl.value);
      if (statusEl.value) qs += '&status=' + encodeURIComponent(statusEl.value);
      if (prioridadeEl.value) qs += '&prioridade=' + encodeURIComponent(prioridadeEl.value);
      if (dataDeEl.value) qs += '&vencimento_de=' + encodeURIComponent(dataDeEl.value);
      if (dataAteEl.value) qs += '&vencimento_ate=' + encodeURIComponent(dataAteEl.value);
      apiGetJson('/api/painel?acao=tarefa_listar' + qs)
        .then(function (dados) {
          tarefasCarregadas = dados.tarefas || [];
          renderLista();
        })
        .catch(function () {
          document.getElementById('tarefas-lista').innerHTML = '<div class="empty-state"><div class="msg" style="color:var(--ink-faint);">Não foi possível carregar as tarefas agora.</div></div>';
        });
    }

    function abrirNovaTarefa() { abrirModalTarefa(null, carregar); }

    function renderLista() {
      var container = document.getElementById('tarefas-lista');
      if (tarefasCarregadas.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="msg" style="color:var(--ink-faint);">Nenhuma tarefa encontrada.</div></div>';
        return;
      }
      container.innerHTML = '<div class="table-scroll"><table class="aviso-tabela">' +
        '<thead><tr><th>Título</th><th>Prioridade</th><th>Status</th><th>Vencimento</th><th>Responsável</th><th>Cliente / Processo</th><th>Ações</th></tr></thead>' +
        '<tbody>' + tarefasCarregadas.map(function (t) {
          return '<tr><td>' + esc(t.titulo) + '</td>' +
            '<td>' + _chipPrioridadeTarefa(t.prioridade) + '</td>' +
            '<td>' + _chipStatusTarefa(t.status) + '</td>' +
            '<td>' + (t.vencimento ? fmtDataProcesso(t.vencimento) : '—') + '</td>' +
            '<td>' + esc(t.responsavel || '—') + '</td>' +
            '<td>' + esc(t.cliente_nome || t.numero_cnj || '—') + '</td>' +
            '<td><button type="button" class="btn-conexao-secundario" data-tarefa-editar="' + t.id + '">Editar</button> ' +
              '<button type="button" class="btn-remover" data-tarefa-excluir="' + t.id + '">Excluir</button></td></tr>';
        }).join('') + '</tbody></table></div>';

      container.querySelectorAll('[data-tarefa-editar]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var t = tarefasCarregadas.filter(function (x) { return String(x.id) === btn.getAttribute('data-tarefa-editar'); })[0];
          if (t) abrirModalTarefa(t, carregar);
        });
      });
      container.querySelectorAll('[data-tarefa-excluir]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          confirmarModal('Excluir esta tarefa?').then(function (ok) {
            if (!ok) return;
            apiPostJson('/api/painel?acao=tarefa_excluir', { id: btn.getAttribute('data-tarefa-excluir') }).then(carregar);
          });
        });
      });
    }

    document.getElementById('tarefas-btn-buscar').addEventListener('click', carregar);
    document.getElementById('tarefas-btn-limpar').addEventListener('click', function () {
      responsavelEl.value = ''; statusEl.value = ''; prioridadeEl.value = ''; dataDeEl.value = ''; dataAteEl.value = '';
      carregar();
    });
    document.getElementById('tarefas-btn-adicionar').addEventListener('click', abrirNovaTarefa);
    carregar();
  }

  var ROTULO_TIPO_COMPROMISSO = {
    audiencia: 'Audiência', reuniao: 'Reunião', atendimento: 'Atendimento', prazo: 'Prazo',
    visita: 'Visita', administrativo: 'Administrativo', pessoal: 'Pessoal', outro: 'Outro',
  };
  var COR_TIPO_COMPROMISSO = {
    audiencia: 'var(--chart-cat-1)', reuniao: 'var(--chart-cat-2)', atendimento: 'var(--chart-cat-3)', prazo: 'var(--chart-cat-4)',
    visita: 'var(--chart-cat-5)', administrativo: 'var(--chart-cat-6)', pessoal: 'var(--chart-cat-7)', outro: 'var(--chart-cat-8)',
  };
  var NOMES_MES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  var NOMES_DIA_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  function _fmtISOData(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function _inicioSemana(d) {
    var novo = new Date(d);
    var diaSemana = novo.getDay(); // 0=domingo
    var deslocamento = diaSemana === 0 ? -6 : 1 - diaSemana; // segunda-feira como inicio
    novo.setDate(novo.getDate() + deslocamento);
    novo.setHours(0, 0, 0, 0);
    return novo;
  }
  function _horaMinuto(isoDataHora) {
    if (!isoDataHora) return null;
    var parte = isoDataHora.split('T')[1];
    return parte ? parte.slice(0, 5) : null;
  }

  function wireAgendaCompleta() {
    var estado = { view: 'lista', refData: new Date() };
    var compromissosCarregados = [];

    var elTipo = document.getElementById('ag-filtro-tipo');
    var elResponsavel = document.getElementById('ag-filtro-responsavel');
    var elVinculo = document.getElementById('ag-filtro-vinculo');

    apiGetJson('/api/painel?acao=usuarios_nomes').then(function (dados) {
      var usuarios = dados.usuarios || [];
      var opcoes = usuarios.map(function (u) { return '<option value="' + esc(u.usuario) + '">' + esc(u.nome) + '</option>'; }).join('');
      elResponsavel.innerHTML = '<option value="">Todos os responsáveis</option>' + opcoes;
      document.getElementById('ag-form-responsavel').innerHTML = '<option value="">Selecione</option>' + opcoes;
    });
    apiGetJson('/api/painel?acao=processo_manual_listar').then(function (dados) {
      var processos = dados.processos || [];
      document.getElementById('ag-form-processo').innerHTML = '<option value="">Nenhum</option>' +
        processos.map(function (p) { return '<option value="' + p.id + '">' + esc(p.numero_cnj || p.cliente_nome) + '</option>'; }).join('');
    });

    document.querySelectorAll('[data-ag-view]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('[data-ag-view]').forEach(function (b) { b.classList.remove('ativo'); });
        btn.classList.add('ativo');
        estado.view = btn.getAttribute('data-ag-view');
        document.getElementById('ag-nav').classList.toggle('hidden', estado.view === 'lista');
        carregar();
      });
    });

    document.getElementById('ag-btn-mais-filtros').addEventListener('click', function () {
      document.getElementById('ag-mais-filtros').classList.toggle('hidden');
    });
    document.getElementById('ag-btn-atualizar').addEventListener('click', carregar);
    elTipo.addEventListener('change', carregar);
    elResponsavel.addEventListener('change', carregar);
    elVinculo.addEventListener('change', carregar);

    document.getElementById('ag-nav-anterior').addEventListener('click', function () { navegar(-1); });
    document.getElementById('ag-nav-proximo').addEventListener('click', function () { navegar(1); });
    document.getElementById('ag-nav-hoje').addEventListener('click', function () { estado.refData = new Date(); carregar(); });

    function navegar(direcao) {
      var d = new Date(estado.refData);
      if (estado.view === 'mensal') d.setMonth(d.getMonth() + direcao);
      else d.setDate(d.getDate() + direcao * 7);
      estado.refData = d;
      carregar();
    }

    function calcularIntervalo() {
      if (estado.view === 'lista') {
        var hoje = new Date();
        var fim = new Date();
        fim.setDate(fim.getDate() + 90);
        return { de: _fmtISOData(hoje) + 'T00:00:00', ate: _fmtISOData(fim) + 'T23:59:59' };
      }
      if (estado.view === 'semanal') {
        var inicioSem = _inicioSemana(estado.refData);
        var fimSem = new Date(inicioSem);
        fimSem.setDate(fimSem.getDate() + 6);
        return { de: _fmtISOData(inicioSem) + 'T00:00:00', ate: _fmtISOData(fimSem) + 'T23:59:59' };
      }
      // mensal -- pega o mes inteiro (com folga de semana antes/depois pra grid ficar completa)
      var primeiroDiaMes = new Date(estado.refData.getFullYear(), estado.refData.getMonth(), 1);
      var ultimoDiaMes = new Date(estado.refData.getFullYear(), estado.refData.getMonth() + 1, 0);
      var inicioGrid = _inicioSemana(primeiroDiaMes);
      var fimGrid = new Date(ultimoDiaMes);
      fimGrid.setDate(fimGrid.getDate() + (7 - fimGrid.getDay()) % 7);
      return { de: _fmtISOData(inicioGrid) + 'T00:00:00', ate: _fmtISOData(fimGrid) + 'T23:59:59' };
    }

    function atualizarTituloNav() {
      var titulo = document.getElementById('ag-nav-titulo');
      if (estado.view === 'mensal') {
        titulo.textContent = NOMES_MES[estado.refData.getMonth()] + ' de ' + estado.refData.getFullYear();
      } else if (estado.view === 'semanal') {
        var inicioSem = _inicioSemana(estado.refData);
        var fimSem = new Date(inicioSem);
        fimSem.setDate(fimSem.getDate() + 6);
        titulo.textContent = inicioSem.getDate() + ' de ' + NOMES_MES[inicioSem.getMonth()].slice(0, 3).toLowerCase() +
          ' – ' + fimSem.getDate() + ' de ' + NOMES_MES[fimSem.getMonth()].slice(0, 3).toLowerCase() + ' de ' + fimSem.getFullYear();
      }
    }

    function carregar() {
      atualizarTituloNav();
      document.getElementById('ag-conteudo').innerHTML = '<div class="empty-state"><div class="msg" style="color:var(--ink-faint);">Carregando…</div></div>';
      var intervalo = calcularIntervalo();
      var qs = '&data_de=' + encodeURIComponent(intervalo.de) + '&data_ate=' + encodeURIComponent(intervalo.ate);
      if (elTipo.value) qs += '&tipo=' + encodeURIComponent(elTipo.value);
      if (elResponsavel.value) qs += '&responsavel=' + encodeURIComponent(elResponsavel.value);
      if (elVinculo.value) qs += '&vinculo=' + encodeURIComponent(elVinculo.value);
      apiGetJson('/api/painel?acao=compromisso_listar' + qs)
        .then(function (dados) {
          compromissosCarregados = dados.compromissos || [];
          renderizar();
        })
        .catch(function () {
          document.getElementById('ag-conteudo').innerHTML = '<div class="empty-state"><div class="msg" style="color:var(--ink-faint);">Não foi possível carregar a agenda agora.</div></div>';
        });
    }

    function renderizar() {
      if (estado.view === 'lista') renderLista();
      else if (estado.view === 'mensal') renderMensal();
      else renderSemanal();
    }

    function _chipTipo(tipo) {
      return '<span class="chip neutral" style="color:' + (COR_TIPO_COMPROMISSO[tipo] || 'var(--ink-faint)') + ';">' + esc(ROTULO_TIPO_COMPROMISSO[tipo] || tipo) + '</span>';
    }

    function renderLista() {
      var container = document.getElementById('ag-conteudo');
      if (compromissosCarregados.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="msg" style="color:var(--ink-faint);">Nenhum compromisso encontrado nos próximos 90 dias.</div></div>';
        return;
      }
      container.innerHTML = '<div class="table-scroll"><table class="aviso-tabela">' +
        '<thead><tr><th>Título</th><th>Tipo</th><th>Data/Hora</th><th>Responsável</th><th>Local</th><th>Cliente / Processo</th><th>Ações</th></tr></thead>' +
        '<tbody>' + compromissosCarregados.map(function (c) {
          return '<tr><td>' + esc(c.titulo) + '</td><td>' + _chipTipo(c.tipo) + '</td>' +
            '<td>' + fmtDataProcesso(c.data_inicio.slice(0, 10)) + (_horaMinuto(c.data_inicio) ? ' · ' + _horaMinuto(c.data_inicio) : '') + '</td>' +
            '<td>' + esc(c.responsavel || '—') + '</td><td>' + esc(c.local || '—') + '</td>' +
            '<td>' + esc(c.cliente_nome || c.numero_cnj || '—') + '</td>' +
            '<td><button type="button" class="btn-conexao-secundario" data-ag-editar="' + c.id + '">Editar</button> ' +
              '<button type="button" class="btn-remover" data-ag-excluir="' + c.id + '">Excluir</button></td></tr>';
        }).join('') + '</tbody></table></div>';
      wireAcoesLinha(container);
    }

    function renderMensal() {
      var container = document.getElementById('ag-conteudo');
      var primeiroDiaMes = new Date(estado.refData.getFullYear(), estado.refData.getMonth(), 1);
      var inicioGrid = _inicioSemana(primeiroDiaMes);
      var porDia = {};
      compromissosCarregados.forEach(function (c) {
        var chave = c.data_inicio.slice(0, 10);
        (porDia[chave] = porDia[chave] || []).push(c);
      });

      var html = '<div style="display:grid; grid-template-columns:repeat(7,1fr); border:1px solid var(--line); border-radius:8px; overflow:hidden;">';
      NOMES_DIA_SEMANA.forEach(function (n) {
        html += '<div style="padding:8px; text-align:center; font-size:11px; font-weight:700; color:var(--ink-faint); background:var(--surface-sunken); border-bottom:1px solid var(--line);">' + n.toUpperCase() + '</div>';
      });
      for (var i = 0; i < 42; i++) {
        var dia = new Date(inicioGrid);
        dia.setDate(dia.getDate() + i);
        if (i >= 35 && dia.getMonth() !== estado.refData.getMonth()) break; // nao mostra 6a linha se for so mes seguinte
        var chaveDia = _fmtISOData(dia);
        var doMes = dia.getMonth() === estado.refData.getMonth();
        var eventosDia = porDia[chaveDia] || [];
        var chips = eventosDia.slice(0, 3).map(function (c) {
          var corTipo = COR_TIPO_COMPROMISSO[c.tipo] || 'var(--ink-faint)';
          return '<div data-ag-editar="' + c.id + '" style="font-size:10.5px; padding:2px 5px; border-radius:4px; margin-bottom:2px; background:color-mix(in srgb, ' + corTipo + ' 13%, transparent); color:' + corTipo + '; cursor:pointer; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' +
            (_horaMinuto(c.data_inicio) ? esc(_horaMinuto(c.data_inicio)) + ' ' : '') + esc(c.titulo) + '</div>';
        }).join('');
        var maisTexto = eventosDia.length > 3 ? '<div style="font-size:10px; color:var(--ink-faint);">+' + (eventosDia.length - 3) + ' mais</div>' : '';
        html += '<div data-ag-dia="' + chaveDia + '" style="min-height:88px; padding:6px; border-right:1px solid var(--line); border-bottom:1px solid var(--line); background:' + (doMes ? 'var(--bg)' : 'var(--surface-sunken)') + '; cursor:pointer;">' +
          '<div style="font-size:11.5px; color:' + (doMes ? 'var(--ink)' : 'var(--ink-faint)') + '; margin-bottom:4px;">' + dia.getDate() + '</div>' +
          chips + maisTexto +
        '</div>';
      }
      html += '</div>';
      container.innerHTML = html;

      container.querySelectorAll('[data-ag-editar]').forEach(function (el) {
        el.addEventListener('click', function (ev) {
          ev.stopPropagation();
          var c = compromissosCarregados.filter(function (x) { return String(x.id) === el.getAttribute('data-ag-editar'); })[0];
          if (c) abrirModal(c);
        });
      });
      container.querySelectorAll('[data-ag-dia]').forEach(function (el) {
        el.addEventListener('click', function () { abrirModal(null, el.getAttribute('data-ag-dia')); });
      });
    }

    function renderSemanal() {
      var container = document.getElementById('ag-conteudo');
      var inicioSem = _inicioSemana(estado.refData);
      var horaInicioGrid = 6, horaFimGrid = 22, alturaHora = 42;
      var porDia = {};
      compromissosCarregados.forEach(function (c) {
        var chave = c.data_inicio.slice(0, 10);
        (porDia[chave] = porDia[chave] || []).push(c);
      });

      var html = '<div style="display:grid; grid-template-columns:56px repeat(7,1fr); border:1px solid var(--line); border-radius:8px; overflow:hidden;">';
      html += '<div style="background:var(--surface-sunken); border-bottom:1px solid var(--line);"></div>';
      for (var d = 0; d < 7; d++) {
        var dia = new Date(inicioSem);
        dia.setDate(dia.getDate() + d);
        html += '<div style="padding:8px; text-align:center; background:var(--surface-sunken); border-bottom:1px solid var(--line); border-left:1px solid var(--line);">' +
          '<div style="font-size:10.5px; color:var(--ink-faint);">' + NOMES_DIA_SEMANA[dia.getDay()].toUpperCase() + '</div>' +
          '<div style="font-size:13px; color:var(--ink); font-weight:600;">' + String(dia.getDate()).padStart(2, '0') + '/' + String(dia.getMonth() + 1).padStart(2, '0') + '</div>' +
        '</div>';
      }
      // linhas de hora + coluna de rotulo
      html += '<div style="position:relative; grid-column:1 / span 8; display:grid; grid-template-columns:56px repeat(7,1fr);">';
      html += '<div>';
      for (var h = horaInicioGrid; h <= horaFimGrid; h++) {
        html += '<div style="height:' + alturaHora + 'px; font-size:10.5px; color:var(--ink-faint); text-align:right; padding-right:6px; border-top:1px solid var(--line);">' + String(h).padStart(2, '0') + ':00</div>';
      }
      html += '</div>';
      for (var d2 = 0; d2 < 7; d2++) {
        var dia2 = new Date(inicioSem);
        dia2.setDate(dia2.getDate() + d2);
        var chaveDia2 = _fmtISOData(dia2);
        var eventosDia2 = (porDia[chaveDia2] || []).filter(function (c) { return _horaMinuto(c.data_inicio); });
        html += '<div style="position:relative; border-left:1px solid var(--line);">';
        for (var h2 = horaInicioGrid; h2 <= horaFimGrid; h2++) {
          html += '<div style="height:' + alturaHora + 'px; border-top:1px solid var(--line);"></div>';
        }
        eventosDia2.forEach(function (c) {
          var hm = _horaMinuto(c.data_inicio).split(':');
          var horaFloat = parseInt(hm[0], 10) + parseInt(hm[1], 10) / 60;
          if (horaFloat < horaInicioGrid || horaFloat > horaFimGrid) return;
          var topo = (horaFloat - horaInicioGrid) * alturaHora;
          var duracaoH = 1;
          if (c.data_fim) {
            var hmFim = _horaMinuto(c.data_fim);
            if (hmFim) {
              var hmFimArr = hmFim.split(':');
              var horaFimFloat = parseInt(hmFimArr[0], 10) + parseInt(hmFimArr[1], 10) / 60;
              duracaoH = Math.max(0.5, horaFimFloat - horaFloat);
            }
          }
          var corTipoSemana = COR_TIPO_COMPROMISSO[c.tipo] || 'var(--ink-faint)';
          html += '<div data-ag-editar="' + c.id + '" style="position:absolute; top:' + topo + 'px; left:2px; right:2px; height:' + (duracaoH * alturaHora - 2) + 'px; background:color-mix(in srgb, ' + corTipoSemana + ' 20%, transparent); border-left:3px solid ' + corTipoSemana + '; border-radius:4px; padding:2px 5px; font-size:10.5px; color:var(--ink); overflow:hidden; cursor:pointer;">' +
            esc(hm.join(':')) + ' ' + esc(c.titulo) + '</div>';
        });
        html += '</div>';
      }
      html += '</div></div>';
      container.innerHTML = html;

      container.querySelectorAll('[data-ag-editar]').forEach(function (el) {
        el.addEventListener('click', function () {
          var c = compromissosCarregados.filter(function (x) { return String(x.id) === el.getAttribute('data-ag-editar'); })[0];
          if (c) abrirModal(c);
        });
      });
    }

    function wireAcoesLinha(container) {
      container.querySelectorAll('[data-ag-editar]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var c = compromissosCarregados.filter(function (x) { return String(x.id) === btn.getAttribute('data-ag-editar'); })[0];
          if (c) abrirModal(c);
        });
      });
      container.querySelectorAll('[data-ag-excluir]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          confirmarModal('Excluir este compromisso?').then(function (ok) {
            if (!ok) return;
            apiPostJson('/api/painel?acao=compromisso_excluir', { id: btn.getAttribute('data-ag-excluir') }).then(carregar);
          });
        });
      });
    }

    // --- Modal "Novo compromisso" ---
    var modal = document.getElementById('modal-compromisso');
    var compromissoEmEdicao = null;
    _abrirCalendarioAoClicar('ag-form-data');

    function fecharModal() { modal.classList.add('hidden'); }
    document.getElementById('ag-modal-fechar').addEventListener('click', fecharModal);
    document.getElementById('ag-btn-cancelar').addEventListener('click', fecharModal);
    modal.addEventListener('click', function (ev) { if (ev.target === modal) fecharModal(); });
    document.getElementById('ag-btn-mais-opcoes').addEventListener('click', function () {
      document.getElementById('ag-mais-opcoes').classList.toggle('hidden');
    });
    document.getElementById('ag-btn-hoje').addEventListener('click', function () {
      document.getElementById('ag-form-data').value = _fmtISOData(new Date());
    });
    document.getElementById('ag-btn-agora').addEventListener('click', function () {
      var agora = new Date();
      document.getElementById('ag-form-data').value = _fmtISOData(agora);
      document.getElementById('ag-form-hora').value = String(agora.getHours()).padStart(2, '0') + ':' + String(agora.getMinutes()).padStart(2, '0');
    });

    function abrirModal(compromissoExistente, dataPreset) {
      compromissoEmEdicao = compromissoExistente || null;
      document.getElementById('ag-modal-titulo').textContent = compromissoExistente ? 'Editar compromisso' : 'Novo compromisso';
      document.getElementById('ag-form-erro').innerHTML = '';
      document.getElementById('ag-link-meet-resultado').classList.add('hidden');
      document.getElementById('ag-form-titulo').value = compromissoExistente ? compromissoExistente.titulo : '';
      document.getElementById('ag-form-tipo').value = compromissoExistente ? compromissoExistente.tipo : 'reuniao';
      document.getElementById('ag-form-responsavel').value = compromissoExistente ? (compromissoExistente.responsavel || '') : '';
      document.getElementById('ag-form-data').value = compromissoExistente ? compromissoExistente.data_inicio.slice(0, 10) : (dataPreset || _fmtISOData(new Date()));
      document.getElementById('ag-form-hora').value = compromissoExistente ? (_horaMinuto(compromissoExistente.data_inicio) || '') : '';
      document.getElementById('ag-form-hora-fim').value = compromissoExistente ? (_horaMinuto(compromissoExistente.data_fim) || '') : '';
      document.getElementById('ag-form-repetir').value = compromissoExistente ? compromissoExistente.repetir : 'nao_repete';
      document.getElementById('ag-form-local').value = compromissoExistente ? (compromissoExistente.local || '') : '';
      document.getElementById('ag-form-meet').checked = false;
      document.getElementById('ag-form-meet').disabled = !!compromissoExistente;
      document.getElementById('ag-form-privado').checked = compromissoExistente ? !!compromissoExistente.privado : false;
      document.getElementById('ag-form-cliente').value = compromissoExistente ? (compromissoExistente.cliente_nome || '') : '';
      document.getElementById('ag-form-processo').value = compromissoExistente ? (compromissoExistente.processo_id || '') : '';
      document.getElementById('ag-form-descricao').value = compromissoExistente ? (compromissoExistente.descricao || '') : '';
      document.getElementById('ag-mais-opcoes').classList.add('hidden');
      modal.classList.remove('hidden');
    }
    document.getElementById('ag-btn-novo').addEventListener('click', function () { abrirModal(null); });

    document.getElementById('ag-btn-salvar').addEventListener('click', function () {
      var btn = this;
      var erroDiv = document.getElementById('ag-form-erro');
      erroDiv.innerHTML = '';
      var corpo = {
        titulo: document.getElementById('ag-form-titulo').value.trim(),
        tipo: document.getElementById('ag-form-tipo').value,
        responsavel: document.getElementById('ag-form-responsavel').value,
        data: document.getElementById('ag-form-data').value,
        hora_inicio: document.getElementById('ag-form-hora').value,
        hora_fim: document.getElementById('ag-form-hora-fim').value,
        repetir: document.getElementById('ag-form-repetir').value,
        local: document.getElementById('ag-form-local').value.trim(),
        privado: document.getElementById('ag-form-privado').checked,
        cliente_nome: document.getElementById('ag-form-cliente').value.trim(),
        processo_id: document.getElementById('ag-form-processo').value,
        descricao: document.getElementById('ag-form-descricao').value.trim(),
      };
      var acao = 'compromisso_criar';
      if (compromissoEmEdicao) {
        corpo.id = compromissoEmEdicao.id;
        acao = 'compromisso_atualizar';
      } else {
        corpo.com_meet = document.getElementById('ag-form-meet').checked;
      }
      btn.disabled = true; btn.textContent = 'Salvando...';
      apiPostJson('/api/painel?acao=' + acao, corpo)
        .then(function (resultado) {
          btn.disabled = false; btn.textContent = 'Salvar';
          if (resultado && resultado.link_meet) {
            var resEl = document.getElementById('ag-link-meet-resultado');
            resEl.classList.remove('hidden');
            resEl.innerHTML = 'Link do Meet: <a href="' + esc(resultado.link_meet) + '" target="_blank" rel="noopener" style="color:var(--accent);">' + esc(resultado.link_meet) + '</a>';
            carregar();
          } else {
            fecharModal();
            carregar();
          }
        })
        .catch(function (e) {
          btn.disabled = false; btn.textContent = 'Salvar';
          erroDiv.innerHTML = '<div class="aviso-tenant">' + esc(e.message || 'Não foi possível salvar o compromisso agora.') + '</div>';
        });
    });

    carregar();
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
          '<div style="margin-top:6px;"><button type="button" class="procman-acao-excluir" data-docs-excluir="' + d.id + '" style="border:none;background:none;color:var(--crit);font-size:12px;cursor:pointer;padding:0;">Excluir</button></div>' +
        '</div>';
      }).join('');

      Array.prototype.forEach.call(corpo.querySelectorAll('[data-docs-excluir]'), function (btn) {
        btn.addEventListener('click', function () {
          confirmarModal('Excluir este documento?').then(function (ok) {
            if (!ok) return;
            var id = btn.getAttribute('data-docs-excluir');
            apiPostJson('/api/painel?acao=documento_processo_excluir', { id: id })
              .then(function () { carregarDocumentos(); })
              .catch(function (e) { mostrarAviso(e.message || 'Não foi possível excluir o documento agora.'); });
          });
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
      lista.innerHTML = '<div class="empty-state"><div class="msg" style="color:var(--ink-faint);">Nenhum processo encontrado.</div></div>';
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
          '<td style="color:var(--ink-faint);">' + fmtDataProcesso(String(p.criado_em || '').slice(0, 10)) + '</td>' +
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
        var idProcessoNaUrl = new URLSearchParams(window.location.search).get('processo');
        if (idProcessoNaUrl) {
          var processoDaUrl = _processosManuaisTodos.filter(function (p) { return String(p.id) === idProcessoNaUrl; })[0];
          if (processoDaUrl) abrirFichaProcesso(processoDaUrl);
        }
      })
      .catch(function () {
        lista.innerHTML = '<div class="empty-state"><div class="msg" style="color:var(--ink-faint);">Não foi possível carregar os processos agora.</div></div>';
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
      '<div style="background:var(--bg); border:1px solid var(--line); border-radius:8px; padding:14px 16px; margin-bottom:18px;">' +
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
              '<div style="margin-top:14px; padding:10px 14px; border-radius:8px; background:var(--warn-soft); border:1px solid var(--warn); color:var(--warn); font-size:13px;">' +
                '⚠️ O DataJud registra este processo com nível de sigilo ' + esc(String(p.datajud_meta.nivel_sigilo)) + ' (não é totalmente público).' +
              '</div>'
            ) : '') +
            '<p class="procficha-painel-titulo" style="margin-top:18px;">Últimas movimentações</p>' +
            '<p class="procficha-painel-sub">Movimentações do tribunal são sincronizadas automaticamente (DataJud/CNJ) quando o número do processo é reconhecido pela base pública — pode levar de algumas horas a alguns dias pra aparecer. Registre atos processuais pra completar com o histórico do escritório.</p>' +
            '<div id="procficha-geral-atos"><div class="empty-state"><div class="msg" style="color:var(--ink-faint);">Carregando…</div></div></div>' +
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
              '<div><label>Tribunal</label><select id="procficha-edit-tribunal">' + htmlOpcoesTribunal(p.tribunal || '') + '</select></div>' +
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
            '<label style="display:block; font-size:11px; color:var(--ink-faint); margin:14px 0 5px;">Observações internas</label>' +
            '<textarea id="procficha-edit-obs" rows="3" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--line);border-radius:6px;font-size:13px;font-family:inherit;background:var(--bg);color:var(--ink);resize:vertical;">' + esc(p.observacoes_internas || '') + '</textarea>' +

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

            '<div style="background:var(--bg); border:1px solid var(--line); border-radius:8px; padding:14px 16px; margin-bottom:16px;">' +
              '<label style="font-size:11px;color:var(--ink-faint);">Próxima audiência</label>' +
              '<div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap;align-items:center;">' +
                '<input type="date" id="procficha-audiencia-input" value="' + esc(p.proxima_audiencia || '') + '">' +
                '<button type="button" class="procpage-btn" id="procficha-btn-salvar-audiencia">Salvar</button>' +
                (p.proxima_audiencia ? '<span class="chip warn">' + esc(fmtDataCurta(p.proxima_audiencia)) + '</span>' : '') +
              '</div>' +
              '<p class="procficha-painel-sub" style="margin:6px 0 0;">Preenchido automaticamente quando a detecção por IA acha uma audiência marcada numa comunicação do PJe ou andamento do tribunal -- edite aqui quando ela não conseguir achar sozinha.</p>' +
            '</div>' +

            '<div style="margin-bottom:12px; display:flex; gap:8px; flex-wrap:wrap;">' +
              '<button type="button" class="procpage-btn procpage-btn-primary" id="procficha-btn-novo-ato">+ Novo ato</button>' +
              '<button type="button" class="procpage-btn" id="procficha-btn-sincronizar-agora">Sincronizar agora</button>' +
              '<span id="procficha-sincronizar-status" style="font-size:12.5px; color:var(--ink-faint); align-self:center;"></span>' +
            '</div>' +
            '<div id="procficha-lista-atos"><div class="empty-state"><div class="msg" style="color:var(--ink-faint);">Carregando…</div></div></div>' +
            (p.numero_cnj ? (
              '<div style="margin-top:10px; font-size:12.5px; color:var(--ink-faint);">' +
                'O DataJud só informa o tipo de cada andamento, nunca o documento em si. ' +
                'Pra abrir o processo de verdade: <a href="' + esc(linkConsultaPublicaProcesso(p.tribunal, p.numero_cnj)) + '" target="_blank" rel="noopener" style="color:var(--accent);">consultar no ' + esc(p.tribunal || 'tribunal') + '</a> ' +
                '— cole o número do processo lá: <strong style="color:var(--ink-soft); user-select:all;">' + esc(p.numero_cnj) + '</strong>' +
              '</div>'
            ) : '') +

            '<div class="procficha-pje-secao hidden" style="margin-top:22px;">' +
              '<p class="procficha-painel-titulo">Comunicações do PJe</p>' +
              '<p class="procficha-painel-sub">Intimações e citações recebidas automaticamente pela Comunica PJe pra este processo.</p>' +
              '<div id="procficha-pje-corpo"><div class="empty-state"><div class="msg" style="color:var(--ink-faint);">Carregando…</div></div></div>' +
            '</div>' +
          '</div>' +

          '<div class="procficha-painel hidden" data-procficha-painel="prazos">' +
            '<p class="procficha-painel-titulo">Prazos</p>' +
            '<div style="margin-bottom:12px;"><button type="button" class="procpage-btn procpage-btn-primary" id="procficha-btn-novo-prazo">+ Novo prazo</button></div>' +
            '<div id="procficha-lista-prazos"><div class="empty-state"><div class="msg" style="color:var(--ink-faint);">Carregando…</div></div></div>' +
          '</div>' +

          '<div class="procficha-painel hidden" data-procficha-painel="documentos">' +
            '<p class="procficha-painel-titulo">Anexos deste processo</p>' +
            '<p class="procficha-painel-sub">Arquivos enviados e vinculados a este processo.</p>' +
            '<div style="margin-bottom:12px;"><button type="button" class="procpage-btn procpage-btn-primary" id="procficha-btn-novo-doc">+ Enviar documento</button></div>' +
            '<div id="procficha-lista-docs"><div class="empty-state"><div class="msg" style="color:var(--ink-faint);">Carregando…</div></div></div>' +

            '<p class="procficha-painel-titulo" style="margin-top:22px;">Modelos de documentos</p>' +
            '<p class="procficha-painel-sub">Gere um PDF a partir dos modelos já cadastrados no escritório, preenchido com os dados do cliente vinculado.</p>' +
            '<input type="text" id="procficha-modelos-busca" placeholder="Buscar por nome do modelo..." style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--line);border-radius:6px;font-size:13px;background:var(--bg);color:var(--ink);margin-bottom:10px;">' +
            '<div id="procficha-lista-modelos"><div class="empty-state"><div class="msg" style="color:var(--ink-faint);">Carregando…</div></div></div>' +
            '<div id="procficha-modelo-preview"></div>' +
          '</div>' +

          '<div class="procficha-painel hidden" data-procficha-painel="financeiro">' +
            '<div style="display:flex; align-items:center; justify-content:space-between;">' +
              '<p class="procficha-painel-titulo" style="margin:0;">Financeiro do processo</p>' +
            '</div>' +
            '<p class="procficha-painel-sub">Somado pelos contratos com o mesmo nome de cliente — hoje não há vínculo direto entre processo e contrato.</p>' +
            '<div id="procficha-financeiro-corpo"><div class="empty-state"><div class="msg" style="color:var(--ink-faint);">Carregando…</div></div></div>' +
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
          .catch(function () { mostrarAviso('Não foi possível atualizar o status agora.'); });
      });
    });
    document.getElementById('procficha-btn-excluir').addEventListener('click', function () {
      document.getElementById('procficha-menu-acoes').classList.add('hidden');
      confirmarModal('Excluir o processo de ' + processo.cliente_nome + '? Essa ação não pode ser desfeita.').then(function (ok) {
        if (!ok) return;
        apiPostJson('/api/painel?acao=processo_manual_excluir', { id: processo.id })
          .then(function () {
            viewFicha.classList.add('hidden');
            viewLista.classList.remove('hidden');
            carregarProcessosManuais();
          })
          .catch(function () { mostrarAviso('Não foi possível excluir o processo agora.'); });
      });
    });

    document.getElementById('procficha-btn-salvar-audiencia').addEventListener('click', function () {
      var btn = this;
      var valor = document.getElementById('procficha-audiencia-input').value;
      btn.disabled = true;
      btn.textContent = 'Salvando...';
      apiPostJson('/api/painel?acao=processo_manual_audiencia_atualizar', { id: processo.id, proxima_audiencia: valor })
        .then(function () { processo.proxima_audiencia = valor; abrirFichaProcesso(processo); })
        .catch(function () {
          btn.disabled = false;
          btn.textContent = 'Salvar';
          mostrarAviso('Não foi possível salvar agora.');
        });
    });

    function _htmlListaAtosInline(atos) {
      if (!atos.length) return '<div class="empty-state"><div class="msg" style="color:var(--ink-faint);">Nenhum ato processual registrado.</div></div>';
      return agruparAtosRepetidos(atos).map(function (g) {
        var a = g.base;
        var selo = g.qtd > 1
          ? ' <span class="chip neutral" title="O tribunal registrou este mesmo andamento ' + g.qtd + ' vezes nesse dia (comum quando vários documentos são anexados de uma vez, ex: petição inicial com vários anexos)">×' + g.qtd + '</span>'
          : '';
        return '<div class="prazo-card" style="background:var(--bg);border-color:var(--line);">' +
          '<div class="prazo-card-topo">' +
            '<div><span class="chip ' + (a.origem === 'Tribunal' ? 'neutral' : 'good') + '">' + esc(a.origem === 'Tribunal' ? 'Tribunal' : 'Escritório') + '</span> ' +
              '<strong style="font-size:13px;color:var(--ink);">' + esc(a.tipo || 'Ato') + '</strong>' + selo + '</div>' +
            '<span class="prazo-meta" style="color:var(--ink-faint);">' + fmtDataProcesso(a.data) + '</span>' +
          '</div>' +
          (a.descricao ? '<div class="prazo-resumo" style="color:var(--ink-soft);">' + esc(a.descricao) + '</div>' : '') +
          (a.link ? '<div style="margin-top:6px;"><a href="' + esc(a.link) + '" target="_blank" rel="noopener" style="font-size:12px;color:var(--accent);">Ver documento original</a></div>' : '') +
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

    carregarComunicacoesPjeDaFicha(processo);

    function _htmlListaPrazosInline(prazos) {
      if (!prazos.length) return '<div class="empty-state"><div class="msg" style="color:var(--ink-faint);">Nenhum prazo cadastrado.</div></div>';
      return prazos.map(function (pz) {
        return '<div class="prazo-card" style="background:var(--bg);border-color:var(--line);">' +
          '<div class="prazo-card-topo">' +
            '<div>' + _chipStatusPrazo(pz.status) + ' <span class="chip neutral">' + esc(pz.tipo === 'interno' ? 'Interno' : 'Legal') + '</span> ' +
              '<strong style="font-size:13px;color:var(--ink);">' + esc(pz.titulo) + '</strong></div>' +
            '<span class="prazo-meta" style="color:var(--ink-faint);">' + fmtDataProcesso(pz.data_limite) + '</span>' +
          '</div>' +
          (pz.observacao ? '<div class="prazo-resumo" style="color:var(--ink-soft);">' + esc(pz.observacao) + '</div>' : '') +
          '<div style="margin-top:8px; display:flex; gap:8px;">' +
            (pz.status !== 'cumprido' ? '<button type="button" class="btn-conexao-secundario" data-prazo-cumprir="' + pz.id + '">Marcar como cumprido</button>' : '') +
            '<button type="button" class="btn-conexao-secundario" data-prazo-editar="' + pz.id + '">Editar</button>' +
            '<button type="button" class="btn-remover" data-prazo-excluir="' + pz.id + '">Excluir</button>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    var prazosCarregadosFicha = [];
    function carregarPrazosFicha() {
      apiGetJson('/api/painel?acao=prazo_listar&processo_id=' + processo.id)
        .then(function (dados) {
          prazosCarregadosFicha = dados.prazos || [];
          var listaEl = document.getElementById('procficha-lista-prazos');
          if (!listaEl) return;
          listaEl.innerHTML = _htmlListaPrazosInline(prazosCarregadosFicha);
          listaEl.querySelectorAll('[data-prazo-cumprir]').forEach(function (btn) {
            btn.addEventListener('click', function () {
              apiPostJson('/api/painel?acao=prazo_atualizar', { id: btn.getAttribute('data-prazo-cumprir'), cumprido: true }).then(carregarPrazosFicha);
            });
          });
          listaEl.querySelectorAll('[data-prazo-editar]').forEach(function (btn) {
            btn.addEventListener('click', function () {
              var pz = prazosCarregadosFicha.filter(function (x) { return String(x.id) === btn.getAttribute('data-prazo-editar'); })[0];
              if (pz) abrirModalPrazo(processo, pz, carregarPrazosFicha);
            });
          });
          listaEl.querySelectorAll('[data-prazo-excluir]').forEach(function (btn) {
            btn.addEventListener('click', function () {
              confirmarModal('Excluir este prazo?').then(function (ok) {
                if (!ok) return;
                apiPostJson('/api/painel?acao=prazo_excluir', { id: btn.getAttribute('data-prazo-excluir') }).then(carregarPrazosFicha);
              });
            });
          });
        })
        .catch(function () {
          var listaEl = document.getElementById('procficha-lista-prazos');
          if (listaEl) listaEl.innerHTML = '<div class="empty-state"><div class="msg">Não foi possível carregar os prazos agora.</div></div>';
        });
    }
    carregarPrazosFicha();
    var btnNovoPrazoFicha = document.getElementById('procficha-btn-novo-prazo');
    if (btnNovoPrazoFicha) {
      btnNovoPrazoFicha.addEventListener('click', function () { abrirModalPrazo(processo, null, carregarPrazosFicha); });
    }

    apiGetJson('/api/painel?acao=documento_processo_listar&processo_id=' + processo.id)
      .then(function (dados) {
        var documentos = dados.documentos || [];
        document.getElementById('procficha-resumo-docs').textContent = documentos.length;
        var listaEl = document.getElementById('procficha-lista-docs');
        if (!listaEl) return;
        listaEl.innerHTML = documentos.length === 0
          ? '<div class="empty-state"><div class="msg" style="color:var(--ink-faint);">Nenhum documento neste processo.</div></div>'
          : documentos.map(function (d) {
              return '<div class="prazo-card" style="background:var(--bg);border-color:var(--line);">' +
                '<div class="prazo-card-topo">' +
                  '<strong style="font-size:13px;color:var(--ink);">' + esc(d.nome_arquivo) + '</strong>' +
                  '<a href="' + esc(d.link) + '" target="_blank" rel="noopener" style="font-size:12px;color:var(--accent);">Abrir</a>' +
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
          corpoEl.innerHTML = '<div class="empty-state"><div class="msg" style="color:var(--ink-faint);">Nenhum contrato encontrado com o nome desse cliente.</div></div>';
          return;
        }
        var vencimentosHtml = resumo.proximos_vencimentos.length === 0
          ? '<div class="empty-state"><div class="msg" style="color:var(--ink-faint);">Nenhuma conta a receber.</div></div>'
          : resumo.proximos_vencimentos.map(function (v) {
              var corSituacao = v.situacao === 'Vencida' ? 'var(--crit)' : (v.situacao === 'Vence hoje' ? 'var(--warn)' : 'var(--ink-faint)');
              return '<div class="prazo-card" style="background:var(--bg);border-color:var(--line);">' +
                '<div class="prazo-card-topo">' +
                  '<div><strong style="font-size:13px;color:var(--ink);">' + esc(v.tipo_servico || 'Parcela') + '</strong></div>' +
                  '<span style="font-size:12px;color:' + corSituacao + ';">' + esc(v.situacao) + (v.dias_atraso ? ' · ' + v.dias_atraso + 'd' : '') + '</span>' +
                '</div>' +
                '<div class="prazo-resumo" style="color:var(--ink-soft);">R$ ' + fmtMoeda(v.saldo) + (v.data_vencimento ? ' · vence ' + fmtDataProcesso(v.data_vencimento) : '') + '</div>' +
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
          '<div class="empty-state"><div class="msg" style="color:var(--ink-faint);">Registro de despesas do processo ainda não disponível.</div></div>';
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
        listaModelosEl.innerHTML = '<div class="empty-state"><div class="msg" style="color:var(--ink-faint);">Nenhum modelo cadastrado.</div></div>';
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
                mostrarAviso(resultado.corpo.erro || 'Não foi possível gerar o documento agora.');
              }
            })
            .catch(function () {
              btn.disabled = false; btn.textContent = 'Gerar PDF';
              mostrarAviso('Não foi possível gerar o documento agora.');
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
          listaModelosEl.innerHTML = '<div class="empty-state"><div class="msg" style="color:var(--ink-faint);">Não foi possível carregar os modelos agora.</div></div>';
        });
      document.getElementById('procficha-modelos-busca').addEventListener('input', function () {
        var termo = this.value.trim().toLowerCase();
        renderModelos(modelosCarregados.filter(function (n) { return n.toLowerCase().indexOf(termo) !== -1; }));
      });
    }
  }

  // ---------------------------------------------------------------------------------------
  // Triagem Trabalhista -- dashboard/lista (fase 1 do plano aprovado). Mesmo padrao de
  // wireProcessosHub/carregarProcessosManuais: busca a lista inteira uma vez, filtro/busca
  // roda no navegador contra o array em memoria, menu "..." por linha via delegacao de evento.
  // ---------------------------------------------------------------------------------------
  var ROTULO_STATUS_TRIAGEM = {
    nao_iniciada: 'Não iniciada', em_andamento: 'Em andamento',
    aguardando_documentos: 'Aguardando documentos', aguardando_informacoes: 'Aguardando informações',
    concluida: 'Concluída', convertida: 'Convertida em caso/processo',
  };
  var CHIP_STATUS_TRIAGEM = {
    nao_iniciada: 'neutral', em_andamento: 'warn', aguardando_documentos: 'warn',
    aguardando_informacoes: 'warn', concluida: 'good', convertida: 'good',
  };
  var _triagensTodasCarregadas = [];

  function _passaNosFiltrosTriagem(t, f) {
    if (f.status === 'arquivada') {
      if (!t.arquivado_em) return false;
    } else {
      if (t.arquivado_em) return false;
      if (f.status && t.status !== f.status) return false;
    }
    if (f.busca) {
      var alvo = ((t.cliente_nome || '') + ' ' + (t.empresa_razao_social || '') + ' ' + (t.empresa_nome_fantasia || '')).toLowerCase();
      if (alvo.indexOf(f.busca) === -1) return false;
    }
    return true;
  }

  function _lerFiltrosTriagemAtuais() {
    var elBusca = document.getElementById('triagem-filtro-busca');
    var elStatus = document.getElementById('triagem-filtro-status');
    return {
      busca: elBusca && elBusca.value ? elBusca.value.trim().toLowerCase() : '',
      status: elStatus ? elStatus.value : '',
    };
  }

  function _renderListaTriagens(triagens) {
    var lista = document.getElementById('triagem-lista');
    if (!lista) return;
    if (!triagens.length) {
      lista.innerHTML = '<div class="empty-state"><div class="msg" style="color:var(--ink-faint);">Nenhuma triagem encontrada.</div></div>';
      return;
    }
    var svgMais = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="6" r="1.8"></circle><circle cx="12" cy="12" r="1.8"></circle><circle cx="12" cy="18" r="1.8"></circle></svg>';
    lista.innerHTML = '<table><thead><tr>' +
      '<th>Cliente</th><th>Empresa/Reclamada</th><th>Responsável</th><th>Status</th><th>Conclusão</th><th>Última atualização</th><th></th>' +
      '</tr></thead><tbody>' +
      triagens.map(function (t, indice) {
        return '<tr>' +
          '<td><a class="procpage-numero-link" href="painel-criar-triagem.html?id=' + t.id + '#sec-criar-triagem">' + esc(t.cliente_nome || 'Cliente não definido') + '</a></td>' +
          '<td>' + esc(t.empresa_razao_social || t.empresa_nome_fantasia || '—') + '</td>' +
          '<td style="color:var(--ink-faint);">' + esc(t.responsavel_email || '—') + '</td>' +
          '<td><span class="chip triagem-chip-status ' + (CHIP_STATUS_TRIAGEM[t.status] || 'neutral') + '">' + esc(ROTULO_STATUS_TRIAGEM[t.status] || t.status) + '</span>' +
            (t.arquivado_em ? ' <span class="chip neutral">Arquivada</span>' : '') + '</td>' +
          '<td style="color:var(--ink-faint);">' + (t.percentual_conclusao || 0) + '%</td>' +
          '<td style="color:var(--ink-faint);">' + fmtDataProcesso(String(t.atualizado_em || '').slice(0, 10)) + '</td>' +
          '<td>' +
            '<div class="procpage-acoes-icones">' +
              (t.convertido_processo_id
                ? '<a class="procpage-btn" href="painel-processos.html?processo=' + t.convertido_processo_id + '#sec-processos">Ver processo</a>'
                : '<a class="procpage-btn" href="painel-criar-triagem.html?id=' + t.id + '#sec-criar-triagem">Continuar</a>') +
              '<span class="procman-acoes-wrap">' +
                '<button type="button" class="procpage-icone-btn" data-triagem-mais="' + indice + '" aria-label="Mais opções">' + svgMais + '</button>' +
                '<div class="procman-acoes-menu hidden" data-triagem-menu="' + indice + '">' +
                  (t.convertido_processo_id ? '' : '<button type="button" data-triagem-converter="' + indice + '">Converter em Caso</button>') +
                  '<button type="button" data-triagem-duplicar="' + indice + '">Duplicar</button>' +
                  (t.arquivado_em
                    ? '<button type="button" data-triagem-restaurar="' + indice + '">Restaurar</button>'
                    : '<button type="button" data-triagem-arquivar="' + indice + '">Arquivar</button>') +
                  '<button type="button" class="procman-acao-excluir" data-triagem-excluir="' + indice + '">Excluir</button>' +
                '</div>' +
              '</span>' +
            '</div>' +
          '</td>' +
        '</tr>';
      }).join('') +
      '</tbody></table>';
  }

  function carregarTriagens() {
    var lista = document.getElementById('triagem-lista');
    if (!lista) return;
    apiGetJson('/api/painel?acao=triagem_listar&incluir_arquivadas=1')
      .then(function (dados) {
        _triagensTodasCarregadas = dados.triagens || [];
        var f = _lerFiltrosTriagemAtuais();
        _renderListaTriagens(_triagensTodasCarregadas.filter(function (t) { return _passaNosFiltrosTriagem(t, f); }));
      })
      .catch(function () {
        lista.innerHTML = '<div class="empty-state"><div class="msg" style="color:var(--ink-faint);">Não foi possível carregar as triagens agora.</div></div>';
      });
  }

  function wireTriagemDashboard() {
    var lista = document.getElementById('triagem-lista');
    if (!lista) return;

    function aplicarFiltrosTriagem() {
      var f = _lerFiltrosTriagemAtuais();
      _renderListaTriagens(_triagensTodasCarregadas.filter(function (t) { return _passaNosFiltrosTriagem(t, f); }));
    }
    var elBusca = document.getElementById('triagem-filtro-busca');
    var elStatus = document.getElementById('triagem-filtro-status');
    if (elBusca) elBusca.addEventListener('input', aplicarFiltrosTriagem);
    if (elStatus) elStatus.addEventListener('change', aplicarFiltrosTriagem);
    var elLimpar = document.getElementById('triagem-filtro-limpar');
    if (elLimpar) elLimpar.addEventListener('click', function () {
      if (elBusca) elBusca.value = '';
      if (elStatus) elStatus.value = '';
      aplicarFiltrosTriagem();
    });

    lista.addEventListener('click', function (ev) {
      var btnMais = ev.target.closest('[data-triagem-mais]');
      if (btnMais) {
        var idx = btnMais.getAttribute('data-triagem-mais');
        var menuAlvo = lista.querySelector('[data-triagem-menu="' + idx + '"]');
        var jaAberto = menuAlvo && !menuAlvo.classList.contains('hidden');
        lista.querySelectorAll('.procman-acoes-menu').forEach(function (m) { m.classList.add('hidden'); });
        if (menuAlvo && !jaAberto) menuAlvo.classList.remove('hidden');
        return;
      }

      var btnConverter = ev.target.closest('[data-triagem-converter]');
      if (btnConverter) {
        var tc = _triagensTodasCarregadas[btnConverter.getAttribute('data-triagem-converter')];
        confirmarModal('Converter essa triagem em um processo? Um novo processo será criado com os dados do cliente.').then(function (ok) {
          if (!ok) return;
          apiPostJson('/api/painel?acao=triagem_converter_processo', { id: tc.id })
            .then(function (d) {
              carregarTriagens();
              window.location.href = 'painel-processos.html?processo=' + d.processo_id + '#sec-processos';
            })
            .catch(function (e) { mostrarAviso(e.message || 'Não foi possível converter agora.'); });
        });
        return;
      }

      var btnDuplicar = ev.target.closest('[data-triagem-duplicar]');
      if (btnDuplicar) {
        var t = _triagensTodasCarregadas[btnDuplicar.getAttribute('data-triagem-duplicar')];
        apiPostJson('/api/painel?acao=triagem_duplicar', { id: t.id })
          .then(function () { carregarTriagens(); })
          .catch(function (e) { mostrarAviso(e.message || 'Não foi possível duplicar agora.'); });
        return;
      }

      var btnArquivar = ev.target.closest('[data-triagem-arquivar]');
      if (btnArquivar) {
        var ta = _triagensTodasCarregadas[btnArquivar.getAttribute('data-triagem-arquivar')];
        confirmarModal('Arquivar essa triagem? Ela sai da lista, mas continua guardada.').then(function (ok) {
          if (!ok) return;
          apiPostJson('/api/painel?acao=triagem_arquivar', { id: ta.id })
            .then(function () { carregarTriagens(); })
            .catch(function (e) { mostrarAviso(e.message || 'Não foi possível arquivar agora.'); });
        });
        return;
      }

      var btnRestaurar = ev.target.closest('[data-triagem-restaurar]');
      if (btnRestaurar) {
        var tr = _triagensTodasCarregadas[btnRestaurar.getAttribute('data-triagem-restaurar')];
        apiPostJson('/api/painel?acao=triagem_restaurar', { id: tr.id })
          .then(function () { carregarTriagens(); })
          .catch(function (e) { mostrarAviso(e.message || 'Não foi possível restaurar agora.'); });
        return;
      }

      var btnExcluir = ev.target.closest('[data-triagem-excluir]');
      if (btnExcluir) {
        var te = _triagensTodasCarregadas[btnExcluir.getAttribute('data-triagem-excluir')];
        confirmarModal('Excluir essa triagem? Essa ação não pode ser desfeita.').then(function (ok) {
          if (!ok) return;
          apiPostJson('/api/painel?acao=triagem_excluir', { id: te.id })
            .then(function () { carregarTriagens(); })
            .catch(function (e) { mostrarAviso(e.message || 'Não foi possível excluir agora.'); });
        });
        return;
      }
    });

    document.addEventListener('click', function (ev) {
      if (!ev.target.closest('[data-triagem-mais]')) {
        lista.querySelectorAll('.procman-acoes-menu').forEach(function (m) { m.classList.add('hidden'); });
      }
    });
  }

  // ---------------------------------------------------------------------------------------
  // Triagem Trabalhista -- wizard (fase 1 do plano aprovado: so os passos Cliente, Empresa e
  // Contrato ficam funcionais aqui; Jornada e os demais entram nas fases seguintes). Botoes
  // sim/nao reaproveitam a mesma ideia de campo condicional ja usada em wireNovoContratoModal
  // (mostrar/esconder um bloco com .hidden a partir de uma resposta), generalizada aqui em 3
  // helpers pequenos em vez de repetir a logica por pergunta.
  function htmlSimNaoTriagem(id, rotulo, valorAtual) {
    return '<div>' +
      '<label style="display:block;font-size:11px;color:var(--ink-faint);margin-bottom:5px;">' + esc(rotulo) + '</label>' +
      '<div class="triagem-simnao" id="' + id + '" data-valor="' + (valorAtual === true ? 'sim' : (valorAtual === false ? 'nao' : '')) + '">' +
        '<button type="button" data-v="sim">Sim</button>' +
        '<button type="button" data-v="nao">Não</button>' +
      '</div>' +
    '</div>';
  }
  function wireSimNaoTriagem(id, onChange) {
    var wrap = document.getElementById(id);
    if (!wrap) return;
    function atualizarVisual() {
      var v = wrap.getAttribute('data-valor');
      wrap.querySelectorAll('button').forEach(function (b) { b.classList.toggle('ativo', b.getAttribute('data-v') === v); });
    }
    wrap.querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () {
        wrap.setAttribute('data-valor', b.getAttribute('data-v'));
        atualizarVisual();
        if (onChange) onChange(lerSimNaoTriagem(id));
      });
    });
    atualizarVisual();
    if (onChange) onChange(lerSimNaoTriagem(id));
  }
  function lerSimNaoTriagem(id) {
    var wrap = document.getElementById(id);
    if (!wrap) return null;
    var v = wrap.getAttribute('data-valor');
    return v === 'sim' ? true : (v === 'nao' ? false : null);
  }

  var PASSOS_WIZARD_TRIAGEM = ['cliente', 'empresa', 'contrato', 'jornada', 'remuneracao', 'irregularidades', 'saude', 'assedio', 'rescisao', 'testemunhas', 'provas', 'analise_final'];
  var ROTULOS_PASSO_WIZARD_TRIAGEM = {
    cliente: 'Cliente', empresa: 'Empresa', contrato: 'Contrato', jornada: 'Jornada',
    remuneracao: 'Remuneração', irregularidades: 'Irregularidades', saude: 'Saúde e Segurança',
    assedio: 'Assédio e Discriminação', rescisao: 'Rescisão', testemunhas: 'Testemunhas', provas: 'Provas',
    analise_final: 'Diagnóstico e Relatório',
  };
  var CATEGORIAS_PROVA_TRIAGEM = [
    { chave: 'documento', rotulo: 'Documento' }, { chave: 'whatsapp', rotulo: 'WhatsApp' },
    { chave: 'email', rotulo: 'E-mail' }, { chave: 'audio', rotulo: 'Áudio' },
    { chave: 'foto', rotulo: 'Foto' }, { chave: 'video', rotulo: 'Vídeo' },
    { chave: 'comprovante_pagamento', rotulo: 'Comprovante de pagamento' }, { chave: 'ponto', rotulo: 'Cartão de ponto' },
    { chave: 'testemunhal', rotulo: 'Prova testemunhal' }, { chave: 'outro', rotulo: 'Outro' },
  ];
  var TIPOS_ASSEDIO_TRIAGEM = [
    { chave: 'assedio_moral', rotulo: 'Assédio moral' }, { chave: 'assedio_sexual', rotulo: 'Assédio sexual' },
    { chave: 'discriminacao_genero', rotulo: 'Discriminação de gênero' }, { chave: 'discriminacao_racial', rotulo: 'Discriminação racial' },
    { chave: 'discriminacao_idade', rotulo: 'Discriminação por idade' }, { chave: 'discriminacao_deficiencia', rotulo: 'Discriminação por deficiência' },
    { chave: 'humilhacao', rotulo: 'Humilhação/xingamento' }, { chave: 'ameaca', rotulo: 'Ameaça' },
    { chave: 'cobranca_abusiva', rotulo: 'Cobrança abusiva' }, { chave: 'meta_abusiva', rotulo: 'Meta abusiva' },
    { chave: 'isolamento', rotulo: 'Isolamento/perseguição' }, { chave: 'retaliacao', rotulo: 'Retaliação' },
    { chave: 'outro', rotulo: 'Outro' },
  ];
  var FORMAS_RESCISAO_TRIAGEM = [
    { chave: 'dispensa_sem_justa_causa', rotulo: 'Dispensa sem justa causa' },
    { chave: 'justa_causa', rotulo: 'Justa causa' },
    { chave: 'pedido_demissao', rotulo: 'Pedido de demissão' },
    { chave: 'rescisao_indireta', rotulo: 'Rescisão indireta' },
    { chave: 'acordo', rotulo: 'Acordo' },
    { chave: 'termino_contrato_determinado', rotulo: 'Término de contrato determinado' },
    { chave: 'outro', rotulo: 'Outro' },
  ];
  var AGENTES_INSALUBRIDADE_TRIAGEM = [
    { chave: 'ruido', rotulo: 'Ruído' }, { chave: 'calor', rotulo: 'Calor' }, { chave: 'frio', rotulo: 'Frio' },
    { chave: 'quimicos', rotulo: 'Produtos químicos' }, { chave: 'biologicos', rotulo: 'Agentes biológicos' },
    { chave: 'eletricidade', rotulo: 'Eletricidade' }, { chave: 'inflamaveis', rotulo: 'Inflamáveis' },
    { chave: 'explosivos', rotulo: 'Explosivos' }, { chave: 'motocicleta', rotulo: 'Motocicleta' },
    { chave: 'poeira', rotulo: 'Poeira' }, { chave: 'outro', rotulo: 'Outro agente' },
  ];
  var DIAS_SEMANA_TRIAGEM = [
    { numero: 1, sigla: 'SEG' }, { numero: 2, sigla: 'TER' }, { numero: 3, sigla: 'QUA' },
    { numero: 4, sigla: 'QUI' }, { numero: 5, sigla: 'SEX' }, { numero: 6, sigla: 'SÁB' },
    { numero: 7, sigla: 'DOM' },
  ];

  function wireTriagemWizard() {
    var conteudo = document.getElementById('triagem-wizard-conteudo');
    if (!conteudo) return;

    var estado = { triagemId: null, passoIndex: 0, clienteModo: 'existente', clienteSelecionadoId: null };
    var _episodiosAssedioTriagem = [];
    var _testemunhasTriagem = [];
    var _provasTriagem = [];
    var _clientesCacheTriagem = null;

    function renderBarraPassosTriagem() {
      var barra = document.getElementById('triagem-passos-barra');
      barra.innerHTML = PASSOS_WIZARD_TRIAGEM.map(function (p, i) {
        var classe = i < estado.passoIndex ? 'feito' : (i === estado.passoIndex ? 'atual' : '');
        var clicavel = i < estado.passoIndex; // so deixa pular direto pra passo ja visitado
        return '<div class="triagem-passo-marca ' + classe + (clicavel ? ' clicavel' : '') + '"' +
          (clicavel ? ' data-triagem-passo-idx="' + i + '" title="Ir para: ' + esc(ROTULOS_PASSO_WIZARD_TRIAGEM[p]) + '"' : '') +
          '></div>';
      }).join('');
      document.getElementById('triagem-passo-atual-label').textContent =
        'Passo ' + (estado.passoIndex + 1) + ' de ' + PASSOS_WIZARD_TRIAGEM.length + ' — ' + ROTULOS_PASSO_WIZARD_TRIAGEM[PASSOS_WIZARD_TRIAGEM[estado.passoIndex]];
      document.getElementById('triagem-passo-pct-label').textContent =
        'Triagem ' + Math.round((estado.passoIndex / PASSOS_WIZARD_TRIAGEM.length) * 100) + '% concluída';
      document.getElementById('triagem-btn-voltar').style.visibility = estado.passoIndex === 0 ? 'hidden' : 'visible';
      document.getElementById('triagem-btn-avancar').textContent =
        estado.passoIndex === PASSOS_WIZARD_TRIAGEM.length - 1 ? 'Salvar e voltar ao painel' : 'Avançar →';
    }

    function erroWizardTriagem(msg) {
      document.getElementById('triagem-wizard-erro').innerHTML = msg ? '<div class="aviso-tenant">' + esc(msg) + '</div>' : '';
    }

    function renderPassoClienteTriagem() {
      conteudo.innerHTML =
        '<p class="triagem-passo-titulo">Cliente</p>' +
        '<p class="triagem-passo-sub">Selecione um cliente já cadastrado, ou cadastre um novo — ele já entra na lista geral de Clientes.</p>' +
        '<div class="triagem-simnao" id="triagem-cliente-modo">' +
          '<button type="button" data-modo="existente">Cliente já cadastrado</button>' +
          '<button type="button" data-modo="novo">Cadastrar novo cliente</button>' +
        '</div>' +
        '<div id="triagem-cliente-existente-wrap" class="triagem-campo-condicional" style="margin-top:14px;">' +
          '<div class="procficha-editar-grid"><div><label>Cliente</label><select id="triagem-cliente-select"><option value="">Carregando...</option></select></div></div>' +
        '</div>' +
        '<div id="triagem-cliente-novo-wrap" class="triagem-campo-condicional hidden" style="margin-top:14px;">' +
          '<div class="procficha-editar-grid">' +
            '<div><label>Tipo</label><select id="triagem-nc-tipo"><option>Pessoa Física</option><option>Pessoa Jurídica</option></select></div>' +
            '<div><label>Nome completo *</label><input id="triagem-nc-nome"></div>' +
            '<div><label>CPF/CNPJ</label><input id="triagem-nc-cpf"></div>' +
            '<div><label>Telefone</label><input id="triagem-nc-telefone"></div>' +
            '<div><label>E-mail</label><input id="triagem-nc-email"></div>' +
          '</div>' +
        '</div>';

      var btnExistente = conteudo.querySelector('[data-modo="existente"]');
      var btnNovo = conteudo.querySelector('[data-modo="novo"]');
      function atualizarModoCliente() {
        btnExistente.classList.toggle('ativo', estado.clienteModo === 'existente');
        btnNovo.classList.toggle('ativo', estado.clienteModo === 'novo');
        document.getElementById('triagem-cliente-existente-wrap').classList.toggle('hidden', estado.clienteModo !== 'existente');
        document.getElementById('triagem-cliente-novo-wrap').classList.toggle('hidden', estado.clienteModo !== 'novo');
      }
      btnExistente.addEventListener('click', function () { estado.clienteModo = 'existente'; atualizarModoCliente(); });
      btnNovo.addEventListener('click', function () { estado.clienteModo = 'novo'; atualizarModoCliente(); });
      atualizarModoCliente();

      var select = document.getElementById('triagem-cliente-select');
      (_clientesCacheTriagem ? Promise.resolve({ clientes: _clientesCacheTriagem }) : apiGetJson('/api/painel?acao=cliente_cadastro_listar'))
        .then(function (d) {
          _clientesCacheTriagem = d.clientes || [];
          select.innerHTML = '<option value="">Selecione...</option>' +
            _clientesCacheTriagem.map(function (c) {
              return '<option value="' + c.id + '">' + esc(c.nome) + (c.cpf_cnpj ? ' — ' + esc(c.cpf_cnpj) : '') + '</option>';
            }).join('');
          if (estado.clienteSelecionadoId) select.value = estado.clienteSelecionadoId;
        })
        .catch(function () { select.innerHTML = '<option value="">Não foi possível carregar os clientes</option>'; });
    }

    function salvarPassoClienteTriagem() {
      return new Promise(function (resolve, reject) {
        if (estado.clienteModo === 'existente') {
          var id = document.getElementById('triagem-cliente-select').value;
          if (!id) { reject('Selecione um cliente.'); return; }
          resolve(parseInt(id, 10));
        } else {
          var nome = document.getElementById('triagem-nc-nome').value.trim();
          if (!nome) { reject('Informe o nome do novo cliente.'); return; }
          apiPostJson('/api/painel?acao=cliente_cadastro_criar', {
            tipo: document.getElementById('triagem-nc-tipo').value,
            nome: nome,
            cpf_cnpj: document.getElementById('triagem-nc-cpf').value.trim(),
            telefone: document.getElementById('triagem-nc-telefone').value.trim(),
            email: document.getElementById('triagem-nc-email').value.trim(),
          }).then(function (d) { resolve(d.id); }).catch(function (e) { reject(e.message || 'Não foi possível cadastrar o cliente agora.'); });
        }
      });
    }

    function renderPassoEmpresaTriagem(d) {
      d = d || {};
      var endereco = (d.empresa_endereco && d.empresa_endereco.texto) || '';
      conteudo.innerHTML =
        '<p class="triagem-passo-titulo">Empresa (reclamada)</p>' +
        '<p class="triagem-passo-sub">Dados da empresa onde o cliente trabalhou.</p>' +
        '<div class="procficha-editar-grid">' +
          '<div><label>Razão social</label><input id="tg-emp-razao" value="' + esc(d.empresa_razao_social || '') + '"></div>' +
          '<div><label>Nome fantasia</label><input id="tg-emp-fantasia" value="' + esc(d.empresa_nome_fantasia || '') + '"></div>' +
          '<div><label>CNPJ</label><input id="tg-emp-cnpj" value="' + esc(d.empresa_cnpj || '') + '"></div>' +
          '<div><label>Endereço</label><input id="tg-emp-endereco" value="' + esc(endereco) + '"></div>' +
          '<div><label>Local efetivo de trabalho</label><input id="tg-emp-local" value="' + esc(d.local_trabalho || '') + '"></div>' +
          '<div><label>Nome do superior imediato</label><input id="tg-emp-superior-nome" value="' + esc(d.superior_imediato_nome || '') + '"></div>' +
          '<div><label>Cargo do superior</label><input id="tg-emp-superior-cargo" value="' + esc(d.superior_imediato_cargo || '') + '"></div>' +
        '</div>' +
        '<div style="margin-top:14px;display:flex;gap:24px;flex-wrap:wrap;">' +
          htmlSimNaoTriagem('tg-emp-terceirizacao', 'Havia terceirização?', d.terceirizacao) +
          htmlSimNaoTriagem('tg-emp-grupo', 'Pode haver grupo econômico?', d.grupo_economico) +
        '</div>' +
        '<div id="tg-emp-grupo-obs-wrap" class="triagem-campo-condicional hidden" style="margin-top:10px;">' +
          '<label style="display:block;font-size:11px;color:var(--ink-faint);margin-bottom:5px;">Observações sobre o grupo econômico</label>' +
          '<input id="tg-emp-grupo-obs" value="' + esc(d.grupo_economico_obs || '') + '" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--line);border-radius:6px;font-size:13px;background:var(--bg);color:var(--ink);">' +
        '</div>';
      wireSimNaoTriagem('tg-emp-terceirizacao');
      wireSimNaoTriagem('tg-emp-grupo', function (valor) {
        document.getElementById('tg-emp-grupo-obs-wrap').classList.toggle('hidden', valor !== true);
      });
    }

    function coletarPassoEmpresaTriagem() {
      return {
        empresa_razao_social: document.getElementById('tg-emp-razao').value.trim(),
        empresa_nome_fantasia: document.getElementById('tg-emp-fantasia').value.trim(),
        empresa_cnpj: document.getElementById('tg-emp-cnpj').value.trim(),
        empresa_endereco: { texto: document.getElementById('tg-emp-endereco').value.trim() },
        local_trabalho: document.getElementById('tg-emp-local').value.trim(),
        superior_imediato_nome: document.getElementById('tg-emp-superior-nome').value.trim(),
        superior_imediato_cargo: document.getElementById('tg-emp-superior-cargo').value.trim(),
        terceirizacao: lerSimNaoTriagem('tg-emp-terceirizacao'),
        grupo_economico: lerSimNaoTriagem('tg-emp-grupo'),
        grupo_economico_obs: document.getElementById('tg-emp-grupo-obs') ? document.getElementById('tg-emp-grupo-obs').value.trim() : '',
      };
    }

    function renderPassoContratoTriagem(d) {
      d = d || {};
      conteudo.innerHTML =
        '<p class="triagem-passo-titulo">Contrato de trabalho</p>' +
        '<p class="triagem-passo-sub">Como o vínculo foi registrado e como funcionava na prática.</p>' +
        '<div class="procficha-editar-grid">' +
          '<div><label>Data de admissão</label><input type="date" id="tg-ct-admissao" value="' + esc((d.data_admissao || '').slice(0, 10)) + '"></div>' +
          '<div><label>Cargo registrado</label><input id="tg-ct-cargo-registrado" value="' + esc(d.cargo_registrado || '') + '"></div>' +
          '<div><label>Função efetivamente exercida</label><input id="tg-ct-funcao" value="' + esc(d.funcao_exercida || '') + '"></div>' +
          '<div><label>Último salário (R$)</label><input id="tg-ct-salario" value="' + esc(d.salario_registrado != null ? String(d.salario_registrado).replace('.', ',') : '') + '"></div>' +
          '<div><label>Forma de pagamento</label><input id="tg-ct-forma-pagamento" value="' + esc(d.forma_pagamento || '') + '"></div>' +
        '</div>' +
        '<div style="margin-top:14px;display:flex;gap:24px;flex-wrap:wrap;">' +
          htmlSimNaoTriagem('tg-ct-ctps', 'Registro em CTPS?', d.ctps_registrado) +
          htmlSimNaoTriagem('tg-ct-por-fora', 'Recebia algum valor por fora?', d.pagamento_por_fora) +
        '</div>' +
        '<div id="tg-ct-por-fora-wrap" class="triagem-campo-condicional hidden" style="margin-top:10px;">' +
          '<div class="procficha-editar-grid">' +
            '<div><label>Qual valor?</label><input id="tg-ct-por-fora-valor" value="' + esc(d.valor_por_fora != null ? String(d.valor_por_fora).replace('.', ',') : '') + '"></div>' +
            '<div><label>Qual frequência?</label><input id="tg-ct-por-fora-frequencia" value="' + esc(d.frequencia_por_fora || '') + '"></div>' +
            '<div><label>Como era pago?</label><input id="tg-ct-por-fora-forma" value="' + esc(d.forma_por_fora || '') + '" placeholder="Pix, dinheiro, transferência..."></div>' +
          '</div>' +
          '<div style="margin-top:10px;">' + htmlSimNaoTriagem('tg-ct-por-fora-comprovante', 'Existe comprovante?', d.comprovante_por_fora) + '</div>' +
        '</div>' +
        '<div style="margin-top:14px;display:flex;gap:24px;flex-wrap:wrap;">' +
          htmlSimNaoTriagem('tg-ct-comissoes', 'Comissões?', d.comissoes) +
          htmlSimNaoTriagem('tg-ct-bonificacoes', 'Bonificações/premiações?', d.bonificacoes) +
          htmlSimNaoTriagem('tg-ct-alteracao', 'Alteração de cargo/salário?', d.alteracao_cargo_salario) +
          htmlSimNaoTriagem('tg-ct-acumulo', 'Acúmulo/desvio de função?', d.acumulo_desvio_funcao) +
        '</div>';
      wireSimNaoTriagem('tg-ct-ctps');
      wireSimNaoTriagem('tg-ct-por-fora', function (valor) {
        document.getElementById('tg-ct-por-fora-wrap').classList.toggle('hidden', valor !== true);
      });
      ['tg-ct-por-fora-comprovante', 'tg-ct-comissoes', 'tg-ct-bonificacoes', 'tg-ct-alteracao', 'tg-ct-acumulo'].forEach(function (id) { wireSimNaoTriagem(id); });
    }

    function coletarPassoContratoTriagem() {
      return {
        data_admissao: document.getElementById('tg-ct-admissao').value || null,
        ctps_registrado: lerSimNaoTriagem('tg-ct-ctps'),
        cargo_registrado: document.getElementById('tg-ct-cargo-registrado').value.trim(),
        funcao_exercida: document.getElementById('tg-ct-funcao').value.trim(),
        salario_registrado: document.getElementById('tg-ct-salario').value.trim(),
        forma_pagamento: document.getElementById('tg-ct-forma-pagamento').value.trim(),
        pagamento_por_fora: lerSimNaoTriagem('tg-ct-por-fora'),
        valor_por_fora: document.getElementById('tg-ct-por-fora-valor') ? document.getElementById('tg-ct-por-fora-valor').value.trim() : '',
        frequencia_por_fora: document.getElementById('tg-ct-por-fora-frequencia') ? document.getElementById('tg-ct-por-fora-frequencia').value.trim() : '',
        forma_por_fora: document.getElementById('tg-ct-por-fora-forma') ? document.getElementById('tg-ct-por-fora-forma').value.trim() : '',
        comprovante_por_fora: lerSimNaoTriagem('tg-ct-por-fora-comprovante'),
        comissoes: lerSimNaoTriagem('tg-ct-comissoes'),
        bonificacoes: lerSimNaoTriagem('tg-ct-bonificacoes'),
        alteracao_cargo_salario: lerSimNaoTriagem('tg-ct-alteracao'),
        acumulo_desvio_funcao: lerSimNaoTriagem('tg-ct-acumulo'),
      };
    }

    // ---- passo Jornada (fase 2) -- grade semanal (tabela propria, triagem_jornada_dias) +
    // perguntas de resumo (colunas do cabecalho, ja existiam desde a fase 1). Grade sempre
    // manda os 7 dias de uma vez (delete+insert no backend), nunca dia isolado.
    function _diaJornadaPorNumero(diasExistentes, numero) {
      return (diasExistentes || []).filter(function (d) { return d.dia_semana === numero; })[0] || {};
    }

    function renderPassoJornadaTriagem(d) {
      d = d || {};
      var diasExistentes = d.jornada_dias || [];
      conteudo.innerHTML =
        '<p class="triagem-passo-titulo">Jornada de trabalho</p>' +
        '<p class="triagem-passo-sub">Reconstrua a rotina semanal e as irregularidades de horário.</p>' +
        '<div class="procpage-tabela-wrap"><table><thead><tr>' +
          '<th>Dia</th><th>Trabalhava?</th><th>Entrada</th><th>Saída</th><th>Intervalo início</th><th>Intervalo fim</th>' +
        '</tr></thead><tbody>' +
        DIAS_SEMANA_TRIAGEM.map(function (dia) {
          var registro = _diaJornadaPorNumero(diasExistentes, dia.numero);
          var trabalhava = registro.trabalhava !== false;
          return '<tr>' +
            '<td><strong>' + dia.sigla + '</strong></td>' +
            '<td><input type="checkbox" id="tg-jor-trabalhava-' + dia.numero + '"' + (trabalhava ? ' checked' : '') + '></td>' +
            '<td><input type="time" id="tg-jor-entrada-' + dia.numero + '" value="' + esc((registro.horario_entrada || '').slice(0, 5)) + '"></td>' +
            '<td><input type="time" id="tg-jor-saida-' + dia.numero + '" value="' + esc((registro.horario_saida || '').slice(0, 5)) + '"></td>' +
            '<td><input type="time" id="tg-jor-int-ini-' + dia.numero + '" value="' + esc((registro.intervalo_inicio || '').slice(0, 5)) + '"></td>' +
            '<td><input type="time" id="tg-jor-int-fim-' + dia.numero + '" value="' + esc((registro.intervalo_fim || '').slice(0, 5)) + '"></td>' +
          '</tr>';
        }).join('') +
        '</tbody></table></div>' +
        '<p class="triagem-passo-sub" style="margin-top:22px;margin-bottom:8px;font-weight:600;">Perguntas complementares</p>' +
        '<div style="display:flex;gap:24px;flex-wrap:wrap;">' +
          htmlSimNaoTriagem('tg-jor-horas-extras', 'Fazia horas extras?', d.jornada_horas_extras) +
          htmlSimNaoTriagem('tg-jor-feriados', 'Trabalhava em feriados?', d.jornada_feriados) +
          htmlSimNaoTriagem('tg-jor-intervalo', 'Trabalhava durante o intervalo?', d.jornada_trabalho_intervalo) +
          htmlSimNaoTriagem('tg-jor-ponto-alterado', 'Chegava antes/saía depois de registrar o ponto?', d.jornada_ponto_alterado) +
        '</div>' +
        '<div style="display:flex;gap:24px;flex-wrap:wrap;margin-top:14px;">' +
          htmlSimNaoTriagem('tg-jor-mensagens', 'Recebia mensagens/ordens fora do expediente?', d.jornada_mensagens_fora_expediente) +
          htmlSimNaoTriagem('tg-jor-banco-horas', 'Existia banco de horas?', d.jornada_banco_horas) +
          htmlSimNaoTriagem('tg-jor-compensacao', 'Existia compensação?', d.jornada_compensacao) +
          htmlSimNaoTriagem('tg-jor-noturno', 'Trabalhava em horário noturno?', d.jornada_noturno) +
        '</div>' +
        '<p class="triagem-passo-sub" style="margin-top:22px;margin-bottom:8px;font-weight:600;">Controle de ponto</p>' +
        '<div style="display:flex;gap:24px;flex-wrap:wrap;">' +
          htmlSimNaoTriagem('tg-jor-ponto-existia', 'Existia controle de jornada?', d.controle_ponto_existia) +
        '</div>' +
        '<div id="tg-jor-ponto-detalhe-wrap" class="triagem-campo-condicional hidden" style="margin-top:10px;">' +
          '<div class="procficha-editar-grid">' +
            '<div><label>Tipo de controle</label><select id="tg-jor-ponto-tipo">' +
              '<option value="">Selecione...</option>' +
              '<option value="biometrico">Biométrico</option>' +
              '<option value="eletronico">Eletrônico</option>' +
              '<option value="aplicativo">Aplicativo</option>' +
              '<option value="folha">Folha</option>' +
              '<option value="cartao">Cartão</option>' +
              '<option value="outro">Outro</option>' +
            '</select></div>' +
          '</div>' +
          '<div style="margin-top:10px;">' + htmlSimNaoTriagem('tg-jor-ponto-real', 'O ponto registrava a jornada verdadeira?', d.controle_ponto_registrava_real) + '</div>' +
          '<div id="tg-jor-ponto-explicacao-wrap" class="triagem-campo-condicional hidden" style="margin-top:10px;">' +
            '<label style="display:block;font-size:11px;color:var(--ink-faint);margin-bottom:5px;">Explique como funcionava</label>' +
            '<textarea id="tg-jor-ponto-explicacao" rows="3" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--line);border-radius:6px;font-size:13px;background:var(--bg);color:var(--ink);font-family:inherit;">' + esc(d.controle_ponto_explicacao || '') + '</textarea>' +
          '</div>' +
        '</div>';

      setSelectValueComFallback(document.getElementById('tg-jor-ponto-tipo'), d.controle_ponto_tipo || '');

      wireSimNaoTriagem('tg-jor-horas-extras'); wireSimNaoTriagem('tg-jor-feriados');
      wireSimNaoTriagem('tg-jor-intervalo'); wireSimNaoTriagem('tg-jor-ponto-alterado');
      wireSimNaoTriagem('tg-jor-mensagens'); wireSimNaoTriagem('tg-jor-banco-horas');
      wireSimNaoTriagem('tg-jor-compensacao'); wireSimNaoTriagem('tg-jor-noturno');
      wireSimNaoTriagem('tg-jor-ponto-existia', function (valor) {
        document.getElementById('tg-jor-ponto-detalhe-wrap').classList.toggle('hidden', valor !== true);
      });
      wireSimNaoTriagem('tg-jor-ponto-real', function (valor) {
        document.getElementById('tg-jor-ponto-explicacao-wrap').classList.toggle('hidden', valor !== false);
      });
    }

    function coletarPassoJornadaTriagem() {
      var dias = DIAS_SEMANA_TRIAGEM.map(function (dia) {
        return {
          dia_semana: dia.numero,
          trabalhava: document.getElementById('tg-jor-trabalhava-' + dia.numero).checked,
          horario_entrada: document.getElementById('tg-jor-entrada-' + dia.numero).value || null,
          horario_saida: document.getElementById('tg-jor-saida-' + dia.numero).value || null,
          intervalo_inicio: document.getElementById('tg-jor-int-ini-' + dia.numero).value || null,
          intervalo_fim: document.getElementById('tg-jor-int-fim-' + dia.numero).value || null,
        };
      });
      var camposResumo = {
        jornada_horas_extras: lerSimNaoTriagem('tg-jor-horas-extras'),
        jornada_feriados: lerSimNaoTriagem('tg-jor-feriados'),
        jornada_trabalho_intervalo: lerSimNaoTriagem('tg-jor-intervalo'),
        jornada_ponto_alterado: lerSimNaoTriagem('tg-jor-ponto-alterado'),
        jornada_mensagens_fora_expediente: lerSimNaoTriagem('tg-jor-mensagens'),
        jornada_banco_horas: lerSimNaoTriagem('tg-jor-banco-horas'),
        jornada_compensacao: lerSimNaoTriagem('tg-jor-compensacao'),
        jornada_noturno: lerSimNaoTriagem('tg-jor-noturno'),
        controle_ponto_existia: lerSimNaoTriagem('tg-jor-ponto-existia'),
        controle_ponto_tipo: document.getElementById('tg-jor-ponto-tipo').value,
        controle_ponto_registrava_real: lerSimNaoTriagem('tg-jor-ponto-real'),
        controle_ponto_explicacao: document.getElementById('tg-jor-ponto-explicacao') ? document.getElementById('tg-jor-ponto-explicacao').value.trim() : '',
      };
      return { dias: dias, camposResumo: camposResumo };
    }

    // ---- passo Remuneração (fase 3) -- so colunas do cabecalho, ja existiam desde a fase 1.
    // Alerta visual automatico (pedido explicito do usuario) quando salario registrado e
    // salario efetivamente recebido divergem -- comparacao simples na hora de desenhar a tela,
    // sem precisar de coluna calculada no banco.
    function _valorMoedaTriagem(v) {
      return v != null ? String(v).replace('.', ',') : '';
    }

    function renderPassoRemuneracaoTriagem(d) {
      d = d || {};
      conteudo.innerHTML =
        '<p class="triagem-passo-titulo">Remuneração</p>' +
        '<p class="triagem-passo-sub">Salário registrado x efetivamente recebido, e outros valores.</p>' +
        '<div id="tg-rem-alerta-divergencia"></div>' +
        '<div class="procficha-editar-grid">' +
          '<div><label>Salário registrado (R$)</label><input value="' + esc(_valorMoedaTriagem(d.salario_registrado)) + '" disabled title="Editado no passo Contrato"></div>' +
          '<div><label>Salário efetivamente recebido (R$)</label><input id="tg-rem-salario-real" value="' + esc(_valorMoedaTriagem(d.salario_recebido_real)) + '"></div>' +
          '<div><label>Descontos indevidos (se houver)</label><input id="tg-rem-descontos" value="' + esc(d.descontos_indevidos || '') + '"></div>' +
        '</div>' +
        '<div style="margin-top:14px;display:flex;gap:24px;flex-wrap:wrap;">' +
          htmlSimNaoTriagem('tg-rem-dsr', 'Recebia DSR?', d.recebia_dsr) +
          htmlSimNaoTriagem('tg-rem-noturno', 'Recebia adicional noturno?', d.recebia_adicional_noturno) +
          htmlSimNaoTriagem('tg-rem-vt', 'Vale-transporte?', d.vale_transporte) +
          htmlSimNaoTriagem('tg-rem-va', 'Vale-alimentação?', d.vale_alimentacao) +
          htmlSimNaoTriagem('tg-rem-vr', 'Vale-refeição?', d.vale_refeicao) +
        '</div>';
      ['tg-rem-dsr', 'tg-rem-noturno', 'tg-rem-vt', 'tg-rem-va', 'tg-rem-vr'].forEach(function (id) { wireSimNaoTriagem(id); });

      function atualizarAlertaDivergencia() {
        var registrado = parseFloat((d.salario_registrado || '0').toString().replace(',', '.')) || 0;
        var recebidoTexto = document.getElementById('tg-rem-salario-real').value.trim();
        var recebido = parseFloat(recebidoTexto.replace(',', '.'));
        var alertaEl = document.getElementById('tg-rem-alerta-divergencia');
        if (recebidoTexto && !isNaN(recebido) && Math.abs(recebido - registrado) > 0.01) {
          alertaEl.innerHTML = '<div class="aviso-tenant" style="margin-bottom:14px;">⚠ Possível divergência remuneratória identificada — o salário efetivamente recebido é diferente do registrado.</div>';
        } else {
          alertaEl.innerHTML = '';
        }
      }
      document.getElementById('tg-rem-salario-real').addEventListener('input', atualizarAlertaDivergencia);
      atualizarAlertaDivergencia();
    }

    function coletarPassoRemuneracaoTriagem() {
      return {
        salario_recebido_real: document.getElementById('tg-rem-salario-real').value.trim(),
        descontos_indevidos: document.getElementById('tg-rem-descontos').value.trim(),
        recebia_dsr: lerSimNaoTriagem('tg-rem-dsr'),
        recebia_adicional_noturno: lerSimNaoTriagem('tg-rem-noturno'),
        vale_transporte: lerSimNaoTriagem('tg-rem-vt'),
        vale_alimentacao: lerSimNaoTriagem('tg-rem-va'),
        vale_refeicao: lerSimNaoTriagem('tg-rem-vr'),
      };
    }

    // ---- passo Irregularidades / Insalubridade e Periculosidade (fase 3) -- checklist de
    // agentes; marcar um agente revela suas sub-perguntas (mesmo padrao .triagem-campo-condicional
    // ja usado nos outros passos, generalizado aqui pra uma lista dinamica de agentes em vez de
    // um unico campo condicional).
    function _agenteInsalubridadePorChave(agentesExistentes, chave) {
      return (agentesExistentes || []).filter(function (a) { return a.agente === chave; })[0] || null;
    }

    function renderPassoIrregularidadesTriagem(d) {
      d = d || {};
      var agentesExistentes = d.insalubridade || [];
      conteudo.innerHTML =
        '<p class="triagem-passo-titulo">Insalubridade e periculosidade</p>' +
        '<p class="triagem-passo-sub">Marque os agentes a que o cliente foi exposto -- cada um abre perguntas complementares.</p>' +
        AGENTES_INSALUBRIDADE_TRIAGEM.map(function (agenteInfo) {
          var registro = _agenteInsalubridadePorChave(agentesExistentes, agenteInfo.chave);
          var marcado = !!registro;
          return '<div style="margin-bottom:10px;">' +
            '<label style="display:flex;align-items:center;gap:8px;font-size:13.5px;color:var(--ink);cursor:pointer;">' +
              '<input type="checkbox" class="tg-irr-agente-check" data-agente="' + agenteInfo.chave + '"' + (marcado ? ' checked' : '') + '>' +
              agenteInfo.rotulo +
            '</label>' +
            '<div id="tg-irr-detalhe-' + agenteInfo.chave + '" class="triagem-campo-condicional' + (marcado ? '' : ' hidden') + '" style="margin-top:8px;margin-left:26px;">' +
              '<div class="procficha-editar-grid">' +
                '<div><label>Qual era a exposição?</label><input id="tg-irr-exp-' + agenteInfo.chave + '" value="' + esc((registro && registro.descricao_exposicao) || '') + '"></div>' +
                '<div><label>Com que frequência?</label><input id="tg-irr-freq-' + agenteInfo.chave + '" value="' + esc((registro && registro.frequencia) || '') + '"></div>' +
                '<div><label>Durante quanto tempo?</label><input id="tg-irr-tempo-' + agenteInfo.chave + '" value="' + esc((registro && registro.tempo_exposicao) || '') + '"></div>' +
                '<div><label>Qual EPI?</label><input id="tg-irr-epiqual-' + agenteInfo.chave + '" value="' + esc((registro && registro.epi_qual) || '') + '"></div>' +
              '</div>' +
              '<div style="display:flex;gap:20px;flex-wrap:wrap;margin-top:8px;">' +
                htmlSimNaoTriagem('tg-irr-episim-' + agenteInfo.chave, 'Recebia EPI?', registro && registro.epi_fornecido) +
                htmlSimNaoTriagem('tg-irr-epiuso-' + agenteInfo.chave, 'Utilizava?', registro && registro.epi_utilizava) +
                htmlSimNaoTriagem('tg-irr-episub-' + agenteInfo.chave, 'Era substituído?', registro && registro.epi_substituido) +
                htmlSimNaoTriagem('tg-irr-fiscal-' + agenteInfo.chave, 'Existia fiscalização?', registro && registro.existia_fiscalizacao) +
                htmlSimNaoTriagem('tg-irr-adic-' + agenteInfo.chave, 'Recebia adicional?', registro && registro.adicional_recebido) +
              '</div>' +
            '</div>' +
          '</div>';
        }).join('');

      AGENTES_INSALUBRIDADE_TRIAGEM.forEach(function (agenteInfo) {
        ['episim', 'epiuso', 'episub', 'fiscal', 'adic'].forEach(function (prefixo) {
          wireSimNaoTriagem('tg-irr-' + prefixo + '-' + agenteInfo.chave);
        });
      });

      conteudo.querySelectorAll('.tg-irr-agente-check').forEach(function (chk) {
        chk.addEventListener('change', function () {
          document.getElementById('tg-irr-detalhe-' + chk.getAttribute('data-agente')).classList.toggle('hidden', !chk.checked);
        });
      });
    }

    function coletarPassoIrregularidadesTriagem() {
      var agentes = [];
      conteudo.querySelectorAll('.tg-irr-agente-check').forEach(function (chk) {
        if (!chk.checked) return;
        var chave = chk.getAttribute('data-agente');
        agentes.push({
          agente: chave,
          descricao_exposicao: document.getElementById('tg-irr-exp-' + chave).value.trim(),
          frequencia: document.getElementById('tg-irr-freq-' + chave).value.trim(),
          tempo_exposicao: document.getElementById('tg-irr-tempo-' + chave).value.trim(),
          epi_qual: document.getElementById('tg-irr-epiqual-' + chave).value.trim(),
          epi_fornecido: lerSimNaoTriagem('tg-irr-episim-' + chave),
          epi_utilizava: lerSimNaoTriagem('tg-irr-epiuso-' + chave),
          epi_substituido: lerSimNaoTriagem('tg-irr-episub-' + chave),
          existia_fiscalizacao: lerSimNaoTriagem('tg-irr-fiscal-' + chave),
          adicional_recebido: lerSimNaoTriagem('tg-irr-adic-' + chave),
        });
      });
      return agentes;
    }

    // ---- passo Saúde e Segurança (fase 4) -- linha unica opcional (triagem_saude_seguranca).
    function renderPassoSaudeTriagem(d) {
      d = d || {};
      var s = d.saude_seguranca || {};
      conteudo.innerHTML =
        '<p class="triagem-passo-titulo">Saúde e segurança do trabalho</p>' +
        '<p class="triagem-passo-sub">Acidentes de trabalho ou doenças relacionadas ao trabalho.</p>' +
        '<div style="display:flex;gap:24px;flex-wrap:wrap;">' +
          htmlSimNaoTriagem('tg-sau-teve', 'Sofreu acidente de trabalho ou desenvolveu doença relacionada ao trabalho?', s.teve_acidente_doenca) +
        '</div>' +
        '<div id="tg-sau-detalhe-wrap" class="triagem-campo-condicional hidden" style="margin-top:14px;">' +
          '<div style="display:flex;gap:24px;flex-wrap:wrap;">' +
            htmlSimNaoTriagem('tg-sau-cat', 'Foi emitida CAT?', s.cat_emitida) +
            htmlSimNaoTriagem('tg-sau-exames', 'Possui exames?', s.exames_realizados) +
            htmlSimNaoTriagem('tg-sau-laudos', 'Possui laudos médicos?', s.laudos_medicos) +
            htmlSimNaoTriagem('tg-sau-afastamento', 'Foi afastado pelo INSS?', s.afastamento_inss) +
            htmlSimNaoTriagem('tg-sau-dispensado', 'Foi dispensado após retornar?', s.dispensado_apos_retorno) +
          '</div>' +
          '<div class="procficha-editar-grid" style="margin-top:14px;">' +
            '<div><label>Dias de afastamento (aprox.)</label><input id="tg-sau-dias" value="' + esc(s.dias_afastamento || '') + '"></div>' +
            '<div><label>Data de retorno do afastamento</label><input type="date" id="tg-sau-retorno" value="' + esc((s.data_retorno_afastamento || '').slice(0, 10)) + '"></div>' +
          '</div>' +
          '<div style="margin-top:10px;">' +
            '<label style="display:block;font-size:11px;color:var(--ink-faint);margin-bottom:5px;">Limitação atual (se houver)</label>' +
            '<textarea id="tg-sau-limitacao" rows="3" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--line);border-radius:6px;font-size:13px;background:var(--bg);color:var(--ink);font-family:inherit;">' + esc(s.limitacao_atual || '') + '</textarea>' +
          '</div>' +
        '</div>';
      ['tg-sau-cat', 'tg-sau-exames', 'tg-sau-laudos', 'tg-sau-afastamento', 'tg-sau-dispensado'].forEach(function (id) { wireSimNaoTriagem(id); });
      wireSimNaoTriagem('tg-sau-teve', function (valor) {
        document.getElementById('tg-sau-detalhe-wrap').classList.toggle('hidden', valor !== true);
      });
    }

    function coletarPassoSaudeTriagem() {
      return {
        teve_acidente_doenca: lerSimNaoTriagem('tg-sau-teve'),
        cat_emitida: lerSimNaoTriagem('tg-sau-cat'),
        exames_realizados: lerSimNaoTriagem('tg-sau-exames'),
        laudos_medicos: lerSimNaoTriagem('tg-sau-laudos'),
        afastamento_inss: lerSimNaoTriagem('tg-sau-afastamento'),
        dias_afastamento: document.getElementById('tg-sau-dias').value.trim(),
        limitacao_atual: document.getElementById('tg-sau-limitacao').value.trim(),
        dispensado_apos_retorno: lerSimNaoTriagem('tg-sau-dispensado'),
        data_retorno_afastamento: document.getElementById('tg-sau-retorno').value || null,
      };
    }

    // ---- passo Assédio e Discriminação (fase 4) -- lista dinamica "+ adicionar episodio"
    // (primeira lista de verdade do wizard com quantidade livre, ao contrario da jornada/
    // insalubridade que tem um conjunto fixo de linhas possiveis).
    function renderPassoAssedioTriagem(d) {
      d = d || {};
      _episodiosAssedioTriagem = (d.assedio_episodios || []).slice();
      conteudo.innerHTML =
        '<p class="triagem-passo-titulo">Assédio e discriminação</p>' +
        '<p class="triagem-passo-sub">Cadastre cada episódio separadamente — pode adicionar quantos precisar.</p>' +
        '<div id="tg-ass-lista"></div>' +
        '<button type="button" class="procpage-btn" id="tg-ass-adicionar" style="margin-top:10px;">+ Adicionar episódio</button>';
      _renderListaEpisodiosAssedioTriagem();
      document.getElementById('tg-ass-adicionar').addEventListener('click', function () {
        _sincronizarEpisodiosAssedioDoDom();
        _episodiosAssedioTriagem.push({});
        _renderListaEpisodiosAssedioTriagem();
      });
    }

    // Le os valores que estao de fato na tela agora (o usuario pode ter digitado algo depois do
    // ultimo render) pro array em memoria antes de qualquer re-render -- sem isso, adicionar ou
    // remover um episodio jogava fora o que ja tinha sido preenchido nos outros (bug real
    // reportado: o campo de cima ficava em branco ao clicar "+ Adicionar episodio").
    function _lerEpisodioAssedioDoDom(i) {
      var elTipo = document.getElementById('tg-ass-tipo-' + i);
      if (!elTipo) return null;
      return {
        tipo: elTipo.value,
        data_ocorrencia: document.getElementById('tg-ass-data-' + i).value || null,
        quem: document.getElementById('tg-ass-quem-' + i).value,
        cargo_quem: document.getElementById('tg-ass-cargo-' + i).value,
        quantidade_vezes: document.getElementById('tg-ass-qtd-' + i).value,
        local_ocorrencia: document.getElementById('tg-ass-local-' + i).value,
        descricao: document.getElementById('tg-ass-desc-' + i).value,
        teve_testemunha: lerSimNaoTriagem('tg-ass-test-' + i),
        tem_prova: lerSimNaoTriagem('tg-ass-prova-' + i),
      };
    }

    function _sincronizarEpisodiosAssedioDoDom() {
      _episodiosAssedioTriagem = _episodiosAssedioTriagem.map(function (ep, i) { return _lerEpisodioAssedioDoDom(i) || ep; });
    }

    function _renderListaEpisodiosAssedioTriagem() {
      var lista = document.getElementById('tg-ass-lista');
      if (!_episodiosAssedioTriagem.length) {
        lista.innerHTML = '<p style="color:var(--ink-faint);font-size:13px;">Nenhum episódio cadastrado ainda.</p>';
        return;
      }
      lista.innerHTML = _episodiosAssedioTriagem.map(function (ep, i) {
        return '<div class="procficha-painel" style="margin-bottom:12px;position:relative;">' +
          '<button type="button" class="procman-acao-excluir" data-ass-remover="' + i + '" style="position:absolute;top:14px;right:16px;background:none;border:none;cursor:pointer;font-size:12px;">Remover</button>' +
          '<div class="procficha-editar-grid">' +
            '<div><label>Tipo</label><select id="tg-ass-tipo-' + i + '">' +
              TIPOS_ASSEDIO_TRIAGEM.map(function (t) { return '<option value="' + t.chave + '">' + esc(t.rotulo) + '</option>'; }).join('') +
            '</select></div>' +
            '<div><label>Quando aconteceu?</label><input type="date" id="tg-ass-data-' + i + '" value="' + esc((ep.data_ocorrencia || '').slice(0, 10)) + '"></div>' +
            '<div><label>Quem praticou?</label><input id="tg-ass-quem-' + i + '" value="' + esc(ep.quem || '') + '"></div>' +
            '<div><label>Qual cargo?</label><input id="tg-ass-cargo-' + i + '" value="' + esc(ep.cargo_quem || '') + '"></div>' +
            '<div><label>Quantas vezes?</label><input id="tg-ass-qtd-' + i + '" value="' + esc(ep.quantidade_vezes || '') + '"></div>' +
            '<div><label>Onde?</label><input id="tg-ass-local-' + i + '" value="' + esc(ep.local_ocorrencia || '') + '"></div>' +
          '</div>' +
          '<div style="margin-top:10px;">' +
            '<label style="display:block;font-size:11px;color:var(--ink-faint);margin-bottom:5px;">O que aconteceu?</label>' +
            '<textarea id="tg-ass-desc-' + i + '" rows="2" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--line);border-radius:6px;font-size:13px;background:var(--bg);color:var(--ink);font-family:inherit;">' + esc(ep.descricao || '') + '</textarea>' +
          '</div>' +
          '<div style="display:flex;gap:20px;flex-wrap:wrap;margin-top:10px;">' +
            htmlSimNaoTriagem('tg-ass-test-' + i, 'Quem presenciou (existem testemunhas)?', ep.teve_testemunha) +
            htmlSimNaoTriagem('tg-ass-prova-' + i, 'Existem provas (mensagens/áudios/vídeos)?', ep.tem_prova) +
          '</div>' +
        '</div>';
      }).join('');

      _episodiosAssedioTriagem.forEach(function (ep, i) {
        setSelectValueComFallback(document.getElementById('tg-ass-tipo-' + i), ep.tipo || 'assedio_moral');
        wireSimNaoTriagem('tg-ass-test-' + i);
        wireSimNaoTriagem('tg-ass-prova-' + i);
      });

      lista.querySelectorAll('[data-ass-remover]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          _sincronizarEpisodiosAssedioDoDom();
          _episodiosAssedioTriagem.splice(parseInt(btn.getAttribute('data-ass-remover'), 10), 1);
          _renderListaEpisodiosAssedioTriagem();
        });
      });
    }

    function coletarPassoAssedioTriagem() {
      return _episodiosAssedioTriagem.map(function (ep, i) {
        return {
          tipo: document.getElementById('tg-ass-tipo-' + i).value,
          data_ocorrencia: document.getElementById('tg-ass-data-' + i).value || null,
          quem: document.getElementById('tg-ass-quem-' + i).value.trim(),
          cargo_quem: document.getElementById('tg-ass-cargo-' + i).value.trim(),
          quantidade_vezes: document.getElementById('tg-ass-qtd-' + i).value.trim(),
          local_ocorrencia: document.getElementById('tg-ass-local-' + i).value.trim(),
          descricao: document.getElementById('tg-ass-desc-' + i).value.trim(),
          teve_testemunha: lerSimNaoTriagem('tg-ass-test-' + i),
          tem_prova: lerSimNaoTriagem('tg-ass-prova-' + i),
        };
      });
    }

    // ---- passo Rescisão (fase 4) -- colunas do cabecalho (ja existiam desde a fase 1), com a
    // subsecao de Justa Causa condicional e o painel de Estabilidades (so leitura, calculado no
    // backend a partir de outras respostas -- ver _detectar_estabilidades em triagem_trabalhista.py).
    function montarPainelEstabilidadesTriagem(lista) {
      if (!lista || !lista.length) return '';
      return '<div class="triagem-campo-condicional" style="margin-top:22px;border-color:var(--crit);">' +
        '<p style="font-weight:600;margin:0 0 8px;color:var(--ink);">🔴 Pontos de atenção — possíveis estabilidades</p>' +
        lista.map(function (e) { return '<div style="font-size:13px;color:var(--ink-soft);margin-bottom:4px;">• ' + esc(e.mensagem) + '</div>'; }).join('') +
        '<p style="font-size:11.5px;color:var(--ink-faint);margin-top:8px;margin-bottom:0;">Isso não conclui que existe direito — só sinaliza que o assunto precisa de análise jurídica.</p>' +
      '</div>';
    }

    function renderPassoRescisaoTriagem(d) {
      d = d || {};
      conteudo.innerHTML =
        '<p class="triagem-passo-titulo">Rescisão</p>' +
        '<p class="triagem-passo-sub">Como e quando o contrato terminou (se já terminou).</p>' +
        '<div style="display:flex;gap:24px;flex-wrap:wrap;">' +
          htmlSimNaoTriagem('tg-res-terminou', 'O contrato já terminou?', d.contrato_terminou) +
        '</div>' +
        '<div id="tg-res-detalhe-wrap" class="triagem-campo-condicional hidden" style="margin-top:14px;">' +
          '<div class="procficha-editar-grid">' +
            '<div><label>Data da rescisão</label><input type="date" id="tg-res-data" value="' + esc((d.data_rescisao || '').slice(0, 10)) + '"></div>' +
            '<div><label>Forma de desligamento</label><select id="tg-res-forma">' +
              '<option value="">Selecione...</option>' +
              FORMAS_RESCISAO_TRIAGEM.map(function (f) { return '<option value="' + f.chave + '">' + esc(f.rotulo) + '</option>'; }).join('') +
            '</select></div>' +
            '<div><label>Tipo de aviso-prévio</label><input id="tg-res-aviso" value="' + esc(d.aviso_previo_tipo || '') + '"></div>' +
          '</div>' +
          '<div style="display:flex;gap:24px;flex-wrap:wrap;margin-top:14px;">' +
            htmlSimNaoTriagem('tg-res-trct', 'Recebeu TRCT?', d.trct_recebido) +
            htmlSimNaoTriagem('tg-res-fgts', 'Recebeu as guias do FGTS?', d.fgts_guias_entregues) +
            htmlSimNaoTriagem('tg-res-seguro', 'Recebeu seguro-desemprego?', d.seguro_desemprego_liberado) +
            htmlSimNaoTriagem('tg-res-multa', 'Recebeu a multa de 40%?', d.multa_40_paga) +
          '</div>' +
          '<div id="tg-res-jc-wrap" class="triagem-campo-condicional hidden" style="margin-top:18px;">' +
            '<p class="triagem-passo-sub" style="font-weight:600;margin-bottom:8px;">Análise da justa causa</p>' +
            '<label style="display:block;font-size:11px;color:var(--ink-faint);margin-bottom:5px;">Qual foi a acusação da empresa?</label>' +
            '<textarea id="tg-res-jc-acusacao" rows="2" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--line);border-radius:6px;font-size:13px;background:var(--bg);color:var(--ink);font-family:inherit;">' + esc(d.jc_acusacao || '') + '</textarea>' +
            '<div class="procficha-editar-grid" style="margin-top:10px;">' +
              '<div><label>Dias entre o fato e a demissão</label><input id="tg-res-jc-tempo" value="' + esc(d.jc_tempo_fato_demissao_dias || '') + '"></div>' +
            '</div>' +
            '<div style="display:flex;gap:20px;flex-wrap:wrap;margin-top:10px;">' +
              htmlSimNaoTriagem('tg-res-jc-adv', 'Existe advertência/suspensão anterior?', d.jc_advertencias_previas) +
              htmlSimNaoTriagem('tg-res-jc-invest', 'Houve investigação formal?', d.jc_investigacao_formal) +
            '</div>' +
          '</div>' +
        '</div>' +
        montarPainelEstabilidadesTriagem(d.estabilidades_detectadas);

      setSelectValueComFallback(document.getElementById('tg-res-forma'), d.forma_rescisao || '');
      ['tg-res-trct', 'tg-res-fgts', 'tg-res-seguro', 'tg-res-multa', 'tg-res-jc-adv', 'tg-res-jc-invest'].forEach(function (id) { wireSimNaoTriagem(id); });
      wireSimNaoTriagem('tg-res-terminou', function (valor) {
        document.getElementById('tg-res-detalhe-wrap').classList.toggle('hidden', valor !== true);
      });
      var selectForma = document.getElementById('tg-res-forma');
      function atualizarJustaCausaTriagem() {
        document.getElementById('tg-res-jc-wrap').classList.toggle('hidden', selectForma.value !== 'justa_causa');
      }
      selectForma.addEventListener('change', atualizarJustaCausaTriagem);
      atualizarJustaCausaTriagem();
    }

    function coletarPassoRescisaoTriagem() {
      return {
        contrato_terminou: lerSimNaoTriagem('tg-res-terminou'),
        data_rescisao: document.getElementById('tg-res-data').value || null,
        forma_rescisao: document.getElementById('tg-res-forma').value,
        aviso_previo_tipo: document.getElementById('tg-res-aviso').value.trim(),
        trct_recebido: lerSimNaoTriagem('tg-res-trct'),
        fgts_guias_entregues: lerSimNaoTriagem('tg-res-fgts'),
        seguro_desemprego_liberado: lerSimNaoTriagem('tg-res-seguro'),
        multa_40_paga: lerSimNaoTriagem('tg-res-multa'),
        jc_acusacao: document.getElementById('tg-res-jc-acusacao').value.trim(),
        jc_tempo_fato_demissao_dias: document.getElementById('tg-res-jc-tempo').value.trim(),
        jc_advertencias_previas: lerSimNaoTriagem('tg-res-jc-adv'),
        jc_investigacao_formal: lerSimNaoTriagem('tg-res-jc-invest'),
      };
    }

    // ---- passo Testemunhas (fase 5) -- lista dinamica, mesmo padrao "+ adicionar" do assedio.
    function renderPassoTestemunhasTriagem(d) {
      d = d || {};
      _testemunhasTriagem = (d.testemunhas || []).slice();
      conteudo.innerHTML =
        '<p class="triagem-passo-titulo">Testemunhas</p>' +
        '<p class="triagem-passo-sub">Pessoas que podem confirmar os fatos relatados — pode adicionar quantas precisar.</p>' +
        '<div id="tg-test-lista"></div>' +
        '<button type="button" class="procpage-btn" id="tg-test-adicionar" style="margin-top:10px;">+ Adicionar testemunha</button>';
      _renderListaTestemunhasTriagem();
      document.getElementById('tg-test-adicionar').addEventListener('click', function () {
        _sincronizarTestemunhasDoDom();
        _testemunhasTriagem.push({});
        _renderListaTestemunhasTriagem();
      });
    }

    // Mesmo motivo do _sincronizarEpisodiosAssedioDoDom -- le a tela de verdade antes de
    // adicionar/remover, pra nao perder o que ja foi digitado nos outros cards.
    function _lerTestemunhaDoDom(i) {
      var elNome = document.getElementById('tg-test-nome-' + i);
      if (!elNome) return null;
      return {
        nome: elNome.value,
        telefone: document.getElementById('tg-test-tel-' + i).value,
        empresa_trabalhou: document.getElementById('tg-test-emp-' + i).value,
        cargo: document.getElementById('tg-test-cargo-' + i).value,
        periodo_conviveu: document.getElementById('tg-test-periodo-' + i).value,
        relacao_com_cliente: document.getElementById('tg-test-relacao-' + i).value,
        fatos_presenciados: document.getElementById('tg-test-fatos-' + i).value,
        ainda_trabalha_na_empresa: lerSimNaoTriagem('tg-test-ativa-' + i),
      };
    }

    function _sincronizarTestemunhasDoDom() {
      _testemunhasTriagem = _testemunhasTriagem.map(function (t, i) { return _lerTestemunhaDoDom(i) || t; });
    }

    function _renderListaTestemunhasTriagem() {
      var lista = document.getElementById('tg-test-lista');
      if (!_testemunhasTriagem.length) {
        lista.innerHTML = '<p style="color:var(--ink-faint);font-size:13px;">Nenhuma testemunha cadastrada ainda.</p>';
        return;
      }
      lista.innerHTML = _testemunhasTriagem.map(function (t, i) {
        return '<div class="procficha-painel" style="margin-bottom:12px;position:relative;">' +
          '<button type="button" class="procman-acao-excluir" data-test-remover="' + i + '" style="position:absolute;top:14px;right:16px;background:none;border:none;cursor:pointer;font-size:12px;">Remover</button>' +
          '<div class="procficha-editar-grid">' +
            '<div><label>Nome</label><input id="tg-test-nome-' + i + '" value="' + esc(t.nome || '') + '"></div>' +
            '<div><label>Telefone</label><input id="tg-test-tel-' + i + '" value="' + esc(t.telefone || '') + '"></div>' +
            '<div><label>Empresa em que trabalhou junto</label><input id="tg-test-emp-' + i + '" value="' + esc(t.empresa_trabalhou || '') + '"></div>' +
            '<div><label>Cargo</label><input id="tg-test-cargo-' + i + '" value="' + esc(t.cargo || '') + '"></div>' +
            '<div><label>Período que conviveram</label><input id="tg-test-periodo-' + i + '" value="' + esc(t.periodo_conviveu || '') + '"></div>' +
            '<div><label>Relação com o cliente</label><input id="tg-test-relacao-' + i + '" value="' + esc(t.relacao_com_cliente || '') + '"></div>' +
          '</div>' +
          '<div style="margin-top:10px;">' +
            htmlSimNaoTriagem('tg-test-ativa-' + i, 'Ainda trabalha na empresa?', t.ainda_trabalha_na_empresa) +
          '</div>' +
          '<div style="margin-top:10px;">' +
            '<label style="display:block;font-size:11px;color:var(--ink-faint);margin-bottom:5px;">Fatos que pode presenciar/confirmar</label>' +
            '<textarea id="tg-test-fatos-' + i + '" rows="2" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--line);border-radius:6px;font-size:13px;background:var(--bg);color:var(--ink);font-family:inherit;">' + esc(t.fatos_presenciados || '') + '</textarea>' +
          '</div>' +
        '</div>';
      }).join('');

      _testemunhasTriagem.forEach(function (t, i) { wireSimNaoTriagem('tg-test-ativa-' + i); });

      lista.querySelectorAll('[data-test-remover]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          _sincronizarTestemunhasDoDom();
          _testemunhasTriagem.splice(parseInt(btn.getAttribute('data-test-remover'), 10), 1);
          _renderListaTestemunhasTriagem();
        });
      });
    }

    function coletarPassoTestemunhasTriagem() {
      return _testemunhasTriagem.map(function (t, i) {
        return {
          nome: document.getElementById('tg-test-nome-' + i).value.trim(),
          telefone: document.getElementById('tg-test-tel-' + i).value.trim(),
          empresa_trabalhou: document.getElementById('tg-test-emp-' + i).value.trim(),
          cargo: document.getElementById('tg-test-cargo-' + i).value.trim(),
          periodo_conviveu: document.getElementById('tg-test-periodo-' + i).value.trim(),
          relacao_com_cliente: document.getElementById('tg-test-relacao-' + i).value.trim(),
          fatos_presenciados: document.getElementById('tg-test-fatos-' + i).value.trim(),
          ainda_trabalha_na_empresa: lerSimNaoTriagem('tg-test-ativa-' + i),
        };
      });
    }

    // ---- passo Provas (fase 5) -- lista dinamica com upload opcional pro Drive por item,
    // reaproveitando o mesmo mecanismo em pedacos ja usado pros documentos de processo
    // (documento_processo_upload_iniciar/chunk/finalizar, so trocando processo_id por
    // triagem_id -- ver documentos_processuais.py, que ganhou suporte a isso na fase 5).
    function renderPassoProvasTriagem(d) {
      d = d || {};
      _provasTriagem = (d.provas || []).slice();
      conteudo.innerHTML =
        '<p class="triagem-passo-titulo">Central de provas</p>' +
        '<p class="triagem-passo-sub">Cadastre cada prova (disponível ou ainda a obter) — pode anexar um arquivo quando já estiver disponível.</p>' +
        '<div id="tg-prova-lista"></div>' +
        '<button type="button" class="procpage-btn" id="tg-prova-adicionar" style="margin-top:10px;">+ Adicionar prova</button>';
      _renderListaProvasTriagem();
      document.getElementById('tg-prova-adicionar').addEventListener('click', function () {
        _sincronizarProvasDoDom();
        _provasTriagem.push({ categoria: 'documento', status: 'a_obter' });
        _renderListaProvasTriagem();
      });
    }

    // Mesmo motivo do _sincronizarEpisodiosAssedioDoDom -- le a tela de verdade antes de
    // adicionar/remover/anexar arquivo. documento_id nao existe em nenhum input (so e setado
    // depois que um upload termina), por isso preserva o que ja estava no array em memoria.
    function _lerProvaDoDom(i) {
      var elCat = document.getElementById('tg-prova-cat-' + i);
      if (!elCat) return null;
      return {
        categoria: elCat.value,
        fato_relacionado: document.getElementById('tg-prova-fato-' + i).value,
        descricao: document.getElementById('tg-prova-desc-' + i).value,
        status: lerSimNaoTriagem('tg-prova-disp-' + i) ? 'disponivel' : 'a_obter',
        documento_id: (_provasTriagem[i] && _provasTriagem[i].documento_id) || null,
      };
    }

    function _sincronizarProvasDoDom() {
      _provasTriagem = _provasTriagem.map(function (p, i) { return _lerProvaDoDom(i) || p; });
    }

    function _renderListaProvasTriagem() {
      var lista = document.getElementById('tg-prova-lista');
      if (!_provasTriagem.length) {
        lista.innerHTML = '<p style="color:var(--ink-faint);font-size:13px;">Nenhuma prova cadastrada ainda.</p>';
        return;
      }
      lista.innerHTML = _provasTriagem.map(function (p, i) {
        var statusInfo = p.documento_id
          ? '<span class="chip good" style="margin-left:8px;">Arquivo anexado</span>'
          : '';
        return '<div class="procficha-painel" style="margin-bottom:12px;position:relative;">' +
          '<button type="button" class="procman-acao-excluir" data-prova-remover="' + i + '" style="position:absolute;top:14px;right:16px;background:none;border:none;cursor:pointer;font-size:12px;">Remover</button>' +
          '<div class="procficha-editar-grid">' +
            '<div><label>Categoria</label><select id="tg-prova-cat-' + i + '">' +
              CATEGORIAS_PROVA_TRIAGEM.map(function (c) { return '<option value="' + c.chave + '">' + esc(c.rotulo) + '</option>'; }).join('') +
            '</select></div>' +
            '<div><label>Relacionada a qual fato?</label><input id="tg-prova-fato-' + i + '" value="' + esc(p.fato_relacionado || '') + '"></div>' +
          '</div>' +
          '<div style="margin-top:10px;">' +
            '<label style="display:block;font-size:11px;color:var(--ink-faint);margin-bottom:5px;">Descrição</label>' +
            '<textarea id="tg-prova-desc-' + i + '" rows="2" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--line);border-radius:6px;font-size:13px;background:var(--bg);color:var(--ink);font-family:inherit;">' + esc(p.descricao || '') + '</textarea>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:10px;">' +
            htmlSimNaoTriagem('tg-prova-disp-' + i, 'Já está disponível?', p.status === 'disponivel') +
            '<label style="font-size:12.5px;color:var(--ink-soft);cursor:pointer;">Anexar arquivo <input type="file" data-prova-arquivo="' + i + '" style="display:none;"></label>' +
            statusInfo +
          '</div>' +
          '<div id="tg-prova-upload-status-' + i + '" style="font-size:12px;color:var(--ink-faint);margin-top:4px;"></div>' +
        '</div>';
      }).join('');

      _provasTriagem.forEach(function (p, i) {
        setSelectValueComFallback(document.getElementById('tg-prova-cat-' + i), p.categoria || 'documento');
        wireSimNaoTriagem('tg-prova-disp-' + i);
      });

      lista.querySelectorAll('[data-prova-remover]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          _sincronizarProvasDoDom();
          _provasTriagem.splice(parseInt(btn.getAttribute('data-prova-remover'), 10), 1);
          _renderListaProvasTriagem();
        });
      });

      lista.querySelectorAll('[data-prova-arquivo]').forEach(function (input) {
        input.addEventListener('change', function () {
          var i = parseInt(input.getAttribute('data-prova-arquivo'), 10);
          if (input.files && input.files[0]) _enviarArquivoProvaTriagem(i, input.files[0]);
        });
      });
    }

    function _enviarArquivoProvaTriagem(i, arquivo) {
      if (arquivo.size > 10 * 1024 * 1024) {
        document.getElementById('tg-prova-upload-status-' + i).textContent = 'Arquivo maior que 10 MB.';
        return;
      }
      var statusEl = document.getElementById('tg-prova-upload-status-' + i);
      statusEl.textContent = 'Enviando…';
      function enviarPedacos(uploadId, tamanhoChunk) {
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
            statusEl.textContent = Math.min(100, Math.round((offset / arquivo.size) * 100)) + '% enviado';
            return proximoPedaco();
          });
        }
        return proximoPedaco();
      }
      apiPostJson('/api/painel?acao=documento_processo_upload_iniciar', {
        triagem_id: estado.triagemId, nome_arquivo: arquivo.name,
        mimetype: arquivo.type || 'application/octet-stream', tamanho_total: arquivo.size,
      })
        .then(function (dados) { return enviarPedacos(dados.upload_id, dados.tamanho_chunk); })
        .then(function (uploadId) {
          statusEl.textContent = 'Concluindo…';
          return apiPostJson('/api/painel?acao=documento_processo_upload_finalizar', { upload_id: uploadId });
        })
        .then(function (resp) {
          _sincronizarProvasDoDom();
          _provasTriagem[i].documento_id = resp.id;
          _provasTriagem[i].status = 'disponivel';
          _renderListaProvasTriagem();
        })
        .catch(function (e) {
          statusEl.textContent = 'Não foi possível enviar: ' + (e.message || 'erro desconhecido');
        });
    }

    function coletarPassoProvasTriagem() {
      return _provasTriagem.map(function (p, i) {
        var disponivel = lerSimNaoTriagem('tg-prova-disp-' + i);
        return {
          categoria: document.getElementById('tg-prova-cat-' + i).value,
          fato_relacionado: document.getElementById('tg-prova-fato-' + i).value.trim(),
          descricao: document.getElementById('tg-prova-desc-' + i).value.trim(),
          status: disponivel ? 'disponivel' : 'a_obter',
          documento_id: p.documento_id || null,
        };
      });
    }

    // ---- passo Diagnóstico e Relatório (fase 7) -- ultimo passo, so leitura. Diagnostico e
    // alertas/pendencias reaproveitam o que o backend (triagem_regras.py) ja calcula desde a
    // fase 6; a timeline e o relatorio de 16 secoes sao montados aqui mesmo, direto dos campos
    // que a triagem_obter ja devolve -- nunca inventa fato que nao foi informado (mostra "Não
    // informado" em vez de deixar em branco ou supor um valor).
    function _rotuloPorChaveTriagem(lista, chave) {
      var item = lista.filter(function (x) { return x.chave === chave; })[0];
      return item ? item.rotulo : (chave || '—');
    }

    function _valorOuNaoInformadoTriagem(v) {
      if (v === null || v === undefined || v === '') return '<span style="color:var(--ink-faint);">Não informado</span>';
      return esc(String(v));
    }

    function _boolParaTextoTriagem(v) {
      if (v === true) return 'Sim';
      if (v === false) return 'Não';
      return '<span style="color:var(--ink-faint);">Não informado</span>';
    }

    function _montarTimelineTriagem(t) {
      var eventos = [];
      if (t.data_admissao) eventos.push({ data: t.data_admissao, rotulo: 'Admissão' });
      if (t.saude_seguranca && t.saude_seguranca.data_retorno_afastamento) {
        eventos.push({ data: t.saude_seguranca.data_retorno_afastamento, rotulo: 'Retorno de afastamento (INSS)' });
      }
      (t.assedio_episodios || []).forEach(function (ep) {
        if (ep.data_ocorrencia) eventos.push({ data: ep.data_ocorrencia, rotulo: 'Episódio relatado: ' + _rotuloPorChaveTriagem(TIPOS_ASSEDIO_TRIAGEM, ep.tipo) });
      });
      if (t.contrato_terminou && t.data_rescisao) {
        eventos.push({ data: t.data_rescisao, rotulo: 'Rescisão (' + _rotuloPorChaveTriagem(FORMAS_RESCISAO_TRIAGEM, t.forma_rescisao) + ')' });
      }
      eventos.sort(function (a, b) { return a.data < b.data ? -1 : a.data > b.data ? 1 : 0; });
      return eventos;
    }

    function _montarSecoesRelatorioTriagem(t) {
      var secoes = [];
      secoes.push({ titulo: '1. Identificação do cliente', linhas: [
        'Cliente: ' + _valorOuNaoInformadoTriagem(t.cliente_nome),
        'Responsável pela triagem: ' + _valorOuNaoInformadoTriagem(t.responsavel_email),
      ]});
      secoes.push({ titulo: '2. Dados da empresa', linhas: [
        'Razão social: ' + _valorOuNaoInformadoTriagem(t.empresa_razao_social),
        'Nome fantasia: ' + _valorOuNaoInformadoTriagem(t.empresa_nome_fantasia),
        'CNPJ: ' + _valorOuNaoInformadoTriagem(t.empresa_cnpj),
        'Local de trabalho: ' + _valorOuNaoInformadoTriagem(t.local_trabalho),
        'Superior imediato: ' + _valorOuNaoInformadoTriagem(t.superior_imediato_nome) + (t.superior_imediato_cargo ? ' (' + esc(t.superior_imediato_cargo) + ')' : ''),
        'Terceirização: ' + _boolParaTextoTriagem(t.terceirizacao),
        'Grupo econômico: ' + _boolParaTextoTriagem(t.grupo_economico),
      ]});
      secoes.push({ titulo: '3. Contrato de trabalho', linhas: [
        'Data de admissão: ' + _valorOuNaoInformadoTriagem(t.data_admissao),
        'Registro em CTPS: ' + _boolParaTextoTriagem(t.ctps_registrado),
        'Cargo registrado: ' + _valorOuNaoInformadoTriagem(t.cargo_registrado),
        'Função exercida de fato: ' + _valorOuNaoInformadoTriagem(t.funcao_exercida),
        'Salário registrado: ' + _valorOuNaoInformadoTriagem(t.salario_registrado),
        'Pagamento por fora: ' + _boolParaTextoTriagem(t.pagamento_por_fora) +
          (t.pagamento_por_fora ? ' — valor: ' + _valorOuNaoInformadoTriagem(t.valor_por_fora) + ', frequência: ' + _valorOuNaoInformadoTriagem(t.frequencia_por_fora) : ''),
        'Acúmulo/desvio de função: ' + _boolParaTextoTriagem(t.acumulo_desvio_funcao),
      ]});
      secoes.push({ titulo: '4. Jornada de trabalho', linhas: [
        'Horas extras habituais: ' + _boolParaTextoTriagem(t.jornada_horas_extras),
        'Trabalho em feriados: ' + _boolParaTextoTriagem(t.jornada_feriados),
        'Trabalho no intervalo: ' + _boolParaTextoTriagem(t.jornada_trabalho_intervalo),
        'Banco de horas: ' + _boolParaTextoTriagem(t.jornada_banco_horas),
        'Jornada noturna: ' + _boolParaTextoTriagem(t.jornada_noturno),
      ].concat((t.jornada_dias || []).length ? (t.jornada_dias || []).map(function (d) {
        var sigla = _rotuloPorChaveTriagem(DIAS_SEMANA_TRIAGEM.map(function (ds) { return { chave: ds.numero, rotulo: ds.sigla }; }), d.dia_semana);
        return sigla + ': ' + (d.trabalhava ? ((d.horario_entrada || '?') + ' às ' + (d.horario_saida || '?')) : 'não trabalhava');
      }) : ['Grade diária: <span style="color:var(--ink-faint);">Não informada</span>'])});
      secoes.push({ titulo: '5. Controle de ponto', linhas: [
        'Existia controle de ponto: ' + _boolParaTextoTriagem(t.controle_ponto_existia),
        'Tipo: ' + _valorOuNaoInformadoTriagem(t.controle_ponto_tipo),
        'Registrava a jornada real: ' + _boolParaTextoTriagem(t.controle_ponto_registrava_real),
        'Explicação: ' + _valorOuNaoInformadoTriagem(t.controle_ponto_explicacao),
      ]});
      secoes.push({ titulo: '6. Remuneração', linhas: [
        'Salário recebido de fato: ' + _valorOuNaoInformadoTriagem(t.salario_recebido_real),
        'Recebia DSR: ' + _boolParaTextoTriagem(t.recebia_dsr),
        'Adicional noturno: ' + _boolParaTextoTriagem(t.recebia_adicional_noturno),
        'Vale-transporte / alimentação / refeição: ' + _boolParaTextoTriagem(t.vale_transporte) + ' / ' + _boolParaTextoTriagem(t.vale_alimentacao) + ' / ' + _boolParaTextoTriagem(t.vale_refeicao),
        'Descontos indevidos: ' + _valorOuNaoInformadoTriagem(t.descontos_indevidos),
      ]});
      secoes.push({ titulo: '7. Norma coletiva', linhas: [
        'Categoria profissional: ' + _valorOuNaoInformadoTriagem(t.categoria_profissional),
        'Sindicato: ' + _valorOuNaoInformadoTriagem(t.sindicato),
        'Tem CCT/ACT: ' + _boolParaTextoTriagem(t.tem_cct_act),
        'Piso salarial da categoria: ' + _valorOuNaoInformadoTriagem(t.piso_salarial_categoria),
      ]});
      secoes.push({ titulo: '8. Insalubridade e periculosidade', linhas:
        (t.insalubridade || []).length ? t.insalubridade.map(function (i) {
          return _rotuloPorChaveTriagem(AGENTES_INSALUBRIDADE_TRIAGEM, i.agente) + ' — adicional recebido: ' + _boolParaTextoTriagem(i.adicional_recebido);
        }) : ['<span style="color:var(--ink-faint);">Nenhum agente de risco relatado.</span>']});
      secoes.push({ titulo: '9. Saúde e segurança do trabalho', linhas:
        t.saude_seguranca ? [
          'Acidente/doença ocupacional: ' + _boolParaTextoTriagem(t.saude_seguranca.teve_acidente_doenca),
          'CAT emitida: ' + _boolParaTextoTriagem(t.saude_seguranca.cat_emitida),
          'Afastamento pelo INSS: ' + _boolParaTextoTriagem(t.saude_seguranca.afastamento_inss),
          'Limitação atual: ' + _valorOuNaoInformadoTriagem(t.saude_seguranca.limitacao_atual),
        ] : ['<span style="color:var(--ink-faint);">Nenhum acidente ou doença ocupacional relatado.</span>']});
      secoes.push({ titulo: '10. Assédio e discriminação', linhas:
        (t.assedio_episodios || []).length ? t.assedio_episodios.map(function (ep) {
          return _rotuloPorChaveTriagem(TIPOS_ASSEDIO_TRIAGEM, ep.tipo) + ' — ' + _valorOuNaoInformadoTriagem(ep.data_ocorrencia) + ' — testemunha: ' + _boolParaTextoTriagem(ep.teve_testemunha);
        }) : ['<span style="color:var(--ink-faint);">Nenhum episódio relatado.</span>']});
      secoes.push({ titulo: '11. Rescisão contratual', linhas: [
        'Contrato já terminou: ' + _boolParaTextoTriagem(t.contrato_terminou),
        'Data da rescisão: ' + _valorOuNaoInformadoTriagem(t.data_rescisao),
        'Forma: ' + (t.forma_rescisao ? _rotuloPorChaveTriagem(FORMAS_RESCISAO_TRIAGEM, t.forma_rescisao) : '<span style="color:var(--ink-faint);">Não informado</span>'),
        'TRCT recebido: ' + _boolParaTextoTriagem(t.trct_recebido),
        'Guias do FGTS entregues: ' + _boolParaTextoTriagem(t.fgts_guias_entregues),
        'Multa de 40% paga: ' + _boolParaTextoTriagem(t.multa_40_paga),
      ].concat(t.forma_rescisao === 'justa_causa' ? [
        'Acusação da empresa: ' + _valorOuNaoInformadoTriagem(t.jc_acusacao),
        'Dias entre o fato e a demissão: ' + _valorOuNaoInformadoTriagem(t.jc_tempo_fato_demissao_dias),
      ] : [])});
      secoes.push({ titulo: '12. Estabilidades identificadas', linhas:
        (t.estabilidades_detectadas || []).length ? t.estabilidades_detectadas.map(function (e) { return e.mensagem; })
          : ['<span style="color:var(--ink-faint);">Nenhuma estabilidade identificada com os dados atuais.</span>']});
      secoes.push({ titulo: '13. Testemunhas', linhas:
        (t.testemunhas || []).length ? t.testemunhas.map(function (te) {
          return esc(te.nome) + (te.cargo ? ' (' + esc(te.cargo) + ')' : '') + ' — ainda na empresa: ' + _boolParaTextoTriagem(te.ainda_trabalha_na_empresa);
        }) : ['<span style="color:var(--ink-faint);">Nenhuma testemunha cadastrada.</span>']});
      secoes.push({ titulo: '14. Central de provas', linhas:
        (t.provas || []).length ? t.provas.map(function (p) {
          return _rotuloPorChaveTriagem(CATEGORIAS_PROVA_TRIAGEM, p.categoria) + ' — ' + (p.status === 'disponivel' ? 'disponível' : 'a obter') + (p.descricao ? ' — ' + esc(p.descricao) : '');
        }) : ['<span style="color:var(--ink-faint);">Nenhuma prova cadastrada.</span>']});
      secoes.push({ titulo: '15. Alertas jurídicos', linhas:
        (t.alertas || []).length ? t.alertas.map(function (a) { return (a.severidade === 'critico' ? '🔴 ' : '🟠 ') + a.mensagem; })
          : ['<span style="color:var(--ink-faint);">Nenhum alerta identificado com os dados atuais.</span>']});
      secoes.push({ titulo: '16. Pendências e próximos passos', linhas:
        (t.pendencias || []).length ? t.pendencias.map(function (p) { return p.mensagem; })
          : ['<span style="color:var(--ink-faint);">Nenhuma pendência identificada com os dados atuais.</span>']});
      return secoes;
    }

    // ---- Exportação em PDF (fase 10) -- gerado 100% no navegador com pdfmake (carregado via
    // CDN só nesta página, ver painel-criar-triagem.html), a partir dos mesmos dados que a
    // triagem_obter já devolve -- nunca por screenshot/impressão da tela, e sempre com os dados
    // mais recentes (o botão sempre refaz o fetch antes de montar o PDF). Nada fica guardado no
    // servidor nem em URL pública -- o PDF é montado e baixado só no navegador de quem já está
    // autenticado no painel.
    function _semAcentoPdfTriagem(texto) {
      return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
    }

    function _nomeArquivoPdfTriagem(t) {
      var nome = _semAcentoPdfTriagem(t.cliente_nome || 'Cliente').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      var agora = new Date();
      var dataStr = String(agora.getDate()).padStart(2, '0') + '-' + String(agora.getMonth() + 1).padStart(2, '0') + '-' + agora.getFullYear();
      return 'Triagem_Trabalhista_' + (nome || 'Cliente') + '_' + dataStr + '.pdf';
    }

    function _textoOuNaoInformadoPdf(v) {
      return (v === null || v === undefined || v === '') ? 'Não informado' : String(v);
    }

    function _boolTextoPdf(v) {
      if (v === true) return 'Sim';
      if (v === false) return 'Não';
      return 'Não informado';
    }

    function _moedaTextoPdf(v) {
      return (v !== null && v !== undefined && v !== '') ? 'R$ ' + _valorMoedaTriagem(v) : 'Não informado';
    }

    function _dataTextoPdf(v) {
      return v ? fmtDataProcesso(String(v).slice(0, 10)) : 'Não informado';
    }

    function _linhaPdf(rotulo, valor) {
      return { text: [{ text: rotulo + ': ', style: 'rotulo' }, valor], style: 'corpo' };
    }

    function _garantirPdfMakeCarregado() {
      return new Promise(function (resolve, reject) {
        var tentativas = 0;
        (function checar() {
          if (window.pdfMake && window.pdfMake.vfs) return resolve();
          tentativas += 1;
          if (tentativas > 40) return reject(new Error('Não foi possível carregar o gerador de PDF agora.'));
          setTimeout(checar, 150);
        })();
      });
    }

    function _montarDocDefinicaoPdfTriagem(t) {
      var conteudo = [];
      var agora = new Date();
      var dataHoraGeracao = fmtDataProcesso(agora.toISOString().slice(0, 10)) + ' às ' +
        String(agora.getHours()).padStart(2, '0') + ':' + String(agora.getMinutes()).padStart(2, '0');

      // Capa
      conteudo.push({ text: 'VERO JURÍDICO', style: 'marca' });
      conteudo.push({ text: 'RELATÓRIO DE TRIAGEM TRABALHISTA', style: 'titulo' });
      conteudo.push({
        columns: [
          [
            _linhaPdf('Cliente', _textoOuNaoInformadoPdf(t.cliente_nome)),
            _linhaPdf('Reclamada', _textoOuNaoInformadoPdf(t.empresa_razao_social || t.empresa_nome_fantasia)),
            _linhaPdf('Responsável pelo atendimento', _textoOuNaoInformadoPdf(t.responsavel_email)),
          ],
          [
            _linhaPdf('Data da triagem', _dataTextoPdf(t.criado_em)),
            _linhaPdf('Relatório gerado em', dataHoraGeracao),
            _linhaPdf('ID interno da triagem', String(t.id)),
          ],
        ],
        columnGap: 20, margin: [0, 6, 0, 14],
      });

      // Resumo da triagem
      var alertasCriticos = (t.alertas || []).filter(function (a) { return a.severidade === 'critico'; });
      var alertasAtencao = (t.alertas || []).filter(function (a) { return a.severidade !== 'critico'; });
      var provasDisponiveis = (t.provas || []).filter(function (p) { return p.status === 'disponivel'; });
      var provasAObter = (t.provas || []).filter(function (p) { return p.status === 'a_obter'; });
      conteudo.push({ text: 'RESUMO DA TRIAGEM', style: 'secao' });
      conteudo.push(_linhaPdf('Cliente', _textoOuNaoInformadoPdf(t.cliente_nome)));
      conteudo.push(_linhaPdf('Reclamada', _textoOuNaoInformadoPdf(t.empresa_razao_social || t.empresa_nome_fantasia)));
      conteudo.push(_linhaPdf('Período trabalhado', (t.data_admissao ? _dataTextoPdf(t.data_admissao) : 'Não informado') +
        ' até ' + (t.contrato_terminou ? _dataTextoPdf(t.data_rescisao) : 'contrato em andamento')));
      conteudo.push(_linhaPdf('Cargo', _textoOuNaoInformadoPdf(t.cargo_registrado)));
      conteudo.push(_linhaPdf('Última remuneração recebida', _moedaTextoPdf(t.salario_recebido_real || t.salario_registrado)));
      conteudo.push(_linhaPdf('Forma de rescisão', t.forma_rescisao ? _rotuloPorChaveTriagem(FORMAS_RESCISAO_TRIAGEM, t.forma_rescisao) : 'Não informado'));
      conteudo.push(_linhaPdf('Testemunhas cadastradas', String((t.testemunhas || []).length)));
      conteudo.push(_linhaPdf('Provas/documentos cadastrados', String((t.provas || []).length) + ' (' + provasDisponiveis.length + ' disponível(is), ' + provasAObter.length + ' a obter)'));
      conteudo.push(_linhaPdf('Alertas identificados', String((t.alertas || []).length) + ' (' + alertasCriticos.length + ' crítico(s), ' + alertasAtencao.length + ' de atenção)'));

      // Pontos de atenção
      if ((t.alertas || []).length) {
        conteudo.push({ text: 'PONTOS DE ATENÇÃO', style: 'secao' });
        t.alertas.forEach(function (a) {
          conteudo.push({ text: (a.severidade === 'critico' ? '🔴 ' : '🟠 ') + a.mensagem, style: 'corpo' });
        });
        conteudo.push({ text: 'Os itens acima são pontos que exigem análise jurídica -- não representam conclusão definitiva de existência de direito.', style: 'disclaimer' });
      }

      conteudo.push({ text: '', pageBreak: 'after' });

      // 1. Identificação do cliente
      conteudo.push({ text: '1. IDENTIFICAÇÃO DO CLIENTE', style: 'secao' });
      conteudo.push(_linhaPdf('Cliente', _textoOuNaoInformadoPdf(t.cliente_nome)));
      conteudo.push(_linhaPdf('Responsável pela triagem', _textoOuNaoInformadoPdf(t.responsavel_email)));

      // 2. Dados da empresa/reclamada
      conteudo.push({ text: '2. DADOS DA EMPRESA/RECLAMADA', style: 'secao' });
      conteudo.push(_linhaPdf('Razão social', _textoOuNaoInformadoPdf(t.empresa_razao_social)));
      conteudo.push(_linhaPdf('Nome fantasia', _textoOuNaoInformadoPdf(t.empresa_nome_fantasia)));
      conteudo.push(_linhaPdf('CNPJ', _textoOuNaoInformadoPdf(t.empresa_cnpj)));
      conteudo.push(_linhaPdf('Local de trabalho', _textoOuNaoInformadoPdf(t.local_trabalho)));
      conteudo.push(_linhaPdf('Superior imediato', _textoOuNaoInformadoPdf(t.superior_imediato_nome) + (t.superior_imediato_cargo ? ' (' + t.superior_imediato_cargo + ')' : '')));
      conteudo.push(_linhaPdf('Terceirização', _boolTextoPdf(t.terceirizacao)));
      conteudo.push(_linhaPdf('Grupo econômico', _boolTextoPdf(t.grupo_economico)));

      // 3. Contrato de trabalho + 4. Cargo e funções exercidas
      conteudo.push({ text: '3. INFORMAÇÕES DO CONTRATO DE TRABALHO', style: 'secao' });
      conteudo.push(_linhaPdf('Data de admissão', _dataTextoPdf(t.data_admissao)));
      conteudo.push(_linhaPdf('Registro em CTPS', _boolTextoPdf(t.ctps_registrado)));
      conteudo.push(_linhaPdf('Forma de pagamento', _textoOuNaoInformadoPdf(t.forma_pagamento)));
      if (t.pagamento_por_fora) {
        conteudo.push(_linhaPdf('Pagamento por fora', 'Sim -- valor: ' + _moedaTextoPdf(t.valor_por_fora) + ', frequência: ' + _textoOuNaoInformadoPdf(t.frequencia_por_fora)));
      } else {
        conteudo.push(_linhaPdf('Pagamento por fora', _boolTextoPdf(t.pagamento_por_fora)));
      }
      conteudo.push({ text: '4. Cargo e funções exercidas', style: 'subsecao' });
      conteudo.push(_linhaPdf('Cargo registrado', _textoOuNaoInformadoPdf(t.cargo_registrado)));
      conteudo.push(_linhaPdf('Função exercida de fato', _textoOuNaoInformadoPdf(t.funcao_exercida)));
      conteudo.push(_linhaPdf('Alteração de cargo/salário', _boolTextoPdf(t.alteracao_cargo_salario)));
      conteudo.push(_linhaPdf('Acúmulo/desvio de função', _boolTextoPdf(t.acumulo_desvio_funcao)));

      // 5. Remuneração
      conteudo.push({ text: '5. REMUNERAÇÃO', style: 'secao' });
      conteudo.push(_linhaPdf('Salário registrado', _moedaTextoPdf(t.salario_registrado)));
      conteudo.push(_linhaPdf('Salário recebido de fato', _moedaTextoPdf(t.salario_recebido_real)));
      conteudo.push(_linhaPdf('Recebia DSR', _boolTextoPdf(t.recebia_dsr)));
      conteudo.push(_linhaPdf('Adicional noturno', _boolTextoPdf(t.recebia_adicional_noturno)));
      conteudo.push(_linhaPdf('Vale-transporte / alimentação / refeição', _boolTextoPdf(t.vale_transporte) + ' / ' + _boolTextoPdf(t.vale_alimentacao) + ' / ' + _boolTextoPdf(t.vale_refeicao)));
      conteudo.push(_linhaPdf('Descontos indevidos', _textoOuNaoInformadoPdf(t.descontos_indevidos)));

      // 6. Jornada de trabalho + 8. Horas extras + 9. Intervalos
      conteudo.push({ text: '6. JORNADA DE TRABALHO', style: 'secao' });
      if ((t.jornada_dias || []).length) {
        t.jornada_dias.forEach(function (d) {
          var sigla = _rotuloPorChaveTriagem(DIAS_SEMANA_TRIAGEM.map(function (ds) { return { chave: ds.numero, rotulo: ds.sigla }; }), d.dia_semana);
          conteudo.push({ text: sigla + ': ' + (d.trabalhava ? ((d.horario_entrada || '?') + ' às ' + (d.horario_saida || '?')) : 'não trabalhava'), style: 'corpo' });
        });
      } else {
        conteudo.push({ text: 'Grade diária não informada.', style: 'corpo' });
      }
      conteudo.push({ text: '8. Horas extras', style: 'subsecao' });
      conteudo.push(_linhaPdf('Horas extras habituais', _boolTextoPdf(t.jornada_horas_extras)));
      conteudo.push(_linhaPdf('Trabalho em feriados', _boolTextoPdf(t.jornada_feriados)));
      conteudo.push(_linhaPdf('Banco de horas', _boolTextoPdf(t.jornada_banco_horas)));
      conteudo.push(_linhaPdf('Compensação de jornada', _boolTextoPdf(t.jornada_compensacao)));
      conteudo.push(_linhaPdf('Jornada noturna', _boolTextoPdf(t.jornada_noturno)));
      conteudo.push({ text: '9. Intervalos', style: 'subsecao' });
      conteudo.push(_linhaPdf('Trabalho no intervalo', _boolTextoPdf(t.jornada_trabalho_intervalo)));

      // 7. Controle de ponto
      conteudo.push({ text: '7. CONTROLE DE PONTO', style: 'secao' });
      conteudo.push(_linhaPdf('Existia controle de ponto', _boolTextoPdf(t.controle_ponto_existia)));
      conteudo.push(_linhaPdf('Tipo', _textoOuNaoInformadoPdf(t.controle_ponto_tipo)));
      conteudo.push(_linhaPdf('Registrava a jornada real', _boolTextoPdf(t.controle_ponto_registrava_real)));
      conteudo.push(_linhaPdf('Explicação', _textoOuNaoInformadoPdf(t.controle_ponto_explicacao)));

      // 10. Insalubridade/periculosidade (so se houver)
      if ((t.insalubridade || []).length) {
        conteudo.push({ text: '10. INSALUBRIDADE/PERICULOSIDADE', style: 'secao' });
        t.insalubridade.forEach(function (i) {
          conteudo.push({ text: _rotuloPorChaveTriagem(AGENTES_INSALUBRIDADE_TRIAGEM, i.agente) + ' -- adicional recebido: ' + _boolTextoPdf(i.adicional_recebido), style: 'corpo' });
        });
      }

      // 11. Acidente de trabalho/doença ocupacional (so se houver)
      if (t.saude_seguranca) {
        conteudo.push({ text: '11. ACIDENTE DE TRABALHO/DOENÇA OCUPACIONAL', style: 'secao' });
        conteudo.push(_linhaPdf('Acidente/doença ocupacional', _boolTextoPdf(t.saude_seguranca.teve_acidente_doenca)));
        conteudo.push(_linhaPdf('CAT emitida', _boolTextoPdf(t.saude_seguranca.cat_emitida)));
        conteudo.push(_linhaPdf('Afastamento pelo INSS', _boolTextoPdf(t.saude_seguranca.afastamento_inss)));
        conteudo.push(_linhaPdf('Limitação atual', _textoOuNaoInformadoPdf(t.saude_seguranca.limitacao_atual)));
      }

      // 12. Assédio/discriminação (so se houver)
      if ((t.assedio_episodios || []).length) {
        conteudo.push({ text: '12. ASSÉDIO, DISCRIMINAÇÃO OU OUTROS ACONTECIMENTOS RELEVANTES', style: 'secao' });
        t.assedio_episodios.forEach(function (ep) {
          conteudo.push({ text: _rotuloPorChaveTriagem(TIPOS_ASSEDIO_TRIAGEM, ep.tipo) + ' -- ' + _dataTextoPdf(ep.data_ocorrencia) + ' -- testemunha: ' + _boolTextoPdf(ep.teve_testemunha), style: 'corpo' });
        });
      }

      // 13. Ferias/13o/FGTS/INSS -- so o que a triagem de fato capta hoje (norma coletiva + FGTS
      // na rescisao); nao ha campo proprio de ferias/13o na triagem ainda, entao a secao usa so
      // dado real, sem inventar.
      if (t.sindicato || t.categoria_profissional || t.tem_cct_act !== null && t.tem_cct_act !== undefined || t.fgts_guias_entregues !== null && t.fgts_guias_entregues !== undefined) {
        conteudo.push({ text: '13. FÉRIAS, 13º SALÁRIO, FGTS E INSS', style: 'secao' });
        conteudo.push(_linhaPdf('Categoria profissional', _textoOuNaoInformadoPdf(t.categoria_profissional)));
        conteudo.push(_linhaPdf('Sindicato', _textoOuNaoInformadoPdf(t.sindicato)));
        conteudo.push(_linhaPdf('Tem CCT/ACT', _boolTextoPdf(t.tem_cct_act)));
        conteudo.push(_linhaPdf('Guias do FGTS entregues (na rescisão)', _boolTextoPdf(t.fgts_guias_entregues)));
      }

      // 14. Rescisão contratual + 15. Justa causa
      conteudo.push({ text: '14. RESCISÃO CONTRATUAL', style: 'secao' });
      conteudo.push(_linhaPdf('Contrato já terminou', _boolTextoPdf(t.contrato_terminou)));
      if (t.contrato_terminou) {
        conteudo.push(_linhaPdf('Data da rescisão', _dataTextoPdf(t.data_rescisao)));
        conteudo.push(_linhaPdf('Forma', t.forma_rescisao ? _rotuloPorChaveTriagem(FORMAS_RESCISAO_TRIAGEM, t.forma_rescisao) : 'Não informado'));
        conteudo.push(_linhaPdf('TRCT recebido', _boolTextoPdf(t.trct_recebido)));
        conteudo.push(_linhaPdf('Seguro-desemprego liberado', _boolTextoPdf(t.seguro_desemprego_liberado)));
        conteudo.push(_linhaPdf('Multa de 40% paga', _boolTextoPdf(t.multa_40_paga)));
      }
      if (t.forma_rescisao === 'justa_causa') {
        conteudo.push({ text: '15. Justa causa -- necessária análise específica', style: 'subsecao' });
        conteudo.push(_linhaPdf('Acusação da empresa', _textoOuNaoInformadoPdf(t.jc_acusacao)));
        conteudo.push(_linhaPdf('Advertências prévias', _boolTextoPdf(t.jc_advertencias_previas)));
        conteudo.push(_linhaPdf('Investigação formal', _boolTextoPdf(t.jc_investigacao_formal)));
        conteudo.push(_linhaPdf('Dias entre o fato e a demissão', _textoOuNaoInformadoPdf(t.jc_tempo_fato_demissao_dias)));
      }

      // 16. Estabilidades (so se houver)
      if ((t.estabilidades_detectadas || []).length) {
        conteudo.push({ text: '16. POSSÍVEIS ESTABILIDADES IDENTIFICADAS PARA ANÁLISE', style: 'secao' });
        t.estabilidades_detectadas.forEach(function (e) { conteudo.push({ text: e.mensagem, style: 'corpo' }); });
        conteudo.push({ text: 'Itens sinalizados pelo sistema pra análise jurídica -- não representam conclusão de direito.', style: 'disclaimer' });
      }

      // 17. Testemunhas (so se houver)
      if ((t.testemunhas || []).length) {
        conteudo.push({ text: '17. TESTEMUNHAS', style: 'secao' });
        t.testemunhas.forEach(function (te) {
          conteudo.push({ text: te.nome + (te.cargo ? ' (' + te.cargo + ')' : ''), style: 'subsecao' });
          conteudo.push(_linhaPdf('Telefone', _textoOuNaoInformadoPdf(te.telefone)));
          conteudo.push(_linhaPdf('Período trabalhado com o cliente', _textoOuNaoInformadoPdf(te.periodo_conviveu)));
          conteudo.push(_linhaPdf('Ainda trabalha na empresa', _boolTextoPdf(te.ainda_trabalha_na_empresa)));
          conteudo.push(_linhaPdf('Fatos que presenciou', _textoOuNaoInformadoPdf(te.fatos_presenciados)));
        });
      }

      // 18/19/20. Provas e documentos, apresentados e pendentes
      if ((t.provas || []).length) {
        conteudo.push({ text: '18. PROVAS E DOCUMENTOS', style: 'secao' });
        conteudo.push({ text: '19. Documentos/provas apresentados', style: 'subsecao' });
        if (provasDisponiveis.length) {
          provasDisponiveis.forEach(function (p) {
            conteudo.push({ text: '• ' + _rotuloPorChaveTriagem(CATEGORIAS_PROVA_TRIAGEM, p.categoria) + (p.descricao ? ' -- ' + p.descricao : '') + (p.documento_id ? ' (arquivo anexado na plataforma)' : ''), style: 'corpo' });
          });
        } else {
          conteudo.push({ text: 'Nenhuma prova/documento disponível cadastrado.', style: 'corpo' });
        }
        conteudo.push({ text: '20. Documentos/provas a providenciar', style: 'subsecao' });
        if (provasAObter.length) {
          provasAObter.forEach(function (p) {
            conteudo.push({ text: '☐ ' + _rotuloPorChaveTriagem(CATEGORIAS_PROVA_TRIAGEM, p.categoria) + (p.descricao ? ' -- ' + p.descricao : ''), style: 'corpo' });
          });
        } else {
          conteudo.push({ text: 'Nenhuma pendência de prova/documento cadastrada.', style: 'corpo' });
        }
      }

      // 23. Informações ainda pendentes (so se houver)
      if ((t.pendencias || []).length) {
        conteudo.push({ text: '23. INFORMAÇÕES AINDA PENDENTES', style: 'secao' });
        t.pendencias.forEach(function (p) { conteudo.push({ text: '• ' + p.mensagem, style: 'corpo' }); });
      }

      // 24. Observações do advogado (so se houver)
      if ((t.observacoes_advogado || '').trim()) {
        conteudo.push({ text: '24. OBSERVAÇÕES DO ADVOGADO', style: 'secao' });
        conteudo.push({ text: t.observacoes_advogado, style: 'corpo' });
      }

      // 25. Linha do tempo do contrato (so se houver datas suficientes)
      var timeline = _montarTimelineTriagem(t);
      if (timeline.length) {
        conteudo.push({ text: '25. LINHA DO TEMPO DO CONTRATO', style: 'secao' });
        timeline.forEach(function (ev) {
          conteudo.push({ text: _dataTextoPdf(ev.data) + ' -- ' + ev.rotulo, style: 'corpo' });
        });
      }

      return {
        pageSize: 'A4',
        pageMargins: [40, 50, 40, 50],
        header: function () {
          return { text: 'VERO JURÍDICO', style: 'marca', margin: [40, 18, 40, 0] };
        },
        footer: function (paginaAtual, totalPaginas) {
          return {
            columns: [
              { text: 'VERO JURÍDICO — Relatório de Triagem Trabalhista', style: 'rodape' },
              { text: 'Página ' + paginaAtual + ' de ' + totalPaginas, style: 'rodape', alignment: 'right' },
            ],
            margin: [40, 0, 40, 20],
          };
        },
        content: conteudo,
        defaultStyle: { font: 'Roboto', fontSize: 10 },
        styles: {
          marca: { fontSize: 9, bold: true, color: '#2c5ce0' },
          titulo: { fontSize: 17, bold: true, margin: [0, 4, 0, 10] },
          secao: { fontSize: 13, bold: true, color: '#2c5ce0', margin: [0, 14, 0, 6] },
          subsecao: { fontSize: 11, bold: true, margin: [0, 8, 0, 3] },
          rotulo: { bold: true },
          corpo: { fontSize: 10, margin: [0, 0, 0, 3] },
          disclaimer: { fontSize: 8.5, italics: true, color: '#666666', margin: [0, 4, 0, 10] },
          rodape: { fontSize: 8, color: '#888888' },
        },
      };
    }

    function _gerarPdfTriagem(estadoBotao, modo) {
      var btn = document.getElementById(estadoBotao);
      var textoOriginal = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Gerando PDF...';
      erroWizardTriagem('');
      apiGetJson('/api/painel?acao=triagem_obter&id=' + estado.triagemId)
        .then(function (d) { return _garantirPdfMakeCarregado().then(function () { return d.triagem; }); })
        .then(function (triagem) {
          var docDefinicao = _montarDocDefinicaoPdfTriagem(triagem);
          var pdf = pdfMake.createPdf(docDefinicao);
          if (modo === 'baixar') pdf.download(_nomeArquivoPdfTriagem(triagem));
          else pdf.open();
          btn.textContent = 'PDF gerado';
          setTimeout(function () { btn.textContent = textoOriginal; btn.disabled = false; }, 2500);
        })
        .catch(function (e) {
          btn.textContent = 'Erro ao gerar PDF -- tentar novamente';
          btn.disabled = false;
          erroWizardTriagem(e.message || 'Não foi possível gerar o PDF agora.');
        });
    }

    function renderPassoAnaliseFinalTriagem(t) {
      t = t || {};
      var alertasCriticos = (t.alertas || []).filter(function (a) { return a.severidade === 'critico'; }).length;
      var alertasAtencao = (t.alertas || []).length - alertasCriticos;
      var provasDisponiveis = (t.provas || []).filter(function (p) { return p.status === 'disponivel'; }).length;
      var provasAObter = (t.provas || []).length - provasDisponiveis;
      var timeline = _montarTimelineTriagem(t);
      var secoesRelatorio = _montarSecoesRelatorioTriagem(t);

      conteudo.innerHTML =
        '<p class="triagem-passo-titulo">Diagnóstico da triagem</p>' +
        '<p class="triagem-passo-sub">Resumo do que foi coletado até aqui, timeline do contrato e o relatório completo (16 seções) — nada aqui é inventado, só organiza o que foi respondido.</p>' +
        '<div style="display:flex;gap:12px;flex-wrap:wrap;margin:14px 0;">' +
          '<div class="procficha-painel" style="flex:1;min-width:150px;"><div style="font-size:12px;color:var(--ink-faint);">Alertas críticos</div><div style="font-size:22px;font-weight:700;color:var(--crit);">' + alertasCriticos + '</div></div>' +
          '<div class="procficha-painel" style="flex:1;min-width:150px;"><div style="font-size:12px;color:var(--ink-faint);">Alertas de atenção</div><div style="font-size:22px;font-weight:700;color:var(--warn);">' + alertasAtencao + '</div></div>' +
          '<div class="procficha-painel" style="flex:1;min-width:150px;"><div style="font-size:12px;color:var(--ink-faint);">Provas disponíveis</div><div style="font-size:22px;font-weight:700;color:var(--good);">' + provasDisponiveis + '</div></div>' +
          '<div class="procficha-painel" style="flex:1;min-width:150px;"><div style="font-size:12px;color:var(--ink-faint);">Provas a obter</div><div style="font-size:22px;font-weight:700;">' + provasAObter + '</div></div>' +
          '<div class="procficha-painel" style="flex:1;min-width:150px;"><div style="font-size:12px;color:var(--ink-faint);">Testemunhas</div><div style="font-size:22px;font-weight:700;">' + (t.testemunhas || []).length + '</div></div>' +
        '</div>' +

        '<p style="font-weight:600;margin:18px 0 8px;">Timeline do contrato</p>' +
        (timeline.length ?
          '<div style="border-left:2px solid var(--line);padding-left:14px;">' +
            timeline.map(function (ev) {
              return '<div style="margin-bottom:10px;"><span style="font-size:12px;color:var(--ink-faint);">' + esc(ev.data) + '</span><br><span style="font-size:13.5px;">' + esc(ev.rotulo) + '</span></div>';
            }).join('') +
          '</div>'
          : '<p style="font-size:13px;color:var(--ink-faint);">Nenhuma data suficiente pra montar a timeline ainda.</p>') +

        '<p style="font-weight:600;margin:22px 0 8px;">Observações do advogado</p>' +
        '<textarea id="tg-observacoes-advogado" rows="3" placeholder="Anotações gerais sobre o caso (aparecem no relatório/PDF)" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--line);border-radius:6px;font-size:13px;background:var(--bg);color:var(--ink);font-family:inherit;">' + esc(t.observacoes_advogado || '') + '</textarea>' +
        '<div style="margin-top:6px;"><button type="button" class="procpage-btn" id="tg-salvar-observacoes">Salvar observações</button> <span id="tg-observacoes-status" style="font-size:12px;color:var(--ink-faint);"></span></div>' +

        '<p style="font-weight:600;margin:22px 0 8px;">Relatório completo</p>' +
        secoesRelatorio.map(function (s) {
          return '<div class="procficha-painel" style="margin-bottom:10px;">' +
            '<p style="font-weight:600;margin:0 0 8px;font-size:13.5px;">' + esc(s.titulo) + '</p>' +
            s.linhas.map(function (l) { return '<div style="font-size:13px;color:var(--ink-soft);margin-bottom:4px;">' + l + '</div>'; }).join('') +
          '</div>';
        }).join('') +

        '<div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap;">' +
          (t.convertido_processo_id
            ? '<a class="procpage-btn" href="painel-processos.html?processo=' + t.convertido_processo_id + '#sec-processos">Ver processo criado</a>'
            : '<button type="button" class="procpage-btn" id="tg-converter-processo">Converter em Caso</button>') +
          '<button type="button" class="procpage-btn" id="tg-visualizar-pdf">👁 Visualizar PDF</button>' +
          '<button type="button" class="procpage-btn" id="tg-baixar-pdf">📄 Baixar Triagem em PDF</button>' +
          '<button type="button" class="procpage-btn procpage-btn-primary" id="tg-concluir-triagem">Marcar triagem como concluída</button>' +
        '</div>';

      document.getElementById('tg-salvar-observacoes').addEventListener('click', function () {
        var btnObs = document.getElementById('tg-salvar-observacoes');
        var statusObs = document.getElementById('tg-observacoes-status');
        btnObs.disabled = true;
        statusObs.textContent = 'Salvando...';
        apiPostJson('/api/painel?acao=triagem_atualizar', { id: estado.triagemId, observacoes_advogado: document.getElementById('tg-observacoes-advogado').value })
          .then(function () { statusObs.textContent = 'Salvo.'; btnObs.disabled = false; setTimeout(function () { statusObs.textContent = ''; }, 2500); })
          .catch(function (e) { statusObs.textContent = ''; btnObs.disabled = false; erroWizardTriagem(e.message || 'Não foi possível salvar as observações agora.'); });
      });

      document.getElementById('tg-visualizar-pdf').addEventListener('click', function () { _gerarPdfTriagem('tg-visualizar-pdf', 'visualizar'); });
      document.getElementById('tg-baixar-pdf').addEventListener('click', function () { _gerarPdfTriagem('tg-baixar-pdf', 'baixar'); });

      document.getElementById('tg-concluir-triagem').addEventListener('click', function () {
        var btn = document.getElementById('tg-concluir-triagem');
        btn.disabled = true;
        apiPostJson('/api/painel?acao=triagem_status', { id: estado.triagemId, status: 'concluida' })
          .then(function () { window.location.href = 'painel-triagem-trabalhista.html#sec-triagem-trabalhista'; })
          .catch(function (e) { btn.disabled = false; erroWizardTriagem(e.message || 'Não foi possível concluir a triagem agora.'); });
      });

      var btnConverterProcesso = document.getElementById('tg-converter-processo');
      if (btnConverterProcesso) {
        btnConverterProcesso.addEventListener('click', function () {
          confirmarModal('Converter essa triagem em um processo? Um novo processo será criado com os dados do cliente.').then(function (ok) {
            if (!ok) return;
            btnConverterProcesso.disabled = true;
            apiPostJson('/api/painel?acao=triagem_converter_processo', { id: estado.triagemId })
              .then(function (d) { window.location.href = 'painel-processos.html?processo=' + d.processo_id + '#sec-processos'; })
              .catch(function (e) { btnConverterProcesso.disabled = false; erroWizardTriagem(e.message || 'Não foi possível converter agora.'); });
          });
        });
      }
    }

    function renderPassoAtualTriagem(dadosExistentes) {
      renderBarraPassosTriagem();
      var passo = PASSOS_WIZARD_TRIAGEM[estado.passoIndex];
      if (passo === 'cliente') renderPassoClienteTriagem();
      else if (passo === 'empresa') renderPassoEmpresaTriagem(dadosExistentes);
      else if (passo === 'contrato') renderPassoContratoTriagem(dadosExistentes);
      else if (passo === 'jornada') renderPassoJornadaTriagem(dadosExistentes);
      else if (passo === 'remuneracao') renderPassoRemuneracaoTriagem(dadosExistentes);
      else if (passo === 'irregularidades') renderPassoIrregularidadesTriagem(dadosExistentes);
      else if (passo === 'saude') renderPassoSaudeTriagem(dadosExistentes);
      else if (passo === 'assedio') renderPassoAssedioTriagem(dadosExistentes);
      else if (passo === 'rescisao') renderPassoRescisaoTriagem(dadosExistentes);
      else if (passo === 'testemunhas') renderPassoTestemunhasTriagem(dadosExistentes);
      else if (passo === 'provas') renderPassoProvasTriagem(dadosExistentes);
      else if (passo === 'analise_final') renderPassoAnaliseFinalTriagem(dadosExistentes);
    }

    function salvarPassoAtualEAvancarTriagem() {
      erroWizardTriagem('');
      var passo = PASSOS_WIZARD_TRIAGEM[estado.passoIndex];
      var btnAvancar = document.getElementById('triagem-btn-avancar');
      btnAvancar.disabled = true;

      function irParaProximoPasso() {
        btnAvancar.disabled = false;
        if (estado.passoIndex < PASSOS_WIZARD_TRIAGEM.length - 1) {
          estado.passoIndex += 1;
          // Busca a triagem atualizada antes de desenhar o proximo passo -- alguns passos
          // precisam de dado salvo num passo anterior (ex: Remuneracao mostra o "salario
          // registrado" que acabou de ser salvo no passo Contrato). Sem isso, so quem retomava
          // via ?id= na URL (resume) via esses dados; quem avancava na mesma sessao veria em
          // branco (bug real encontrado ao implementar o passo Remuneracao).
          apiGetJson('/api/painel?acao=triagem_obter&id=' + estado.triagemId)
            .then(function (d) { renderPassoAtualTriagem(d.triagem); })
            .catch(function () { renderPassoAtualTriagem(null); });
        } else {
          window.location.href = 'painel-triagem-trabalhista.html#sec-triagem-trabalhista';
        }
      }

      if (passo === 'cliente') {
        salvarPassoClienteTriagem().then(function (clienteId) {
          estado.clienteSelecionadoId = clienteId;
          if (!estado.triagemId) {
            apiPostJson('/api/painel?acao=triagem_criar', { cliente_id: clienteId })
              .then(function (d) {
                estado.triagemId = d.id;
                window.history.replaceState(null, '', 'painel-criar-triagem.html?id=' + d.id + '#sec-criar-triagem');
                apiPostJson('/api/painel?acao=triagem_atualizar', {
                  id: d.id, passo_atual: 'empresa',
                  percentual_conclusao: Math.round((1 / PASSOS_WIZARD_TRIAGEM.length) * 100),
                }).catch(function () {});
                irParaProximoPasso();
              })
              .catch(function (e) { btnAvancar.disabled = false; erroWizardTriagem(e.message || 'Não foi possível criar a triagem agora.'); });
          } else {
            apiPostJson('/api/painel?acao=triagem_atualizar', { id: estado.triagemId, cliente_id: clienteId })
              .then(irParaProximoPasso)
              .catch(function (e) { btnAvancar.disabled = false; erroWizardTriagem(e.message || 'Não foi possível salvar agora.'); });
          }
        }).catch(function (msgErro) { btnAvancar.disabled = false; erroWizardTriagem(msgErro); });
        return;
      }

      var proximoPasso = PASSOS_WIZARD_TRIAGEM[estado.passoIndex + 1];
      var percentual = Math.round(((estado.passoIndex + 1) / PASSOS_WIZARD_TRIAGEM.length) * 100);

      if (passo === 'jornada') {
        var pacoteJornada = coletarPassoJornadaTriagem();
        var corpoResumo = pacoteJornada.camposResumo;
        corpoResumo.id = estado.triagemId;
        if (proximoPasso) corpoResumo.passo_atual = proximoPasso;
        corpoResumo.percentual_conclusao = percentual;
        Promise.all([
          apiPostJson('/api/painel?acao=triagem_atualizar', corpoResumo),
          apiPostJson('/api/painel?acao=triagem_jornada_salvar', { id: estado.triagemId, dias: pacoteJornada.dias }),
        ])
          .then(irParaProximoPasso)
          .catch(function (e) { btnAvancar.disabled = false; erroWizardTriagem(e.message || 'Não foi possível salvar a jornada agora.'); });
        return;
      }

      if (passo === 'irregularidades') {
        var agentesColetados = coletarPassoIrregularidadesTriagem();
        Promise.all([
          apiPostJson('/api/painel?acao=triagem_atualizar', { id: estado.triagemId, passo_atual: proximoPasso || 'irregularidades', percentual_conclusao: percentual }),
          apiPostJson('/api/painel?acao=triagem_insalubridade_salvar', { id: estado.triagemId, agentes: agentesColetados }),
        ])
          .then(irParaProximoPasso)
          .catch(function (e) { btnAvancar.disabled = false; erroWizardTriagem(e.message || 'Não foi possível salvar agora.'); });
        return;
      }

      if (passo === 'saude') {
        var corpoSaude = coletarPassoSaudeTriagem();
        corpoSaude.id = estado.triagemId;
        Promise.all([
          apiPostJson('/api/painel?acao=triagem_atualizar', { id: estado.triagemId, passo_atual: proximoPasso || 'saude', percentual_conclusao: percentual }),
          apiPostJson('/api/painel?acao=triagem_saude_salvar', corpoSaude),
        ])
          .then(irParaProximoPasso)
          .catch(function (e) { btnAvancar.disabled = false; erroWizardTriagem(e.message || 'Não foi possível salvar agora.'); });
        return;
      }

      if (passo === 'assedio') {
        var episodiosColetados = coletarPassoAssedioTriagem();
        Promise.all([
          apiPostJson('/api/painel?acao=triagem_atualizar', { id: estado.triagemId, passo_atual: proximoPasso || 'assedio', percentual_conclusao: percentual }),
          apiPostJson('/api/painel?acao=triagem_assedio_salvar', { id: estado.triagemId, episodios: episodiosColetados }),
        ])
          .then(irParaProximoPasso)
          .catch(function (e) { btnAvancar.disabled = false; erroWizardTriagem(e.message || 'Não foi possível salvar agora.'); });
        return;
      }

      if (passo === 'testemunhas') {
        var testemunhasColetadas = coletarPassoTestemunhasTriagem();
        Promise.all([
          apiPostJson('/api/painel?acao=triagem_atualizar', { id: estado.triagemId, passo_atual: proximoPasso || 'testemunhas', percentual_conclusao: percentual }),
          apiPostJson('/api/painel?acao=triagem_testemunhas_salvar', { id: estado.triagemId, testemunhas: testemunhasColetadas }),
        ])
          .then(irParaProximoPasso)
          .catch(function (e) { btnAvancar.disabled = false; erroWizardTriagem(e.message || 'Não foi possível salvar agora.'); });
        return;
      }

      if (passo === 'provas') {
        var provasColetadas = coletarPassoProvasTriagem();
        Promise.all([
          apiPostJson('/api/painel?acao=triagem_atualizar', { id: estado.triagemId, passo_atual: proximoPasso || 'provas', percentual_conclusao: percentual }),
          apiPostJson('/api/painel?acao=triagem_provas_salvar', { id: estado.triagemId, provas: provasColetadas }),
        ])
          .then(irParaProximoPasso)
          .catch(function (e) { btnAvancar.disabled = false; erroWizardTriagem(e.message || 'Não foi possível salvar agora.'); });
        return;
      }

      if (passo === 'analise_final') {
        // Ultimo passo -- so leitura (diagnostico/timeline/relatorio), nada pra coletar aqui.
        // "Avancar" so marca 100% e volta pro painel; concluir de fato (status = concluida) e
        // uma acao separada (botao dentro do proprio passo).
        apiPostJson('/api/painel?acao=triagem_atualizar', { id: estado.triagemId, passo_atual: 'analise_final', percentual_conclusao: 100 })
          .then(irParaProximoPasso)
          .catch(function (e) { btnAvancar.disabled = false; erroWizardTriagem(e.message || 'Não foi possível salvar agora.'); });
        return;
      }

      var corpo = passo === 'empresa' ? coletarPassoEmpresaTriagem()
        : passo === 'contrato' ? coletarPassoContratoTriagem()
        : passo === 'remuneracao' ? coletarPassoRemuneracaoTriagem()
        : coletarPassoRescisaoTriagem();
      corpo.id = estado.triagemId;
      if (proximoPasso) corpo.passo_atual = proximoPasso;
      corpo.percentual_conclusao = percentual;
      apiPostJson('/api/painel?acao=triagem_atualizar', corpo)
        .then(irParaProximoPasso)
        .catch(function (e) { btnAvancar.disabled = false; erroWizardTriagem(e.message || 'Não foi possível salvar agora.'); });
    }

    // Pula direto pra um passo ja visitado -- reaproveitado tanto pelo botao "Voltar" (so
    // decrementa 1) quanto pelo clique na propria barra verde (pedido explicito do usuario, pra
    // nao precisar clicar "Voltar" repetidas vezes). Sempre busca a triagem de novo antes de
    // desenhar (mesmo motivo do irParaProximoPasso -- sem isso, o passo pro qual voltou aparecia
    // com os campos em branco em vez do que ja tinha sido preenchido).
    function _irParaPassoJaVisitadoTriagem(indice) {
      estado.passoIndex = indice;
      if (!estado.triagemId) { renderPassoAtualTriagem(null); return; }
      apiGetJson('/api/painel?acao=triagem_obter&id=' + estado.triagemId)
        .then(function (d) { renderPassoAtualTriagem(d.triagem); })
        .catch(function () { renderPassoAtualTriagem(null); });
    }

    document.getElementById('triagem-btn-avancar').addEventListener('click', salvarPassoAtualEAvancarTriagem);
    document.getElementById('triagem-btn-voltar').addEventListener('click', function () {
      if (estado.passoIndex === 0) return;
      _irParaPassoJaVisitadoTriagem(estado.passoIndex - 1);
    });
    document.getElementById('triagem-passos-barra').addEventListener('click', function (ev) {
      var marca = ev.target.closest('[data-triagem-passo-idx]');
      if (!marca) return;
      var idx = parseInt(marca.getAttribute('data-triagem-passo-idx'), 10);
      if (idx >= estado.passoIndex) return; // barra so deixa voltar, nao pular pra frente
      _irParaPassoJaVisitadoTriagem(idx);
    });

    // ---- Alertas e pendencias (fase 6) -- calculados no backend (triagem_regras.py) a partir
    // dos dados atuais, sempre na hora (nao ficam guardados em tabela -- ver o modulo pra saber
    // por que). O botao so busca a triagem de novo e mostra o que voltou; cada pendencia e
    // clicavel e leva direto pro passo certo (clique-pro-campo pedido no plano original).
    function _saltarParaPassoTriagem(nomePasso, dadosTriagem) {
      var idx = PASSOS_WIZARD_TRIAGEM.indexOf(nomePasso);
      if (idx === -1) return;
      estado.passoIndex = idx;
      document.getElementById('triagem-painel-pendencias').classList.add('hidden');
      renderPassoAtualTriagem(dadosTriagem);
    }

    function _renderPainelPendenciasTriagem(triagem) {
      var painel = document.getElementById('triagem-painel-pendencias');
      var alertas = triagem.alertas || [];
      var pendencias = triagem.pendencias || [];
      if (!alertas.length && !pendencias.length) {
        painel.innerHTML = '<p style="margin:0;font-size:13px;color:var(--ink-soft);">Nenhum alerta ou pendência identificado até agora. ✅</p>';
      } else {
        painel.innerHTML =
          (alertas.length ? '<p style="font-weight:600;margin:0 0 8px;">Alertas</p>' +
            alertas.map(function (a) {
              var emoji = a.severidade === 'critico' ? '🔴' : '🟠';
              return '<div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:8px;">' +
                '<span>' + emoji + '</span>' +
                '<span style="font-size:13px;color:var(--ink);flex:1;">' + esc(a.mensagem) + '</span>' +
                '<button type="button" class="procpage-btn" data-triagem-ir-passo="' + esc(a.passo) + '" style="font-size:11.5px;padding:4px 10px;">Ver passo</button>' +
              '</div>';
            }).join('') : '') +
          (pendencias.length ? '<p style="font-weight:600;margin:14px 0 8px;">Pendências</p>' +
            pendencias.map(function (p) {
              return '<div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:8px;">' +
                '<span style="font-size:13px;color:var(--ink);flex:1;">' + esc(p.mensagem) + '</span>' +
                '<button type="button" class="procpage-btn" data-triagem-ir-passo="' + esc(p.passo) + '" style="font-size:11.5px;padding:4px 10px;">Ver passo</button>' +
              '</div>';
            }).join('') : '');
      }
      painel.classList.remove('hidden');
      painel.querySelectorAll('[data-triagem-ir-passo]').forEach(function (btn) {
        btn.addEventListener('click', function () { _saltarParaPassoTriagem(btn.getAttribute('data-triagem-ir-passo'), triagem); });
      });
    }

    document.getElementById('triagem-btn-pendencias').addEventListener('click', function () {
      var painel = document.getElementById('triagem-painel-pendencias');
      if (!painel.classList.contains('hidden')) { painel.classList.add('hidden'); return; }
      if (!estado.triagemId) {
        erroWizardTriagem('Salve o passo Cliente primeiro pra poder verificar pendências.');
        return;
      }
      var btn = document.getElementById('triagem-btn-pendencias');
      btn.disabled = true;
      apiGetJson('/api/painel?acao=triagem_obter&id=' + estado.triagemId)
        .then(function (d) { _renderPainelPendenciasTriagem(d.triagem); })
        .catch(function () { erroWizardTriagem('Não foi possível verificar as pendências agora.'); })
        .then(function () { btn.disabled = false; });
    });

    // Retomando uma triagem existente (?id=X na URL) -- busca tudo de uma vez e pula pro passo
    // salvo (autosave/retomada, pedido explicito do usuario).
    var idNaUrlTriagem = new URLSearchParams(window.location.search).get('id');
    if (idNaUrlTriagem) {
      apiGetJson('/api/painel?acao=triagem_obter&id=' + idNaUrlTriagem)
        .then(function (d) {
          var t = d.triagem;
          estado.triagemId = t.id;
          estado.clienteSelecionadoId = t.cliente_id;
          var idxSalvo = PASSOS_WIZARD_TRIAGEM.indexOf(t.passo_atual);
          estado.passoIndex = idxSalvo === -1 ? 0 : idxSalvo;
          renderPassoAtualTriagem(t);
        })
        .catch(function () { erroWizardTriagem('Não foi possível carregar essa triagem agora.'); });
    } else {
      renderPassoAtualTriagem(null);
    }
  }

  function wireProcessosHub() {
    var lista = document.getElementById('procman-lista');
    if (!lista) return;

    carregarProcessosManuais();
    carregarAvisoProcessosPjeNaoCadastrados();

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
        confirmarModal('Excluir o processo de ' + processoExcluir.cliente_nome + '? Essa ação não pode ser desfeita.').then(function (ok) {
          if (!ok) return;
          apiPostJson('/api/painel?acao=processo_manual_excluir', { id: processoExcluir.id })
            .then(function () { carregarProcessosManuais(); })
            .catch(function () { /* lista so nao atualiza -- usuario pode tentar de novo */ });
        });
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

  function carregarAvisoProcessosPjeNaoCadastrados() {
    var alvo = document.getElementById('procpage-aviso-nao-cadastrados');
    if (!alvo) return;
    apiGetJson('/api/painel?acao=processo_manual_pje_sem_cadastro')
      .then(function (dados) {
        var pendentes = dados.processos || [];
        if (pendentes.length === 0) { alvo.innerHTML = ''; return; }
        var lista = pendentes.slice(0, 5).map(function (p) {
          return esc(p.processo) + (p.cliente ? ' — ' + esc(p.cliente) : '');
        }).join('; ');
        var resto = pendentes.length > 5 ? ' e mais ' + (pendentes.length - 5) + '...' : '';
        alvo.innerHTML = '<div class="aviso-tenant" style="margin-bottom:16px;">' +
          '<strong>' + pendentes.length + ' processo(s) com comunicação do PJe ainda não cadastrado(s):</strong> ' +
          lista + resto + ' — ' +
          '<a href="painel-importar-oab.html#sec-importar-oab" style="font-weight:600;">Importar pela OAB</a>' +
        '</div>';
      })
      .catch(function () { /* aviso e so um "plus" -- se falhar, nao atrapalha a lista principal */ });
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
      // data-busca junta tudo que aparece na linha (sem acento, minusculo) pra o filtro de texto
      // achar por numero do processo, classe, tribunal ou nome de qualquer uma das partes.
      var textoBusca = normalizarBusca([p.numero_cnj, p.classe_processual, p.tribunal, p.polo_ativo, p.polo_passivo]
        .filter(Boolean).join(' '));
      return '<tr data-busca="' + esc(textoBusca) + '">' +
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
            '<div style="margin-top:14px; display:flex; gap:8px; flex-wrap:wrap; align-items:center;">' +
              '<input type="text" id="procoab-filtro" class="conexao-input" style="margin-bottom:0; max-width:280px;" ' +
                'placeholder="Filtrar por processo, classe, tribunal ou parte...">' +
              '<button type="button" id="procoab-marcar-visiveis" class="btn-conexao-secundario" style="padding:8px 12px; font-size:12.5px;">Marcar visíveis</button>' +
              '<button type="button" id="procoab-desmarcar-visiveis" class="btn-conexao-secundario" style="padding:8px 12px; font-size:12.5px;">Desmarcar visíveis</button>' +
              '<button type="button" id="procoab-marcar-todos" class="btn-conexao-secundario" style="padding:8px 12px; font-size:12.5px;">Marcar todos</button>' +
              '<button type="button" id="procoab-desmarcar-todos" class="btn-conexao-secundario" style="padding:8px 12px; font-size:12.5px;">Desmarcar todos</button>' +
              '<span id="procoab-contador" style="font-size:12.5px; color:var(--ink-soft); margin-left:auto;"></span>' +
            '</div>' +
            '<div class="table-scroll" style="margin-top:10px;"><table><thead><tr>' +
              '<th></th><th>Processo</th><th>Tribunal</th><th>Polo ativo</th><th>Polo passivo</th><th>Cliente (confirme)</th>' +
            '</tr></thead><tbody>' +
            processos.map(linhaResultado).join('') +
            '</tbody></table></div>' +
            '<div style="margin-top:12px;"><button id="procoab-btn-importar" style="padding:9px 16px;border:none;' +
              'border-radius:7px;background:var(--good);color:#fff;font-size:13px;font-weight:600;cursor:pointer;">Importar selecionados</button>' +
              '<span id="procoab-status-importar" style="margin-left:10px;font-size:12.5px;color:var(--ink-soft);"></span></div>';

          var todasLinhas = Array.prototype.slice.call(resultadoDiv.querySelectorAll('tbody tr'));
          var todosChecks = Array.prototype.slice.call(resultadoDiv.querySelectorAll('.procoab-check'));
          var campoFiltro = document.getElementById('procoab-filtro');
          var contadorEl = document.getElementById('procoab-contador');

          function linhasVisiveis() {
            return todasLinhas.filter(function (tr) { return !tr.classList.contains('hidden'); });
          }
          function checkDaLinha(tr) { return tr.querySelector('.procoab-check'); }
          function atualizarContador() {
            var marcados = todosChecks.filter(function (c) { return c.checked; }).length;
            var visiveis = linhasVisiveis().length;
            contadorEl.textContent = marcados + ' de ' + todosChecks.length + ' selecionado(s)' +
              (visiveis < todasLinhas.length ? ' · ' + visiveis + ' visível(is) com o filtro' : '');
          }

          campoFiltro.addEventListener('input', function () {
            var termo = normalizarBusca(campoFiltro.value.trim());
            todasLinhas.forEach(function (tr) {
              var bate = !termo || (tr.getAttribute('data-busca') || '').indexOf(termo) !== -1;
              tr.classList.toggle('hidden', !bate);
            });
            atualizarContador();
          });

          document.getElementById('procoab-marcar-visiveis').addEventListener('click', function () {
            linhasVisiveis().forEach(function (tr) { checkDaLinha(tr).checked = true; });
            atualizarContador();
          });
          document.getElementById('procoab-desmarcar-visiveis').addEventListener('click', function () {
            linhasVisiveis().forEach(function (tr) { checkDaLinha(tr).checked = false; });
            atualizarContador();
          });
          document.getElementById('procoab-marcar-todos').addEventListener('click', function () {
            todosChecks.forEach(function (c) { c.checked = true; });
            atualizarContador();
          });
          document.getElementById('procoab-desmarcar-todos').addEventListener('click', function () {
            todosChecks.forEach(function (c) { c.checked = false; });
            atualizarContador();
          });
          resultadoDiv.addEventListener('change', function (ev) {
            if (ev.target.classList.contains('procoab-check')) atualizarContador();
          });
          atualizarContador();

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

    aplicarMascaraNumeroCnj(document.getElementById('procman-numero-cnj'));

    var datalistProcMan = document.getElementById('procman-clientes-lista');
    apiGetJson('/api/painel?acao=clientes')
      .then(function (dados) {
        datalistProcMan.innerHTML = (dados.clientes || []).map(function (c) {
          return '<option value="' + esc(c.nome) + '">';
        }).join('');
      })
      .catch(function () { /* datalist so ajuda, nao bloqueia o preenchimento manual se falhar */ });

    function limparFormulario() {
      ['procman-numero-cnj', 'procman-classe', 'procman-area', 'procman-orgao',
        'procman-comarca', 'procman-cliente', 'procman-fase', 'procman-valor-causa',
        'procman-data-distribuicao', 'procman-data-encerramento', 'procman-advogado',
        'procman-prioridade', 'procman-obs'].forEach(function (id) {
        document.getElementById(id).value = '';
      });
      document.getElementById('procman-tribunal').value = '';
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
      var campoNumeroCnj = document.getElementById('procman-numero-cnj');
      campoNumeroCnj.value = p.numero_cnj || '';
      campoNumeroCnj.dispatchEvent(new Event('input')); // reaplica a mascara no valor ja salvo
      document.getElementById('procman-classe').value = p.classe_processual || '';
      document.getElementById('procman-area').value = p.area_direito || '';
      document.getElementById('procman-orgao').value = p.orgao_julgador || '';
      setSelectValueComFallback(document.getElementById('procman-tribunal'), p.tribunal || '');
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
            (ok ? 'background:var(--good-soft); color:var(--good);' : 'background:var(--accent-soft); color:var(--ink-faint);') + '">' + (ok ? '✓' : '') + '</div>' +
          '<div><div style="font-size:12.5px; font-weight:600; color:var(--ink);">' + esc(c.rotulo) + '</div>' +
          '<div style="font-size:11px; color:var(--ink-faint);">' + esc(c.sub) + '</div></div>' +
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
        mostrarAviso('A foto precisa ter até 5MB.');
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

    var clienteIdEdicao = new URLSearchParams(window.location.search).get('cliente');

    apiGetJson('/api/painel?acao=etiqueta_listar')
      .then(function (dados) {
        etiquetasCatalogo = dados.etiquetas || [];
        if (clienteIdEdicao) preencherParaEdicao(clienteIdEdicao);
      })
      .catch(function () {
        /* dropdown so fica vazio se falhar */
        if (clienteIdEdicao) preencherParaEdicao(clienteIdEdicao);
      });

    function preencherParaEdicao(id) {
      var titulo = document.getElementById('cliente-form-titulo');
      if (titulo) titulo.textContent = 'Editar cliente';
      btnSalvar.textContent = 'Salvar alterações';
      apiGetJson('/api/painel?acao=cliente_cadastro_obter&id=' + id)
        .then(function (c) {
          document.getElementById('cliente-tipo').value = c.tipo || 'Pessoa Física';
          document.getElementById('cliente-tipo').dispatchEvent(new Event('change'));
          document.getElementById('cliente-nome').value = c.nome || '';
          document.getElementById('cliente-cpf-cnpj').value = c.cpf_cnpj || '';
          document.getElementById('cliente-email').value = c.email || '';
          document.getElementById('cliente-telefone').value = c.telefone || '';
          document.getElementById('cliente-cep').value = c.cep || '';
          document.getElementById('cliente-logradouro').value = c.logradouro || '';
          document.getElementById('cliente-numero').value = c.numero || '';
          document.getElementById('cliente-complemento').value = c.complemento || '';
          document.getElementById('cliente-bairro').value = c.bairro || '';
          document.getElementById('cliente-cidade').value = c.cidade || '';
          document.getElementById('cliente-uf').value = c.uf || '';
          document.getElementById('cliente-observacoes').value = c.observacoes || '';
          (c.etiquetas || []).forEach(function (nomeEt) {
            var et = etiquetasCatalogo.find(function (e) { return e.nome === nomeEt; });
            if (et && etiquetasSelecionadasIds.indexOf(et.id) === -1) etiquetasSelecionadasIds.push(et.id);
          });
          renderEtiquetasSelecionadas();
          renderProgressoCliente();
          if (c.tem_foto) {
            apiGet('/api/painel?acao=cliente_foto_obter&cliente_id=' + id)
              .then(function (r) { return r.ok ? r.blob() : null; })
              .then(function (blob) {
                if (!blob) return;
                document.getElementById('cliente-foto-preview').innerHTML =
                  '<img src="' + URL.createObjectURL(blob) + '" style="width:100%;height:100%;object-fit:cover;">';
              })
              .catch(function () { /* preview so ajuda, nao bloqueia edicao se falhar */ });
          }
        })
        .catch(function (e) {
          document.getElementById('cliente-form-erro').innerHTML =
            '<div class="aviso-tenant">' + esc(e.message || 'Não foi possível carregar os dados desse cliente.') + '</div>';
        });
    }

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
        .catch(function (e) { mostrarAviso(e.message || 'Não foi possível criar a etiqueta agora.'); });
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

      var textoOriginalBtn = btnSalvar.textContent;
      btnSalvar.disabled = true; btnSalvar.textContent = 'Salvando...';

      var acaoSalvar, corpoSalvar;
      if (clienteIdEdicao) {
        acaoSalvar = 'cliente_cadastro_atualizar';
        corpoSalvar = Object.assign({ id: clienteIdEdicao }, corpo);
      } else {
        acaoSalvar = 'cliente_cadastro_criar';
        corpoSalvar = corpo;
      }

      apiPostJson('/api/painel?acao=' + acaoSalvar, corpoSalvar)
        .then(function (resultado) {
          var clienteId = clienteIdEdicao || resultado.id;
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
          // ao editar, manda sempre (mesmo lista vazia) pra remover etiqueta tirada;
          // ao criar, so manda se tiver alguma (evita chamada a toa na maioria dos casos).
          if (clienteIdEdicao || etiquetasSelecionadasIds.length > 0) {
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
          btnSalvar.disabled = false; btnSalvar.textContent = textoOriginalBtn;
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
        if (!arquivo) { mostrarAviso('Escolha um arquivo primeiro.'); return; }
        if (arquivo.size > 4 * 1024 * 1024) { mostrarAviso('Arquivo maior que 4 MB -- suba um menor.'); return; }

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
          .catch(function () { mostrarAviso('Não foi possível atualizar o status agora.'); });
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
            mostrarAviso('Não foi possível abrir o documento agora.');
          });
      });
    });

    container.querySelectorAll('[data-remover-doc-procadm]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var partes = btn.getAttribute('data-remover-doc-procadm').split('|');
        confirmarModal('Remover este documento?').then(function (ok) {
          if (!ok) return;
          apiPostJson('/api/painel?acao=processos_administrativos', { op: 'remover_documento', id: partes[0], documento_id: partes[1] })
            .then(function () { carregarProcessosAdministrativos(); })
            .catch(function () { mostrarAviso('Não foi possível remover o documento agora.'); });
        });
      });
    });

    container.querySelectorAll('[data-upload-btn-procadm]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-upload-btn-procadm');
        var input = container.querySelector('[data-upload-input-procadm="' + id + '"]');
        var arquivo = input && input.files && input.files[0];
        if (!arquivo) { mostrarAviso('Escolha um arquivo primeiro.'); return; }
        if (arquivo.size > 4 * 1024 * 1024) { mostrarAviso('Arquivo maior que 4 MB -- suba um menor.'); return; }

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
            mostrarAviso((erro && erro.message) || 'Não foi possível enviar o arquivo agora.');
          });
      });
    });

    container.querySelectorAll('[data-excluir-procadm]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-excluir-procadm');
        confirmarModal('Excluir este processo administrativo? Os documentos continuam na pasta do cliente no Drive.').then(function (ok) {
          if (!ok) return;
          apiPostJson('/api/painel?acao=processos_administrativos', { op: 'excluir', id: id })
            .then(function () { carregarProcessosAdministrativos(); })
            .catch(function () { mostrarAviso('Não foi possível excluir agora.'); });
        });
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
        var mensagemCobranca = 'Enviar cobrança de R$ ' + btn.getAttribute('data-cobrar-valor') + ' para ' +
          btn.getAttribute('data-cobrar-nome') + '?';
        confirmarModal(mensagemCobranca, { perigo: false, textoOk: 'Enviar' }).then(function (ok) {
          if (!ok) return;
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
            mostrarAviso(dados.resposta || dados.erro || 'Concluído.');
            btn.disabled = false;
            btn.textContent = textoOriginal;
          }).catch(function () {
            btn.disabled = false;
            btn.textContent = textoOriginal;
            mostrarAviso('Não foi possível enviar a cobrança agora.');
          });
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
      confirmarModal(aviso, { textoOk: 'Enviar' }).then(function (ok) {
        if (!ok) return;

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
    });
  }

  function fmtDataCurta(iso) {
    if (!iso) return '';
    var dataParte = iso.split('T')[0];
    var horaParte = iso.includes('T') ? iso.split('T')[1].substring(0, 5) : '';
    var partes = dataParte.split('-');
    var dataFmt = partes[2] + '/' + partes[1] + '/' + partes[0];
    return horaParte ? dataFmt + ' às ' + horaParte : dataFmt;
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

  function wireAssinaturaDireta() {
    var card = document.getElementById('card-assinatura');
    if (!card) return;
    var campoNome = document.getElementById('assinatura-nome');
    var btnBuscar = document.getElementById('assinatura-buscar');
    var passo2 = document.getElementById('assinatura-passo2');
    var campoTelefoneWrap = document.getElementById('assinatura-campo-telefone');
    var campoTelefone = document.getElementById('assinatura-telefone');
    var listaDocs = document.getElementById('assinatura-lista-docs');
    var btnEnviar = document.getElementById('assinatura-enviar');
    var resultadoEl = document.getElementById('assinatura-resultado');
    var nomePastaAtual = '';

    function esconderPasso2() {
      passo2.classList.add('hidden');
      listaDocs.innerHTML = '';
    }

    function buscar() {
      var nome = campoNome.value.trim();
      resultadoEl.textContent = '';
      if (!nome) { resultadoEl.textContent = 'Informe o nome do cliente.'; return; }
      esconderPasso2();
      btnBuscar.disabled = true;
      btnBuscar.textContent = 'Buscando...';
      var corpo = { tipo: 'assinatura_listar_documentos', nome: nome };
      if (campoTelefone.value.trim()) corpo.telefone = campoTelefone.value.trim();
      apiPostJson('/api/painel?acao=executar', corpo)
        .then(function (dados) {
          nomePastaAtual = dados.nome_pasta || nome;
          if (dados.precisa_telefone) {
            campoTelefoneWrap.classList.remove('hidden');
            passo2.classList.remove('hidden');
            resultadoEl.textContent = 'Não achei telefone cadastrado pra ' + nomePastaAtual + '. Informe abaixo e busque de novo.';
            return;
          }
          campoTelefoneWrap.classList.add('hidden');
          var opcoes = dados.opcoes || [];
          if (!opcoes.length) {
            resultadoEl.textContent = 'Nenhum PDF encontrado na pasta de honorários de ' + nomePastaAtual + '.';
            return;
          }
          listaDocs.innerHTML =
            '<div style="font-size:13px;color:var(--ink-soft);margin-bottom:4px;">Documentos de ' + esc(nomePastaAtual) +
            ' (telefone: ' + esc(dados.telefone || '') + '):</div>' +
            opcoes.map(function (o, i) {
              return '<label style="display:flex;align-items:center;gap:8px;padding:4px 0;font-weight:400;">' +
                '<input type="checkbox" class="assinatura-doc-check" data-id="' + esc(o.id) + '" data-nome="' + esc(o.nome) + '"' + (i === 0 ? ' checked' : '') + '> ' +
                esc(o.nome) + '</label>';
            }).join('');
          btnEnviar.dataset.telefone = dados.telefone || campoTelefone.value.trim();
          passo2.classList.remove('hidden');
        })
        .catch(function (e) { resultadoEl.textContent = e.message || 'Não foi possível buscar agora.'; })
        .finally(function () {
          btnBuscar.disabled = false;
          btnBuscar.textContent = 'Buscar documentos';
        });
    }

    btnBuscar.addEventListener('click', buscar);

    btnEnviar.addEventListener('click', function () {
      var marcados = listaDocs.querySelectorAll('.assinatura-doc-check:checked');
      if (!marcados.length) { resultadoEl.textContent = 'Marque pelo menos um documento.'; return; }
      var telefone = btnEnviar.dataset.telefone || campoTelefone.value.trim();
      if (!telefone) { resultadoEl.textContent = 'Informe o telefone do cliente.'; return; }
      var ids = [], nomes = [];
      marcados.forEach(function (chk) { ids.push(chk.getAttribute('data-id')); nomes.push(chk.getAttribute('data-nome')); });

      btnEnviar.disabled = true;
      var textoOriginal = btnEnviar.textContent;
      btnEnviar.textContent = 'Enviando...';
      resultadoEl.textContent = '';
      apiPostJson('/api/painel?acao=executar', {
        tipo: 'assinatura_enviar_documentos', telefone: telefone, ids: ids.join(','), nomes: nomes.join('||'),
      })
        .then(function (dados) {
          var partes = [];
          if (dados.enviados && dados.enviados.length) partes.push('Enviados: ' + dados.enviados.join(', '));
          if (dados.falhas && dados.falhas.length) partes.push('Falharam: ' + dados.falhas.join(', '));
          resultadoEl.textContent = partes.length ? partes.join(' — ') : 'Concluído.';
          if (dados.enviados && dados.enviados.length && (!dados.falhas || !dados.falhas.length)) {
            esconderPasso2();
            campoNome.value = '';
          }
        })
        .catch(function (e) { resultadoEl.textContent = e.message || 'Não foi possível enviar agora.'; })
        .finally(function () {
          btnEnviar.disabled = false;
          btnEnviar.textContent = textoOriginal;
        });
    });
  }

  function wireAutomacoes() {
    var botoes = document.querySelectorAll('.btn-automacao');
    for (var i = 0; i < botoes.length; i++) {
      botoes[i].addEventListener('click', function (e) {
        var tipoBotao = e.target.getAttribute('data-tipo');
        if (!tipoBotao) return; // botoes com fluxo proprio (ex: assinatura direta) sao wireados a parte
        if (tipoBotao === 'remover_cliente_financeiro') {
          var nomeCampo = document.querySelector('[data-form="remover_cliente_financeiro"][data-campo="nome"]');
          var nomeDigitado = nomeCampo ? nomeCampo.value.trim() : '';
          if (!nomeDigitado) return;
          confirmarModal('Remover "' + nomeDigitado + '" da planilha de honorários? Essa ação não pode ser desfeita pelo painel.').then(function (ok) {
            if (ok) executarAutomacao(tipoBotao, e.target);
          });
          return;
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
            mostrarAviso('Não foi possível marcar a audiência como realizada agora.');
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

  function segundosDeMarca(marca) {
    var partes = marca.split(':').map(Number);
    return partes[0] * 3600 + partes[1] * 60 + partes[2];
  }

  function parseTranscricaoDialogo(texto, audienciaId, notas) {
    notas = (notas || []).slice().sort(function (a, b) { return a.segundo - b.segundo; });
    var indiceNota = 0;
    var linhas = texto.split('\n');
    // O rotulo antes dos dois-pontos pode ser "Locutor A" (agrupamento por voz da AssemblyAI,
    // sem nome) ou o nome de verdade (quando veio da extensao de Zoom, que sabe quem estava
    // falando) -- captura o rotulo inteiro, verbatim, em vez de exigir literalmente a palavra
    // "Locutor" (senao toda transcricao com nome de verdade caia no fallback generico abaixo).
    var regexFala = /^\[(\d{2}:\d{2}:\d{2})\]\s+(.+?):\s*(.*)$/;
    var locutorCor = {}, proximaCor = 0;
    var partes = [], algumaFala = false;

    function inserirNotasAte(limiteSegundos) {
      while (indiceNota < notas.length && notas[indiceNota].segundo <= limiteSegundos) {
        var nota = notas[indiceNota];
        indiceNota++;
        partes.push(
          '<div class="nota-manual">📝 ' + esc(nota.texto) +
          ' <button type="button" data-remover-nota="' + esc(nota.id) + '" data-id-audiencia="' + esc(audienciaId) + '">remover</button></div>'
        );
      }
    }

    linhas.forEach(function (linha) {
      var m = linha.match(regexFala);
      if (!m) {
        if (linha.trim()) partes.push('<div class="timeline-item-resumo">' + esc(linha) + '</div>');
        return;
      }
      algumaFala = true;
      var segundoLinha = segundosDeMarca(m[1]);
      inserirNotasAte(segundoLinha);
      var locutor = m[2];
      if (!(locutor in locutorCor)) { locutorCor[locutor] = proximaCor % 4; proximaCor++; }
      partes.push(
        '<div class="fala"><span class="fala-hora">' + esc(m[1]) + '</span>' +
        '<span class="fala-locutor fala-locutor-' + locutorCor[locutor] + '">' + esc(locutor) + '</span>' +
        '<span class="fala-texto">' + esc(m[3]) + '</span>' +
        '<button type="button" class="btn-add-nota" data-add-nota="' + segundoLinha + '" data-id-audiencia="' + esc(audienciaId) + '" title="Adicionar anotação aqui">📝+</button>' +
        '</div>'
      );
    });
    inserirNotasAte(Infinity);
    if (!algumaFala) {
      return '<div class="timeline-item-resumo" style="white-space:pre-wrap;">' + esc(texto) + '</div>';
    }
    return '<div class="transcricao-dialogo">' + partes.join('') + '</div>';
  }

  function wireNotasTranscricao(alvo, audienciaId, idx) {
    alvo.querySelectorAll('[data-add-nota]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var texto = window.prompt('Anotação (só você vê isso):');
        if (!texto || !texto.trim()) return;
        var segundo = btn.getAttribute('data-add-nota');
        apiPost('/api/painel?acao=audiencias', { op: 'adicionar_nota', id: audienciaId, texto: texto.trim(), segundo: segundo })
          .then(function (r) { if (!r.ok) throw new Error('falha'); return r.json(); })
          .then(function () {
            // recarrega so essa transcricao (com a nota nova ja no lugar certo) -- limpa o
            // conteudo antes de clicar de novo, senao o clique so fecharia (o botao alterna
            // entre mostrar/esconder quando ja tem algo renderizado ali).
            document.getElementById('audiencia-transcricao-' + idx).innerHTML = '';
            document.querySelector('[data-ver-transcricao="' + idx + '"]').click();
          })
          .catch(function () { mostrarAviso('Não foi possível salvar a anotação agora.'); });
      });
    });
    alvo.querySelectorAll('[data-remover-nota]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var notaId = btn.getAttribute('data-remover-nota');
        apiPost('/api/painel?acao=audiencias', { op: 'remover_nota', id: audienciaId, nota_id: notaId })
          .then(function (r) { if (!r.ok) throw new Error('falha'); return r.json(); })
          .then(function () { btn.closest('.nota-manual').remove(); })
          .catch(function () { mostrarAviso('Não foi possível remover a anotação agora.'); });
      });
    });
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
      var tags = a.tags || [];
      var chips = '';
      if (a.duracao_segundos || a.duracao_segundos === 0) chips += '<span class="audiencia-chip">' + esc(fmtDuracao(a.duracao_segundos)) + '</span>';
      if (a.total_falas) chips += '<span class="audiencia-chip">' + a.total_falas + ' fala' + (a.total_falas === 1 ? '' : 's') + '</span>';
      if (a.total_locutores) chips += '<span class="audiencia-chip">' + a.total_locutores + ' pessoa' + (a.total_locutores === 1 ? '' : 's') + '</span>';
      tags.forEach(function (t) { chips += '<span class="audiencia-chip audiencia-chip-tag">🏷️ ' + esc(t) + '</span>'; });
      return '<div class="processo-card" data-busca-audiencia="' + esc(normalizarBusca(a.cliente + ' ' + a.resumo + ' ' + tags.join(' '))) + '" data-id-card="' + esc(a.id) + '">' +
        '<button type="button" class="processo-cabecalho" data-toggle-audiencia="' + idx + '" aria-expanded="false" aria-controls="audiencia-corpo-' + idx + '">' +
          '<div><div class="processo-numero">' + esc(a.cliente) + '</div>' +
          '<div class="processo-meta">' + esc(fmtDataCurta(a.data_processamento)) + (chips ? ' · ' : '') + '</div>' +
          (chips ? '<div style="margin-top:4px;">' + chips + '</div>' : '') + '</div>' +
        '</button>' +
        '<div class="processo-corpo" id="audiencia-corpo-' + idx + '">' + avisos +
          '<div class="timeline-item-resumo" style="white-space:pre-wrap;">' + esc(a.resumo) + '</div>' +
          '<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">' +
            '<span style="font-size:12.5px;color:var(--ink-soft);">Tags (ex: número do processo):</span>' +
            '<input type="text" data-tags-input="' + idx + '" value="' + esc(tags.join(', ')) + '" placeholder="processo-123, guarda" style="flex:1;min-width:160px;">' +
            '<button type="button" data-tags-salvar="' + idx + '" data-id-audiencia="' + esc(a.id) + '">Salvar tags</button>' +
          '</div>' +
          '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">' +
            '<button data-ver-transcricao="' + idx + '" data-id-audiencia="' + esc(a.id) + '">Ver transcrição completa</button>' +
            '<button data-baixar-audiencia-pdf="' + esc(a.pdf_file_id) + '">Baixar PDF</button>' +
            '<button data-comparar-audiencia="' + idx + '" data-id-audiencia="' + esc(a.id) + '">Comparar com outras do mesmo processo</button>' +
            '<button data-gerar-email="' + idx + '" data-id-audiencia="' + esc(a.id) + '">Gerar e-mail pro cliente</button>' +
            '<button data-excluir-audiencia="' + esc(a.id) + '" class="btn-remover">Excluir</button></div>' +
          '<div style="margin-top:12px;" id="audiencia-transcricao-' + idx + '"></div>' +
          '<div style="margin-top:12px;white-space:pre-wrap;" id="audiencia-comparacao-' + idx + '"></div>' +
          '<div style="margin-top:12px;" id="audiencia-email-' + idx + '"></div>' +
          '<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">' +
            '<span style="font-size:12.5px;color:var(--ink-soft);">Ver resumo em outro formato:</span>' +
            '<select data-template-select="' + idx + '">' +
              '<option value="curto">Curto (até 5 linhas)</option>' +
              '<option value="detalhado">Detalhado</option>' +
              '<option value="so_decisoes">Só decisões e acordos</option>' +
            '</select>' +
            '<button type="button" data-gerar-resumo-template="' + idx + '" data-id-audiencia="' + esc(a.id) + '">Gerar</button>' +
          '</div>' +
          '<div style="margin-top:8px;white-space:pre-wrap;" id="audiencia-resumo-template-' + idx + '"></div>' +
          '<div class="audiencia-pergunta" style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line);">' +
            '<div style="font-size:12.5px;color:var(--ink-soft);margin-bottom:6px;">Perguntar sobre esta audiência</div>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
              '<input type="text" data-pergunta-input="' + idx + '" placeholder="Ex: qual foi o prazo concedido?" style="flex:1;min-width:200px;">' +
              '<button type="button" data-pergunta-enviar="' + idx + '" data-id-audiencia="' + esc(a.id) + '">Perguntar</button>' +
            '</div>' +
            '<div style="margin-top:8px;white-space:pre-wrap;" id="audiencia-resposta-' + idx + '"></div>' +
          '</div>' +
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
            var notas = (dados.audiencia && dados.audiencia.notas) || [];
            alvo.innerHTML = parseTranscricaoDialogo(texto, id, notas);
            wireNotasTranscricao(alvo, id, idx);
            btn.textContent = textoOriginal;
          })
          .catch(function () {
            btn.textContent = textoOriginal;
            mostrarAviso('Não foi possível carregar a transcrição agora.');
          });
      });
    });

    var buscaInput = document.getElementById('audiencias-busca-input');
    if (buscaInput && !buscaInput.dataset.wired) {
      buscaInput.dataset.wired = '1';
      var timerBuscaAudiencia = null;
      buscaInput.addEventListener('input', function () {
        var valorDigitado = buscaInput.value;
        var termo = normalizarBusca(valorDigitado);
        // 1) reação instantânea, filtrando só pelo que já está na tela (cliente + resumo).
        document.querySelectorAll('[data-busca-audiencia]').forEach(function (card) {
          card.style.display = !termo || card.getAttribute('data-busca-audiencia').indexOf(termo) === -1 ? 'none' : '';
        });
        if (!termo) return;
        // 2) depois de uma pausa, também pergunta pro backend (que vasculha a transcrição
        // completa, não só o resumo) e revela os cards que só batem lá -- assim a busca acha
        // coisas ditas durante a audiência mesmo que não apareçam no resumo.
        clearTimeout(timerBuscaAudiencia);
        timerBuscaAudiencia = setTimeout(function () {
          if (normalizarBusca(buscaInput.value) !== termo) return; // usuário já digitou outra coisa
          apiGetJson('/api/painel?acao=audiencias&op=buscar&q=' + encodeURIComponent(valorDigitado))
            .then(function (dados) {
              if (normalizarBusca(buscaInput.value) !== termo) return;
              var idsAchados = dados.ids || [];
              document.querySelectorAll('[data-id-card]').forEach(function (card) {
                if (idsAchados.indexOf(card.getAttribute('data-id-card')) !== -1) card.style.display = '';
              });
            })
            .catch(function () {});
        }, 400);
      });
    }

    container.querySelectorAll('[data-comparar-audiencia]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var idx = btn.getAttribute('data-comparar-audiencia');
        var id = btn.getAttribute('data-id-audiencia');
        var alvo = document.getElementById('audiencia-comparacao-' + idx);
        var textoOriginal = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Comparando...';
        alvo.textContent = '';
        apiPost('/api/painel?acao=audiencias', { op: 'comparar', id: id })
          .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.erro || 'falha'); return d; }); })
          .then(function (dados) { alvo.textContent = '📊 Comparação com ' + dados.total + ' audiências:\n\n' + dados.comparacao; })
          .catch(function (err) { alvo.textContent = 'Não foi possível comparar: ' + (err.message || 'erro'); })
          .finally(function () { btn.disabled = false; btn.textContent = textoOriginal; });
      });
    });

    container.querySelectorAll('[data-gerar-resumo-template]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var idx = btn.getAttribute('data-gerar-resumo-template');
        var id = btn.getAttribute('data-id-audiencia');
        var select = container.querySelector('[data-template-select="' + idx + '"]');
        var alvo = document.getElementById('audiencia-resumo-template-' + idx);
        var textoOriginal = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Gerando...';
        alvo.textContent = '';
        apiPost('/api/painel?acao=audiencias', { op: 'gerar_resumo_alternativo', id: id, template: select.value })
          .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.erro || 'falha'); return d; }); })
          .then(function (dados) { alvo.textContent = dados.resumo || ''; })
          .catch(function (err) { alvo.textContent = 'Não foi possível gerar agora: ' + (err.message || 'erro'); })
          .finally(function () { btn.disabled = false; btn.textContent = textoOriginal; });
      });
    });

    container.querySelectorAll('[data-gerar-email]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var idx = btn.getAttribute('data-gerar-email');
        var id = btn.getAttribute('data-id-audiencia');
        var alvo = document.getElementById('audiencia-email-' + idx);
        var textoOriginal = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Gerando...';
        alvo.innerHTML = '';
        apiPost('/api/painel?acao=audiencias', { op: 'gerar_email', id: id })
          .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.erro || 'falha'); return d; }); })
          .then(function (dados) {
            var textarea = document.createElement('textarea');
            textarea.value = dados.email || '';
            textarea.rows = 8;
            textarea.style.cssText = 'width:100%;font-family:inherit;font-size:13px;padding:8px;border:1px solid var(--line);border-radius:8px;';
            var botaoCopiar = document.createElement('button');
            botaoCopiar.type = 'button';
            botaoCopiar.textContent = 'Copiar texto';
            botaoCopiar.style.marginTop = '6px';
            botaoCopiar.addEventListener('click', function () {
              navigator.clipboard.writeText(textarea.value).then(function () {
                botaoCopiar.textContent = 'Copiado!';
                setTimeout(function () { botaoCopiar.textContent = 'Copiar texto'; }, 1500);
              });
            });
            alvo.appendChild(textarea);
            alvo.appendChild(botaoCopiar);
          })
          .catch(function (err) { alvo.textContent = 'Não foi possível gerar o e-mail: ' + (err.message || 'erro'); })
          .finally(function () { btn.disabled = false; btn.textContent = textoOriginal; });
      });
    });

    container.querySelectorAll('[data-tags-salvar]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var idx = btn.getAttribute('data-tags-salvar');
        var id = btn.getAttribute('data-id-audiencia');
        var campo = container.querySelector('[data-tags-input="' + idx + '"]');
        var textoOriginal = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Salvando...';
        apiPost('/api/painel?acao=audiencias', { op: 'atualizar_tags', id: id, tags: campo.value })
          .then(function (r) { if (!r.ok) throw new Error('falha'); return r.json(); })
          .then(function () { carregarAudiencias(); })
          .catch(function () {
            mostrarAviso('Não foi possível salvar as tags agora.');
            btn.disabled = false;
            btn.textContent = textoOriginal;
          });
      });
    });

    container.querySelectorAll('[data-pergunta-enviar]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var idx = btn.getAttribute('data-pergunta-enviar');
        var id = btn.getAttribute('data-id-audiencia');
        var campo = container.querySelector('[data-pergunta-input="' + idx + '"]');
        var alvo = document.getElementById('audiencia-resposta-' + idx);
        var pergunta = (campo.value || '').trim();
        if (!pergunta) { alvo.textContent = 'Digite uma pergunta primeiro.'; return; }
        var textoOriginal = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Perguntando...';
        alvo.textContent = '';
        apiPost('/api/painel?acao=audiencias', { op: 'perguntar', id: id, pergunta: pergunta })
          .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.erro || 'falha'); return d; }); })
          .then(function (dados) { alvo.textContent = dados.resposta || ''; })
          .catch(function (err) { alvo.textContent = 'Não consegui responder agora (' + (err.message || 'erro') + ').'; })
          .finally(function () { btn.disabled = false; btn.textContent = textoOriginal; });
      });
    });

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
            mostrarAviso('Não foi possível abrir o PDF agora.');
          });
      });
    });

    container.querySelectorAll('[data-excluir-audiencia]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = btn.getAttribute('data-excluir-audiencia');
        confirmarModal('Excluir essa transcrição de audiência? O PDF também será apagado do Drive. Essa ação não pode ser desfeita.').then(function (ok) {
          if (!ok) return;
          var textoOriginal = btn.textContent;
          btn.textContent = 'Excluindo...';
          btn.disabled = true;
          apiPost('/api/painel?acao=audiencias', { op: 'excluir', id: id })
            .then(function (r) { if (!r.ok) throw new Error('falha'); return r.json(); })
            .then(function () { carregarAudiencias(); })
            .catch(function () {
              btn.textContent = textoOriginal;
              btn.disabled = false;
              mostrarAviso('Não foi possível excluir agora.');
            });
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
        var rotulos = { financeiro: 'Financeiro', pje: 'PJe', clientes: 'Clientes', processos: 'Processos', agenda: 'Tarefas e Agenda', automacoes: 'Automações' };
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
          '<table><thead><tr><th>Nome</th><th>Login</th><th>Nível</th><th></th></tr></thead>' +
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
