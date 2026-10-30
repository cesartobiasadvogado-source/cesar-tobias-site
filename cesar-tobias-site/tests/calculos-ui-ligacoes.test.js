// Roda com: node tests/calculos-ui-ligacoes.test.js
// Guarda estatica da aba Calculos: todo botao/controle declarado no HTML da tela tem tratamento ligado no JS, a pagina carrega os
// scripts na ordem certa, o menu aponta para a pagina e o painel-app.js monta a aba.
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const raiz = path.join(__dirname, '..');
const ler = f => fs.readFileSync(path.join(raiz, f), 'utf8').replace(/\r\n/g, '\n');
const ui = ler('calculos-ui.js');

let falhas = 0;
function t(nome, fn) { try { fn(); console.log('ok  ' + nome); } catch (e) { falhas++; console.log('FALHA ' + nome + ': ' + e.message); } }

t('todo controle da tela (id calc-btn-*, calc-modelo, calc-ind-*, calc-pdf-*) tem tratamento no JS', () => {
  const ids = new Set();
  ui.replace(/id="(calc-(?:btn|ind|pdf|modelo|formato|formula|arquivo|nome|lista|sistema|v)[a-z-]*)"/g, (_m, id) => { if (id !== 'calc-v-titulo' && id !== 'calc-sistema') ids.add(id); return ''; }); // so referenciados por aria-labelledby / so estilo (container)
  assert(ids.size >= 25, 'poucos ids encontrados: ' + [...ids]);
  for (const id of ids) {
    const ligado = new RegExp("querySelector\\('#" + id + "'\\)|getElementById\\('" + id + "'\\)").test(ui);
    assert(ligado, 'id sem ligacao no JS: ' + id);
  }
});

t('cada querySelector("#...") do JS aponta para um id que existe no HTML da tela', () => {
  const declarados = new Set();
  ui.replace(/id="([a-z-]+)"/g, (_m, id) => { declarados.add(id); return ''; });
  ui.replace(/\bid = '([a-z-]+)'/g, (_m, id) => { declarados.add(id); return ''; });
  ui.replace(/querySelector\('#([a-z-]+)'\)/g, (_m, id) => { assert(declarados.has(id), 'id usado e nao declarado: ' + id); return ''; });
});

t('pagina carrega estilos e scripts na ordem certa (motor, modelos, exportar, ui, depois painel-app)', () => {
  const h = ler('painel-calculos.html');
  assert(h.includes('var PAGINA_ATUAL = "calculos"'));
  const ordem = ['calculos-motor.js', 'calculos-modelos.js', 'calculos-exportar.js', 'calculos-ui.js', 'painel-app.js'].map(f => h.indexOf(f));
  ordem.forEach(i => assert(i > 0));
  assert.deepStrictEqual([...ordem].sort((a, b) => a - b), ordem, 'ordem dos scripts');
  assert(h.includes('calculos.css'));
});

t('menu: todas as paginas do painel tem o item Calculos e o painel-app.js monta a aba com permissao', () => {
  const htmls = fs.readdirSync(raiz).filter(f => /^painel.*\.html$/.test(f));
  for (const f of htmls) assert(ler(f).includes('href="painel-calculos.html#sec-calculos"'), f + ' sem item de menu');
  const app = ler('painel-app.js');
  assert(app.includes("calculos: htmlCalculos"));
  assert(app.includes("calculos: 'processos'"));
  assert(app.includes("window.CalculosUI.montar(document.getElementById('calculos-raiz'))"));
});

t('o JS fala so com acoes do servidor que existem no Lambda e no proxy', () => {
  const acoes = new Set();
  ui.replace(/acao=([a-z_]+)/g, (_m, a) => { acoes.add(a); return ''; });
  assert.deepStrictEqual([...acoes].sort(), ['calculo_excluir', 'calculo_indice_salvar', 'calculo_indices_listar', 'calculo_listar', 'calculo_obter', 'calculo_salvar', 'calculo_vinculos']);
});

t('o ExcelJS so e carregado com hash de integridade (SRI) e de endereco fixo', () => {
  assert(/URL_EXCELJS = 'https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/exceljs\/4\.4\.0\/exceljs\.min\.js'/.test(ui));
  assert(/SRI_EXCELJS = 'sha384-[A-Za-z0-9+\/=]{64}'/.test(ui));
  assert(ui.includes('sc.integrity = SRI_EXCELJS'));
});

console.log(falhas ? '\n' + falhas + ' falha(s)' : '\nTodos os testes passaram');
process.exit(falhas ? 1 : 0);
