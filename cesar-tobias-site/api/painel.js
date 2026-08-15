function obterIp(req) {
  const encaminhado = req.headers['x-forwarded-for'];
  if (encaminhado) return encaminhado.split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || 'desconhecido';
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

  if (acao === 'login') {
    const usuario = (req.query && req.query.usuario) || '';
    const senha = (req.query && req.query.senha) || '';

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

  const tokenSessao = (req.query && req.query.token) || '';
  if (!tokenSessao) {
    res.status(401).json({ erro: 'Sessao ausente.' });
    return;
  }

  if (acao === 'usuarios_listar' || acao === 'usuarios_criar' || acao === 'usuarios_remover') {
    const op = acao === 'usuarios_listar' ? 'listar' : acao === 'usuarios_criar' ? 'criar' : 'remover';
    let url = base + '?action=painel_admin&op=' + op + '&token=' + encodeURIComponent(tokenSessao) + segredoQS;

    if (op === 'criar') {
      url += '&nome=' + encodeURIComponent((req.query && req.query.nome) || '') +
             '&login=' + encodeURIComponent((req.query && req.query.login) || '') +
             '&senha=' + encodeURIComponent((req.query && req.query.senha) || '');
    }
    if (op === 'remover') {
      url += '&login=' + encodeURIComponent((req.query && req.query.login) || '');
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
    var url2 = base + '?action=painel_acao&token=' + encodeURIComponent(tokenSessao) + segredoQS;
    var camposPermitidos = ['tipo', 'nome', 'tipo_servico', 'descricao', 'endereco', 'etapa', 'origem', 'midia', 'campanha', 'resposta', 'valor', 'vencimento'];
    camposPermitidos.forEach(function (campo) {
      if (req.query && req.query[campo]) {
        url2 += '&' + campo + '=' + encodeURIComponent(req.query[campo]);
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
    var url3 = base + '?action=painel_agenda&token=' + encodeURIComponent(tokenSessao) + segredoQS;
    var camposAgenda = ['op', 'id', 'titulo', 'data', 'hora', 'meet'];
    camposAgenda.forEach(function (campo) {
      if (req.query && req.query[campo]) {
        url3 += '&' + campo + '=' + encodeURIComponent(req.query[campo]);
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
    var url4 = base + '?action=painel_processos&token=' + encodeURIComponent(tokenSessao) + segredoQS;
    var camposProcessos = ['op', 'processo', 'cliente', 'proxima_audiencia', 'observacoes'];
    camposProcessos.forEach(function (campo) {
      if (req.query && req.query[campo] !== undefined) {
        url4 += '&' + campo + '=' + encodeURIComponent(req.query[campo]);
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
