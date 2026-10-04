// Roda com: node tests/prazo-prioridade.test.js
// Prioridade (Baixa/Média/Alta, padrão Baixa) no modal de prazo e o selo nas listas de prazos.
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const fonte = fs.readFileSync(path.join(__dirname, '..', 'painel-app.js'), 'utf8').replace(/\r\n/g, '\n');

let falhas = 0;
function t(nome, fn) { try { fn(); console.log('ok  ' + nome); } catch (e) { falhas++; console.log('FALHA ' + nome + ': ' + e.message); } }

// pedaco do modal de prazo, do HTML ate o fim de _abrir
const iniModal = fonte.indexOf('function _garantirModalPrazo()');
const fimModal = fonte.indexOf('function abrirModalPrazo(');
assert(iniModal > 0 && fimModal > iniModal, 'modal de prazo nao encontrado');
const modal = fonte.slice(iniModal, fimModal);

t('o modal de prazo tem o campo Prioridade com Baixa (padrao), Média e Alta, depois do Tipo', () => {
  assert(modal.includes('<label>Prioridade</label>'));
  assert(modal.includes('id="prazo-form-prioridade"'));
  assert(modal.includes('<option value="baixa" selected>Baixa</option><option value="media">Média</option><option value="alta">Alta</option>'));
  assert(modal.indexOf('prazo-form-tipo') < modal.indexOf('prazo-form-prioridade'));
  assert(modal.indexOf('prazo-form-prioridade') < modal.indexOf('prazo-form-observacao'));
});

t('salvar envia a prioridade (criar e editar usam o mesmo corpo)', () => {
  assert(modal.includes("prioridade: document.getElementById('prazo-form-prioridade').value,"));
});

t('ao abrir: novo prazo = Baixa; editar = a prioridade do prazo (Baixa se vier vazia)', () => {
  assert(modal.includes("document.getElementById('prazo-form-prioridade').value = prazoExistente ? (prazoExistente.prioridade || 'baixa') : 'baixa';"));
});

t('as duas listas de prazo (pagina Prazos e aba da ficha) mostram o selo da prioridade', () => {
  const trecho = "_chipPrioridadeTarefa(pz.prioridade || 'baixa')";
  assert.strictEqual(fonte.split(trecho).length - 1, 2);
});

t('o selo reaproveita o mesmo componente das tarefas (Baixa/Média/Alta)', () => {
  assert(/function _chipPrioridadeTarefa\(prioridade\) \{\n\s+var mapa = \{ baixa: \['neutral', 'Baixa'\], media: \['warn', 'Média'\], alta: \['crit', 'Alta'\] \};/.test(fonte));
});

t('tarefa continua com o padrao Média (nao foi alterada)', () => {
  assert(fonte.includes('<option value="baixa">Baixa</option><option value="media" selected>Média</option><option value="alta">Alta</option>'));
});

if (falhas) { console.log('\n' + falhas + ' falha(s)'); process.exit(1); }
console.log('\ntodos passaram');
