// Roda com: node tests/ultimo-andamento.test.js
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const fonte = fs.readFileSync(path.join(__dirname, '..', 'painel-app.js'), 'utf8');
const ini = fonte.indexOf('// ULTIMO-ANDAMENTO:inicio');
const fim = fonte.indexOf('// ULTIMO-ANDAMENTO:fim');
assert(ini > 0 && fim > ini, 'marcadores nao encontrados em painel-app.js');
const html = new Function(fonte.slice(ini, fim) + '; return _htmlUltimoAndamentoTribunal;')();

const AGORA = Date.parse('2026-10-02T15:00:00Z');
const ato = (data, origem) => ({ origem: origem === undefined ? 'Tribunal' : origem, data });
const ALERTA = 'Pode ser processo parado ou base incompleta. Confira no PJe.';

let falhas = 0;
function t(nome, fn) { try { fn(); console.log('ok  ' + nome); } catch (e) { falhas++; console.log('FALHA ' + nome + ': ' + e.message); } }

t('sem atos: nada a mostrar', () => assert.strictEqual(html([], AGORA), ''));
t('atos indefinidos: nada a mostrar', () => assert.strictEqual(html(undefined, AGORA), ''));
t('so atos do escritorio: nada a mostrar', () => assert.strictEqual(html([ato('2026-09-30', 'Escritorio')], AGORA), ''));
t('andamento de hoje', () => {
  const r = html([ato('2026-10-02')], AGORA);
  assert(r.includes('<strong>02/10/2026</strong> (hoje).') && !r.includes('<span'), r);
});
t('1 dia: singular', () => assert(html([ato('2026-10-01')], AGORA).includes('(1 dia atrás)')));
t('2 dias, sem alerta', () => {
  const r = html([ato('2026-09-30')], AGORA);
  assert(r.includes('(2 dias atrás)') && !r.includes('<span') && !r.includes(ALERTA), r);
});
t('escolhe o mais recente entre varios, ignorando ordem e atos do escritorio', () => {
  const r = html([ato('2026-07-31'), ato('2026-09-22'), ato('2026-10-01', 'Escritorio'), ato('2026-08-10')], AGORA);
  assert(r.includes('<strong>22/09/2026</strong> (10 dias atrás)'), r);
});
t('exatamente 30 dias: so informativo (limite estrito)', () => {
  const r = html([ato('2026-09-02')], AGORA);
  assert(r.includes('(30 dias atrás)') && !r.includes('<span') && !r.includes(ALERTA), r);
});
t('31 dias: alerta amarelo', () => {
  const r = html([ato('2026-09-01')], AGORA);
  assert(r.includes('(31 dias atrás)') && r.includes('<span') && r.includes(ALERTA), r);
});
t('caso real: 31/07 -> 63 dias, com alerta', () => {
  const r = html([ato('2026-07-31')], AGORA);
  assert(r.includes('<strong>31/07/2026</strong> (63 dias atrás)') && r.includes(ALERTA), r);
});
t('data com hora (ISO completo) e lida pela parte da data', () => {
  assert(html([ato('2026-09-30T23:59:59Z')], AGORA).includes('<strong>30/09/2026</strong>'));
});
t('data invalida ou ausente e ignorada, sem quebrar', () => {
  assert.strictEqual(html([ato('lixo'), ato(null), ato(undefined), null], AGORA), '');
  assert(html([ato('lixo'), ato('2026-09-30')], AGORA).includes('30/09/2026'));
});
t('data futura (relogio/fuso) nao vira dias negativos', () => {
  const r = html([ato('2026-10-05')], AGORA);
  assert(r.includes('(hoje)'), r);
});
t('virada de dia usa Sao Paulo: 01:00Z de 03/10 ainda e 02/10 em Sao Paulo', () => {
  const r = html([ato('2026-10-02')], Date.parse('2026-10-03T01:00:00Z'));
  assert(r.includes('(hoje)'), r);
});
t('saida so contem digitos e texto fixo (sem dado livre do backend)', () => {
  const r = html([{ origem: 'Tribunal', data: '2026-09-30', descricao: '<img onerror=x>', tipo: '<script>' }], AGORA);
  assert(!r.includes('<img') && !r.includes('<script'), r);
});

if (falhas) { console.log(falhas + ' falha(s)'); process.exit(1); }
console.log('todos os testes passaram');
