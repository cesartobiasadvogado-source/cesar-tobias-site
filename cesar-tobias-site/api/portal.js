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
  const acao = (req.query && req.query.acao) || '';
  const corpo = (req.body && typeof req.body === 'object') ? req.body : {};

  if (acao === 'solicitar_codigo') {
    if (req.method !== 'POST') {
      res.status(405).json({ erro: 'Metodo nao permitido.' });
      return;
    }
    const telefone = corpo.telefone || '';
    try {
      const resposta = await fetch(
        base + '?action=portal_solicitar_codigo&telefone=' + encodeURIComponent(telefone) + segredoQS
      );
      const dados = await resposta.json();
      res.status(resposta.status).json(dados);
    } catch (e) {
      res.status(502).json({ erro: 'Erro de conexao.' });
    }
    return;
  }

  if (acao === 'verificar_codigo') {
    if (req.method !== 'POST') {
      res.status(405).json({ erro: 'Metodo nao permitido.' });
      return;
    }
    const telefone = corpo.telefone || '';
    const codigo = corpo.codigo || '';
    try {
      const resposta = await fetch(
        base + '?action=portal_verificar_codigo&telefone=' + encodeURIComponent(telefone) +
        '&codigo=' + encodeURIComponent(codigo) + segredoQS
      );
      const dados = await resposta.json();
      res.status(resposta.status).json(dados);
    } catch (e) {
      res.status(502).json({ erro: 'Erro de conexao.' });
    }
    return;
  }

  const tokenSessao = obterToken(req);
  if (!tokenSessao) {
    res.status(401).json({ erro: 'Sessao ausente.' });
    return;
  }

  if (acao === 'documento') {
    const idDoc = (req.query && req.query.id) || '';
    try {
      const resposta = await fetch(
        base + '?action=portal_documento&token=' + encodeURIComponent(tokenSessao) +
        '&id=' + encodeURIComponent(idDoc) + segredoQS
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

  const url = base + '?action=portal_dados&token=' + encodeURIComponent(tokenSessao) + segredoQS;

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
