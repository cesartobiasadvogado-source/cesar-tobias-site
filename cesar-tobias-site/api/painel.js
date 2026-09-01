function obterIp(req) {
  const encaminhado = req.headers['x-forwarded-for'];
  if (encaminhado) return encaminhado.split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || 'desconhecido';
}

function obterToken(req) {
  const auth = req.headers['authorization'] || '';
  if (auth.indexOf('Bearer ') === 0) return auth.slice(7).trim();
  return (req.query && req.query.token) || '';
}

module.exports = async (req, res) => {
  const segredoLambda = process.env.DASHBOARD_SECRET;
  if (!segredoLambda) {
    res.status(500).json({ erro: 'Configuracao ausente no servidor.' });
    return;
  }

  const base = 'https://63quf5pqd4t5hgjuvi67r3juzq0mawnb.lambda-url.us-east-1.on.aws/';
  const segredoQS = '&secret=' + encodeURIComponent(segredoLambda);
  const ip = obterIp(req);
  const acao = (req.query && req.query.acao) || 'dados';
  const corpo = (req.body && typeof req.body === 'object') ? req.body : {};

  if (acao === 'login') {
    if (req.method !== 'POST') {
      res.status(405).json({ erro: 'Metodo nao permitido.' });
      return;
    }
    const usuario = corpo.usuario || '';
    const senha = corpo.senha || '';

    try {
      const resposta = await fetch(
        base + '?action=painel_login' +
        '&usuario=' + encodeURIComponent(usuario) +
        '&senha=' + encodeURIComponent(senha) +
        '&ip=' + encodeURIComponent(ip) + segredoQS
      );
      const dados = await resposta.json();
      res.status(resposta.status).json(dados);
    } catch (e) {
      res.status(502).json({ erro: 'Erro de conexao ao autenticar.' });
    }
    return;
  }

  if (acao === 'criar_tenant') {
    if (req.method !== 'POST') {
      res.status(405).json({ erro: 'Metodo nao permitido.' });
      return;
    }
    try {
      const resposta = await fetch(base + '?action=criar_tenant' + segredoQS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome_advogado: corpo.nome_advogado, oab_numero: corpo.oab_numero,
          oab_uf: corpo.oab_uf, nome_escritorio: corpo.nome_escritorio,
          cpf: corpo.cpf, rg: corpo.rg, cidade_escritorio: corpo.cidade_escritorio,
        })
      });
      const dados = await resposta.json();
      res.status(resposta.status).json(dados);
    } catch (e) {
      res.status(502).json({ erro: 'Erro de conexao ao criar cadastro.' });
    }
    return;
  }

  if (acao === 'tenant_status') {
    const tenantIdStatus = (req.query && req.query.tenant_id) || '';
    try {
      const resposta = await fetch(
        base + '?action=tenant_status&tenant_id=' + encodeURIComponent(tenantIdStatus) + segredoQS
      );
      const dados = await resposta.json();
      res.status(resposta.status).json(dados);
    } catch (e) {
      res.status(502).json({ erro: 'Erro de conexao ao checar o status do cadastro.' });
    }
    return;
  }

  if (acao === 'whatsapp_status') {
    // Exige sessao autenticada (painel ja logado) -- usa o token da sessao (Authorization:
    // Bearer), nunca tenant_id cru (a OAB do advogado e informacao publica, ver correcao de
    // seguranca no handle_whatsapp_conectar_status da Lambda).
    const tokenSessaoWa = obterToken(req);
    if (!tokenSessaoWa) {
      res.status(401).json({ erro: 'Sessao ausente. Faca login novamente.' });
      return;
    }
    try {
      const resposta = await fetch(
        base + '?action=whatsapp_conectar_status&token=' + encodeURIComponent(tokenSessaoWa) + segredoQS
      );
      const dados = await resposta.json();
      res.status(resposta.status).json(dados);
    } catch (e) {
      res.status(502).json({ erro: 'Erro de conexao ao checar o WhatsApp.' });
    }
    return;
  }

  if (acao === 'asaas_conectar') {
    if (req.method !== 'POST') {
      res.status(405).json({ erro: 'Metodo nao permitido.' });
      return;
    }
    // Exige sessao autenticada -- ver correcao de seguranca no handle_asaas_conectar da Lambda:
    // antes, tenant_id sozinho bastava, e como e a OAB do advogado (informacao publica),
    // qualquer pessoa conseguiria trocar a chave Asaas de qualquer escritorio.
    const tokenSessaoAsaas = obterToken(req);
    if (!tokenSessaoAsaas) {
      res.status(401).json({ erro: 'Sessao ausente. Faca login novamente.' });
      return;
    }
    try {
      const resposta = await fetch(base + '?action=asaas_conectar' + segredoQS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenSessaoAsaas, api_key: corpo.api_key })
      });
      const dados = await resposta.json();
      res.status(resposta.status).json(dados);
    } catch (e) {
      res.status(502).json({ erro: 'Erro de conexao ao conectar a Asaas.' });
    }
    return;
  }

  if (acao === 'upload_logo_tenant') {
    if (req.method !== 'POST') {
      res.status(405).json({ erro: 'Metodo nao permitido.' });
      return;
    }
    // Mesma correcao de seguranca: exige sessao autenticada, nao aceita mais tenant_id cru.
    const tokenSessaoLogo = obterToken(req);
    if (!tokenSessaoLogo) {
      res.status(401).json({ erro: 'Sessao ausente. Faca login novamente.' });
      return;
    }
    try {
      const resposta = await fetch(base + '?action=upload_logo_tenant' + segredoQS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenSessaoLogo, logo_base64: corpo.logo_base64 })
      });
      const dados = await resposta.json();
      res.status(resposta.status).json(dados);
    } catch (e) {
      res.status(502).json({ erro: 'Erro de conexao ao enviar o papel timbrado.' });
    }
    return;
  }

  if (acao === 'atualizar_tenant') {
    if (req.method !== 'POST') {
      res.status(405).json({ erro: 'Metodo nao permitido.' });
      return;
    }
    try {
      const resposta = await fetch(base + '?action=atualizar_tenant' + segredoQS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: corpo.tenant_id, nome_advogado: corpo.nome_advogado, nome_escritorio: corpo.nome_escritorio,
          cpf: corpo.cpf, rg: corpo.rg, cidade_escritorio: corpo.cidade_escritorio,
        })
      });
      const dados = await resposta.json();
      res.status(resposta.status).json(dados);
    } catch (e) {
      res.status(502).json({ erro: 'Erro de conexao ao atualizar seus dados.' });
    }
    return;
  }

  if (acao === 'criar_usuario_tenant') {
    if (req.method !== 'POST') {
      res.status(405).json({ erro: 'Metodo nao permitido.' });
      return;
    }
    try {
      const resposta = await fetch(base + '?action=painel_criar_usuario_tenant' + segredoQS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: corpo.tenant_id, nome: corpo.nome, usuario: corpo.usuario, senha: corpo.senha,
        })
      });
      const dados = await resposta.json();
      res.status(resposta.status).json(dados);
    } catch (e) {
      res.status(502).json({ erro: 'Erro de conexao ao criar seu login.' });
    }
    return;
  }

  if (acao === 'login_tenant') {
    if (req.method !== 'POST') {
      res.status(405).json({ erro: 'Metodo nao permitido.' });
      return;
    }
    try {
      const resposta = await fetch(base + '?action=painel_login_tenant' + segredoQS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: corpo.tenant_id, usuario: corpo.usuario, senha: corpo.senha })
      });
      const dados = await resposta.json();
      res.status(resposta.status).json(dados);
    } catch (e) {
      res.status(502).json({ erro: 'Erro de conexao ao entrar.' });
    }
    return;
  }

  const tokenSessao = obterToken(req);
  if (!tokenSessao) {
    res.status(401).json({ erro: 'Sessao ausente.' });
    return;
  }

  if (acao === 'usuarios_listar' || acao === 'usuarios_criar' || acao === 'usuarios_remover') {
    const op = acao === 'usuarios_listar' ? 'listar' : acao === 'usuarios_criar' ? 'criar' : 'remover';
    if (op !== 'listar' && req.method !== 'POST') {
      res.status(405).json({ erro: 'Metodo nao permitido.' });
      return;
    }
    let url = base + '?action=painel_admin&op=' + op + '&token=' + encodeURIComponent(tokenSessao) + segredoQS;

    if (op === 'criar') {
      url += '&nome=' + encodeURIComponent(corpo.nome || '') +
             '&login=' + encodeURIComponent(corpo.login || '') +
             '&senha=' + encodeURIComponent(corpo.senha || '') +
             '&admin=' + encodeURIComponent(corpo.admin || 'false') +
             '&permissoes=' + encodeURIComponent(corpo.permissoes || '');
    }
    if (op === 'remover') {
      url += '&login=' + encodeURIComponent(corpo.login || '');
    }

    try {
      const resposta = await fetch(url);
      const dados = await resposta.json();
      res.status(resposta.status).json(dados);
    } catch (e) {
      res.status(502).json({ erro: 'Erro de conexao ao gerenciar usuarios.' });
    }
    return;
  }

  if (acao === 'executar') {
    if (req.method !== 'POST') {
      res.status(405).json({ erro: 'Metodo nao permitido.' });
      return;
    }
    var url2 = base + '?action=painel_acao&token=' + encodeURIComponent(tokenSessao) + segredoQS;
    var camposPermitidos = ['tipo', 'nome', 'tipo_servico', 'descricao', 'endereco', 'etapa', 'origem', 'midia', 'campanha', 'resposta', 'valor', 'vencimento', 'entrada', 'parcelas', 'data_entrada', 'dia_vencimento', 'percentual_honorarios', 'percentual_recursal', 'campos_extra', 'linha_contrato', 'numero_parcela', 'prazo_dias', 'clausula_honorarios', 'descricao_debito', 'pdf_id', 'email', 'whatsapp', 'valor_total', 'valor_entrada', 'forma_pagamento', 'num_parcelas', 'data_inicio', 'data_primeira_parcela', 'mes', 'percentual_exito', 'valor_recebido_cliente', 'status', 'tipo_contrato', 'processo_numero', 'periodicidade'];
    camposPermitidos.forEach(function (campo) {
      if (corpo[campo]) {
        url2 += '&' + campo + '=' + encodeURIComponent(corpo[campo]);
      }
    });

    try {
      const resposta = await fetch(url2);
      const dados = await resposta.json();
      res.status(resposta.status).json(dados);
    } catch (e) {
      res.status(502).json({ erro: 'Erro de conexao ao executar a ação.' });
    }
    return;
  }

  if (acao === 'usuarios_nomes') {
    try {
      const resposta = await fetch(base + '?action=usuarios_nomes&token=' + encodeURIComponent(tokenSessao) + segredoQS);
      const dados = await resposta.json();
      res.status(resposta.status).json(dados);
    } catch (e) {
      res.status(502).json({ erro: 'Erro de conexao ao listar os usuarios.' });
    }
    return;
  }

  if (acao === 'tarefa_listar') {
    var qsTarefa = '';
    ['responsavel', 'status', 'prioridade', 'vencimento_de', 'vencimento_ate'].forEach(function (campo) {
      if (req.query && req.query[campo]) qsTarefa += '&' + campo + '=' + encodeURIComponent(req.query[campo]);
    });
    try {
      const resposta = await fetch(base + '?action=tarefa_listar' + qsTarefa + '&token=' + encodeURIComponent(tokenSessao) + segredoQS);
      const dados = await resposta.json();
      res.status(resposta.status).json(dados);
    } catch (e) {
      res.status(502).json({ erro: 'Erro de conexao ao listar as tarefas.' });
    }
    return;
  }

  var acoesTarefaPost = {
    tarefa_criar: 'Erro de conexao ao salvar a tarefa.',
    tarefa_atualizar: 'Erro de conexao ao atualizar a tarefa.',
    tarefa_excluir: 'Erro de conexao ao excluir a tarefa.',
  };
  if (acoesTarefaPost[acao]) {
    if (req.method !== 'POST') {
      res.status(405).json({ erro: 'Metodo nao permitido.' });
      return;
    }
    try {
      const resposta = await fetch(
        base + '?action=' + acao + '&token=' + encodeURIComponent(tokenSessao) + segredoQS,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }
      );
      const dados = await resposta.json();
      res.status(resposta.status).json(dados);
    } catch (e) {
      res.status(502).json({ erro: acoesTarefaPost[acao] });
    }
    return;
  }

  if (acao === 'compromisso_listar') {
    var qsCompromisso = '';
    ['data_de', 'data_ate', 'tipo', 'responsavel', 'vinculo'].forEach(function (campo) {
      if (req.query && req.query[campo]) qsCompromisso += '&' + campo + '=' + encodeURIComponent(req.query[campo]);
    });
    try {
      const resposta = await fetch(base + '?action=compromisso_listar' + qsCompromisso + '&token=' + encodeURIComponent(tokenSessao) + segredoQS);
      const dados = await resposta.json();
      res.status(resposta.status).json(dados);
    } catch (e) {
      res.status(502).json({ erro: 'Erro de conexao ao listar a agenda.' });
    }
    return;
  }

  var acoesCompromissoPost = {
    compromisso_criar: 'Erro de conexao ao salvar o compromisso.',
    compromisso_atualizar: 'Erro de conexao ao atualizar o compromisso.',
    compromisso_excluir: 'Erro de conexao ao excluir o compromisso.',
  };
  if (acoesCompromissoPost[acao]) {
    if (req.method !== 'POST') {
      res.status(405).json({ erro: 'Metodo nao permitido.' });
      return;
    }
    try {
      const resposta = await fetch(
        base + '?action=' + acao + '&token=' + encodeURIComponent(tokenSessao) + segredoQS,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }
      );
      const dados = await resposta.json();
      res.status(resposta.status).json(dados);
    } catch (e) {
      res.status(502).json({ erro: acoesCompromissoPost[acao] });
    }
    return;
  }

  if (acao === 'processos') {
    var opProcessos = (req.query && req.query.op) || corpo.op || '';
    if (opProcessos !== 'listar' && req.method !== 'POST') {
      res.status(405).json({ erro: 'Metodo nao permitido.' });
      return;
    }
    var url4 = base + '?action=painel_processos&op=' + encodeURIComponent(opProcessos) + '&token=' + encodeURIComponent(tokenSessao) + segredoQS;
    var camposProcessos = ['processo', 'cliente', 'proxima_audiencia', 'observacoes'];
    var origemProcessos = opProcessos === 'listar' ? (req.query || {}) : corpo;
    camposProcessos.forEach(function (campo) {
      if (origemProcessos[campo] !== undefined) {
        url4 += '&' + campo + '=' + encodeURIComponent(origemProcessos[campo]);
      }
    });

    try {
      const resposta = await fetch(url4);
      const dados = await resposta.json();
      res.status(resposta.status).json(dados);
    } catch (e) {
      res.status(502).json({ erro: 'Erro de conexao ao buscar processos.' });
    }
    return;
  }

  if (acao === 'processo_manual_listar') {
    var tokenSessaoProcManual = obterToken(req);
    if (!tokenSessaoProcManual) {
      res.status(401).json({ erro: 'Sessao ausente. Faca login novamente.' });
      return;
    }
    try {
      const resposta = await fetch(
        base + '?action=processo_manual_listar&token=' + encodeURIComponent(tokenSessaoProcManual) + segredoQS
      );
      const dados = await resposta.json();
      res.status(resposta.status).json(dados);
    } catch (e) {
      res.status(502).json({ erro: 'Erro de conexao ao listar processos.' });
    }
    return;
  }

  if (acao === 'processo_manual_buscar_oab') {
    var tokenSessaoBuscaOab = obterToken(req);
    if (!tokenSessaoBuscaOab) {
      res.status(401).json({ erro: 'Sessao ausente. Faca login novamente.' });
      return;
    }
    var numeroOabBusca = (req.query && req.query.numero_oab) || '';
    var ufOabBusca = (req.query && req.query.uf_oab) || '';
    try {
      const resposta = await fetch(
        base + '?action=processo_manual_buscar_oab&numero_oab=' + encodeURIComponent(numeroOabBusca) +
        '&uf_oab=' + encodeURIComponent(ufOabBusca) + '&token=' + encodeURIComponent(tokenSessaoBuscaOab) + segredoQS
      );
      const dados = await resposta.json();
      res.status(resposta.status).json(dados);
    } catch (e) {
      res.status(502).json({ erro: 'Erro de conexao ao buscar pela OAB.' });
    }
    return;
  }

  if (acao === 'ato_processual_listar') {
    var tokenSessaoAtosListar = obterToken(req);
    if (!tokenSessaoAtosListar) {
      res.status(401).json({ erro: 'Sessao ausente. Faca login novamente.' });
      return;
    }
    var processoIdAtos = (req.query && req.query.processo_id) || '';
    try {
      const resposta = await fetch(
        base + '?action=ato_processual_listar&processo_id=' + encodeURIComponent(processoIdAtos) +
        '&token=' + encodeURIComponent(tokenSessaoAtosListar) + segredoQS
      );
      const dados = await resposta.json();
      res.status(resposta.status).json(dados);
    } catch (e) {
      res.status(502).json({ erro: 'Erro de conexao ao listar os atos processuais.' });
    }
    return;
  }

  if (acao === 'ato_processual_criar') {
    if (req.method !== 'POST') {
      res.status(405).json({ erro: 'Metodo nao permitido.' });
      return;
    }
    var tokenSessaoAtosCriar = obterToken(req);
    if (!tokenSessaoAtosCriar) {
      res.status(401).json({ erro: 'Sessao ausente. Faca login novamente.' });
      return;
    }
    try {
      const resposta = await fetch(
        base + '?action=ato_processual_criar&token=' + encodeURIComponent(tokenSessaoAtosCriar) + segredoQS,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }
      );
      const dados = await resposta.json();
      res.status(resposta.status).json(dados);
    } catch (e) {
      res.status(502).json({ erro: 'Erro de conexao ao registrar o ato processual.' });
    }
    return;
  }

  if (acao === 'ato_processual_excluir') {
    if (req.method !== 'POST') {
      res.status(405).json({ erro: 'Metodo nao permitido.' });
      return;
    }
    var tokenSessaoAtosExcluir = obterToken(req);
    if (!tokenSessaoAtosExcluir) {
      res.status(401).json({ erro: 'Sessao ausente. Faca login novamente.' });
      return;
    }
    try {
      const resposta = await fetch(
        base + '?action=ato_processual_excluir&token=' + encodeURIComponent(tokenSessaoAtosExcluir) + segredoQS,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }
      );
      const dados = await resposta.json();
      res.status(resposta.status).json(dados);
    } catch (e) {
      res.status(502).json({ erro: 'Erro de conexao ao excluir o ato processual.' });
    }
    return;
  }

  if (acao === 'prazo_listar') {
    var tokenSessaoPrazoListar = obterToken(req);
    if (!tokenSessaoPrazoListar) {
      res.status(401).json({ erro: 'Sessao ausente. Faca login novamente.' });
      return;
    }
    var qsPrazo = '';
    ['processo_id', 'status', 'tipo'].forEach(function (campo) {
      if (req.query && req.query[campo]) qsPrazo += '&' + campo + '=' + encodeURIComponent(req.query[campo]);
    });
    try {
      const resposta = await fetch(
        base + '?action=prazo_listar' + qsPrazo + '&token=' + encodeURIComponent(tokenSessaoPrazoListar) + segredoQS
      );
      const dados = await resposta.json();
      res.status(resposta.status).json(dados);
    } catch (e) {
      res.status(502).json({ erro: 'Erro de conexao ao listar os prazos.' });
    }
    return;
  }

  var acoesPrazoPost = {
    prazo_criar: 'Erro de conexao ao salvar o prazo.',
    prazo_atualizar: 'Erro de conexao ao atualizar o prazo.',
    prazo_excluir: 'Erro de conexao ao excluir o prazo.',
  };
  if (acoesPrazoPost[acao]) {
    if (req.method !== 'POST') {
      res.status(405).json({ erro: 'Metodo nao permitido.' });
      return;
    }
    var tokenSessaoPrazoPost = obterToken(req);
    if (!tokenSessaoPrazoPost) {
      res.status(401).json({ erro: 'Sessao ausente. Faca login novamente.' });
      return;
    }
    try {
      const resposta = await fetch(
        base + '?action=' + acao + '&token=' + encodeURIComponent(tokenSessaoPrazoPost) + segredoQS,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }
      );
      const dados = await resposta.json();
      res.status(resposta.status).json(dados);
    } catch (e) {
      res.status(502).json({ erro: acoesPrazoPost[acao] });
    }
    return;
  }

  if (acao === 'documento_processo_listar') {
    var tokenSessaoDocListar = obterToken(req);
    if (!tokenSessaoDocListar) {
      res.status(401).json({ erro: 'Sessao ausente. Faca login novamente.' });
      return;
    }
    var processoIdDoc = (req.query && req.query.processo_id) || '';
    try {
      const resposta = await fetch(
        base + '?action=documento_processo_listar&processo_id=' + encodeURIComponent(processoIdDoc) +
        '&token=' + encodeURIComponent(tokenSessaoDocListar) + segredoQS
      );
      const dados = await resposta.json();
      res.status(resposta.status).json(dados);
    } catch (e) {
      res.status(502).json({ erro: 'Erro de conexao ao listar os documentos.' });
    }
    return;
  }

  if (acao === 'processo_financeiro_resumo') {
    var tokenSessaoFinResumo = obterToken(req);
    if (!tokenSessaoFinResumo) {
      res.status(401).json({ erro: 'Sessao ausente. Faca login novamente.' });
      return;
    }
    var clienteNomeFinResumo = (req.query && req.query.cliente_nome) || '';
    try {
      const resposta = await fetch(
        base + '?action=processo_financeiro_resumo&cliente_nome=' + encodeURIComponent(clienteNomeFinResumo) +
        '&token=' + encodeURIComponent(tokenSessaoFinResumo) + segredoQS
      );
      const dados = await resposta.json();
      res.status(resposta.status).json(dados);
    } catch (e) {
      res.status(502).json({ erro: 'Erro de conexao ao carregar o financeiro do processo.' });
    }
    return;
  }

  var acoesDocumentoPost = {
    documento_processo_upload_iniciar: 'Erro de conexao ao iniciar o envio.',
    documento_processo_upload_chunk: 'Erro de conexao ao enviar o pedaco do arquivo.',
    documento_processo_upload_finalizar: 'Erro de conexao ao concluir o envio.',
    documento_processo_excluir: 'Erro de conexao ao excluir o documento.',
  };
  if (acoesDocumentoPost[acao]) {
    if (req.method !== 'POST') {
      res.status(405).json({ erro: 'Metodo nao permitido.' });
      return;
    }
    var tokenSessaoDoc = obterToken(req);
    if (!tokenSessaoDoc) {
      res.status(401).json({ erro: 'Sessao ausente. Faca login novamente.' });
      return;
    }
    try {
      const resposta = await fetch(
        base + '?action=' + acao + '&token=' + encodeURIComponent(tokenSessaoDoc) + segredoQS,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }
      );
      const dados = await resposta.json();
      res.status(resposta.status).json(dados);
    } catch (e) {
      res.status(502).json({ erro: acoesDocumentoPost[acao] });
    }
    return;
  }

  if (acao === 'processo_manual_criar') {
    if (req.method !== 'POST') {
      res.status(405).json({ erro: 'Metodo nao permitido.' });
      return;
    }
    var tokenSessaoProcCriar = obterToken(req);
    if (!tokenSessaoProcCriar) {
      res.status(401).json({ erro: 'Sessao ausente. Faca login novamente.' });
      return;
    }
    try {
      const resposta = await fetch(
        base + '?action=processo_manual_criar&token=' + encodeURIComponent(tokenSessaoProcCriar) + segredoQS,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }
      );
      const dados = await resposta.json();
      res.status(resposta.status).json(dados);
    } catch (e) {
      res.status(502).json({ erro: 'Erro de conexao ao salvar o processo.' });
    }
    return;
  }

  if (acao === 'processo_manual_atualizar') {
    if (req.method !== 'POST') {
      res.status(405).json({ erro: 'Metodo nao permitido.' });
      return;
    }
    var tokenSessaoProcAtualizar = obterToken(req);
    if (!tokenSessaoProcAtualizar) {
      res.status(401).json({ erro: 'Sessao ausente. Faca login novamente.' });
      return;
    }
    try {
      const resposta = await fetch(
        base + '?action=processo_manual_atualizar&token=' + encodeURIComponent(tokenSessaoProcAtualizar) + segredoQS,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }
      );
      const dados = await resposta.json();
      res.status(resposta.status).json(dados);
    } catch (e) {
      res.status(502).json({ erro: 'Erro de conexao ao salvar as alteracoes.' });
    }
    return;
  }

  if (acao === 'processo_manual_status') {
    if (req.method !== 'POST') {
      res.status(405).json({ erro: 'Metodo nao permitido.' });
      return;
    }
    var tokenSessaoProcStatus = obterToken(req);
    if (!tokenSessaoProcStatus) {
      res.status(401).json({ erro: 'Sessao ausente. Faca login novamente.' });
      return;
    }
    try {
      const resposta = await fetch(
        base + '?action=processo_manual_status&token=' + encodeURIComponent(tokenSessaoProcStatus) + segredoQS,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }
      );
      const dados = await resposta.json();
      res.status(resposta.status).json(dados);
    } catch (e) {
      res.status(502).json({ erro: 'Erro de conexao ao atualizar o status.' });
    }
    return;
  }

  if (acao === 'processo_datajud_sincronizar') {
    if (req.method !== 'POST') {
      res.status(405).json({ erro: 'Metodo nao permitido.' });
      return;
    }
    var tokenSessaoDatajudSync = obterToken(req);
    if (!tokenSessaoDatajudSync) {
      res.status(401).json({ erro: 'Sessao ausente. Faca login novamente.' });
      return;
    }
    try {
      const resposta = await fetch(
        base + '?action=processo_datajud_sincronizar&token=' + encodeURIComponent(tokenSessaoDatajudSync) + segredoQS,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }
      );
      const dados = await resposta.json();
      res.status(resposta.status).json(dados);
    } catch (e) {
      res.status(502).json({ erro: 'Erro de conexao ao sincronizar o processo.' });
    }
    return;
  }

  if (acao === 'cliente_cadastro_listar') {
    var tokenSessaoClienteListar = obterToken(req);
    if (!tokenSessaoClienteListar) {
      res.status(401).json({ erro: 'Sessao ausente. Faca login novamente.' });
      return;
    }
    try {
      const resposta = await fetch(
        base + '?action=cliente_cadastro_listar&token=' + encodeURIComponent(tokenSessaoClienteListar) + segredoQS
      );
      const dados = await resposta.json();
      res.status(resposta.status).json(dados);
    } catch (e) {
      res.status(502).json({ erro: 'Erro de conexao ao listar os clientes.' });
    }
    return;
  }

  if (acao === 'cliente_cadastro_obter') {
    var tokenSessaoClienteObter = obterToken(req);
    if (!tokenSessaoClienteObter) {
      res.status(401).json({ erro: 'Sessao ausente. Faca login novamente.' });
      return;
    }
    var idClienteObter = (req.query && req.query.id) || '';
    try {
      const resposta = await fetch(
        base + '?action=cliente_cadastro_obter&id=' + encodeURIComponent(idClienteObter) +
        '&token=' + encodeURIComponent(tokenSessaoClienteObter) + segredoQS
      );
      const dados = await resposta.json();
      res.status(resposta.status).json(dados);
    } catch (e) {
      res.status(502).json({ erro: 'Erro de conexao ao carregar o cliente.' });
    }
    return;
  }

  if (acao === 'etiqueta_listar') {
    var tokenSessaoEtiquetaListar = obterToken(req);
    if (!tokenSessaoEtiquetaListar) {
      res.status(401).json({ erro: 'Sessao ausente. Faca login novamente.' });
      return;
    }
    try {
      const resposta = await fetch(
        base + '?action=etiqueta_listar&token=' + encodeURIComponent(tokenSessaoEtiquetaListar) + segredoQS
      );
      const dados = await resposta.json();
      res.status(resposta.status).json(dados);
    } catch (e) {
      res.status(502).json({ erro: 'Erro de conexao ao listar as etiquetas.' });
    }
    return;
  }

  if (acao === 'cliente_foto_obter') {
    var tokenSessaoFotoObter = obterToken(req);
    if (!tokenSessaoFotoObter) {
      res.status(401).json({ erro: 'Sessao ausente. Faca login novamente.' });
      return;
    }
    var idClienteFoto = (req.query && req.query.cliente_id) || '';
    try {
      const resposta = await fetch(
        base + '?action=cliente_foto_obter&cliente_id=' + encodeURIComponent(idClienteFoto) +
        '&token=' + encodeURIComponent(tokenSessaoFotoObter) + segredoQS
      );
      if (!resposta.ok) {
        const erroJson = await resposta.json().catch(function () { return { erro: 'Falha ao obter a foto.' }; });
        res.status(resposta.status).json(erroJson);
        return;
      }
      const buffer = Buffer.from(await resposta.arrayBuffer());
      res.setHeader('Content-Type', resposta.headers.get('content-type') || 'image/jpeg');
      res.status(200).send(buffer);
    } catch (e) {
      res.status(502).json({ erro: 'Erro de conexao ao buscar a foto.' });
    }
    return;
  }

  var acoesConfigGet = {
    escritorio_obter: 'Erro de conexao ao carregar os dados do escritorio.',
    avisos_listar: 'Erro de conexao ao carregar os avisos.',
    auditoria_listar: 'Erro de conexao ao carregar a auditoria.',
  };
  if (acoesConfigGet[acao]) {
    var tokenSessaoConfigGet = obterToken(req);
    if (!tokenSessaoConfigGet) {
      res.status(401).json({ erro: 'Sessao ausente. Faca login novamente.' });
      return;
    }
    var qsConfigGet = '';
    if (acao === 'avisos_listar' && req.query && req.query.apenas_ativos) {
      qsConfigGet = '&apenas_ativos=' + encodeURIComponent(req.query.apenas_ativos);
    }
    try {
      const resposta = await fetch(
        base + '?action=' + acao + qsConfigGet + '&token=' + encodeURIComponent(tokenSessaoConfigGet) + segredoQS
      );
      const dados = await resposta.json();
      res.status(resposta.status).json(dados);
    } catch (e) {
      res.status(502).json({ erro: acoesConfigGet[acao] });
    }
    return;
  }

  var acoesClientePost = {
    cliente_cadastro_criar: 'Erro de conexao ao salvar o cliente.',
    cliente_cadastro_atualizar: 'Erro de conexao ao salvar as alteracoes.',
    cliente_cadastro_excluir: 'Erro de conexao ao excluir o cliente.',
    etiqueta_criar: 'Erro de conexao ao criar a etiqueta.',
    cliente_etiquetas_definir: 'Erro de conexao ao salvar as etiquetas.',
    cliente_foto_salvar: 'Erro de conexao ao enviar a foto.',
    escritorio_salvar: 'Erro de conexao ao salvar os dados do escritorio.',
    aviso_criar: 'Erro de conexao ao publicar o aviso.',
    aviso_atualizar: 'Erro de conexao ao atualizar o aviso.',
    aviso_excluir: 'Erro de conexao ao excluir o aviso.',
  };
  if (acoesClientePost[acao]) {
    if (req.method !== 'POST') {
      res.status(405).json({ erro: 'Metodo nao permitido.' });
      return;
    }
    var tokenSessaoClientePost = obterToken(req);
    if (!tokenSessaoClientePost) {
      res.status(401).json({ erro: 'Sessao ausente. Faca login novamente.' });
      return;
    }
    try {
      const resposta = await fetch(
        base + '?action=' + acao + '&token=' + encodeURIComponent(tokenSessaoClientePost) + segredoQS,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }
      );
      const dados = await resposta.json();
      res.status(resposta.status).json(dados);
    } catch (e) {
      res.status(502).json({ erro: acoesClientePost[acao] });
    }
    return;
  }

  if (acao === 'processo_manual_excluir') {
    if (req.method !== 'POST') {
      res.status(405).json({ erro: 'Metodo nao permitido.' });
      return;
    }
    var tokenSessaoProcExcluir = obterToken(req);
    if (!tokenSessaoProcExcluir) {
      res.status(401).json({ erro: 'Sessao ausente. Faca login novamente.' });
      return;
    }
    try {
      const resposta = await fetch(
        base + '?action=processo_manual_excluir&token=' + encodeURIComponent(tokenSessaoProcExcluir) + segredoQS,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }
      );
      const dados = await resposta.json();
      res.status(resposta.status).json(dados);
    } catch (e) {
      res.status(502).json({ erro: 'Erro de conexao ao excluir o processo.' });
    }
    return;
  }

  if (acao === 'processos_administrativos') {
    var opProcAdm = (req.query && req.query.op) || corpo.op || '';
    if (opProcAdm !== 'listar' && req.method !== 'POST') {
      res.status(405).json({ erro: 'Metodo nao permitido.' });
      return;
    }
    var urlProcAdm = base + '?action=painel_processos_administrativos&op=' + encodeURIComponent(opProcAdm) +
      '&token=' + encodeURIComponent(tokenSessao) + segredoQS;
    var camposProcAdm = ['id', 'cliente', 'orgao', 'numero_protocolo', 'status', 'prazo', 'proximo_passo', 'observacoes', 'documento_id'];
    var origemProcAdm = opProcAdm === 'listar' ? (req.query || {}) : corpo;
    camposProcAdm.forEach(function (campo) {
      if (origemProcAdm[campo] !== undefined) {
        urlProcAdm += '&' + campo + '=' + encodeURIComponent(origemProcAdm[campo]);
      }
    });

    try {
      const resposta = await fetch(urlProcAdm);
      const dados = await resposta.json();
      res.status(resposta.status).json(dados);
    } catch (e) {
      res.status(502).json({ erro: 'Erro de conexao ao buscar processos administrativos.' });
    }
    return;
  }

  if (acao === 'processo_administrativo_anexar') {
    if (req.method !== 'POST') {
      res.status(405).json({ erro: 'Metodo nao permitido.' });
      return;
    }
    var urlAnexar = base + '?action=painel_processo_administrativo_anexar&token=' + encodeURIComponent(tokenSessao) + segredoQS;
    try {
      const resposta = await fetch(urlAnexar, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: corpo.id, nome_arquivo: corpo.nome_arquivo, mimetype: corpo.mimetype, dados_base64: corpo.dados_base64
        })
      });
      const dados = await resposta.json();
      res.status(resposta.status).json(dados);
    } catch (e) {
      res.status(502).json({ erro: 'Erro de conexao ao enviar o documento.' });
    }
    return;
  }

  if (acao === 'processo_administrativo_analisar') {
    if (req.method !== 'POST') {
      res.status(405).json({ erro: 'Metodo nao permitido.' });
      return;
    }
    var urlAnalisar = base + '?action=painel_processo_administrativo_analisar&token=' + encodeURIComponent(tokenSessao) + segredoQS;
    try {
      const resposta = await fetch(urlAnalisar, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mimetype: corpo.mimetype, dados_base64: corpo.dados_base64 })
      });
      const dados = await resposta.json();
      res.status(resposta.status).json(dados);
    } catch (e) {
      res.status(502).json({ erro: 'Erro de conexao ao analisar o documento.' });
    }
    return;
  }

  if (acao === 'processo_administrativo_documento') {
    const idDocProcAdm = (req.query && req.query.id) || '';
    try {
      const resposta = await fetch(
        base + '?action=painel_processo_administrativo_documento&token=' + encodeURIComponent(tokenSessao) +
        '&id=' + encodeURIComponent(idDocProcAdm) + segredoQS
      );
      if (!resposta.ok) {
        const erroJson = await resposta.json().catch(function () { return { erro: 'Falha ao obter documento.' }; });
        res.status(resposta.status).json(erroJson);
        return;
      }
      const buffer = Buffer.from(await resposta.arrayBuffer());
      res.setHeader('Content-Type', resposta.headers.get('content-type') || 'application/octet-stream');
      const disposicao = resposta.headers.get('content-disposition');
      if (disposicao) res.setHeader('Content-Disposition', disposicao);
      res.status(200).send(buffer);
    } catch (e) {
      res.status(502).json({ erro: 'Erro de conexao ao buscar documento.' });
    }
    return;
  }

  if (acao === 'clientes') {
    var url5 = base + '?action=painel_clientes&token=' + encodeURIComponent(tokenSessao) + segredoQS;
    try {
      const resposta = await fetch(url5);
      const dados = await resposta.json();
      res.status(resposta.status).json(dados);
    } catch (e) {
      res.status(502).json({ erro: 'Erro de conexao ao buscar clientes.' });
    }
    return;
  }

  if (acao === 'modelos_contrato') {
    var url5b = base + '?action=painel_modelos_contrato&token=' + encodeURIComponent(tokenSessao) + segredoQS;
    try {
      const resposta = await fetch(url5b);
      const dados = await resposta.json();
      res.status(resposta.status).json(dados);
    } catch (e) {
      res.status(502).json({ erro: 'Erro de conexao ao buscar modelos de contrato.' });
    }
    return;
  }

  if (acao === 'modelo_campos') {
    var nomeModelo = (req.query && req.query.nome) || '';
    var url5c = base + '?action=painel_modelo_campos&nome=' + encodeURIComponent(nomeModelo) +
      '&token=' + encodeURIComponent(tokenSessao) + segredoQS;
    try {
      const resposta = await fetch(url5c);
      const dados = await resposta.json();
      res.status(resposta.status).json(dados);
    } catch (e) {
      res.status(502).json({ erro: 'Erro de conexao ao buscar campos do modelo.' });
    }
    return;
  }

  if (acao === 'padrao_operacional') {
    var opPadrao = (req.query && req.query.op) || corpo.op || '';
    if (opPadrao !== 'listar' && req.method !== 'POST') {
      res.status(405).json({ erro: 'Metodo nao permitido.' });
      return;
    }
    var url6 = base + '?action=painel_padrao_operacional&op=' + encodeURIComponent(opPadrao) + '&token=' + encodeURIComponent(tokenSessao) + segredoQS;
    var camposPadrao = ['aba', 'conteudo'];
    var origemPadrao = opPadrao === 'listar' ? (req.query || {}) : corpo;
    camposPadrao.forEach(function (campo) {
      if (origemPadrao[campo] !== undefined) {
        url6 += '&' + campo + '=' + encodeURIComponent(origemPadrao[campo]);
      }
    });

    try {
      const resposta = await fetch(url6);
      const dados = await resposta.json();
      res.status(resposta.status).json(dados);
    } catch (e) {
      res.status(502).json({ erro: 'Erro de conexao ao acessar o padrão operacional.' });
    }
    return;
  }

  if (acao === 'audiencias') {
    var opAud = (req.query && req.query.op) || corpo.op || 'listar';
    var opsQueExigemPost = ['iniciar_upload_audiencia', 'finalizar_upload_audiencia', 'excluir'];
    if (opsQueExigemPost.indexOf(opAud) !== -1 && req.method !== 'POST') {
      res.status(405).json({ erro: 'Metodo nao permitido.' });
      return;
    }
    var urlAud = base + '?action=painel_audiencias&op=' + encodeURIComponent(opAud) +
      '&token=' + encodeURIComponent(tokenSessao) + segredoQS;
    if (opAud === 'detalhe' && req.query && req.query.id) urlAud += '&id=' + encodeURIComponent(req.query.id);
    if (opAud === 'iniciar_upload_audiencia') {
      var camposIniciar = ['cliente', 'nome_arquivo', 'mimetype', 'tamanho_total'];
      camposIniciar.forEach(function (campo) {
        if (corpo[campo] !== undefined) urlAud += '&' + campo + '=' + encodeURIComponent(corpo[campo]);
      });
    }
    if (opAud === 'finalizar_upload_audiencia' && corpo.upload_id) {
      urlAud += '&upload_id=' + encodeURIComponent(corpo.upload_id);
    }
    if (opAud === 'excluir' && corpo.id) {
      urlAud += '&id=' + encodeURIComponent(corpo.id);
    }
    try {
      const resposta = await fetch(urlAud);
      const dados = await resposta.json();
      res.status(resposta.status).json(dados);
    } catch (e) {
      res.status(502).json({ erro: 'Erro de conexao ao buscar audiencias.' });
    }
    return;
  }

  if (acao === 'audiencia_chunk') {
    if (req.method !== 'POST') {
      res.status(405).json({ erro: 'Metodo nao permitido.' });
      return;
    }
    var urlChunk = base + '?action=painel_audiencia_chunk&token=' + encodeURIComponent(tokenSessao) + segredoQS;
    try {
      const resposta = await fetch(urlChunk, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ upload_id: corpo.upload_id, dados_base64: corpo.dados_base64 })
      });
      const dados = await resposta.json();
      res.status(resposta.status).json(dados);
    } catch (e) {
      res.status(502).json({ erro: 'Erro de conexao ao enviar o pedaço do áudio.' });
    }
    return;
  }

  if (acao === 'pauta_audiencias') {
    var opPauta = (req.query && req.query.op) || corpo.op || 'listar';
    if (opPauta !== 'listar' && req.method !== 'POST') {
      res.status(405).json({ erro: 'Metodo nao permitido.' });
      return;
    }
    var urlPauta = base + '?action=painel_pauta_audiencias&op=' + encodeURIComponent(opPauta) +
      '&token=' + encodeURIComponent(tokenSessao) + segredoQS;
    var idPauta = (opPauta === 'listar' ? (req.query && req.query.id) : corpo.id) || '';
    if (idPauta) urlPauta += '&id=' + encodeURIComponent(idPauta);
    try {
      const resposta = await fetch(urlPauta);
      const dados = await resposta.json();
      res.status(resposta.status).json(dados);
    } catch (e) {
      res.status(502).json({ erro: 'Erro de conexao ao buscar a pauta de audiencias.' });
    }
    return;
  }

  if (acao === 'audiencia_documento') {
    const idDocAud = (req.query && req.query.id) || '';
    try {
      const resposta = await fetch(
        base + '?action=painel_audiencia_documento&token=' + encodeURIComponent(tokenSessao) +
        '&id=' + encodeURIComponent(idDocAud) + segredoQS
      );
      if (!resposta.ok) {
        const erroJson = await resposta.json().catch(function () { return { erro: 'Falha ao obter documento.' }; });
        res.status(resposta.status).json(erroJson);
        return;
      }
      const buffer = Buffer.from(await resposta.arrayBuffer());
      res.setHeader('Content-Type', resposta.headers.get('content-type') || 'application/pdf');
      const disposicao = resposta.headers.get('content-disposition');
      if (disposicao) res.setHeader('Content-Disposition', disposicao);
      res.status(200).send(buffer);
    } catch (e) {
      res.status(502).json({ erro: 'Erro de conexao ao buscar documento.' });
    }
    return;
  }

  if (acao === 'documento_gerado') {
    const idDocGerado = (req.query && req.query.id) || '';
    try {
      const resposta = await fetch(
        base + '?action=painel_documento_gerado&token=' + encodeURIComponent(tokenSessao) +
        '&id=' + encodeURIComponent(idDocGerado) + segredoQS
      );
      if (!resposta.ok) {
        const erroJson = await resposta.json().catch(function () { return { erro: 'Falha ao obter documento.' }; });
        res.status(resposta.status).json(erroJson);
        return;
      }
      const buffer = Buffer.from(await resposta.arrayBuffer());
      res.setHeader('Content-Type', resposta.headers.get('content-type') || 'application/pdf');
      const disposicao = resposta.headers.get('content-disposition');
      if (disposicao) res.setHeader('Content-Disposition', disposicao);
      res.status(200).send(buffer);
    } catch (e) {
      res.status(502).json({ erro: 'Erro de conexao ao buscar documento.' });
    }
    return;
  }

  const secaoPedida = (req.query && req.query.secao) || '';
  const url = base + '?action=dashboard&token=' + encodeURIComponent(tokenSessao) +
    (secaoPedida ? '&secao=' + encodeURIComponent(secaoPedida) : '') + segredoQS;

  try {
    const resposta = await fetch(url);
    if (!resposta.ok) {
      res.status(resposta.status).json({ erro: 'sessao_invalida' });
      return;
    }
    const dados = await resposta.json();
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(dados);
  } catch (e) {
    res.status(502).json({ erro: 'Erro de conexao ao buscar os dados.' });
  }
};
