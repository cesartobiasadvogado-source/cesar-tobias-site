module.exports = async (req, res) => {
  const senhaEsperada = process.env.PAINEL_SENHA;
  const segredoLambda = process.env.DASHBOARD_SECRET;

  if (!senhaEsperada || !segredoLambda) {
    res.status(500).json({ erro: 'Configuracao ausente no servidor.' });
    return;
  }

  const senhaRecebida = (req.query && req.query.senha) || '';
  if (senhaRecebida !== senhaEsperada) {
    res.status(401).json({ erro: 'Senha invalida.' });
    return;
  }

  const url =
    'https://63quf5pqd4t5hgjuvi67r3juzq0mawnb.lambda-url.us-east-1.on.aws/' +
    '?action=dashboard&secret=' + encodeURIComponent(segredoLambda);

  try {
    const resposta = await fetch(url);
    if (!resposta.ok) {
      res.status(502).json({ erro: 'Falha ao consultar dados do escritorio.' });
      return;
    }
    const dados = await resposta.json();
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(dados);
  } catch (e) {
    res.status(502).json({ erro: 'Erro de conexao ao buscar os dados.' });
  }
};
