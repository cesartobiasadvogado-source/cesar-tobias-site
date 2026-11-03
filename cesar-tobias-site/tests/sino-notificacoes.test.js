// Roda com: node tests/sino-notificacoes.test.js
// Sino de notificacoes do topo: o que entra, em qual grupo (atrasado/hoje/proximo/info) e o que fica de fora.
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const fonte = fs.readFileSync(path.join(__dirname, '..', 'painel-app.js'), 'utf8').replace(/\r\n/g, '\n');

let falhas = 0;
function t(nome, fn) { try { fn(); console.log('ok  ' + nome); } catch (e) { falhas++; console.log('FALHA ' + nome + ': ' + e.message); } }

const ini = fonte.indexOf('// SINO:inicio');
const fim = fonte.indexOf('// SINO:fim');
assert(ini > 0 && fim > ini, 'bloco do sino nao encontrado');
const bloco = fonte.slice(ini, fim);

// o bloco e extraido e executado com os helpers do painel trocados por versoes minimas
const sino = new Function('esc', 'fmtDataProcesso', '_fmtISOData', 'localStorage',
  bloco + '\nreturn { montar: sinoMontarItens, classificar: _sinoClassificar, dias: _sinoDiasAviso, itemHtml: _sinoItemHtml };')(
  function (x) { return String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); },
  function (iso) { return iso.split('-').reverse().join('/'); },
  function (d) { return d.toISOString().slice(0, 10); },
  { getItem: function () { return null; }, setItem: function () {} });

const HOJE = '2026-11-10';
const montar = function (f, janela) { return sino.montar(f, HOJE, janela || 3); };

t('prazo vencido = atrasado; hoje = hoje; dentro da janela = proximo; alem da janela fica de fora', () => {
  const r = montar({ prazos: [
    { titulo: 'A', data_limite: '2026-11-08', status: 'vencido' }, { titulo: 'B', data_limite: '2026-11-10', status: 'pendente' },
    { titulo: 'C', data_limite: '2026-11-13', status: 'pendente' }, { titulo: 'D', data_limite: '2026-11-14', status: 'pendente' },
  ] });
  assert.deepStrictEqual(r.map(i => i.titulo + ':' + i.urgencia), ['A:atrasado', 'B:hoje', 'C:proximo']);
});

t('a janela de antecedencia muda o que entra (1 dia x 7 dias)', () => {
  const f = { prazos: [{ titulo: 'X', data_limite: '2026-11-15', status: 'pendente' }] };
  assert.strictEqual(montar(f, 1).length, 0);
  assert.strictEqual(montar(f, 7).length, 1);
});

t('prazo cumprido e tarefa concluida ou sem vencimento nao entram', () => {
  const r = montar({ prazos: [{ titulo: 'P', data_limite: '2026-11-01', status: 'cumprido' }],
    tarefas: [{ titulo: 'T1', vencimento: '2026-11-01', status: 'concluida' }, { titulo: 'T2', vencimento: null, status: 'pendente' }] });
  assert.strictEqual(r.length, 0);
});

t('tarefa atrasada entra como atrasada e aceita vencimento com hora', () => {
  const r = montar({ tarefas: [{ titulo: 'T', vencimento: '2026-11-09T10:00:00', status: 'pendente', responsavel: 'ana' }] });
  assert.strictEqual(r[0].urgencia, 'atrasado');
  assert(r[0].detalhe.includes('Atrasada há 1 dia') && r[0].detalhe.includes('ana'));
});

t('audiencia passada pede para marcar como realizada; a de hoje mostra a hora', () => {
  const r = montar({ audiencias: [
    { tipo_audiencia: 'Instrução', cliente: 'Maria', data: '2026-11-05', hora: '09:00:00', numero_processo: '1' },
    { tipo_audiencia: 'Conciliação', cliente: 'José', data: '2026-11-10', hora: '14:30:00' },
  ] });
  assert(r[0].urgencia === 'atrasado' && r[0].detalhe.includes('marque como realizada'));
  assert(r[1].urgencia === 'hoje' && r[1].detalhe.includes('Hoje às 14:30'));
});

t('audiencia passada ha mais de 30 dias nao entra (nao polui o sino)', () => {
  assert.strictEqual(montar({ audiencias: [{ tipo_audiencia: 'Velha', data: '2026-09-01' }] }).length, 0);
  assert.strictEqual(montar({ audiencias: [{ tipo_audiencia: 'Recente', data: '2026-10-20' }] }).length, 1);
});

t('compromisso da agenda: so hoje/proximos (nunca atrasado) e os de tipo audiencia nao duplicam a pauta', () => {
  const r = montar({ compromissos: [
    { titulo: 'Reunião', tipo: 'reuniao', data_inicio: '2026-11-10T15:00:00' }, { titulo: 'Ontem', tipo: 'reuniao', data_inicio: '2026-11-09T15:00:00' },
    { titulo: 'Audiência X', tipo: 'audiencia', data_inicio: '2026-11-10T10:00:00' },
  ] });
  assert.deepStrictEqual(r.map(i => i.titulo), ['Reunião']);
  assert(r[0].detalhe.includes('Hoje às 15:00'));
});

t('avisos do escritorio entram como info; WhatsApp so alerta quando o estado e close', () => {
  const a = montar({ avisos: [{ mensagem: 'Recesso dia 20' }], whatsappEstado: 'close' });
  assert.deepStrictEqual(a.map(i => i.tipo + ':' + i.urgencia).sort(), ['aviso:info', 'whatsapp:atrasado']);
  ['open', 'connecting', '', undefined].forEach(function (estado) {
    assert.strictEqual(montar({ whatsappEstado: estado }).length, 0, 'estado ' + estado);
  });
});

t('ordena por data dentro da lista e nao quebra com listas vazias ou ausentes', () => {
  assert.deepStrictEqual(montar({}), []);
  const r = montar({ prazos: [{ titulo: 'tarde', data_limite: '2026-11-12', status: 'pendente' }, { titulo: 'cedo', data_limite: '2026-11-11', status: 'pendente' }] });
  assert.deepStrictEqual(r.map(i => i.titulo), ['cedo', 'tarde']);
});

t('o texto vindo do servidor e escapado (nada de HTML solto no sino)', () => {
  const html = sino.itemHtml({ tipo: 'aviso', urgencia: 'info', titulo: '<img src=x onerror=alert(1)>', detalhe: '', href: '' });
  assert(!html.includes('<img') && html.includes('&lt;img'));
});

t('antecedencia padrao e 3 dias', () => { assert.strictEqual(sino.dias(), 3); });

t('o sino so e iniciado uma vez (um unico setInterval e um unico conjunto de listeners)', () => {
  assert.strictEqual(bloco.split('setInterval(').length - 1, 1);
  assert(bloco.includes('if (!sinoEstado.iniciado)'));
});

if (falhas) { console.log('\n' + falhas + ' falha(s)'); process.exit(1); }
console.log('\ntudo ok');
