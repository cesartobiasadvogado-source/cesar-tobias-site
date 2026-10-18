// Roda com: node tests/olhinhos-financeiro.test.js
// Olhinhos (ocultar valores) nos cartoes da aba Financeiro: Painel Executivo, Contas a pagar e Gastos. Estado no localStorage (mesmo prefixo dos cartoes da
// pagina inicial), mascara em CSS (vale mesmo quando o texto e reescrito depois) e um unico ouvinte de clique para a pagina toda.
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const raiz = path.join(__dirname, '..');
const fonte = fs.readFileSync(path.join(raiz, 'painel-app.js'), 'utf8').replace(/\r\n/g, '\n');
const css = fs.readFileSync(path.join(raiz, 'painel.css'), 'utf8').replace(/\r\n/g, '\n');

let falhas = 0;
function t(nome, fn) { try { fn(); console.log('ok  ' + nome); } catch (e) { falhas++; console.log('FALHA ' + nome + ': ' + e.message); } }

const ini = fonte.indexOf('// OLHINHOS:inicio');
const fim = fonte.indexOf('// OLHINHOS:fim');
assert(ini > 0 && fim > ini, 'marcadores OLHINHOS nao encontrados');
const bloco = fonte.slice(ini, fim);

function armazenamento(inicial) {
  const dados = Object.assign({}, inicial || {});
  return {
    dados,
    getItem: (k) => (k in dados ? dados[k] : null),
    setItem: (k, v) => { dados[k] = String(v); },
    removeItem: (k) => { delete dados[k]; },
  };
}
function ajudantes(ls) {
  const valorOculto = (chave) => ls.getItem('painel_oculto_' + chave) === '1';
  return new Function('valorOculto', 'localStorage', bloco + '; return { olhoCssRotulo, olhoCssAtributoValor, olhoCssBotao, cardValorCss, alternarOlhoCss };')(valorOculto, ls);
}

class No {
  constructor(attrs) { this.attrs = Object.assign({}, attrs); this.textContent = ''; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  removeAttribute(k) { delete this.attrs[k]; }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
}
function raizFalsa(nos) {
  return {
    querySelectorAll(seletor) {
      const m = /^\[([\w-]+)="([\w-]+)"\]$/.exec(seletor);
      assert(m, 'seletor inesperado: ' + seletor);
      return nos.filter((n) => n.attrs[m[1]] === m[2]);
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------- ajudantes
t('visivel por padrao: sem atributos de mascara e botao "Ocultar valor" com o olho aberto', () => {
  const h = ajudantes(armazenamento());
  assert.strictEqual(h.olhoCssAtributoValor('exec_saldo'), ' data-oculto-chave="exec_saldo"');
  const b = h.olhoCssBotao('exec_saldo');
  assert(b.includes('data-olho-css="exec_saldo"') && b.includes('aria-pressed="false"') && b.includes('title="Ocultar valor"') && b.includes('aria-label="Ocultar valor"'));
  assert(b.includes('class="btn-olho"') && b.includes('type="button"') && b.endsWith('👁</button>'));
});

t('estado salvo: ja nasce oculto (data-oculto, aria-hidden) e com o botao "Mostrar valor"', () => {
  const h = ajudantes(armazenamento({ painel_oculto_exec_saldo: '1' }));
  assert.strictEqual(h.olhoCssAtributoValor('exec_saldo'), ' data-oculto-chave="exec_saldo" data-oculto="1" aria-hidden="true"');
  const b = h.olhoCssBotao('exec_saldo');
  assert(b.includes('aria-pressed="true"') && b.includes('title="Mostrar valor"') && b.endsWith('🙈</button>'));
  assert.strictEqual(h.olhoCssAtributoValor('exec_atraso'), ' data-oculto-chave="exec_atraso"');         // outra chave nao e afetada
});

t('alternar: grava no localStorage, marca todos os elementos da chave e atualiza o botao; de novo desfaz', () => {
  const ls = armazenamento();
  const h = ajudantes(ls);
  const valor = new No({ 'data-oculto-chave': 'cpagar_pago' });
  const sub = new No({ 'data-oculto-chave': 'cpagar_pago' });
  const outro = new No({ 'data-oculto-chave': 'cpagar_atraso' });
  const botao = new No({ 'data-olho-css': 'cpagar_pago' });
  const r = raizFalsa([valor, sub, outro, botao]);
  assert.strictEqual(h.alternarOlhoCss(r, 'cpagar_pago'), true);
  assert.strictEqual(ls.dados.painel_oculto_cpagar_pago, '1');
  [valor, sub].forEach((n) => assert(n.attrs['data-oculto'] === '1' && n.attrs['aria-hidden'] === 'true'));
  assert(!('data-oculto' in outro.attrs));
  assert(botao.attrs['aria-pressed'] === 'true' && botao.attrs.title === 'Mostrar valor' && botao.attrs['aria-label'] === 'Mostrar valor' && botao.textContent === '🙈');
  assert.strictEqual(h.alternarOlhoCss(r, 'cpagar_pago'), false);
  assert(!('painel_oculto_cpagar_pago' in ls.dados));
  [valor, sub].forEach((n) => assert(!('data-oculto' in n.attrs) && !('aria-hidden' in n.attrs)));
  assert(botao.attrs['aria-pressed'] === 'false' && botao.attrs.title === 'Ocultar valor' && botao.textContent === '👁');
});

t('alternar nao quebra se o navegador recusar o armazenamento (modo privado): a tela ainda muda', () => {
  const ls = armazenamento();
  ls.setItem = () => { throw new Error('QuotaExceeded'); };
  const h = ajudantes(ls);
  const valor = new No({ 'data-oculto-chave': 'k' });
  assert.strictEqual(h.alternarOlhoCss(raizFalsa([valor]), 'k'), true);
  assert.strictEqual(valor.attrs['data-oculto'], '1');
});

t('cartao com olhinho: valor + botao na mesma linha, id e cor preservados, rotulo abaixo', () => {
  const h = ajudantes(armazenamento({ painel_oculto_gastos_total: '1' }));
  const html = h.cardValorCss({ id: 'meu-id', chave: 'gastos_total', cor: 'var(--warn)', valor: '1.234,56', rotulo: 'Gastos do mes' });
  assert(html.includes('<div class="stat-value money" id="meu-id" style="color:var(--warn);" data-oculto-chave="gastos_total" data-oculto="1" aria-hidden="true">1.234,56</div>'));
  assert(html.includes('data-olho-css="gastos_total"') && html.includes('<div class="stat-label">Gastos do mes</div>'));
  const sem = h.cardValorCss({ chave: 'x', valor: '1,00', rotulo: 'R' });
  assert(!sem.includes(' id=') && !sem.includes('style="color'));
});

// ---------------------------------------------------------------------------------------------------------------- cartoes do Painel Executivo
const iniExec = fonte.indexOf('function execStatCard(opts) {');
const fimExec = fonte.indexOf('\n    var htmlPainelExecutivo', iniExec);
assert(iniExec > 0 && fimExec > iniExec, 'execStatCard nao encontrado');
function execCard(opts, oculto) {
  const ls = armazenamento(oculto);
  const h = ajudantes(ls);
  const esc = (x) => String(x);
  return new Function('esc', 'olhoCssAtributoValor', 'olhoCssBotao', fonte.slice(iniExec, fimExec) + '; return execStatCard;')(esc, h.olhoCssAtributoValor, h.olhoCssBotao)(opts);
}

t('Painel Executivo: cartao de dinheiro ganha o olhinho e o valor fica ligado a chave exec_<nome>', () => {
  const html = execCard({ id: 'exec-kpi-projetado-90d', idSub: 'exec-kpi-projetado-90d-sub', label: 'Previsto', icone: '<svg></svg>', subMoney: true });
  assert(html.includes('data-olho-css="exec_projetado_90d"'));
  assert(html.includes('id="exec-kpi-projetado-90d"') && html.includes('data-oculto-chave="exec_projetado_90d">—</div>'));
  assert(html.includes('id="exec-kpi-projetado-90d-sub" data-oculto-chave="exec_projetado_90d">'));          // rodape com R$ tambem some
  assert(html.indexOf('data-olho-css') < html.indexOf('<span class="exec-stat-icon">'));                     // olho ao lado do icone
});

t('Painel Executivo: cartao que ja nasce oculto (estado salvo)', () => {
  const html = execCard({ id: 'exec-kpi-saldo', idSub: 'exec-kpi-saldo-sub', label: 'Saldo', icone: '', subMoney: true }, { painel_oculto_exec_saldo: '1' });
  assert(html.includes('id="exec-kpi-saldo" data-oculto-chave="exec_saldo" data-oculto="1" aria-hidden="true">—</div>'));
  assert(html.includes('id="exec-kpi-saldo-sub" data-oculto-chave="exec_saldo" data-oculto="1" aria-hidden="true">'));
});

t('Painel Executivo: contagem sem dinheiro nao ganha olhinho nem mascara', () => {
  const html = execCard({ id: 'exec-kpi-contratos-ativos', idSub: 'exec-kpi-contratos-ativos-sub', label: 'Contratos', icone: '', money: false });
  assert(!html.includes('data-olho-css') && !html.includes('data-oculto'));
});

t('Painel Executivo: contagem com rodape em R$ (contas recorrentes) ganha olhinho so no rodape', () => {
  const html = execCard({ id: 'exec-kpi-recorrentes', idSub: 'exec-kpi-comprometido-sub', label: 'Recorrentes', icone: '', money: false, subMoney: true });
  assert(html.includes('data-olho-css="exec_recorrentes"'));
  assert(!html.includes('id="exec-kpi-recorrentes" data-oculto-chave'));
  assert(html.includes('id="exec-kpi-comprometido-sub" data-oculto-chave="exec_recorrentes"'));
});

t('todos os 9 cartoes do Painel Executivo: os que mostram R$ tem olhinho (valor ou rodape)', () => {
  const chamadas = fonte.match(/execStatCard\(\{ id: '[^']+'[^}]*\}\)/g) || [];
  assert.strictEqual(chamadas.length, 9);
  const deDinheiro = chamadas.filter((c) => !c.includes('money: false'));
  assert.strictEqual(deDinheiro.length, 7);                                      // saldo, previsto 90d, a receber, a pagar, atraso, valor total, recebido
  ['exec-kpi-saldo', 'exec-kpi-projetado-90d', 'exec-kpi-a-pagar'].forEach((id) =>
    assert(chamadas.some((c) => c.includes("'" + id + "'") && c.includes('subMoney: true')), id + ' deve esconder tambem o rodape'));
  assert(chamadas.some((c) => c.includes("'exec-kpi-recorrentes'") && c.includes('subMoney: true')));
});

// ---------------------------------------------------------------------------------------------------------------- contas a pagar e gastos
t('Contas a pagar: os 3 totais usam o cartao com olhinho, mantendo os ids que o JS preenche', () => {
  [['cpagar-total-pendente', 'cpagar_pendente', 'var(--warn)'], ['cpagar-total-pago', 'cpagar_pago', 'var(--good)'], ['cpagar-total-atraso', 'cpagar_atraso', 'var(--crit)']]
    .forEach(([id, chave, cor]) => assert(fonte.includes("cardValorCss({ id: '" + id + "', chave: '" + chave + "', cor: '" + cor + "'"), id));
  assert(fonte.includes("getElementById('cpagar-total-pendente')") && fonte.includes('elPendente.textContent = fmtMoeda(pendente)'));
});

t('Gastos: os 2 totais do mes usam o cartao com olhinho', () => {
  assert(fonte.includes("cardValorCss({ chave: 'gastos_total', valor: fmtMoeda(d.total)"));
  assert(fonte.includes("cardValorCss({ chave: 'gastos_comprometido', cor: 'var(--warn)', valor: fmtMoeda(d.comprometido_futuro)"));
});

t('nenhum cartao "stat-value money" ficou sem olhinho (so os dois moldes, ambos com botao)', () => {
  const ocorrencias = fonte.split('class="stat-value money"').length - 1;
  assert.strictEqual(ocorrencias, 2);          // renderCardValor (pagina inicial, ja tinha) e cardValorCss
});

t('chaves de olhinho do Financeiro sao unicas e nao colidem com as dos cartoes da pagina inicial', () => {
  const novas = ['cpagar_pendente', 'cpagar_pago', 'cpagar_atraso', 'gastos_total', 'gastos_comprometido'];
  const antigas = (fonte.match(/renderCardValor\('([a-z_]+)'/g) || []).map((x) => /'([a-z_]+)'/.exec(x)[1]);
  novas.forEach((k) => assert(!antigas.includes(k), k));
  const ids = (fonte.match(/execStatCard\(\{ id: 'exec-kpi-([a-z0-9-]+)'/g) || []).map((x) => 'exec_' + /kpi-([a-z0-9-]+)'/.exec(x)[1].replace(/-/g, '_'));
  assert.strictEqual(new Set(ids.concat(novas)).size, ids.length + novas.length);
});

// ---------------------------------------------------------------------------------------------------------------- ligacao na pagina
t('um unico ouvinte de clique para a pagina toda, instalado uma vez', () => {
  const i = fonte.indexOf('var olhinhosCssInstalados = false;');
  const f = fonte.indexOf('\n  }\n', fonte.indexOf('function wireOlhinhosCss')) + 5;
  assert(i > 0 && f > i);
  const adicionados = [];
  const chamadas = [];
  const documento = { addEventListener: (tipo, fn) => adicionados.push([tipo, fn]) };
  const wire = new Function('document', 'alternarOlhoCss', fonte.slice(i, f) + '; return wireOlhinhosCss;')(documento, (r, k) => chamadas.push(k));
  wire(); wire(); wire();
  assert.strictEqual(adicionados.length, 1);
  assert.strictEqual(adicionados[0][0], 'click');
  const clicar = adicionados[0][1];
  clicar({ target: { closest: (s) => (s === '[data-olho-css]' ? { getAttribute: () => 'exec_saldo' } : null) } });
  clicar({ target: { closest: () => null } });
  clicar({ target: null });
  assert.deepStrictEqual(chamadas, ['exec_saldo']);                             // clique fora de um olhinho e ignorado
});

t('a aba Financeiro liga os olhinhos antes de montar o resto', () => {
  assert(fonte.includes("if (PAGINA_ATUAL === 'financeiro_novo') {\n      wireOlhinhosCss();\n      wireFinTabs();"));
});

t('os olhinhos antigos (data-olho) continuam como estavam', () => {
  assert(fonte.includes("document.querySelectorAll('[data-olho]').forEach(function (btn) {"));
  assert(fonte.includes('<button class="btn-olho" data-olho="'));
});

// ---------------------------------------------------------------------------------------------------------------- CSS
const cssN = css.replace(/\s+/g, ' ');
t('CSS: a mascara esconde o texto real mantendo o espaco e mostra pontos na cor do valor', () => {
  assert(cssN.includes('[data-oculto="1"] { position: relative; -webkit-text-fill-color: transparent; user-select: none; }'));
  assert(cssN.includes('[data-oculto="1"]::after { content: \'\\2022\\2022\\2022\\2022\\2022\\2022\'; position: absolute; left: 0; top: 0; -webkit-text-fill-color: currentColor; }'));
});

t('CSS: rodape do cartao executivo alinha os pontos abaixo da linha, e o grupo olho+icone nao encolhe', () => {
  assert(cssN.includes('.exec-stat-foot[data-oculto="1"]::after { top: 8px; }'));
  assert(cssN.includes('.exec-stat-direita { display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; }'));
});

t('CSS: o botao do olhinho continua com o estilo de sempre', () => {
  assert(cssN.includes('.btn-olho { background: none; border: none; cursor: pointer;'));
});

t('CSS: a mascara nao depende de classe do tema (vale em claro e escuro) e nao fixa cor', () => {
  const trecho = cssN.slice(cssN.indexOf('[data-oculto="1"] {'), cssN.indexOf('.exec-stat-direita'));
  assert(!/#[0-9a-fA-F]{3,6}\b|rgb\(|\[data-theme/.test(trecho));
});

if (falhas) { console.log('\n' + falhas + ' falha(s)'); process.exit(1); }
console.log('\ntodos os testes passaram');
