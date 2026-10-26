// Roda com: node tests/conteudo-painel.test.js
// Painel de Conteúdo (marketing): garante a ligação entre as pontas que, se uma sair do ar, a página
// quebra em silêncio -- nome da ação no proxy da Vercel, item no menu de TODAS as páginas, mapa de
// permissão/título no painel-app.js e o checkbox de permissão do cadastro de usuário.
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const raiz = path.join(__dirname, '..');
const ler = (f) => fs.readFileSync(path.join(raiz, f), 'utf8').replace(/\r\n/g, '\n');
const proxy = ler('api/painel.js');
const app = ler('painel-app.js');

let falhas = 0;
function t(nome, fn) { try { fn(); console.log('ok  ' + nome); } catch (e) { falhas++; console.log('FALHA ' + nome + ': ' + e.message); } }

const ACOES = ['conteudo_listar', 'conteudo_criar', 'conteudo_atualizar', 'conteudo_excluir'];

t('o proxy repassa as 4 ações de conteúdo ao Lambda com o mesmo nome', () => {
  ACOES.forEach((a) => {
    assert(proxy.includes("'" + a + "'") || proxy.includes(a + ':'), 'proxy sem a ação ' + a);
  });
  assert(proxy.includes("'?action=conteudo_listar'"), 'listar nao repassa action=conteudo_listar');
});

t('o proxy só aceita POST para criar/atualizar/excluir e repassa status, limite e ordem na listagem', () => {
  const bloco = proxy.slice(proxy.indexOf("var acoesConteudoPost"), proxy.indexOf("acao === 'compromisso_listar'"));
  assert(bloco.includes("req.method !== 'POST'"), 'sem a trava de metodo');
  assert(/\['status', 'limite', 'ordem'\]/.test(proxy), 'filtros da listagem nao sao repassados');
});

t('toda ação que o painel-app.js chama existe no proxy', () => {
  // o nome pode estar direto na URL (acao=conteudo_listar) ou numa variável (acao = 'conteudo_criar')
  const usadas = new Set([...app.matchAll(/\bconteudo_[a-z]+\b(?=[&'"])/g)].map((m) => m[0]));
  [...usadas].forEach((a) => assert(ACOES.includes(a), 'acao desconhecida no front: ' + a));
  ACOES.forEach((a) => assert(usadas.has(a), 'o front nunca chama ' + a));
});

t('a página está registrada: título, conteúdo, permissão "marketing" e wire', () => {
  assert(/conteudo: 'Conteúdo'/.test(app), 'titulo do topo');
  assert(/conteudo: htmlConteudo/.test(app), 'mapa de conteudo');
  assert(/conteudo: 'marketing'/.test(app), 'mapa de permissao');
  assert(app.includes("PAGINA_ATUAL === 'conteudo') { wireConteudo(); }"), 'wire da pagina');
  assert(app.includes("perms.indexOf('marketing') === -1 ? ''"), 'a secao nao e travada pela permissao');
});

t('painel-conteudo.html existe e declara PAGINA_ATUAL = "conteudo"', () => {
  const html = ler('painel-conteudo.html');
  assert(html.includes('<script>var PAGINA_ATUAL = "conteudo";</script>'));
  assert(html.includes('<title>Vero Jurídico — Conteúdo</title>'));
});

t('TODAS as páginas do painel têm o item "Conteúdo" no menu, ligado à permissão "marketing"', () => {
  const paginas = fs.readdirSync(raiz).filter((f) => /^painel(-[a-z-]+)?\.html$/.test(f));
  assert(paginas.length >= 20, 'poucas paginas: ' + paginas.length);
  const sem = paginas.filter((f) => {
    const h = ler(f);
    return !h.includes('data-secao="marketing" href="painel-conteudo.html#sec-conteudo"') ||
      !h.includes('<div class="nav-label" data-secao-grupo="marketing">Marketing</div>');
  });
  assert.deepStrictEqual(sem, [], 'sem o item no menu: ' + sem.join(', '));
});

t('as páginas apontam todas para a mesma versão de cache do JS e do CSS', () => {
  const paginas = fs.readdirSync(raiz).filter((f) => /^painel(-[a-z-]+)?\.html$/.test(f));
  const versoes = new Set();
  paginas.forEach((f) => {
    const h = ler(f);
    [...h.matchAll(/painel-app\.js\?v=([\w-]+)/g), ...h.matchAll(/painel\.css\?v=([\w-]+)/g)].forEach((m) => versoes.add(m[1]));
  });
  assert.strictEqual(versoes.size, 1, 'versoes de cache diferentes entre paginas: ' + [...versoes].join(', '));
});

t('o cadastro de usuário oferece a permissão "marketing"', () => {
  assert(app.includes('data-permissao="marketing"'));
});

t('o texto vindo do servidor passa por esc() nos cartões (sem injeção de HTML)', () => {
  const ini = app.indexOf('function _htmlCartaoConteudo');
  const bloco = app.slice(ini, app.indexOf('function _htmlGrupoConteudo'));
  ['c.titulo', 'c.roteiro', 'c.observacao'].forEach((campo) => {
    const re = new RegExp('esc\\(' + campo.replace('.', '\\.') + '\\)');
    assert(re.test(bloco), campo + ' entra no HTML sem esc()');
  });
});

if (falhas) { console.log('\n' + falhas + ' falha(s)'); process.exit(1); }
console.log('\ntodos passaram');
