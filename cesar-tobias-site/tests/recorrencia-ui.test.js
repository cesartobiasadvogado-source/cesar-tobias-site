// Roda com: node tests/recorrencia-ui.test.js
// Recorrencia nos modais de Tarefa e Prazo: bloco "+ Adicionar recorrencia" (Repete + Termina),
// leitura/validacao do formulario e garantia de que EDITAR nao envia recorrencia (mexe so naquela ocorrencia).
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const fonte = fs.readFileSync(path.join(__dirname, '..', 'painel-app.js'), 'utf8').replace(/\r\n/g, '\n');
const ini = fonte.indexOf('// RECORRENCIA:inicio');
const fim = fonte.indexOf('// RECORRENCIA:fim');
assert(ini > 0 && fim > ini, 'marcadores nao encontrados em painel-app.js');

// DOM minimo: so o que o bloco usa
function criarDom() {
  const els = {};
  function el(id) {
    if (!els[id]) {
      const classes = new Set();
      els[id] = {
        id, value: '', ouvintes: {},
        classList: {
          add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c),
          toggle: (c, forca) => { if (forca) classes.add(c); else classes.delete(c); },
        },
        addEventListener(tipo, fn) { this.ouvintes[tipo] = fn; },
        clicar() { this.ouvintes.click.call(this); },
      };
    }
    return els[id];
  }
  return { getElementById: el, els };
}

function carregar() {
  const document = criarDom();
  const calendarios = [];
  const api = new Function('document', '_abrirCalendarioAoClicar',
    fonte.slice(ini, fim) + '; return { _OPCOES_RECORRENCIA, _htmlRecorrencia, _wireRecorrencia, _resetRecorrencia, _lerRecorrencia };'
  )(document, (id) => calendarios.push(id));
  return { document, calendarios, ...api };
}

let falhas = 0;
function t(nome, fn) { try { fn(); console.log('ok  ' + nome); } catch (e) { falhas++; console.log('FALHA ' + nome + ': ' + e.message); } }

t('as 8 opcoes de "Repete" (as do sistema de referencia) com as chaves que o backend aceita', () => {
  const { _OPCOES_RECORRENCIA } = carregar();
  assert.deepStrictEqual(_OPCOES_RECORRENCIA.map(o => o[0]),
    ['diaria', 'dias_uteis', 'semanal', 'mensal', 'anual', 'quinzenal', 'trimestral', 'semestral']);
  assert.deepStrictEqual(_OPCOES_RECORRENCIA.map(o => o[1]), [
    'Repetir todos os dias', 'Repetir de segunda a sexta', 'Repetir toda semana', 'Repetir todo mês', 'Repetir todo ano',
    'Repetir a cada 2 semanas', 'Repetir a cada 3 meses', 'Repetir a cada 6 meses']);
});

t('o HTML tem o link, os campos Repete/Termina e o "Remover", com ids por prefixo (prazo/tarefa)', () => {
  const { _htmlRecorrencia } = carregar();
  for (const p of ['prazo', 'tarefa']) {
    const h = _htmlRecorrencia(p);
    ['-rec-wrap', '-rec-abrir', '-rec-campos', '-rec-freq', '-rec-termina', '-rec-remover'].forEach(sufixo => assert(h.includes('id="' + p + sufixo + '"'), p + sufixo));
    assert(h.includes('+ Adicionar recorrência') && h.includes('<label>Repete</label>') && h.includes('<label>Termina</label>'));
    assert(h.includes('id="' + p + '-rec-campos" class="hidden"'), 'os campos comecam escondidos');
  }
});

t('sem clicar no link: nenhuma recorrencia (o formulario envia como sempre)', () => {
  const c = carregar();
  c._resetRecorrencia('tarefa', false);   // o modal sempre chama isso ao abrir
  assert.deepStrictEqual(c._lerRecorrencia('tarefa'), {});
});

t('clicar em "+ Adicionar recorrencia" mostra os campos e esconde o link', () => {
  const c = carregar();
  c._wireRecorrencia('prazo');
  c.document.getElementById('prazo-rec-abrir').clicar();
  assert(!c.document.getElementById('prazo-rec-campos').classList.contains('hidden'));
  assert(c.document.getElementById('prazo-rec-abrir').classList.contains('hidden'));
});

t('o campo "Termina" abre o calendario ao clicar', () => {
  const c = carregar();
  c._wireRecorrencia('tarefa');
  assert.deepStrictEqual(c.calendarios, ['tarefa-rec-termina']);
});

t('aberta sem data final: erro pedindo a data (nao envia)', () => {
  const c = carregar();
  c._wireRecorrencia('tarefa');
  c.document.getElementById('tarefa-rec-abrir').clicar();
  assert.deepStrictEqual(c._lerRecorrencia('tarefa'), { erro: 'Escolha quando a recorrência termina.' });
});

t('aberta e preenchida: devolve {frequencia, termina}', () => {
  const c = carregar();
  c._wireRecorrencia('tarefa');
  c.document.getElementById('tarefa-rec-abrir').clicar();
  c.document.getElementById('tarefa-rec-freq').value = 'quinzenal';
  c.document.getElementById('tarefa-rec-termina').value = '2026-12-31';
  assert.deepStrictEqual(c._lerRecorrencia('tarefa'), { rec: { frequencia: 'quinzenal', termina: '2026-12-31' } });
});

t('"Remover recorrencia" volta ao estado inicial e limpa os valores', () => {
  const c = carregar();
  c._wireRecorrencia('prazo');
  c.document.getElementById('prazo-rec-abrir').clicar();
  c.document.getElementById('prazo-rec-freq').value = 'anual';
  c.document.getElementById('prazo-rec-termina').value = '2030-01-01';
  c.document.getElementById('prazo-rec-remover').clicar();
  assert.deepStrictEqual(c._lerRecorrencia('prazo'), {});
  assert(!c.document.getElementById('prazo-rec-abrir').classList.contains('hidden'));
  assert.strictEqual(c.document.getElementById('prazo-rec-freq').value, 'diaria');
  assert.strictEqual(c.document.getElementById('prazo-rec-termina').value, '');
});

t('ao abrir o modal para EDITAR o bloco some; para CRIAR ele aparece fechado', () => {
  const c = carregar();
  c._wireRecorrencia('tarefa');
  c._resetRecorrencia('tarefa', true);
  assert(c.document.getElementById('tarefa-rec-wrap').classList.contains('hidden'));
  c._resetRecorrencia('tarefa', false);
  assert(!c.document.getElementById('tarefa-rec-wrap').classList.contains('hidden'));
  assert(c.document.getElementById('tarefa-rec-campos').classList.contains('hidden'));
});

t('os dois modais usam o bloco: HTML, ligacao, leitura ao criar e reset ao abrir', () => {
  for (const p of ['prazo', 'tarefa']) {
    assert(fonte.includes("_htmlRecorrencia('" + p + "')"), p + ': HTML');
    assert(fonte.includes("_wireRecorrencia('" + p + "')"), p + ': wire');
    assert(fonte.includes("_resetRecorrencia('" + p + "', !!" + p + "Existente)"), p + ': reset ao abrir');
  }
  assert(fonte.includes("_lerRecorrencia('prazo')") && fonte.includes('corpo.recorrencia = recPrazo.rec'));
  assert(fonte.includes("_lerRecorrencia('tarefa')") && fonte.includes('corpo.recorrencia = recTarefa.rec'));
});

t('so CRIAR envia recorrencia: a leitura fica no ramo "else" da edicao nos dois modais', () => {
  assert(/if \(prazoEmEdicao\) corpo\.id = prazoEmEdicao\.id;\n\s+else \{\n\s+var recPrazo = _lerRecorrencia\('prazo'\);/.test(fonte));
  assert(/acao = 'tarefa_atualizar';\n\s+\} else \{\n\s+var recTarefa = _lerRecorrencia\('tarefa'\);/.test(fonte));
});

if (falhas) { console.log('\n' + falhas + ' falha(s)'); process.exit(1); }
console.log('\ntodos passaram');
