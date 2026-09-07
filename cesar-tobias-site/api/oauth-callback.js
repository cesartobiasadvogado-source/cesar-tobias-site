// Porta de entrada no nosso proprio dominio pro callback do "Conectar com Google" -- sem isso,
// o redirect_uri usado no fluxo OAuth era a URL crua do Lambda (*.lambda-url.us-east-1.on.aws),
// e e exatamente esse dominio que o Google mostra na tela "Prosseguir para..." antes do advogado
// autorizar. Aqui a gente busca o resultado direto do Lambda (server-side) e devolve o mesmo
// conteudo com nosso proprio dominio na barra de enderecos -- em nenhum momento o navegador do
// advogado chega a ver a URL da AWS.
module.exports = async (req, res) => {
  const segredoLambda = process.env.DASHBOARD_SECRET;
  if (!segredoLambda) {
    res.status(500).send('Configuracao ausente no servidor.');
    return;
  }

  const base = 'https://63quf5pqd4t5hgjuvi67r3juzq0mawnb.lambda-url.us-east-1.on.aws/';
  const q = req.query || {};
  const params = new URLSearchParams();
  ['code', 'state', 'error', 'error_description'].forEach(function (campo) {
    if (q[campo] !== undefined) params.set(campo, q[campo]);
  });
  params.set('action', 'oauth_google_callback');
  params.set('secret', segredoLambda);

  try {
    const resposta = await fetch(base + '?' + params.toString());
    const texto = await resposta.text();
    res.status(resposta.status);
    res.setHeader('Content-Type', resposta.headers.get('content-type') || 'text/html; charset=utf-8');
    res.send(texto);
  } catch (e) {
    res.status(502).send('Nao foi possivel concluir a conexao com o Google agora. Tente de novo em instantes.');
  }
};
