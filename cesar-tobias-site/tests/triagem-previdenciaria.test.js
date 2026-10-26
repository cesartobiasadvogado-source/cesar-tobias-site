// Sem dependencias: node --test tests/triagem-previdenciaria.test.js
// Triagem Previdenciaria (painel): proxy, paginas/menu, passos alinhados ao backend e funcoes puras de tela.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const ler = (arq) => fs.readFileSync(path.join(RAIZ, arq), 'utf8');
const fonte = ler('painel-app.js');
const proxy = ler(path.join('api', 'painel.js'));

function trecho(texto, inicio, fim) {
  const i = texto.indexOf(inicio), f = texto.indexOf(fim, i + inicio.length);
  assert(i >= 0 && f > i, 'trecho nao encontrado: ' + inicio);
  return texto.slice(i, f);
}
const esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const POST = ['criar', 'atualizar', 'status', 'arquivar', 'restaurar', 'duplicar', 'excluir', 'vinculos_salvar', 'pessoas_salvar'];

test('proxy: leituras e escritas da triagem previdenciaria, cada uma no seu bloco/mapa', () => {
  for (const acao of ['triagem_prev_listar', 'triagem_prev_obter']) {
    assert(proxy.includes("if (acao === '" + acao + "')"), acao);
    assert(proxy.includes('action=' + acao), acao);
  }
  const mapa = trecho(proxy, 'var acoesClientePost = {', '  };');
  for (const a of POST) assert(mapa.includes('triagem_prev_' + a + ':'), a);
  assert(!/acao\s*\)\s*\{[^}]*base \+ '\?action=' \+ acao\b/.test(trecho(proxy, "if (acao === 'triagem_prev_listar')", "if (acao === 'etiqueta_listar')")));
});

test('passos do wizard coincidem com PASSOS_TRIAGEM do backend', () => {
  const passos = trecho(fonte, 'var PASSOS_WIZARD_PREV = [', '];');
  assert.equal(passos.replace(/[^a-z_,]/g, ''), 'varPASSOS_WIZARD_PREV=' .replace(/[^a-z_,]/g, '') + 'cliente,segurado,beneficio,vinculos,situacao,requerimento,analise_final'.replace(/[^a-z_,]/g, ''));
});

test('toda pagina com o menu da Triagem Trabalhista tem o da Previdenciaria, e as paginas novas existem', () => {
  const paginas = fs.readdirSync(RAIZ).filter((f) => /^painel.*\.html$/.test(f));
  let comMenu = 0;
  for (const p of paginas) {
    const html = ler(p);
    if (html.includes('painel-triagem-trabalhista.html#sec-triagem-trabalhista')) {
      comMenu++;
      assert(html.includes('href="painel-triagem-previdenciaria.html#sec-triagem-previdenciaria"'), p + ' sem o item de menu');
    }
  }
  assert(comMenu >= 20);
  assert(ler('painel-triagem-previdenciaria.html').includes('var PAGINA_ATUAL = "triagem_previdenciaria";'));
  assert(ler('painel-criar-triagem-previdenciaria.html').includes('var PAGINA_ATUAL = "criar_triagem_prev";'));
});

test('paginas usam a mesma versao de cache do painel-app e do css', () => {
  const versoes = new Set();
  for (const p of fs.readdirSync(RAIZ).filter((f) => /^painel.*\.html$/.test(f))) {
    for (const m of ler(p).matchAll(/(?:painel-app\.js|painel\.css)\?v=([\w-]+)/g)) versoes.add(m[1]);
  }
  assert.equal(versoes.size, 1, Array.from(versoes).join(','));
});

test('mapas de conteudo, permissao e disparo cobrem as duas paginas novas', () => {
  assert(fonte.includes('triagem_previdenciaria: htmlTriagemPrevDashboard'));
  assert(fonte.includes('criar_triagem_prev: htmlCriarTriagemPrev'));
  assert(fonte.includes("triagem_previdenciaria: 'processos', criar_triagem_prev: 'processos'"));
  assert(fonte.includes("PAGINA_ATUAL === 'triagem_previdenciaria') { wireTriagemPrevDashboard(); carregarTriagensPrev(); }"));
  assert(fonte.includes("PAGINA_ATUAL === 'criar_triagem_prev') { wireTriagemPrevWizard(); }"));
});

function funcoes() {
  const codigo = trecho(fonte, '  var ROTULO_STATUS_PREV', '  function _renderListaPrev') + '\n' +
    trecho(fonte, '  function _familiaBeneficioPrev', '  var CATEGORIAS_SEGURADO_PREV') + '\n' +
    trecho(fonte, '  function _valorInputPrev', '  function htmlCamposPrev') + '\n' +
    trecho(fonte, '  function _moedaPrev', '  var ROTULO_STATUS_PREV');
  return new Function('esc', 'htmlSimNaoTriagem', 'ROTULO_STATUS_TRIAGEM',
    'var _triagensPrevCarregadas = [];' + codigo + '; return { _familiaBeneficioPrev, htmlCampoPrev, _valorInputPrev, _moedaPrev, _passaNosFiltrosPrev: typeof _passaNosFiltrosPrev === "function" ? _passaNosFiltrosPrev : null };')(
    esc, (id, rotulo, v) => '<simnao id="' + id + '" v="' + v + '">', {});
}

test('familia do beneficio', () => {
  const f = funcoes();
  assert.equal(f._familiaBeneficioPrev('aposentadoria_rural'), 'aposentadoria');
  assert.equal(f._familiaBeneficioPrev('auxilio_acidente'), 'incapacidade');
  assert.equal(f._familiaBeneficioPrev('aposentadoria_incapacidade'), 'incapacidade');
  assert.equal(f._familiaBeneficioPrev('bpc_deficiencia'), 'bpc');
  assert.equal(f._familiaBeneficioPrev('pensao_morte'), 'pensao_morte');
  assert.equal(f._familiaBeneficioPrev(null), '');
});

test('campos: valor escapado, select marcado, numero com virgula, data cortada', () => {
  const f = funcoes();
  const txt = f.htmlCampoPrev({ c: 'profissao', r: 'Profissão', t: 'texto' }, { profissao: '"><script>x</script>' });
  assert(!txt.includes('<script>') && txt.includes('&quot;&gt;&lt;script&gt;'));
  const sel = f.htmlCampoPrev({ c: 'sexo', r: 'Sexo', t: 'select', op: [['', 'Selecione'], ['F', 'Feminino'], ['M', 'Masculino']] }, { sexo: 'M' });
  assert(/<option value="M" selected>/.test(sel) && !/<option value="F" selected>/.test(sel));
  assert(f.htmlCampoPrev({ c: 'renda_propria', r: 'Renda', t: 'numero' }, { renda_propria: '1200.50' }).includes('value="1200,50"'));
  assert(f.htmlCampoPrev({ c: 'der', r: 'DER', t: 'data' }, { der: '2026-10-22T00:00:00' }).includes('value="2026-10-22"'));
  assert(f.htmlCampoPrev({ c: 'x', r: 'X', t: 'simnao' }, { x: true }).includes('v="true"'));
});

test('moeda em reais com milhar', () => {
  const f = funcoes();
  assert.equal(f._moedaPrev(1621), 'R$ 1.621,00');
  assert.equal(f._moedaPrev(810.5), 'R$ 810,50');
  assert.equal(f._moedaPrev(null), 'R$ 0,00');
});

test('filtros da lista: arquivadas, status, beneficio e busca por cliente', () => {
  const f = funcoes();
  const t = { cliente_nome: 'Maria Silva', status: 'em_andamento', beneficio_pretendido: 'bpc_idoso', arquivado_em: null };
  assert(f._passaNosFiltrosPrev(t, { busca: '', status: '', beneficio: '' }));
  assert(f._passaNosFiltrosPrev(t, { busca: 'maria', status: 'em_andamento', beneficio: 'bpc_idoso' }));
  assert(!f._passaNosFiltrosPrev(t, { busca: 'joao', status: '', beneficio: '' }));
  assert(!f._passaNosFiltrosPrev(t, { busca: '', status: 'concluida', beneficio: '' }));
  assert(!f._passaNosFiltrosPrev(t, { busca: '', status: '', beneficio: 'pensao_morte' }));
  assert(!f._passaNosFiltrosPrev(t, { busca: '', status: 'arquivada', beneficio: '' }));
  assert(f._passaNosFiltrosPrev(Object.assign({}, t, { arquivado_em: '2026-01-01' }), { busca: '', status: 'arquivada', beneficio: '' }));
  assert(!f._passaNosFiltrosPrev(Object.assign({}, t, { arquivado_em: '2026-01-01' }), { busca: '', status: '', beneficio: '' }));
});

test('o diagnostico escapa o texto vindo do servidor', () => {
  const codigo = trecho(fonte, '  function _htmlDiagnosticoPrev', '  function wireTriagemPrevWizard');
  const SPEC_PREV_VINCULO = [{ op: [['empregado', 'Empregado (CLT)']] }];
  const gerar = new Function('esc', 'fmtDataProcesso', '_moedaPrev', 'SPEC_PREV_VINCULO', codigo + '; return _htmlDiagnosticoPrev;')(esc, (d) => d, (n) => 'R$ ' + n, SPEC_PREV_VINCULO);
  const html = gerar({
    alertas: [{ severidade: 'critico', mensagem: '<img src=x onerror=alert(1)>', passo: 'vinculos' }],
    pendencias: [{ mensagem: '<b>x</b>', passo: 'segurado' }],
    elegibilidade: [{ regra: '<i>r</i>', atende: false, detalhe: 'd', falta: '<u>f</u>' }],
    resumo: {}, aviso: '<script>a</script>',
    vinculos: [{ tipo: 'empregado', empregador: '<svg onload=x>', data_inicio: '2000-01-01', especial: true, categoria_especial: 25 }],
  });
  assert(!/<img|<b>|<i>|<u>|<script>|<svg/.test(html));
  assert(html.includes('Empregado (CLT)') && html.includes('Especial 25a'));
  assert(html.includes('data-tprev-ir-passo="vinculos"') && html.includes('Crítico'));
});

test('coleta dos campos: so manda o que esta na tela (nao apaga o que ja estava salvo) e converte sim/nao', () => {
  const codigo = trecho(fonte, '  function coletarCamposPrev', '  // Lista editavel');
  const nos = { 'tprev-sexo': { value: ' F ' }, 'tprev-cid': { value: '' }, 'tprev-ok': {} };
  const documento = { getElementById: (id) => nos[id] || null };
  const coletar = new Function('document', 'lerSimNaoTriagem', codigo + '; return coletarCamposPrev;')(documento, (id) => (id === 'tprev-ok' ? true : null));
  const out = coletar([{ c: 'sexo', t: 'select' }, { c: 'cid', t: 'texto' }, { c: 'ok', t: 'simnao' }, { c: 'fora_da_tela', t: 'texto' }, { c: 'fora_simnao', t: 'simnao' }]);
  assert.deepEqual(out, { sexo: 'F', cid: '', ok: true });
  assert(!('fora_da_tela' in out) && !('fora_simnao' in out));
});

test('fase 2a: converter em processo (proxy, lista, relatorio) e impressao so do diagnostico', () => {
  assert(proxy.includes("triagem_prev_converter_processo: 'Erro de conexao ao converter"));
  assert(fonte.includes("'/api/painel?acao=triagem_prev_converter_processo'"));
  assert(fonte.includes('data-tprev-converter'));                              // item no menu da lista
  assert(fonte.includes("t.convertido_processo_id\n") || fonte.includes('t.convertido_processo_id\r\n'));   // lista usa o id devolvido pelo backend
  assert(fonte.includes('window.print()') && fonte.includes("classList.toggle('tprev-imprimindo', passo === 'analise_final')"));
  const css = ler('painel.css');
  const imp = css.slice(css.indexOf('@media print', css.indexOf('Relatorio da Triagem Previdenciaria')));
  for (const s of ['.sidebar', '.hdr-topo', '.triagem-nav-passos', '.tprev-acoes-relatorio', '.tprev-nao-imprimir']) assert(imp.includes(s), s);
  assert(imp.includes('--bg: #fff') && imp.includes('--ink: #111'));          // sai em folha clara mesmo no tema escuro
  assert(css.includes('.tprev-relatorio-cabecalho { display: none; }'));      // cabecalho do relatorio so aparece impresso
});

test('botao de converter so aparece com beneficio escolhido e triagem ainda nao convertida', () => {
  const trecho1 = trecho(fonte.replace(/\r\n/g, '\n'), 'var podeConverter = ', ';\n');
  assert(trecho1.includes('!d.convertido_processo_id') && trecho1.includes('!!d.beneficio_pretendido'));
  assert(fonte.includes("t.convertido_processo_id || !t.beneficio_pretendido ? '' : '<button type=\"button\" data-tprev-converter="));
});
