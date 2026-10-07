// Roda com: node tests/gastos.test.js
// Aba Gastos (Financeiro): a prévia de parcelas no navegador precisa dar EXATAMENTE o mesmo que o servidor
// (gastos.py), e a aba/ações precisam estar ligadas no painel e no proxy da Vercel.
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const fonte = fs.readFileSync(path.join(__dirname, '..', 'painel-app.js'), 'utf8').replace(/\r\n/g, '\n');
const proxy = fs.readFileSync(path.join(__dirname, '..', 'api', 'painel.js'), 'utf8');
const ini = fonte.indexOf('// GASTOS:inicio');
const fim = fonte.indexOf('// GASTOS:fim');
assert(ini > 0 && fim > ini, 'marcadores nao encontrados em painel-app.js');
const g = new Function(fonte.slice(ini, fim) + '; return { venc: _gastoVencimentoFatura, parcelas: _gastoVencimentosParcelas, dividir: _gastoDividirParcelas, numero: _gastoNumero, hoje: _gastoHojeLocal };')();

let falhas = 0;
function t(nome, fn) { try { fn(); console.log('ok  ' + nome); } catch (e) { falhas++; console.log('FALHA ' + nome + ': ' + e.message); } }

t('fatura: fecha dia 21, vence dia 28 (mesmos casos do servidor)', () => {
  [['2026-10-01', '2026-10-28'], ['2026-10-21', '2026-10-28'], ['2026-10-22', '2026-11-28'], ['2026-10-31', '2026-11-28'], ['2026-12-22', '2027-01-28']]
    .forEach(([compra, esperado]) => assert.strictEqual(g.venc(compra, 21, 28), esperado, compra));
});

t('fatura: vencimento no mês seguinte ao fechamento (fecha 25, vence 5)', () => {
  assert.strictEqual(g.venc('2026-10-10', 25, 5), '2026-11-05');
  assert.strictEqual(g.venc('2026-10-26', 25, 5), '2026-12-05');
});

t('fatura: vencimento 31 cai no último dia do mês curto', () => {
  assert.strictEqual(g.venc('2026-02-10', 20, 31), '2026-02-28');
});

t('parcelas: um vencimento por mês, ancorado no dia do cartão (dia 31 não "deriva" para 28)', () => {
  assert.deepStrictEqual(g.parcelas('2027-01-31', 31, 4), ['2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30']);
  assert.deepStrictEqual(g.parcelas('2026-11-28', 28, 3), ['2026-11-28', '2026-12-28', '2027-01-28']);
});

t('parcelas: compra dia 25 (depois do fechamento 21), 10x, 1ª em novembro e virada de ano', () => {
  const primeiro = g.venc('2026-10-25', 21, 28);
  const v = g.parcelas(primeiro, 28, 10);
  assert.strictEqual(v[0], '2026-11-28'); assert.strictEqual(v[1], '2026-12-28'); assert.strictEqual(v[3], '2027-02-28'); assert.strictEqual(v[9], '2027-08-28');
});

t('divisão: soma exata e a última absorve os centavos (igual ao servidor)', () => {
  assert.deepStrictEqual(g.dividir(100, 3, 0), [33.33, 33.33, 33.34]);
  assert.deepStrictEqual(g.dividir(1200, 10, 0), Array(10).fill(120));
  [[999.99, 7], [0.1, 3], [1234.56, 12]].forEach(([total, n]) => {
    const v = g.dividir(total, n, 0);
    assert.strictEqual(v.length, n);
    assert.strictEqual(Math.round(v.reduce((a, b) => a + b, 0) * 100), Math.round(total * 100));
  });
});

t('divisão: com valor da parcela, todas valem isso', () => {
  assert.deepStrictEqual(g.dividir(0, 10, 135), Array(10).fill(135));
});

t('número: aceita 1.234,56 / 45,5 / 45.50 / R$ 300,00 e recusa vazio, texto e zero', () => {
  assert.strictEqual(g.numero('1.234,56'), 1234.56);
  assert.strictEqual(g.numero('45,5'), 45.5);
  assert.strictEqual(g.numero('45.50'), 45.5);
  assert.strictEqual(g.numero('R$ 300,00'), 300);
  assert.strictEqual(g.numero('1.200'), 1200);          // milhar brasileiro, não 1,2
  assert.strictEqual(g.numero('1.200.000'), 1200000);
  assert.strictEqual(g.numero('1.200,50'), 1200.5);
  assert.strictEqual(g.numero('12.34'), 12.34);          // ponto com 2 casas continua sendo decimal
  ['', 'abc', '0', '0,00', null, undefined, '-5'].forEach(v => assert(isNaN(g.numero(v)), String(v)));
});

t('o painel do Financeiro tem a sub-aba "Gastos" com Escritório, Pessoal e Cartões', () => {
  assert(fonte.includes('<button type="button" class="subtab-btn" data-fin-tab="gastos">Gastos</button>'));
  assert(fonte.includes('data-fin-panel="gastos">\' + htmlGastos'));
  ['escritorio', 'pessoal', 'cartoes'].forEach(n => assert(fonte.includes('data-gnat="' + n + '"'), n));
  assert(fonte.includes("if (alvo === 'gastos') carregarGastos();"));
  assert(fonte.includes('wireFinTabs(); wireGastos();'));
});

t('a aba Pessoal avisa que só o usuário vê e que não entra nos gráficos do escritório', () => {
  assert(fonte.includes('Só você vê estes gastos. Eles não entram em nenhum gráfico nem saldo do escritório.'));
});

t('o formulário tem crédito com cartão, parcelas, valor da parcela e prévia; forma padrão Pix', () => {
  ['gasto-form-descricao', 'gasto-form-valor', 'gasto-form-data', 'gasto-form-categoria', 'gasto-form-forma', 'gasto-form-cartao', 'gasto-form-parcelas', 'gasto-form-valor-parcela', 'gasto-preview']
    .forEach(id => assert(fonte.includes('id="' + id + '"'), id));
  assert(fonte.includes("(k === 'pix' ? ' selected' : '')"));
});

t('excluir: parcela avulsa e compra inteira (só aparece "Excluir compra" quando parcelada)', () => {
  assert(fonte.includes('data-gasto-excluir-compra'));
  assert(fonte.includes("(parcelado ? 'Excluir parcela' : 'Excluir')"));
  assert(fonte.includes("acao=gasto_excluir', { natureza: gastosEstado.natureza, compra_id: compra }"));
});

t('o proxy da Vercel repassa as 7 ações de gastos/cartões, com o corpo inteiro', () => {
  ['gasto_listar', 'cartao_listar'].forEach(a => assert(proxy.includes("acao === 'gasto_listar' || acao === 'cartao_listar'") && proxy.includes(a), a));
  ['gasto_criar', 'gasto_atualizar', 'gasto_excluir', 'cartao_criar', 'cartao_atualizar'].forEach(a => assert(proxy.includes(a + ': '), a));
  const bloco = proxy.slice(proxy.indexOf('var acoesGastoPost'), proxy.indexOf("if (acao === 'tarefa_listar')"));
  assert(bloco.includes('body: JSON.stringify(corpo)'), 'corpo inteiro');
});


t('data padrao do gasto e a de hoje no relogio local, nao a de UTC', () => {
  const noite = new Date(2026, 9, 7, 22, 30);          // 07/10 as 22h30 locais (em UTC ja seria 08/10 no Brasil)
  assert.strictEqual(g.hoje(noite), '2026-10-07');
  assert.strictEqual(g.hoje(new Date(2026, 0, 5, 0, 5)), '2026-01-05');
});
t('o modal de gasto usa a data local e o chip de origem diz Mensagem', () => {
  assert(fonte.includes("document.getElementById('gasto-form-data').value = _gastoHojeLocal();"));
  assert(fonte.includes('>Mensagem</span>') && !fonte.includes('chip neutral">WhatsApp</span>'));
});

if (falhas) { console.log('\n' + falhas + ' falha(s)'); process.exit(1); }
console.log('\ntodos passaram');
