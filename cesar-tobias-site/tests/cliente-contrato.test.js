// Roda com: node tests/cliente-contrato.test.js
// Novo contrato de honorários: o cliente pode ser digitado (contrato sem cadastro) ou escolhido da lista.
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const fonte = fs.readFileSync(path.join(__dirname, '..', 'painel-app.js'), 'utf8').replace(/\r\n/g, '\n');
const ini = fonte.indexOf('// CLIENTE-CONTRATO:inicio');
const fim = fonte.indexOf('// CLIENTE-CONTRATO:fim');
assert(ini > 0 && fim > ini, 'marcadores nao encontrados em painel-app.js');
const resolver = new Function(fonte.slice(ini, fim) + '; return _resolverClienteContrato;')();

let falhas = 0;
function t(nome, fn) { try { fn(); console.log('ok  ' + nome); } catch (e) { falhas++; console.log('FALHA ' + nome + ': ' + e.message); } }

const lista = ['Gustavo Gabriel de Souza Neves', 'José da Conceição', 'Ana Paula'];

t('nome digitado que não existe no cadastro vale como está (contrato sem cadastro)', () => {
  assert.deepStrictEqual(resolver('Fulano Amigo', lista), { nome: 'Fulano Amigo', cadastrado: false });
});

t('nome igual ao do cadastro: cadastrado', () => {
  assert.deepStrictEqual(resolver('Ana Paula', lista), { nome: 'Ana Paula', cadastrado: true });
});

t('ignora maiúsculas, acentos e espaços repetidos e usa a grafia do cadastro', () => {
  assert.deepStrictEqual(resolver('  jose   da conceicao ', lista), { nome: 'José da Conceição', cadastrado: true });
  assert.deepStrictEqual(resolver('ANA PAULA', lista), { nome: 'Ana Paula', cadastrado: true });
});

t('nome parecido mas diferente NÃO é tratado como o mesmo cliente', () => {
  assert.strictEqual(resolver('Ana Paula Silva', lista).cadastrado, false);
  assert.strictEqual(resolver('Ana', lista).cadastrado, false);
});

t('vazio ou só espaços: nome vazio (o formulário pede o nome)', () => {
  assert.strictEqual(resolver('', lista).nome, '');
  assert.strictEqual(resolver('    ', lista).nome, '');
  assert.strictEqual(resolver(null, lista).nome, '');
  assert.strictEqual(resolver(undefined, undefined).nome, '');
});

t('o campo é de texto com sugestões (datalist) e mostra aviso quando o cliente não é cadastrado', () => {
  assert(fonte.includes('<input type="text" id="ncontrato-cliente" list="ncontrato-clientes-lista"'));
  assert(fonte.includes('<datalist id="ncontrato-clientes-lista"></datalist>'));
  assert(fonte.includes('id="ncontrato-cliente-aviso"'));
  assert(fonte.includes('Cliente não cadastrado: o contrato ficará salvo só com este nome.'));
  assert(!fonte.includes('<select id="ncontrato-cliente">'), 'o select antigo sumiu');
});

t('salvar usa o nome digitado e a mensagem pede o nome (não "Selecione")', () => {
  assert(fonte.includes("var nome = _resolverClienteContrato(selectCliente.value, nomesClientes).nome;"));
  assert(fonte.includes("erroEl.textContent = 'Informe o nome do cliente.'"));
  assert(!fonte.includes("erroEl.textContent = 'Selecione o cliente.'"));
});

t('escolher um processo preenche o cliente do processo, mesmo que não esteja no cadastro', () => {
  assert(fonte.includes('selectCliente.value = _resolverClienteContrato(nomeCliente, nomesClientes).nome;'));
});

if (falhas) { console.log('\n' + falhas + ' falha(s)'); process.exit(1); }
console.log('\ntodos passaram');
