// Roda com: node tests/sino-acoes.test.js
// Sino: "marcar como visto" (so neste computador) e acoes rapidas (concluir prazo/tarefa, audiencia realizada).
// O bloco do sino roda de verdade, com um DOM de mentira e as chamadas ao servidor trocadas por espioes.
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const fonte = fs.readFileSync(path.join(__dirname, '..', 'painel-app.js'), 'utf8').replace(/\r\n/g, '\n');
const bloco = fonte.slice(fonte.indexOf('// SINO:inicio'), fonte.indexOf('// SINO:fim'));
assert(bloco.length > 100, 'bloco do sino nao encontrado');

let falhas = 0;
async function t(nome, fn) { try { await fn(); console.log('ok  ' + nome); } catch (e) { falhas++; console.log('FALHA ' + nome + ': ' + e.message); } }
const tick = () => new Promise(r => setTimeout(r, 5));

function iso(offsetDias) {
  const d = new Date(); d.setDate(d.getDate() + offsetDias);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// monta um sino novo (estado limpo) com servidor falso
function criar(opcoes) {
  opcoes = opcoes || {};
  const armazenamento = Object.assign({}, opcoes.armazenamento || {});
  const chamadas = [];
  const avisos = [];
  const respostas = Object.assign({
    avisos_listar: { avisos: [{ id: 7, mensagem: 'Recesso' }] },
    prazo_listar: { prazos: [
      { id: 1, titulo: 'Recurso', data_limite: iso(-2), status: 'vencido', serie_id: 'abc' },
      { id: 2, titulo: 'Contestação', data_limite: iso(0), status: 'pendente', serie_id: null },
    ] },
    tarefa_listar: { tarefas: [{ id: 5, titulo: 'Ligar', vencimento: iso(0), status: 'pendente' }] },
    pauta_audiencias: { pauta: [{ id: 9, tipo_audiencia: 'Instrução', cliente: 'Maria', data: iso(-1) }] },
    compromisso_listar: { compromissos: [] },
    whatsapp_estado: { estado: 'open' },
  }, opcoes.respostas || {});
  const lista = { innerHTML: '', cliquesParados: 0, handlers: {}, addEventListener(tipo, fn) { this.handlers[tipo] = fn; } };
  const badge = { textContent: '', className: 'hdr-badge hidden', classList: { add(c) { badge.className += ' ' + c; }, remove(c) { badge.className = badge.className.split(' ').filter(x => x !== c).join(' '); } } };
  const botao = { addEventListener() {} };
  const documento = { hidden: false, getElementById(id) { return { 'hdr-avisos-lista': lista, 'hdr-avisos-badge': badge, 'hdr-btn-avisos': botao }[id] || null; } };
  const estado = { escopo: undefined, confirmar: true, falhaPost: false };

  const api = new Function('esc', 'fmtDataProcesso', '_fmtISOData', 'localStorage', 'document', 'apiGetJson', 'apiPostJson', 'apiPost',
    'escopoDoPrazo', 'confirmarModal', 'mostrarAviso', 'setInterval',
    bloco + '\nreturn { carregar: carregarAvisosHeader, chave: _sinoChave };')(
    x => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
    iso2 => iso2.split('-').reverse().join('/'),
    d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'),
    { getItem: k => (k in armazenamento ? armazenamento[k] : null), setItem: (k, v) => { armazenamento[k] = String(v); } },
    documento,
    url => { const m = /acao=([a-z_]+)/.exec(url); return Promise.resolve(respostas[m[1]] || {}); },
    (url, corpo) => { chamadas.push({ url, corpo }); return estado.falhaPost ? Promise.reject(new Error('x')) : Promise.resolve({ ok: true }); },
    (url, corpo) => { chamadas.push({ url, corpo }); return estado.falhaPost ? Promise.resolve({ ok: false }) : Promise.resolve({ ok: true, json: () => Promise.resolve({}) }); },
    (pz, verbo) => Promise.resolve(estado.escopo === null ? null : { escopo: estado.escopo }),
    () => Promise.resolve(estado.confirmar),
    msg => avisos.push(msg),
    () => 0);

  // clique num botao do sino: acha o botao pelo atributo no HTML renderizado e dispara o handler registrado
  function clicar(atributo, contem) {
    const re = new RegExp('<button[^>]*' + atributo + '="([^"]*)"', 'g');
    let m, achado = null, chaveAchada = null;
    while ((m = re.exec(lista.innerHTML))) {
      const valor = m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&');
      if (!contem || valor.indexOf(contem) === 0) { achado = true; chaveAchada = valor; break; }
    }
    assert(achado, 'botao ' + atributo + (contem ? ' (' + contem + ')' : '') + ' nao encontrado');
    const alvo = { disabled: false, closest: () => alvo, getAttribute: n => (n === atributo ? chaveAchada : null) };
    lista.handlers.click({ target: alvo, stopPropagation() { lista.cliquesParados++; } });
    return alvo;
  }
  function clicarSemChave(atributo) {
    const alvo = { closest: () => alvo, getAttribute: n => (n === atributo ? '1' : null) };
    lista.handlers.click({ target: alvo, stopPropagation() { lista.cliquesParados++; } });
  }
  return { api, lista, badge, chamadas, avisos, armazenamento, estado, clicar, clicarSemChave };
}

(async () => {
  await t('clique dentro do sino nao propaga (senao o menu fecha ao filtrar ou marcar como visto)', async () => {
    const s = criar(); s.api.carregar(); await tick();
    s.clicarSemChave('data-sino-filtro');
    s.clicar('data-sino-visto', 'tarefa:5:');
    assert.strictEqual(s.lista.cliquesParados, 2);
  });

  await t('o selo conta todos os itens nao vistos (2 prazos + 1 tarefa + 1 audiencia + 1 aviso)', async () => {
    const s = criar(); s.api.carregar(); await tick();
    assert.strictEqual(s.badge.textContent, 5);
    assert(s.lista.innerHTML.includes('Marcar como visto'));
  });

  await t('marcar como visto esconde o item, baixa o selo e lembra a escolha no navegador', async () => {
    const s = criar(); s.api.carregar(); await tick();
    s.clicar('data-sino-visto', 'tarefa:5:');
    assert.strictEqual(s.badge.textContent, 4);
    assert(!s.lista.innerHTML.includes('Ligar'));
    assert(JSON.parse(s.armazenamento.painel_sino_vistos).some(k => k.indexOf('tarefa:5:') === 0));
    // recarregar a pagina: continua escondido
    const s2 = criar({ armazenamento: s.armazenamento }); s2.api.carregar(); await tick();
    assert.strictEqual(s2.badge.textContent, 4);
  });

  await t('mostrar vistos traz o item de volta (esmaecido) e permite desfazer', async () => {
    const s = criar(); s.api.carregar(); await tick();
    s.clicar('data-sino-visto', 'tarefa:5:');
    s.clicarSemChave('data-sino-ocultos');
    assert(s.lista.innerHTML.includes('Ligar') && s.lista.innerHTML.includes('visto'));
    s.clicar('data-sino-desvisto', 'tarefa:5:');
    assert.strictEqual(s.badge.textContent, 5);
  });

  await t('marcar tudo como visto esconde o selo', async () => {
    const s = criar(); s.api.carregar(); await tick();
    s.clicarSemChave('data-sino-tudo');
    assert(s.badge.className.includes('hidden'));
    assert(s.lista.innerHTML.includes('Tudo em dia'));
  });

  await t('item visto volta a aparecer se ficar mais urgente (a chave inclui a urgencia)', async () => {
    const s = criar();
    assert.notStrictEqual(s.api.chave({ tipo: 'prazo', id: 1, urgencia: 'proximo' }), s.api.chave({ tipo: 'prazo', id: 1, urgencia: 'hoje' }));
  });

  await t('vistos de itens que sumiram (concluidos) sao apagados do armazenamento', async () => {
    const s = criar({ armazenamento: { painel_sino_vistos: JSON.stringify(['tarefa:5:hoje', 'prazo:999:atrasado']) } });
    s.api.carregar(); await tick();
    const guardado = JSON.parse(s.armazenamento.painel_sino_vistos);
    assert(guardado.indexOf('prazo:999:atrasado') === -1);
  });

  await t('armazenamento corrompido nao quebra o sino', async () => {
    const s = criar({ armazenamento: { painel_sino_vistos: '{nao e json' } });
    s.api.carregar(); await tick();
    assert.strictEqual(s.badge.textContent, 5);
  });

  await t('concluir tarefa: manda tarefa_atualizar com status concluida e recarrega o sino', async () => {
    const s = criar(); s.api.carregar(); await tick();
    s.respostas = null;
    s.clicar('data-sino-acao', 'tarefa:5:'); await tick();
    const c = s.chamadas.find(x => x.url.includes('tarefa_atualizar'));
    assert.deepStrictEqual(c.corpo, { id: 5, status: 'concluida' });
  });

  await t('concluir prazo de recorrencia usa o escopo escolhido; prazo comum segue sem escopo', async () => {
    const s = criar(); s.estado.escopo = 'serie'; s.api.carregar(); await tick();
    s.clicar('data-sino-acao', 'prazo:1:'); await tick();
    assert.deepStrictEqual(s.chamadas.find(x => x.corpo.id === 1).corpo, { id: 1, cumprido: true, escopo: 'serie' });
    const s2 = criar(); s2.estado.escopo = undefined; s2.api.carregar(); await tick();
    s2.clicar('data-sino-acao', 'prazo:2:'); await tick();
    assert.strictEqual(s2.chamadas.find(x => x.corpo.id === 2).corpo.escopo, undefined);
  });

  await t('cancelar o dialogo de escopo nao conclui nada', async () => {
    const s = criar(); s.estado.escopo = null; s.api.carregar(); await tick();
    s.clicar('data-sino-acao', 'prazo:1:'); await tick();
    assert.strictEqual(s.chamadas.length, 0);
  });

  await t('audiencia realizada pede confirmacao; recusando nao envia, aceitando manda marcar_realizada', async () => {
    const s = criar(); s.estado.confirmar = false; s.api.carregar(); await tick();
    s.clicar('data-sino-acao', 'audiencia:9:'); await tick();
    assert.strictEqual(s.chamadas.length, 0);
    const s2 = criar(); s2.api.carregar(); await tick();
    s2.clicar('data-sino-acao', 'audiencia:9:'); await tick();
    const c = s2.chamadas[0];
    assert(c.url.includes('pauta_audiencias') && c.corpo.op === 'marcar_realizada' && c.corpo.id === 9);
  });

  await t('se o servidor recusar, o botao volta a funcionar e o usuario e avisado', async () => {
    const s = criar(); s.api.carregar(); await tick();
    s.estado.falhaPost = true;
    const botao = s.clicar('data-sino-acao', 'tarefa:5:'); await tick();
    assert.strictEqual(botao.disabled, false);
    assert.strictEqual(s.avisos.length, 1);
  });

  await t('avisos e agenda nao tem botao de concluir, so de marcar como visto', async () => {
    const s = criar({ respostas: { prazo_listar: { prazos: [] }, tarefa_listar: { tarefas: [] }, pauta_audiencias: { pauta: [] } } });
    s.api.carregar(); await tick();
    assert(!s.lista.innerHTML.includes('data-sino-acao'));
    assert(s.lista.innerHTML.includes('data-sino-visto'));
  });

  if (falhas) { console.log('\n' + falhas + ' falha(s)'); process.exit(1); }
  console.log('\ntudo ok');
})();
