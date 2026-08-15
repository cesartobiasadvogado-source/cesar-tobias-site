function obterIp(req) {
  const encaminhado = req.headers['x-forwarded-for'];
  if (encaminhado) return encaminhado.split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || 'desconhecido';
}

module.exports = async (req, res) => {
  const senhaEsperada = process.env.PAINEL_SENHA;
  const segredoLambda = process.env.DASHBOARD_SECRET;

  if (!senhaEsperada || !segredoLambda) {
    res.status(500).json({ erro: 'Configuracao ausente no servidor.' });
    return;
  }

  const base = 'https://63quf5pqd4t5hgjuvi67r3juzq0mawnb.lambda-url.us-east-1.on.aws/';
  const segredoQS = '&secret=' + encodeURIComponent(segredoLambda);
  const ip = obterIp(req);

  try {
    const respostaCheck = await fetch(
      base + '?action=painel_rate_check&ip=' + encodeURIComponent(ip) + segredoQS
    );
    const dadosCheck = await respostaCheck.json();
    if (dadosCheck.bloqueado) {
      res.status(429).json({ erro: 'Muitas tentativas de senha erradas. Tente novamente mais tarde.' });
      return;
    }
  } catch (e) {
    // se o rate check falhar, segue o fluxo normal em vez de travar o acesso
  }

  const senhaRecebida = (req.query && req.query.senha) || '';
  const senhaCorreta = senhaRecebida === senhaEsperada;

  fetch(
    base + '?action=painel_log&ip=' + encodeURIComponent(ip) +
    '&sucesso=' + (senhaCorreta ? 'true' : 'false') + segredoQS
  ).catch(function () {});

  if (!senhaCorreta) {
    res.status(401).json({ erro: 'Senha invalida.' });
    return;
  }

  const url = base + '?action=dashboard' + segredoQS;

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
