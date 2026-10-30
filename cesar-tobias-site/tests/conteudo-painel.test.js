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

t('Para gravar: Meu dia, Gravar amanhã, contador de gravados e "Desfazer: não gravei" (gravado -> para_gravar)', () => {
  assert(app.includes('data-conteudo-aba="meu_dia"'), 'sem a aba Meu dia');
  assert(app.includes("'Gravar amanhã'"), 'sem o grupo Gravar amanha');
  assert(/ de ' \+ totalCiclo \+ ' gravados/.test(app), 'sem o contador de gravados');
  assert(app.includes("botao('nao_gravei', 'Desfazer: não gravei'"), 'sem o botao Desfazer');
  assert(app.includes("acao === 'nao_gravei') mudarStatus(c, 'para_gravar', botao)"), 'Desfazer nao volta para para_gravar');
});

t('carrossel "Seus vídeos em cena": usa esc() no texto do servidor e respeita movimento reduzido', () => {
  const ini = app.indexOf('function _htmlCarrosselConteudo');
  const bloco = app.slice(ini, app.indexOf('function wireConteudo'));
  assert(/esc\(c\.titulo\)/.test(bloco), 'titulo sem esc()');
  assert(bloco.includes('Seus vídeos em cena'));
  const css = ler('painel.css');
  assert(css.includes('prefers-reduced-motion') && css.includes('.conteudo-cena-faixa.corre:hover'), 'sem pausa no hover/movimento reduzido');
});

t('arquivos por rede e sugestão: texto com esc(), link só https e aprovar vira agendado sem mexer em outros campos', () => {
  const ini = app.indexOf('function _linkSeguroConteudo');
  const bloco = app.slice(ini, app.indexOf('function _htmlGrupoConteudo'));
  ['a.video', 'a.capa', 'nome', 'c.sugestao_data'].forEach((x) => assert(bloco.includes('esc(') && bloco.includes(x), 'falta ' + x));
  assert(/\^https:/.test(bloco), 'link sem trava de https');
  assert(bloco.includes('esc(url)'), 'href sem esc()');
  assert(bloco.includes('noopener noreferrer'), 'link externo sem noopener');
  const aprovar = app.slice(app.indexOf("acao === 'aprovar_sugestao'"), app.indexOf("acao === 'aprovar_sugestao'") + 700);
  assert(aprovar.includes("status: 'agendado'") && aprovar.includes('data_postagem: c.sugestao_data'), 'aprovar nao agenda com a sugestao');
  assert(aprovar.includes("sugestao_data: ''") && aprovar.includes("sugestao_hora: ''"), 'aprovar nao limpa a sugestao');
});

t('pré-visualização: miniatura só JPEG base64, player só com id do Drive e iframe preso ao domínio do Drive', () => {
  const ini = app.indexOf('function _idDriveConteudo');
  const bloco = app.slice(ini, app.indexOf('// Sugestao de dia/hora'));
  assert(bloco.includes('drive\\.google\\.com'), 'o player aceita link que nao e do Drive');
  assert(bloco.includes('data:image\\/jpeg;base64'), 'a miniatura nao e restrita a JPEG base64');
  assert(bloco.includes("'https://drive.google.com/file/d/' + encodeURIComponent(idDrive) + '/preview'"), 'src do player nao e fixo no Drive');
  assert(/sandbox="[^"]*"/.test(bloco) && !/sandbox="[^"]*allow-top-navigation/.test(bloco), 'iframe sem sandbox ou com navegacao do topo');
  assert(bloco.includes("src = 'about:blank'"), 'fechar nao esvazia o iframe (o som continuaria tocando)');
  assert(bloco.includes('esc(mini)') && bloco.includes('esc(nomeRede)'), 'miniatura/rede sem esc()');
  assert(app.includes("acao === 'assistir'"), 'o botao Assistir nao tem acao');
});

t('edição do conteúdo: campo do link do Drive só com vídeo, exige https e só reenvia arquivos se o link mudou', () => {
  const salvar = app.slice(app.indexOf("var campoLink = document.getElementById('conteudo-form-link-video')"), app.indexOf("var acao = 'conteudo_criar'"));
  assert(salvar.includes('https:'), 'link sem trava de https');
  assert(salvar.includes('linkNovo !== _linkAtualConteudo(emEdicao)'), 'reenvia arquivos mesmo sem mudar o link');
  assert(salvar.includes('delete arquivosNovos[r].link_video'), 'nao da pra limpar o link');
  assert(app.includes("getElementById('conteudo-form-bloco-link').style.display = temVideo"), 'o campo aparece mesmo sem video');
});

t('escolhas de edição por vídeo: só opções que a rotina já faz, só confirma com clique, texto com esc()', () => {
  const ini = app.indexOf('function _resumoEdicaoConteudo');
  const bloco = app.slice(ini, app.indexOf('// Sugestao de dia/hora'));
  assert(bloco.includes('data-edicao-campo="cortar_pausas"') && bloco.includes('data-edicao-campo="legenda"'), 'faltam as opcoes');
  ['zoom', 'tirar_erros', 'musica', 'marca'].forEach((x) => assert(!bloco.includes('data-edicao-campo="' + x + '"'), 'o painel oferece "' + x + '" que a rotina ainda nao faz'));
  assert(bloco.includes('esc(edicao.video_encontrado)') && bloco.includes('esc(_resumoEdicaoConteudo(edicao))'), 'texto sem esc()');
  assert(bloco.includes("c.status !== 'gravado' || temEditado"), 'o bloco aparece fora de gravado/ja editado');
  const acao = app.slice(app.indexOf("acao === 'salvar_edicao'"), app.indexOf("acao === 'assistir'"));
  assert(acao.includes('edicaoNova.confirmado = true') && acao.includes('edicaoNova.confirmado = false'), 'confirmar/alterar');
  assert(!/status:/.test(acao), 'a escolha de edicao nao pode mexer no status');
});

if (falhas) { console.log('\n' + falhas + ' falha(s)'); process.exit(1); }
console.log('\ntodos passaram');
