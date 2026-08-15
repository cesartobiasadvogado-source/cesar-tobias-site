<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive">
<title>Painel do Escritório</title>
<style>
  :root {
    --bg: #f6f4ef;
    --surface: #ffffff;
    --surface-sunken: #efece4;
    --ink: #1c2438;
    --ink-soft: #5b6178;
    --ink-faint: #8b90a3;
    --line: #e2ded3;
    --brand: #1c2c4f;
    --accent: #a9793a;
    --good: #2f7a4f;
    --good-soft: #e4f1e8;
    --warn: #b8842e;
    --warn-soft: #faf0dc;
    --crit: #b33a3a;
    --crit-soft: #fbe9e9;
    --font-display: 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, 'Times New Roman', serif;
    --font-body: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif;
    --font-mono: 'SF Mono', 'Cascadia Code', 'IBM Plex Mono', ui-monospace, Menlo, Consolas, monospace;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #14182a; --surface: #1c2238; --surface-sunken: #171c2f;
      --ink: #eef0f6; --ink-soft: #a7acc2; --ink-faint: #6d7290; --line: #2b3250;
      --brand: #c7d0ec; --accent: #d3a869;
      --good: #5fbd85; --good-soft: #16261d;
      --warn: #e0ab5a; --warn-soft: #2c2313;
      --crit: #e57b7b; --crit-soft: #2c1717;
    }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--ink); font-family: var(--font-body); -webkit-font-smoothing: antialiased; }
  .page { max-width: 920px; margin: 0 auto; padding: 40px 24px 72px; }

  /* Password gate */
  .gate { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
  .gate-card { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 32px; max-width: 340px; width: 100%; }
  .gate-title { font-family: var(--font-display); font-size: 20px; color: var(--brand); margin: 0 0 4px; }
  .gate-sub { font-size: 13px; color: var(--ink-faint); margin: 0 0 20px; }
  .gate input[type="password"] {
    width: 100%; padding: 11px 12px; border: 1px solid var(--line); border-radius: 8px;
    font-size: 15px; background: var(--bg); color: var(--ink); margin-bottom: 12px;
  }
  .gate input[type="password"]:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
  .gate button {
    width: 100%; padding: 11px; border: none; border-radius: 8px; background: var(--brand);
    color: #fff; font-size: 14.5px; font-weight: 600; cursor: pointer;
  }
  .gate button:hover { opacity: 0.92; }
  .gate-error { color: var(--crit); font-size: 13px; margin-top: 10px; min-height: 16px; }

  header.masthead { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; padding-bottom: 20px; border-bottom: 2px solid var(--brand); margin-bottom: 32px; flex-wrap: wrap; }
  .masthead-name { font-family: var(--font-display); font-size: 28px; font-weight: 600; color: var(--brand); text-wrap: balance; }
  .masthead-name small { display: block; font-family: var(--font-body); font-size: 12.5px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); margin-top: 4px; }
  .masthead-meta { text-align: right; font-size: 13px; color: var(--ink-faint); line-height: 1.5; }
  .masthead-meta strong { color: var(--ink-soft); font-weight: 600; }

  section { margin-bottom: 40px; }
  .section-label { font-size: 12px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-faint); margin: 0 0 14px; }

  .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
  .stat-card { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 20px 20px 18px; }
  .stat-value { font-family: var(--font-mono); font-variant-numeric: tabular-nums; font-size: 30px; font-weight: 600; color: var(--brand); line-height: 1.1; }
  .stat-value.money::before { content: 'R$ '; font-size: 18px; font-weight: 500; color: var(--ink-faint); }
  .stat-label { margin-top: 8px; font-size: 13.5px; color: var(--ink-soft); }
  .stat-sub { margin-top: 2px; font-size: 12px; color: var(--ink-faint); }

  .panel { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
  .panel-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--line); }
  .panel-title { font-size: 15px; font-weight: 600; color: var(--ink); }
  .chip { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 999px; }
  .chip.crit { background: var(--crit-soft); color: var(--crit); }
  .chip.good { background: var(--good-soft); color: var(--good); }
  .chip.warn { background: var(--warn-soft); color: var(--warn); }
  .chip.neutral { background: var(--surface-sunken); color: var(--ink-faint); }

  .funil-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
  .funil-coluna { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; min-height: 90px; }
  .funil-coluna-header { display: flex; align-items: center; justify-content: space-between; font-size: 12px; font-weight: 600; color: var(--ink-soft); padding: 10px 12px; border-bottom: 1px solid var(--line); }
  .funil-count { font-family: var(--font-mono); font-variant-numeric: tabular-nums; background: var(--surface-sunken); color: var(--ink-faint); padding: 1px 7px; border-radius: 999px; font-size: 11.5px; }
  .funil-coluna-body { padding: 8px; display: flex; flex-direction: column; gap: 6px; }
  .lead-card { background: var(--surface-sunken); border-radius: 7px; padding: 8px 10px; }
  .lead-nome { font-size: 12.5px; font-weight: 600; color: var(--ink); margin-bottom: 4px; word-break: break-word; }
  .funil-vazio { padding: 14px 8px; text-align: center; font-size: 12px; color: var(--ink-faint); }
  @media (max-width: 860px) { .funil-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 480px) { .funil-grid { grid-template-columns: 1fr; } }

  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 11.5px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-faint); padding: 10px 20px; border-bottom: 1px solid var(--line); }
  td { padding: 13px 20px; font-size: 14px; border-bottom: 1px solid var(--line); color: var(--ink); }
  tbody tr:last-child td { border-bottom: none; }
  td.num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; text-align: right; }
  .days-badge { font-family: var(--font-mono); font-variant-numeric: tabular-nums; font-size: 12.5px; font-weight: 600; padding: 2px 8px; border-radius: 6px; }
  .days-badge.crit { background: var(--crit-soft); color: var(--crit); }
  .days-badge.warn { background: var(--warn-soft); color: var(--warn); }

  .empty-state { padding: 36px 20px; text-align: center; }
  .empty-state .glyph { font-family: var(--font-display); font-size: 22px; color: var(--good); margin-bottom: 6px; }
  .empty-state .msg { font-size: 13.5px; color: var(--ink-faint); }

  .overview-line { display: flex; gap: 28px; flex-wrap: wrap; padding: 16px 20px; background: var(--surface-sunken); border: 1px solid var(--line); border-radius: 10px; font-size: 13.5px; color: var(--ink-soft); margin-bottom: 14px; }
  .overview-line b { font-family: var(--font-mono); font-variant-numeric: tabular-nums; color: var(--ink); font-weight: 600; }

  footer { margin-top: 48px; padding-top: 20px; border-top: 1px solid var(--line); font-size: 12px; color: var(--ink-faint); display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
  .btn-refresh { background: none; border: 1px solid var(--line); border-radius: 8px; padding: 6px 12px; font-size: 12.5px; color: var(--ink-soft); cursor: pointer; }
  .btn-refresh:hover { background: var(--surface-sunken); }

  .prazo-card { padding: 14px 20px; border-bottom: 1px solid var(--line); }
  .prazo-card:last-child { border-bottom: none; }
  .prazo-card-topo { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .prazo-processo { font-family: var(--font-mono); font-size: 13.5px; font-weight: 600; color: var(--ink); }
  .prazo-meta { font-size: 12px; color: var(--ink-faint); margin-top: 2px; }
  .prazo-orgao { font-size: 12.5px; color: var(--ink-soft); margin-top: 8px; }
  .prazo-resumo { font-size: 13px; color: var(--ink-soft); margin-top: 6px; line-height: 1.5; }

  .admin-form { display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 8px; padding: 16px 20px; border-bottom: 1px solid var(--line); }
  .admin-form input { padding: 9px 10px; border: 1px solid var(--line); border-radius: 7px; font-size: 13.5px; background: var(--bg); color: var(--ink); }
  .admin-form button { padding: 9px 14px; border: none; border-radius: 7px; background: var(--brand); color: #fff; font-size: 13px; font-weight: 600; cursor: pointer; }
  .admin-form button:hover { opacity: 0.92; }
  .admin-msg { padding: 0 20px 12px; font-size: 12.5px; color: var(--ink-faint); }
  .btn-remover { background: none; border: 1px solid var(--crit); color: var(--crit); border-radius: 6px; padding: 3px 9px; font-size: 12px; cursor: pointer; }
  .btn-remover:hover { background: var(--crit-soft); }
  @media (max-width: 640px) { .admin-form { grid-template-columns: 1fr; } }

  .hidden { display: none !important; }
  @media (max-width: 640px) {
    .stat-grid { grid-template-columns: 1fr; }
    .masthead { flex-direction: column; }
    .masthead-meta { text-align: left; }
    th:nth-child(3), td:nth-child(3) { display: none; }
  }
</style>
</head>
<body>

  <div id="gate" class="gate">
    <div class="gate-card">
      <p class="gate-title">Painel do Escritório</p>
      <p class="gate-sub">Acesso restrito. Entre com seu usuário.</p>
      <input type="text" id="usuario-input" placeholder="Usuário" autocomplete="username" style="width:100%;padding:11px 12px;border:1px solid var(--line);border-radius:8px;font-size:15px;background:var(--bg);color:var(--ink);margin-bottom:12px;">
      <input type="password" id="senha-input" placeholder="Senha" autocomplete="current-password">
      <button id="btn-entrar">Entrar</button>
      <div class="gate-error" id="gate-error"></div>
    </div>
  </div>

  <div id="conteudo" class="page hidden"></div>

<script>
(function () {
  var gate = document.getElementById('gate');
  var conteudo = document.getElementById('conteudo');
  var usuarioInput = document.getElementById('usuario-input');
  var senhaInput = document.getElementById('senha-input');
  var btnEntrar = document.getElementById('btn-entrar');
  var gateError = document.getElementById('gate-error');

  function fmtMoeda(v) {
    return (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fmtDataHora(iso) {
    var d = new Date(iso);
    return d.toLocaleString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function renderFunil(crm) {
    if (!crm || !crm.etapas) {
      return '<div class="panel"><div class="empty-state"><div class="msg">Sem dados de leads ainda.</div></div></div>';
    }
    var colunas = crm.etapas.map(function (etapa) {
      var cardsHtml;
      if (etapa.leads.length === 0) {
        cardsHtml = '<div class="funil-vazio">Vazio</div>';
      } else {
        cardsHtml = etapa.leads.map(function (lead) {
          var badgeClasse = lead.dias_na_etapa > 5 ? 'warn' : 'neutral';
          return '<div class="lead-card">' +
            '<div class="lead-nome">' + lead.nome + '</div>' +
            '<span class="days-badge ' + badgeClasse + '" style="background:var(--surface-sunken);color:var(--ink-faint)">' +
            lead.dias_na_etapa + 'd nesta etapa</span></div>';
        }).join('');
      }
      return '<div class="funil-coluna">' +
        '<div class="funil-coluna-header">' + etapa.nome + '<span class="funil-count">' + etapa.quantidade + '</span></div>' +
        '<div class="funil-coluna-body">' + cardsHtml + '</div></div>';
    }).join('');
    return '<div class="funil-grid">' + colunas + '</div>';
  }

  function renderPainel(dados) {
    var f = dados.financeiro;
    var p = dados.pje;

    var htmlVencidas;
    if (f.parcelas_vencidas.length === 0) {
      htmlVencidas =
        '<div class="empty-state"><div class="glyph">✓</div>' +
        '<div class="msg">Nenhuma parcela em atraso agora. Tudo em dia.</div></div>';
    } else {
      var linhas = f.parcelas_vencidas.map(function (item) {
        var classe = item.dias_atraso > 15 ? 'crit' : 'warn';
        return '<tr><td>' + item.nome + '</td>' +
          '<td class="num">R$ ' + fmtMoeda(item.saldo) + '</td>' +
          '<td>' + item.vencimento + '</td>' +
          '<td class="num"><span class="days-badge ' + classe + '">' + item.dias_atraso + ' dias</span></td></tr>';
      }).join('');
      htmlVencidas =
        '<table><thead><tr><th>Cliente</th><th style="text-align:right">Saldo</th><th>Vencimento</th><th style="text-align:right">Atraso</th></tr></thead>' +
        '<tbody>' + linhas + '</tbody></table>';
    }

    var chipVencidas = f.parcelas_vencidas.length === 0
      ? '<span class="chip good">Nenhuma vencida</span>'
      : '<span class="chip crit">' + f.parcelas_vencidas.length + ' vencida(s)</span>';

    var htmlPrazos;
    if (p.prazos_semana.length === 0) {
      htmlPrazos =
        '<div class="empty-state"><div class="glyph">—</div>' +
        '<div class="msg">Nenhum prazo com vencimento nos próximos 14 dias.</div></div>';
    } else {
      htmlPrazos = p.prazos_semana.map(function (item) {
        var linkHtml = item.link
          ? '<a href="' + item.link + '" target="_blank" rel="noopener" style="color:var(--accent);font-size:12.5px;">Ver comunicação original</a>'
          : '';
        return '<div class="prazo-card">' +
          '<div class="prazo-card-topo">' +
            '<div><div class="prazo-processo">' + item.processo + '</div>' +
            '<div class="prazo-meta">' + item.tribunal + (item.tipo ? ' · ' + item.tipo : '') + '</div></div>' +
            '<span class="days-badge warn">' + item.data_limite + '</span>' +
          '</div>' +
          (item.orgao ? '<div class="prazo-orgao">' + item.orgao + '</div>' : '') +
          (item.resumo ? '<div class="prazo-resumo">' + item.resumo + '</div>' : '') +
          (linkHtml ? '<div style="margin-top:6px;">' + linkHtml + '</div>' : '') +
        '</div>';
      }).join('');
    }

    var chipPrazos = p.prazos_semana.length === 0
      ? '<span class="chip neutral">Sem prazos</span>'
      : '<span class="chip warn">' + p.prazos_semana.length + ' prazo(s)</span>';

    conteudo.innerHTML =
      '<header class="masthead">' +
        '<div class="masthead-name">César Tobias Advocacia<small>Painel do escritório</small></div>' +
        '<div class="masthead-meta">Logado como <strong>' + (dados.usuario_logado || '') + '</strong><br>' +
        'Gerado em <strong>' + fmtDataHora(dados.gerado_em) + '</strong> · Fuso America/Fortaleza</div>' +
      '</header>' +
      '<section><p class="section-label">Visão geral</p><div class="stat-grid">' +
        '<div class="stat-card"><div class="stat-value">' + f.contratos_ativos + '</div><div class="stat-label">Contratos ativos</div><div class="stat-sub">em andamento neste momento</div></div>' +
        '<div class="stat-card"><div class="stat-value money">' + fmtMoeda(f.total_a_receber) + '</div><div class="stat-label">A receber</div><div class="stat-sub">saldo de honorários em aberto</div></div>' +
        '<div class="stat-card"><div class="stat-value">' + f.clientes_novos_mes + '</div><div class="stat-label">Cliente(s) novo(s)</div><div class="stat-sub">contrato iniciado este mês</div></div>' +
      '</div></section>' +
      '<section><p class="section-label">Financeiro — parcelas vencidas</p><div class="panel">' +
        '<div class="panel-header"><span class="panel-title">Cobrança pendente</span>' + chipVencidas + '</div>' +
        htmlVencidas +
      '</div></section>' +
      '<section><p class="section-label">Processual — PJe</p>' +
      '<div class="overview-line"><span><b>' + p.comunicacoes_semana + '</b> comunicações novas nos últimos 7 dias</span>' +
      '<span><b>' + p.prazos_semana.length + '</b> prazo(s) nos próximos 7 dias</span></div>' +
      '<div class="panel"><div class="panel-header"><span class="panel-title">Prazos da semana</span>' + chipPrazos + '</div>' +
        htmlPrazos +
      '</div></section>' +
      '<section><p class="section-label">Funil de leads</p>' + renderFunil(dados.crm) + '</section>' +
      (dados.usuario_admin ?
        '<section><p class="section-label">Administração — usuários</p>' +
        '<div class="panel">' +
          '<div class="admin-form">' +
            '<input type="text" id="admin-nome" placeholder="Nome">' +
            '<input type="text" id="admin-login" placeholder="Login" autocomplete="off">' +
            '<input type="password" id="admin-senha" placeholder="Senha" autocomplete="new-password">' +
            '<button id="admin-btn-criar">Adicionar</button>' +
          '</div>' +
          '<div class="admin-msg" id="admin-msg"></div>' +
          '<div id="admin-lista-usuarios"></div>' +
        '</div></section>'
        : '') +
      '<footer><span>Dados de Contratos, Controle de Parcelas, Comunicações PJe e Funil de leads</span>' +
      '<button class="btn-refresh" id="btn-atualizar">Atualizar agora</button></footer>';

    document.getElementById('btn-atualizar').addEventListener('click', function () {
      carregarDados(sessionStorage.getItem('painel_token'));
    });

    if (dados.usuario_admin) {
      carregarListaUsuarios();
      document.getElementById('admin-btn-criar').addEventListener('click', criarUsuarioAdmin);
    }
  }

  function carregarDados(token) {
    gateError.textContent = '';
    fetch('/api/painel?acao=dados&token=' + encodeURIComponent(token), { cache: 'no-store' })
      .then(function (r) {
        if (r.status === 401) throw new Error('sessao');
        if (!r.ok) throw new Error('falha');
        return r.json();
      })
      .then(function (dados) {
        gate.classList.add('hidden');
        conteudo.classList.remove('hidden');
        renderPainel(dados);
      })
      .catch(function (e) {
        sessionStorage.removeItem('painel_token');
        gate.classList.remove('hidden');
        conteudo.classList.add('hidden');
        gateError.textContent = e.message === 'sessao'
          ? 'Sua sessão expirou. Entre novamente.'
          : 'Não foi possível carregar os dados agora.';
      });
  }

  function carregarListaUsuarios() {
    var token = sessionStorage.getItem('painel_token');
    fetch('/api/painel?acao=usuarios_listar&token=' + encodeURIComponent(token), { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (dados) {
        var container = document.getElementById('admin-lista-usuarios');
        if (!container || !dados.usuarios) return;
        if (dados.usuarios.length === 0) {
          container.innerHTML = '<div class="empty-state"><div class="msg">Nenhum usuario cadastrado.</div></div>';
          return;
        }
        var linhas = dados.usuarios.map(function (u) {
          return '<tr><td>' + u.nome + '</td><td>' + u.usuario + '</td>' +
            '<td>' + (u.admin ? '<span class="chip good">Admin</span>' : '<span class="chip neutral">Padrão</span>') + '</td>' +
            '<td style="text-align:right"><button class="btn-remover" data-login="' + u.usuario + '">Remover</button></td></tr>';
        }).join('');
        container.innerHTML =
          '<table><thead><tr><th>Nome</th><th>Login</th><th>Nível</th><th></th></tr></thead>' +
          '<tbody>' + linhas + '</tbody></table>';
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
    var msg = document.getElementById('admin-msg');
    var token = sessionStorage.getItem('painel_token');
    msg.textContent = '';

    fetch(
      '/api/painel?acao=usuarios_criar&token=' + encodeURIComponent(token) +
      '&nome=' + encodeURIComponent(nome) + '&login=' + encodeURIComponent(login) +
      '&senha=' + encodeURIComponent(senha),
      { cache: 'no-store' }
    )
      .then(function (r) { return r.json().then(function (c) { return { status: r.status, corpo: c }; }); })
      .then(function (resultado) {
        if (resultado.status !== 200) {
          msg.textContent = resultado.corpo.erro || 'Erro ao criar usuario.';
          return;
        }
        document.getElementById('admin-nome').value = '';
        document.getElementById('admin-login').value = '';
        document.getElementById('admin-senha').value = '';
        msg.textContent = 'Usuário adicionado com sucesso.';
        carregarListaUsuarios();
      });
  }

  function removerUsuarioAdmin(login) {
    var msg = document.getElementById('admin-msg');
    var token = sessionStorage.getItem('painel_token');
    fetch('/api/painel?acao=usuarios_remover&token=' + encodeURIComponent(token) +
      '&login=' + encodeURIComponent(login), { cache: 'no-store' })
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
    fetch(
      '/api/painel?acao=login&usuario=' + encodeURIComponent(usuario) +
      '&senha=' + encodeURIComponent(senha),
      { cache: 'no-store' }
    )
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
        carregarDados(resultado.corpo.token);
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

  var tokenSalvo = sessionStorage.getItem('painel_token');
  if (tokenSalvo) carregarDados(tokenSalvo);
})();
</script>
</body>
</html>
