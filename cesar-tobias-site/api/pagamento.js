module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ erro: 'Metodo nao permitido.' });
    return;
  }

  const id = (req.query && req.query.id) || '';
  if (!id) {
    res.status(400).json({ erro: 'Cobranca nao informada.' });
    return;
  }

  const base = 'https://63quf5pqd4t5hgjuvi67r3juzq0mawnb.lambda-url.us-east-1.on.aws/';
  const url = base + '?action=pagamento_publico&id=' + encodeURIComponent(id);

  try {
    const resposta = await fetch(url);
    const dados = await resposta.json();
    res.status(resposta.status).json(dados);
  } catch (e) {
    res.status(502).json({ erro: 'Erro de conexao ao buscar a cobranca.' });
  }
};
