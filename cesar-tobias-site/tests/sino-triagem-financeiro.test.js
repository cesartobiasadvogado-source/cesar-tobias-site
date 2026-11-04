// Roda com: node tests/sino-triagem-financeiro.test.js
// Sino: triagens paradas (trabalhista e previdenciaria) e contas a pagar do escritorio.
// Contas a pagar so aparecem pra quem tem permissao "financeiro"; triagens, pra quem tem "processos".
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const fonte = fs.readFileSync(path.join(__dirname, '..', 'painel-app.js'), 'utf8').replace(/\r\n/g, '\n');
const bloco = fonte.slice(fonte.indexOf('// SINO:inicio'), fonte.indexOf('// SINO:fim'));
assert(bloco.length > 100, 'bloco do sino nao encontrado');

let falhas = 0;
async function t(nome, fn) { try { await fn(); console.log('ok  ' + nome); } catch (e) { falhas++; console.log('FALHA ' + nome + ': ' + e.message); } }
const tick = () => new Promise(r => setTimeout(r, 5));
function iso(offset) {
  const d = new Date(); d.setDate(d.getDate() + offset);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
const HOJE = '2026-11-10';

// parte pura: sinoMontarItens
const puro = new Function('esc', 'fmtDataProcesso', '_fmtISOData', 'localStorage',
  bloco + '\nreturn { montar: sinoMontarItens };')(
  x => String(x), i => i.split('-').reverse().join('/'), d => d.toISOString().slice(0, 10), { getItem: () => null, setItem() {} });
const montar = (f, janela) => puro.montar(f, HOJE, janela || 3);

t('triagem em andamento parada ha 7+ dias entra como "atencao"; ha 6 dias fica de fora', async () => {
  const r = montar({ triagens: [
    { id: 1, origem: 'trab', status: 'em_andamento', cliente_nome: 'Maria', atualizado_em: '2026-11-03T10:00:00Z' },
    { id: 2, origem: 'trab', status: 'em_andamento', cliente_nome: 'José', atualizado_em: '2026-11-04T10:00:00Z' },
  ] });
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].urgencia, 'atencao');
  assert(r[0].detalhe.includes('Trabalhista') && r[0].detalhe.includes('Em andamento') && r[0].detalhe.includes('há 7 dias'));
});

t('triagem nao iniciada avisa mais cedo (2 dias)', async () => {
  const r = montar({ triagens: [
    { id: 1, origem: 'trab', status: 'nao_iniciada', cliente_nome: 'A', atualizado_em: '2026-11-08T00:00:00Z' },
    { id: 2, origem: 'trab', status: 'nao_iniciada', cliente_nome: 'B', atualizado_em: '2026-11-09T00:00:00Z' },
  ] });
  assert.deepStrictEqual(r.map(i => i.titulo), ['A']);
});

t('triagem concluida, convertida, arquivada ou ja virada em processo nao entra', async () => {
  const velho = '2026-10-01T00:00:00Z';
  const r = montar({ triagens: [
    { id: 1, origem: 'trab', status: 'concluida', cliente_nome: 'a', atualizado_em: velho },
    { id: 2, origem: 'trab', status: 'convertida', cliente_nome: 'b', atualizado_em: velho },
    { id: 3, origem: 'trab', status: 'em_andamento', cliente_nome: 'c', atualizado_em: velho, arquivado_em: '2026-10-02' },
    { id: 4, origem: 'trab', status: 'em_andamento', cliente_nome: 'd', atualizado_em: velho, convertido_processo_id: 9 },
    { id: 5, origem: 'trab', status: 'em_andamento', cliente_nome: 'e', atualizado_em: '' },
  ] });
  assert.strictEqual(r.length, 0);
});

t('triagem trabalhista e previdenciaria abrem a tela certa e nao colidem no id', async () => {
  const velho = '2026-10-01T00:00:00Z';
  const r = montar({ triagens: [
    { id: 7, origem: 'trab', status: 'aguardando_documentos', cliente_nome: 'T', atualizado_em: velho },
    { id: 7, origem: 'prev', status: 'aguardando_informacoes', cliente_nome: 'P', atualizado_em: velho },
  ] });
  const trab = r.filter(i => i.titulo === 'T')[0], prev = r.filter(i => i.titulo === 'P')[0];
  assert.strictEqual(trab.href, 'painel-criar-triagem.html?id=7#sec-criar-triagem');
  assert.strictEqual(prev.href, 'painel-criar-triagem-previdenciaria.html?id=7#sec-criar-triagem-previdenciaria');
  assert.notStrictEqual(trab.id, prev.id);
  assert(prev.detalhe.includes('Previdenciária'));
});

t('triagem sem nome de cliente aparece como "Cliente não definido"', async () => {
  const r = montar({ triagens: [{ id: 1, origem: 'trab', status: 'em_andamento', cliente_nome: '', atualizado_em: '2026-10-01T00:00:00Z' }] });
  assert.strictEqual(r[0].titulo, 'Cliente não definido');
});

t('conta a pagar: vencida = atrasado, hoje, proxima; paga, cancelada e fora da janela ficam de fora', async () => {
  const r = montar({ contas: [
    { id: 1, descricao: 'Aluguel', status: 'Aberta', vencimento: '2026-11-08', valor: 2500, valor_pago: 0 },
    { id: 2, descricao: 'Internet', status: 'Aberta', vencimento: '2026-11-10', valor: 150, valor_pago: 0 },
    { id: 3, descricao: 'Software', status: 'Aberta', vencimento: '2026-11-12', valor: 99.9, valor_pago: 0 },
    { id: 4, descricao: 'Paga', status: 'Paga', vencimento: '2026-11-08', valor: 10, valor_pago: 10 },
    { id: 5, descricao: 'Cancelada', status: 'Cancelada', vencimento: '2026-11-08', valor: 10, valor_pago: 0 },
    { id: 6, descricao: 'Longe', status: 'Aberta', vencimento: '2026-12-30', valor: 10, valor_pago: 0 },
  ] });
  assert.deepStrictEqual(r.map(i => i.titulo + ':' + i.urgencia), ['Aluguel:atrasado', 'Internet:hoje', 'Software:proximo']);
  assert(r[0].tipo === 'financeiro' && r[0].detalhe.includes('Venceu há 2 dias') && r[0].detalhe.includes('2.500,00'));
});

t('conta parcialmente paga mostra so o que falta pagar', async () => {
  const r = montar({ contas: [{ id: 1, descricao: 'Parcelada', status: 'Parcial', vencimento: '2026-11-10', valor: 1000, valor_pago: 400 }] });
  assert(r[0].detalhe.includes('600,00') && r[0].detalhe.includes('restante'));
});

t('conta sem vencimento nao quebra o sino', async () => {
  assert.strictEqual(montar({ contas: [{ id: 1, descricao: 'x', status: 'Aberta', vencimento: null, valor: 1 }] }).length, 0);
});

// parte com servidor falso: permissoes decidem o que e buscado
function criar(permissoes) {
  const chamadas = [];
  const lista = { innerHTML: '', handlers: {}, addEventListener(tipo, fn) { this.handlers[tipo] = fn; } };
  const badge = { textContent: '', className: '', classList: { add() {}, remove() {} } };
  const doc = { hidden: false, getElementById(id) { return { 'hdr-avisos-lista': lista, 'hdr-avisos-badge': badge, 'hdr-btn-avisos': { addEventListener() {} } }[id] || null; } };
  const velho = new Date(); velho.setDate(velho.getDate() - 20);
  const respostas = {
    triagem_listar: { triagens: [{ id: 1, status: 'em_andamento', cliente_nome: 'Maria Trab', atualizado_em: velho.toISOString() }] },
    triagem_prev_listar: { triagens: [{ id: 2, status: 'em_andamento', cliente_nome: 'João Prev', atualizado_em: velho.toISOString() }] },
  };
  const api = new Function('esc', 'fmtDataProcesso', '_fmtISOData', 'localStorage', 'document', 'apiGetJson', 'apiPostJson', 'apiPost',
    'escopoDoPrazo', 'confirmarModal', 'mostrarAviso', 'setInterval',
    bloco + '\nreturn { carregar: carregarAvisosHeader, permissoes: sinoDefinirPermissoes };')(
    x => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    i => i.split('-').reverse().join('/'),
    d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'),
    { getItem: () => null, setItem() {} }, doc,
    url => { const m = /acao=([a-z_]+)/.exec(url); chamadas.push(m[1]); return Promise.resolve(respostas[m[1]] || {}); },
    (url, corpo) => { chamadas.push(corpo.tipo); return Promise.resolve({ contas: [{ id: 1, descricao: 'Aluguel', status: 'Aberta', vencimento: iso(0), valor: 100, valor_pago: 0 }] }); },
    () => Promise.resolve({ ok: true }), () => Promise.resolve({ escopo: undefined }), () => Promise.resolve(true), () => {}, () => 0);
  if (permissoes !== undefined) api.permissoes(permissoes);
  return { api, lista, chamadas };
}

(async () => {
  await t('sem permissoes informadas, o sino nao busca triagens nem contas a pagar', async () => {
    const s = criar(undefined); s.api.carregar(); await tick();
    assert(!s.chamadas.includes('triagem_listar') && !s.chamadas.includes('conta_pagar_listar'));
  });

  await t('quem so tem "automacoes" (sem financeiro) nunca consulta contas a pagar', async () => {
    const s = criar(['automacoes', 'processos']); s.api.carregar(); await tick();
    assert(!s.chamadas.includes('conta_pagar_listar'));
    assert(!s.lista.innerHTML.includes('Aluguel'));
  });

  await t('quem tem "financeiro" ve as contas no sino; quem nao tem "processos" nao ve triagens', async () => {
    const s = criar(['financeiro']); s.api.carregar(); await tick();
    assert(s.chamadas.includes('conta_pagar_listar'));
    assert(!s.chamadas.includes('triagem_listar') && !s.chamadas.includes('triagem_prev_listar'));
    assert(s.lista.innerHTML.includes('Aluguel'));
  });

  await t('quem tem "processos" ve as duas triagens, em "Precisam de atencao"', async () => {
    const s = criar(['processos']); s.api.carregar(); await tick();
    assert(s.chamadas.includes('triagem_listar') && s.chamadas.includes('triagem_prev_listar'));
    assert(s.lista.innerHTML.includes('Maria Trab') && s.lista.innerHTML.includes('João Prev'));
    assert(s.lista.innerHTML.includes('Precisam de atenção'));
  });

  if (falhas) { console.log('\n' + falhas + ' falha(s)'); process.exit(1); }
  console.log('\ntudo ok');
})();
