// Roda com: node tests/calculos-proxy.test.js
// Proxy da Vercel (api/painel.js) para as acoes do Calculos: repassa filtros e corpo ao Lambda com o token da sessao e o segredo,
// recusa GET nas acoes que gravam, devolve o status do Lambda (inclusive 409 de conflito de versao) e 502 quando o Lambda cai.
const assert = require('assert');

process.env.DASHBOARD_SECRET = 'segredo-de-teste';
const handler = require('../api/painel.js');

let falhas = 0;
const fila = [];
function t(nome, fn) { fila.push({ nome, fn }); }

function res() {
  const r = { codigo: null, corpo: null, status(c) { r.codigo = c; return r; }, json(c) { r.corpo = c; return r; } };
  return r;
}
function req(acao, extra) {
  return Object.assign({ method: 'GET', query: { acao }, headers: { authorization: 'Bearer tok123' }, body: undefined, socket: { remoteAddress: '1.2.3.4' } }, extra || {});
}
function falsoFetch(resposta) {
  const chamadas = [];
  global.fetch = async (url, opc) => {
    chamadas.push({ url, opc });
    if (resposta instanceof Error) throw resposta;
    return { status: resposta.status, json: async () => resposta.corpo };
  };
  return chamadas;
}

t('listar repassa os filtros codificados, o token e o segredo, por GET', async () => {
  const c = falsoFetch({ status: 200, corpo: { calculos: [] } });
  const r = res();
  await handler(req('calculo_listar', { query: { acao: 'calculo_listar', cliente_id: '5', processo_id: '8', q: 'a b&c=d', limite: '20', lixo: 'x' } }), r);
  assert.strictEqual(r.codigo, 200);
  assert.strictEqual(c.length, 1);
  assert(c[0].url.includes('?action=calculo_listar&cliente_id=5&processo_id=8&q=a%20b%26c%3Dd&limite=20&token=tok123&secret=segredo-de-teste'), c[0].url);
  assert(!c[0].url.includes('lixo'), 'parametro fora da lista nao pode passar');
  assert(!c[0].opc || !c[0].opc.method || c[0].opc.method === 'GET');
});

t('obter, indices e vinculos tambem sao GET com o nome certo da acao', async () => {
  for (const [acao, extra] of [['calculo_obter', { id: '7' }], ['calculo_indices_listar', {}], ['calculo_vinculos', { q: 'ana', cliente_id: '5' }]]) {
    const c = falsoFetch({ status: 200, corpo: {} });
    const r = res();
    await handler(req(acao, { query: Object.assign({ acao }, extra) }), r);
    assert.strictEqual(r.codigo, 200, acao);
    assert(c[0].url.includes('?action=' + acao), c[0].url);
  }
});

t('salvar, excluir e salvar indice: POST com o corpo em JSON; GET e recusado com 405 sem chamar o Lambda', async () => {
  for (const acao of ['calculo_salvar', 'calculo_excluir', 'calculo_indice_salvar']) {
    const c = falsoFetch({ status: 200, corpo: { ok: true } });
    const r = res();
    await handler(req(acao, { method: 'POST', body: { id: 3, nome: 'x' } }), r);
    assert.strictEqual(r.codigo, 200, acao);
    assert.strictEqual(c[0].opc.method, 'POST');
    assert.deepStrictEqual(JSON.parse(c[0].opc.body), { id: 3, nome: 'x' });
    assert(c[0].url.includes('?action=' + acao + '&token=tok123&secret=segredo-de-teste'), c[0].url);

    const c2 = falsoFetch({ status: 200, corpo: {} });
    const r2 = res();
    await handler(req(acao, { method: 'GET' }), r2);
    assert.strictEqual(r2.codigo, 405, acao);
    assert.strictEqual(c2.length, 0, 'nao pode chamar o Lambda');
  }
});

t('conflito de versao (409) do Lambda chega intacto ao navegador', async () => {
  falsoFetch({ status: 409, corpo: { erro: 'alterado por outra pessoa', conflito: true } });
  const r = res();
  await handler(req('calculo_salvar', { method: 'POST', body: { id: 1, versao: 1 } }), r);
  assert.strictEqual(r.codigo, 409);
  assert.strictEqual(r.corpo.conflito, true);
});

t('Lambda fora do ar vira 502 com mensagem propria, sem vazar detalhe', async () => {
  falsoFetch(new Error('ECONNRESET 10.0.0.1 senha=abc'));
  for (const [acao, metodo] of [['calculo_listar', 'GET'], ['calculo_salvar', 'POST']]) {
    const r = res();
    await handler(req(acao, { method: metodo, body: {} }), r);
    assert.strictEqual(r.codigo, 502, acao);
    assert(/calculo/i.test(r.corpo.erro) && !/abc|ECONNRESET/.test(r.corpo.erro), r.corpo.erro);
  }
});

t('sem token da sessao nada e repassado ao Lambda', async () => {
  const c = falsoFetch({ status: 200, corpo: {} });
  const r = res();
  await handler(req('calculo_listar', { headers: {} }), r);
  assert.strictEqual(r.codigo, 401);
  assert.strictEqual(c.length, 0);
});

(async () => {
  for (const { nome, fn } of fila) {
    try { await fn(); console.log('ok  ' + nome); } catch (e) { falhas++; console.log('FALHA ' + nome + ': ' + e.message); }
  }
  console.log(falhas ? '\n' + falhas + ' falha(s)' : '\nTodos os testes passaram');
  process.exit(falhas ? 1 : 0);
})();
