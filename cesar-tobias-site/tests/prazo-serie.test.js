// Roda com: node tests/prazo-serie.test.js
// Prazos de uma recorrencia (serie_id): concluir/excluir perguntam "so este" ou "todos" (escopo 'serie').
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const fonte = fs.readFileSync(path.join(__dirname, '..', 'painel-app.js'), 'utf8').replace(/\r\n/g, '\n');

let falhas = 0;
function t(nome, fn) { try { fn(); console.log('ok  ' + nome); } catch (e) { falhas++; console.log('FALHA ' + nome + ': ' + e.message); } }

function contar(trecho) { return fonte.split(trecho).length - 1; }

t('existe o dialogo de escopo com Cancelar, Só este e Todos (concluir e excluir)', () => {
  assert(contar('function perguntarEscopoSerie(verbo)') === 1);
  assert(fonte.includes('data-escopo="um"') && fonte.includes('data-escopo="serie"'));
  assert(fonte.includes('Todos em aberto') && fonte.includes('Todos da recorrência'));
});

t('prazo sem serie_id segue como antes (concluir direto; excluir com a confirmacao simples)', () => {
  const ini = fonte.indexOf('function escopoDoPrazo(pz, verbo)');
  const trecho = fonte.slice(ini, ini + 700);
  assert(trecho.includes('if (pz && pz.serie_id)'));
  assert(trecho.includes("if (verbo === 'concluir') return Promise.resolve({});"));
  assert(trecho.includes("confirmarModal('Excluir este prazo?')"));
});

t('as duas listas (pagina Prazos e aba da ficha) usam o escopo ao concluir e ao excluir', () => {
  assert.strictEqual(contar("escopoDoPrazo(pz, 'concluir')"), 2);
  assert.strictEqual(contar("escopoDoPrazo(pz, 'excluir')"), 2);
  assert.strictEqual(contar('cumprido: true, escopo: r.escopo'), 3); // 2 listas + o sino
  assert.strictEqual(contar("prazo_excluir', { id: btn.getAttribute('data-prazo-excluir'), escopo: r.escopo }"), 2);
});

t('nao sobrou nenhum concluir/excluir de prazo sem passar pelo escopo', () => {
  assert(!fonte.includes("{ id: btn.getAttribute('data-prazo-cumprir'), cumprido: true })"));
  assert(!fonte.includes("{ id: btn.getAttribute('data-prazo-excluir') })"));
});

if (falhas) { console.log('\n' + falhas + ' falha(s)'); process.exit(1); }
console.log('\ntudo ok');
