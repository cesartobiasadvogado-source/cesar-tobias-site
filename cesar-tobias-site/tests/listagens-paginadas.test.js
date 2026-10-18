// node --test tests/listagens-paginadas.test.js — somente fixtures, sem chamadas de rede.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'), path=require('node:path');
const fonte=fs.readFileSync(path.join(__dirname,'..','painel-app.js'),'utf8');
const bloco=fonte.slice(fonte.indexOf('// LISTAGENS-PAGINADAS:inicio'),fonte.indexOf('// LISTAGENS-PAGINADAS:fim'));
const h=new Function('URLSearchParams',bloco+';return {parametrosListagem,validarPaginacao};')(URLSearchParams);

test('filtros codificados preservam caracteres e pagina solicitada',()=>{
 const q=new URLSearchParams(h.parametrosListagem({pagina:3,tamanho:25},{cliente:'José & Filhos',palavra:'100%_?',tribunal:''}));
 assert.equal(q.get('cliente'),'José & Filhos');assert.equal(q.get('palavra'),'100%_?');
 assert.equal(q.get('pagina'),'3');assert.equal(q.get('tamanho'),'25');assert(!q.has('tribunal'));
});
test('resposta antiga/incompleta ou ilimitada nunca vira uma pagina aparentemente valida',()=>{
 for(const m of [undefined,{}, {pagina:1,tamanho:500,total:500,paginas:1},{pagina:1,tamanho:25,total:-1,paginas:1},{pagina:3,tamanho:25,total:30,paginas:2}])assert.throws(()=>h.validarPaginacao({paginacao:m}));
 const m={pagina:1,tamanho:25,total:0,paginas:1};assert.equal(h.validarPaginacao({paginacao:m}),m);
});

test('proxy encaminha somente filtros permitidos e mantem a sessao',async()=>{
 const originalFetch=global.fetch, segredoAnterior=process.env.DASHBOARD_SECRET;
 process.env.DASHBOARD_SECRET='segredo-ficticio-local';
 const handler=require('../api/painel.js');
 try{
  for(const [acao,extras] of [['processo_manual_listar',{cliente:'José & Filhos',status:'todos',id:'99'}],['cliente_cadastro_listar',{busca:'José & Filhos',tipo:'Pessoa Física'}]]){
   let destino;global.fetch=async url=>{destino=new URL(url);return {status:200,json:async()=>({paginacao:{pagina:2,tamanho:25,total:30,paginas:2}})};};
   let status,corpo;const res={status(n){status=n;return this;},json(d){corpo=d;}};
   await handler({method:'GET',headers:{authorization:'Bearer sessao-ficticia'},query:{acao,pagina:'2',tamanho:'25',tenant_id:'outro',sql:'DROP TABLE clientes',...extras}},res);
   assert.equal(status,200);assert.equal(corpo.paginacao.pagina,2);
   assert.equal(destino.searchParams.get('token'),'sessao-ficticia');
   assert.equal(destino.searchParams.get('pagina'),'2');assert.equal(destino.searchParams.get('tamanho'),'25');
   assert(!destino.searchParams.has('tenant_id'));assert(!destino.searchParams.has('sql'));
   for(const [k,v] of Object.entries(extras))assert.equal(destino.searchParams.get(k),v);
  }
 }finally{global.fetch=originalFetch;if(segredoAnterior===undefined)delete process.env.DASHBOARD_SECRET;else process.env.DASHBOARD_SECRET=segredoAnterior;}
});

test('abas financeiras carregam apenas a area selecionada e ligam handlers uma unica vez',()=>{
 const nomes=[...new Set([...fonte.slice(fonte.indexOf('  function wireFinTabs()'),fonte.indexOf('  var honorariosContratosCache')).matchAll(/\b(wire\w+|carregar\w+)\(/g)].map(m=>m[1]).filter(n=>n!=='wireFinTabs'))];
 // Funcoes usadas como valores no mapa tambem precisam das fixtures.
 const loaders=['carregarPainelExecutivo','carregarHonorariosContratos','carregarParcelasAReceber','carregarDespesasProcesso','carregarContasPagar','carregarContasRecorrentes','carregarGastos'];
 const funcoes=[...new Set([...nomes,...loaders])],chamadas={};
 const botoes=['dashboard','contratos','receber','despesas','pagar','recorrentes','gastos'].map(nome=>({nome,eventos:{},classList:{toggle(){}},getAttribute(){return nome;},setAttribute(){},addEventListener(t,fn){this.eventos[t]=fn;}}));
 const document={querySelectorAll:q=>q.includes('[data-fin-tab]')?botoes:[]};
 const trecho=fonte.slice(fonte.indexOf('  function wireFinTabs()'),fonte.indexOf('  var honorariosContratosCache'));
 const wire=new Function('document',...funcoes,trecho+';return wireFinTabs;')(document,...funcoes.map(n=>()=>{chamadas[n]=(chamadas[n]||0)+1;}));
 wire();assert.deepEqual(chamadas,{});
 botoes.find(b=>b.nome==='contratos').eventos.click();
 assert.equal(chamadas.carregarHonorariosContratos,1);
 for(const n of loaders.filter(n=>n!=='carregarHonorariosContratos'))assert.equal(chamadas[n],undefined,n);
 botoes.find(b=>b.nome==='contratos').eventos.click();
 assert.equal(chamadas.wireNovoContratoModal,1);assert.equal(chamadas.carregarHonorariosContratos,2);
 botoes.find(b=>b.nome==='gastos').eventos.click();
 assert.equal(chamadas.wireGastos,1);assert.equal(chamadas.carregarGastos,1);
});
