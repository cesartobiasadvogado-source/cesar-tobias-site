// Roda com: node tests/mensagem-sincronizar.test.js
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const fonte = fs.readFileSync(path.join(__dirname, '..', 'painel-app.js'), 'utf8');
const ini = fonte.indexOf('// MENSAGEM-SINCRONIZAR:inicio');
const fim = fonte.indexOf('// MENSAGEM-SINCRONIZAR:fim');
assert(ini > 0 && fim > ini, 'marcadores nao encontrados em painel-app.js');
const bloco = fonte.slice(ini, fim);
const _mensagemAposSincronizar = new Function(bloco + '; return _mensagemAposSincronizar;')();

const AGORA = Date.parse('2026-10-02T12:00:00Z');
const DIA = 86400000;
const iso = (diasAtras) => new Date(AGORA - diasAtras * DIA).toISOString();
const msg = (r) => _mensagemAposSincronizar(r, AGORA);
const NEUTRA = 'Sincronização concluída. Confira os andamentos na ficha.';
const RECENTE = 'Sincronizado — nenhum andamento novo encontrado.';

let falhas = 0;
function t(nome, fn) { try { fn(); console.log('ok  ' + nome); } catch (e) { falhas++; console.log('FALHA ' + nome + ': ' + e.message); } }

t('1. erro_fonte vence tudo (mesmo com novos e base velha)', () => {
  const m = msg({ novos: 3, status_sincronizacao: 'erro_fonte', base_datajud_atualizada_em: iso(30) });
  assert(m.startsWith('Não foi possível consultar o DataJud agora (instabilidade da fonte). Seus andamentos NÃO foram atualizados.'));
});
t('2. sem_dados vence novos e base velha', () => {
  const m = msg({ novos: 2, status_sincronizacao: 'sem_dados', base_datajud_atualizada_em: iso(30) });
  assert.strictEqual(m, 'Processo não localizado na base pública do CNJ (pode estar em segredo de justiça ou recém-distribuído). Confira no PJe.');
});
t('3. novos > 0 com ok e base velha mostra so a contagem', () => {
  assert.strictEqual(msg({ novos: 4, status_sincronizacao: 'ok', base_datajud_atualizada_em: iso(30) }), '4 andamento(s) novo(s) encontrado(s).');
});
t('3b. novos > 0 com status desconhecido ainda mostra a contagem', () => {
  assert.strictEqual(msg({ novos: 1, status_sincronizacao: null, base_datajud_atualizada_em: null }), '1 andamento(s) novo(s) encontrado(s).');
});
t('4. sem novos e base com 21 dias: aviso de defasagem com DD/MM e N dias', () => {
  const m = msg({ novos: 0, status_sincronizacao: 'ok', base_datajud_atualizada_em: iso(21) });
  assert(m.startsWith('Sincronizado. Nenhum andamento novo na fonte, mas a base do CNJ só vai até 11/09 (21 dias atrás)'), m);
  assert(m.endsWith('movimentações recentes podem não aparecer. Confira no PJe.'));
});
t('5. sem novos e base com 2 dias: texto atual', () => {
  assert.strictEqual(msg({ novos: 0, status_sincronizacao: 'ok', base_datajud_atualizada_em: iso(2) }), RECENTE);
});
t('limite: exatamente 7 dias NAO avisa (regra estrita, igual ao selo da ficha)', () => {
  assert.strictEqual(msg({ novos: 0, status_sincronizacao: 'ok', base_datajud_atualizada_em: iso(7) }), RECENTE);
});
t('limite: 7 dias + 1 minuto avisa', () => {
  const base = new Date(AGORA - 7 * DIA - 60000).toISOString();
  assert(msg({ novos: 0, status_sincronizacao: 'ok', base_datajud_atualizada_em: base }).startsWith('Sincronizado. Nenhum andamento novo na fonte, mas a base do CNJ'));
});
t('limite: 7 dias - 1 minuto nao avisa', () => {
  const base = new Date(AGORA - 7 * DIA + 60000).toISOString();
  assert.strictEqual(msg({ novos: 0, status_sincronizacao: 'ok', base_datajud_atualizada_em: base }), RECENTE);
});
t('campo base ausente (null) com status ok: cai no texto atual', () => {
  assert.strictEqual(msg({ novos: 0, status_sincronizacao: 'ok', base_datajud_atualizada_em: null }), RECENTE);
});
t('campo base ausente (undefined) com status ok: cai no texto atual', () => {
  assert.strictEqual(msg({ novos: 0, status_sincronizacao: 'ok' }), RECENTE);
});
t('leitura falhou (status e base nulos): mensagem NEUTRA, nunca "nenhum andamento novo"', () => {
  const m = msg({ novos: 0, status_sincronizacao: null, base_datajud_atualizada_em: null });
  assert.strictEqual(m, NEUTRA);
  assert(!m.includes('nenhum andamento novo'));
});
t('backend antigo (sem os campos): mensagem NEUTRA', () => {
  assert.strictEqual(msg({ ok: true, novos: 0 }), NEUTRA);
});

if (falhas) { console.log(falhas + ' falha(s)'); process.exit(1); }
console.log('todos os testes passaram');
