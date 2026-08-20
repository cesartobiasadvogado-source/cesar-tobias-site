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
    var camposPermitidos = ['tipo', 'nome', 'tipo_servico', 'descricao', 'endereco', 'etapa', 'origem', 'midia', 'campanha', 'resposta', 'valor', 'vencimento', 'entrada', 'parcelas', 'data_entrada', 'dia_vencimento', 'percentual_honorarios', 'percentual_recursal'];
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

  if (acao === 'agenda') {
    var opAgenda = (req.query && req.query.op) || corpo.op || '';
    if (opAgenda !== 'listar' && req.method !== 'POST') {
      res.status(405).json({ erro: 'Metodo nao permitido.' });
      return;
    }
    var url3 = base + '?action=painel_agenda&op=' + encodeURIComponent(opAgenda) + '&token=' + encodeURIComponent(tokenSessao) + segredoQS;
    var camposAgenda = ['id', 'titulo', 'data', 'hora', 'meet'];
    var origemAgenda = opAgenda === 'listar' ? (req.query || {}) : corpo;
    camposAgenda.forEach(function (campo) {
      if (origemAgenda[campo]) {
        url3 += '&' + campo + '=' + encodeURIComponent(origemAgenda[campo]);
      }
    });

    try {
      const resposta = await fetch(url3);
      const dados = await resposta.json();
      res.status(resposta.status).json(dados);
    } catch (e) {
      res.status(502).json({ erro: 'Erro de conexao com a agenda.' });
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

  const url = base + '?action=dashboard&token=' + encodeURIComponent(tokenSessao) + segredoQS;

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
