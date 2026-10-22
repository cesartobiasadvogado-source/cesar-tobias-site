// Roda com: node tests/olho-geral.test.js
// Olho geral do topo (ao lado do "+"): esconde todos os valores financeiros da tela. Valores em reais viram pontos; datas, contagens e porcentagens ficam. O texto original volta ao desligar.
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const raiz = path.join(__dirname, '..');
const fonte = fs.readFileSync(path.join(raiz, 'painel-app.js'), 'utf8').replace(/\r\n/g, '\n');
const css = fs.readFileSync(path.join(raiz, 'painel.css'), 'utf8').replace(/\r\n/g, '\n').replace(/\s+/g, ' ');
const htmls = fs.readdirSync(raiz).filter((f) => /^painel.*\.html$/.test(f));

let falhas = 0;
function t(nome, fn) { try { fn(); console.log('ok  ' + nome); } catch (e) { falhas++; console.log('FALHA ' + nome + ': ' + e.message); } }

const ini = fonte.indexOf('// OLHOGERAL:inicio');
const fim = fonte.indexOf('// OLHOGERAL:fim');
assert(ini > 0 && fim > ini, 'marcadores OLHOGERAL nao encontrados');
const g = new Function(fonte.slice(ini, fim) + '; return { MASCARA_GERAL, textoTemValorFinanceiro, mascararValoresFinanceiros, coletarTextosDaPagina, aplicarOcultacaoNosTextos, aplicarOcultacaoNosAtributos, varrerOcultacaoGeral };')();
const PONTOS = '••••••';

// ---------------------------------------------------------------------------------------------------------------- o que e (e o que nao e) valor financeiro
const MASCARA = [
  ['R$ 1.234,56', PONTOS], ['1.234,56', PONTOS], ['-1.234,56', PONTOS], ['+250,00', PONTOS], ['−1.000,00', PONTOS], ['0,00', PONTOS], ['R$ 0,00', PONTOS],
  ['225750,50', PONTOS], ['R$ 500', PONTOS], ['R$ 5k', PONTOS], ['R$ 12 mil', PONTOS], ['R$ 1,2 mi', PONTOS], ['R$ 1.200', PONTOS], ['R$1.200,00', PONTOS],
  ['receita R$ 3.000,00 · despesas R$ 4.234,56', 'receita ' + PONTOS + ' · despesas ' + PONTOS],
  ['Saldo estimado: -R$ 1.000,00', 'Saldo estimado: -' + PONTOS], ['Recebido: R$ 100,00 (3x de 33,33)', 'Recebido: ' + PONTOS + ' (3x de ' + PONTOS + ')'],
  ['10.000,00', PONTOS], ['1.234.567,89', PONTOS],
];
MASCARA.forEach(([entrada, saida]) => t('mascara: "' + entrada + '"', () => {
  assert(g.textoTemValorFinanceiro(entrada));
  assert.strictEqual(g.mascararValoresFinanceiros(entrada), saida);
}));

const FICA = [
  '19/10/2026', '2026-10-19', '13 lançamentos', 'Parcela 3/10', '12', '12,50%', '5,25 %'.replace(' ', ''), 'Página 1 de 3', '25 itens por página', '(96) 99162-5462',
  '0001234-56.2024.8.03.0001', 'OAB/AP 1234', 'CPF 123.456.789-09', 'Em andamento', 'R$', 'R$ ', 'Salário', '10x', '2 dias', 'versão 1.2', '3,5 anos',
];
FICA.forEach((texto) => t('nao mascara: "' + texto + '"', () => {
  assert(!g.textoTemValorFinanceiro(texto), 'detectou valor onde nao ha');
  assert.strictEqual(g.mascararValoresFinanceiros(texto), texto);
}));

t('a mascara nao revela o tamanho do numero (sempre 6 pontos)', () => {
  assert.strictEqual(g.mascararValoresFinanceiros('1,00'), g.mascararValoresFinanceiros('9.999.999,99'));
  assert.strictEqual(g.MASCARA_GERAL, PONTOS);
});

t('nao falha com entradas estranhas', () => {
  [null, undefined, 5, {}, ''].forEach((x) => assert.strictEqual(g.textoTemValorFinanceiro(x), false));
});

// ---------------------------------------------------------------------------------------------------------------- troca e restauracao nos textos (DOM simulado)
const FILTRO = { SHOW_TEXT: 4, FILTER_ACCEPT: 1, FILTER_REJECT: 2 };
function texto(valor, tag) { return { nodeType: 3, nodeValue: valor, parentNode: { tagName: tag || 'DIV' } }; }
function arvore(nos) {
  return { nodeType: 1, childNodes: nos };
}
const docFalso = {
  createTreeWalker(raizNo, mostrar, filtro) {
    const todos = [];
    (function descer(no) {
      (no.childNodes || []).forEach((f) => { if (f.nodeType === 3) { if (filtro.acceptNode(f) === FILTRO.FILTER_ACCEPT) todos.push(f); } else descer(f); });
    })(raizNo);
    let i = -1;
    return { nextNode() { i++; this.currentNode = todos[i]; return i < todos.length; }, currentNode: null };
  },
};

t('varredura: troca so os textos com valor e preserva o resto', () => {
  const a = texto('R$ 1.200,00'), b = texto('13 lançamentos'), c = texto('Venc. 19/10/2026'), d = texto('-250,00');
  const r = arvore([a, b, arvore([c, d])]);
  g.aplicarOcultacaoNosTextos(g.coletarTextosDaPagina(r, docFalso, FILTRO), true);
  assert.deepStrictEqual([a.nodeValue, b.nodeValue, c.nodeValue, d.nodeValue], [PONTOS, '13 lançamentos', 'Venc. 19/10/2026', PONTOS]);
});

t('varredura ignora script, style, noscript e textarea', () => {
  const nos = [texto('var x = "R$ 99,99"', 'SCRIPT'), texto('.a{content:"1,00"}', 'STYLE'), texto('R$ 5,00', 'TEXTAREA'), texto('R$ 7,00', 'NOSCRIPT'), texto('R$ 8,00', 'SPAN')];
  const lista = g.coletarTextosDaPagina(arvore(nos), docFalso, FILTRO);
  assert.deepStrictEqual(lista.map((n) => n.nodeValue), ['R$ 8,00']);
  g.aplicarOcultacaoNosTextos(lista, true);
  assert.deepStrictEqual(nos.map((n) => n.nodeValue), ['var x = "R$ 99,99"', '.a{content:"1,00"}', 'R$ 5,00', 'R$ 7,00', PONTOS]);
});

t('desligar devolve exatamente o texto original', () => {
  const a = texto('receita R$ 3.000,00 · despesas R$ 4.234,56'), b = texto('1.234,56');
  g.aplicarOcultacaoNosTextos([a, b], true);
  assert(a.nodeValue.includes('receita ') && !a.nodeValue.includes('3.000'));
  g.aplicarOcultacaoNosTextos([a, b], false);
  assert.deepStrictEqual([a.nodeValue, b.nodeValue], ['receita R$ 3.000,00 · despesas R$ 4.234,56', '1.234,56']);
  assert(!('__ogOriginal' in a) && !('__ogMascarado' in a));
});

t('ligar duas vezes nao mascara a mascara nem perde o original', () => {
  const a = texto('R$ 10,00');
  g.aplicarOcultacaoNosTextos([a], true);
  g.aplicarOcultacaoNosTextos([a], true);
  assert.strictEqual(a.nodeValue, PONTOS);
  g.aplicarOcultacaoNosTextos([a], false);
  assert.strictEqual(a.nodeValue, 'R$ 10,00');
});

t('o app reescreve o mesmo texto enquanto oculto: o novo valor tambem some e volta ao desligar', () => {
  const a = texto('R$ 10,00');
  g.aplicarOcultacaoNosTextos([a], true);
  a.nodeValue = 'R$ 20,00';                           // atualizacao feita pelo painel
  g.aplicarOcultacaoNosTextos([a], true);
  assert.strictEqual(a.nodeValue, PONTOS);
  g.aplicarOcultacaoNosTextos([a], false);
  assert.strictEqual(a.nodeValue, 'R$ 20,00');        // volta o valor NOVO, nao o antigo
});

t('o app troca o texto por algo sem valor enquanto oculto: nada e restaurado por cima', () => {
  const a = texto('R$ 10,00');
  g.aplicarOcultacaoNosTextos([a], true);
  a.nodeValue = 'Carregando...';
  g.aplicarOcultacaoNosTextos([a], true);
  g.aplicarOcultacaoNosTextos([a], false);
  assert.strictEqual(a.nodeValue, 'Carregando...');
});

t('o app reescreve o texto enquanto oculto e o olho e desligado sem nova varredura: nao desfaz a mudanca do app', () => {
  const a = texto('R$ 10,00');
  g.aplicarOcultacaoNosTextos([a], true);
  a.nodeValue = 'Pago';
  g.aplicarOcultacaoNosTextos([a], false);
  assert.strictEqual(a.nodeValue, 'Pago');
});

t('texto solto como raiz (no de texto) tambem e tratado', () => {
  const a = texto('R$ 1,00');
  assert.deepStrictEqual(g.coletarTextosDaPagina(a, docFalso, FILTRO), [a]);
  assert.deepStrictEqual(g.coletarTextosDaPagina(null, docFalso, FILTRO), []);
});

// ---------------------------------------------------------------------------------------------------------------- atributos (dicas ao passar o mouse)
function elemento(attrs) {
  const e = { attrs: Object.assign({}, attrs), getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }, setAttribute(k, v) { this.attrs[k] = v; } };
  return e;
}

t('dicas (title / aria-label) com valor tambem somem e voltam', () => {
  const e = elemento({ title: 'Recebido: R$ 100,00', 'aria-label': 'Saldo -250,00' });
  g.aplicarOcultacaoNosAtributos(e, true);
  assert.deepStrictEqual([e.attrs.title, e.attrs['aria-label']], ['Recebido: ' + PONTOS, 'Saldo ' + PONTOS]);
  g.aplicarOcultacaoNosAtributos(e, true);
  assert.strictEqual(e.attrs.title, 'Recebido: ' + PONTOS);
  g.aplicarOcultacaoNosAtributos(e, false);
  assert.deepStrictEqual([e.attrs.title, e.attrs['aria-label']], ['Recebido: R$ 100,00', 'Saldo -250,00']);
});

t('dicas sem valor e elementos sem atributo ficam intactos', () => {
  const e = elemento({ title: 'Ocultar valor' });
  g.aplicarOcultacaoNosAtributos(e, true);
  assert.strictEqual(e.attrs.title, 'Ocultar valor');
  g.aplicarOcultacaoNosAtributos(elemento({}), true);
});

t('se o app troca a dica enquanto oculto, desligar nao a sobrescreve', () => {
  const e = elemento({ title: 'R$ 5,00' });
  g.aplicarOcultacaoNosAtributos(e, true);
  e.attrs.title = 'Novo texto';
  g.aplicarOcultacaoNosAtributos(e, false);
  assert.strictEqual(e.attrs.title, 'Novo texto');
});

t('varredura completa de um elemento (textos + dicas dos descendentes)', () => {
  const filho = elemento({ title: 'R$ 9,00' });
  const raizEl = Object.assign(elemento({}), { nodeType: 1, childNodes: [texto('R$ 1,00')], hasAttribute: () => false, querySelectorAll: () => [filho] });
  g.varrerOcultacaoGeral(raizEl, true, docFalso, FILTRO);
  assert.strictEqual(raizEl.childNodes[0].nodeValue, PONTOS);
  assert.strictEqual(filho.attrs.title, PONTOS);
  g.varrerOcultacaoGeral(raizEl, false, docFalso, FILTRO);
  assert.strictEqual(raizEl.childNodes[0].nodeValue, 'R$ 1,00');
  assert.strictEqual(filho.attrs.title, 'R$ 9,00');
});

// ---------------------------------------------------------------------------------------------------------------- ligacao no painel
t('o botao do olho geral existe nas 21 paginas, ao lado do "+" (antes dele), com acessibilidade e o icone inicial', () => {
  assert.strictEqual(htmls.length, 21);
  htmls.forEach((f) => {
    const h = fs.readFileSync(path.join(raiz, f), 'utf8').replace(/\r\n/g, '\n');
    const i = h.indexOf('id="hdr-btn-olho-geral"'), j = h.indexOf('<div class="hdr-add-wrap">');
    assert(i > 0 && j > i, f + ': botao ausente ou depois do +');
    assert(h.slice(i, j).length < 900, f + ': botao nao esta colado ao +');
    const antes = h.slice(0, h.lastIndexOf('<button', i)).replace(/\s+$/, '');
    assert(antes.endsWith('<div class="hdr-acoes">'), f + ': o olho deve ser o primeiro item das acoes do topo, logo antes do +');
    const botao = h.slice(h.lastIndexOf('<button', i), h.indexOf('</button>', i));
    assert(botao.includes('class="hdr-icone-btn"') && botao.includes('aria-label="Ocultar todos os valores"') && botao.includes('aria-pressed="false"') && botao.includes('title="Ocultar todos os valores"'), f);
    assert(botao.includes('<circle') && botao.includes('aria-hidden="true"'), f + ': icone inicial');
    assert.strictEqual(h.split('id="hdr-btn-olho-geral"').length, 2, f + ': id duplicado');
  });
});

t('as paginas carregam a versao nova dos arquivos (cache)', () => {
  htmls.forEach((f) => {
    const h = fs.readFileSync(path.join(raiz, f), 'utf8');
    if (h.includes('painel-app.js?v=')) assert(h.includes('painel-app.js?v=20261021-geral1') && h.includes('painel.css?v=20261021-geral1'), f);
  });
});

t('JS: estado em painel_oculto_geral, varredura inicial e observador para o que chega depois, ligado na carga da pagina', () => {
  assert(fonte.includes("var oculto = valorOculto('geral');"));
  assert(fonte.includes("localStorage.setItem('painel_oculto_geral', '1')") && fonte.includes("localStorage.removeItem('painel_oculto_geral')"));
  assert(fonte.includes("document.getElementById('hdr-btn-olho-geral')"));
  assert(fonte.includes("observadorOcultacaoGeral.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['title', 'aria-label'] });"));
  assert(fonte.includes("document.documentElement.setAttribute('data-oculto-geral', '1')") && fonte.includes("document.documentElement.removeAttribute('data-oculto-geral')"));
  assert(fonte.includes('\n  wireOlhoGeral();\n'));
  assert(fonte.indexOf('\n  wireOlhoGeral();\n') > fonte.indexOf('var SVG_OLHO_FECHADO'), 'precisa rodar DEPOIS de os icones existirem');
});

t('JS: o clique no olho nao fecha os menus nem dispara outros cliques; ao desligar o observador e desconectado', () => {
  assert(fonte.includes("btn.addEventListener('click', function (ev) {\n      ev.stopPropagation();"));
  assert(fonte.includes('observadorOcultacaoGeral.disconnect(); observadorOcultacaoGeral = null;'));
});

t('JS: o botao usa os mesmos icones dos cartoes (aberto = visivel, fechado = oculto) e rotulos claros', () => {
  const i = fonte.indexOf('function wireOlhoGeral()');
  const corpo = fonte.slice(i, fonte.indexOf('\n  wireOlhoGeral();\n', i));
  assert(corpo.includes("btn.innerHTML = iconeOlho(oculto);"));
  assert(corpo.includes("'Mostrar todos os valores' : 'Ocultar todos os valores'"));
  assert(corpo.includes("btn.setAttribute('aria-pressed', oculto ? 'true' : 'false');"));
  assert(corpo.includes("btn.setAttribute('aria-label', rotulo);") && corpo.includes("btn.setAttribute('title', rotulo);"));
});

t('CSS: botao pressionado destacado e graficos (que mostram valores pela forma) desfocados quando oculto', () => {
  assert(css.includes('.hdr-icone-btn[aria-pressed="true"] { background: rgba(255,255,255,0.12); color: var(--sidebar-ink); }'));
  assert(css.includes('[data-oculto-geral="1"] #exec-grafico-svg, [data-oculto-geral="1"] .fluxo-bars-grupos, [data-oculto-geral="1"] .exec-cat-donut svg { filter: blur(9px); pointer-events: none; user-select: none; }'));
});

t('os olhinhos dos cartoes continuam independentes (data-olho-css) e sem emoji', () => {
  assert(fonte.includes('data-olho-css'));
  assert(!/[\u{1F300}-\u{1FAFF}]/u.test(fonte.slice(ini, fim)));
});

if (falhas) { console.log('\n' + falhas + ' falha(s)'); process.exit(1); }
console.log('\ntodos os testes passaram');
