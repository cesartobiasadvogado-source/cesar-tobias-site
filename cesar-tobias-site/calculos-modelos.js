/* Modelos prontos da aba "Calculos". Modelo "IR retido - isencao por doenca grave": reproduz a estrutura da planilha
   usada no cumprimento de sentenca (Identificacao, Indices SELIC, Memoria Mensal, Honorarios, Resumo, Fundamentacao).
   Nao traz nenhum dado de cliente: as celulas amarelas sao as de preenchimento. Os textos juridicos sao do proprio escritorio. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.CalculosModelos = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TEXTOS = {
 "leia": {
  "B3": "Modelo técnico para apuração de valores de Imposto de Renda retido indevidamente após reconhecimento de isenção por doença grave (art. 6º, XIV, Lei 7.713/1988), com honorários contratuais e sucumbenciais destacados. Pronta para juntada em petição inicial, cumprimento/liquidação de sentença, RPV ou precatório.",
  "B9": "Este modelo usa a TAXA SELIC como índice único, aplicada uma vez por competência, sem soma de juros ou de outro índice em separado. Fundamento: art. 39, §4º, da Lei nº 9.250/1995; Súmula 162/STJ (termo inicial: mês seguinte ao pagamento indevido); Tema Repetitivo 145/STJ (REsp 1.111.175/SP) — 'aplica-se a taxa SELIC (...) não podendo ser cumulada, porém, com qualquer outro índice, seja de juros ou atualização monetária'; art. 3º, EC nº 113/2021; e art. 4º do Provimento CNJ nº 207/2025, de 30/10/2025 ('Os precatórios de natureza tributária devem ser atualizados monetariamente exclusivamente pela Taxa Selic').",
  "B11": "Um modelo genérico de cálculo para a Fazenda Pública, com colunas separadas de 'atualização monetária' e 'juros de mora', está correto para débitos de natureza NÃO tributária (regidos, após a EC nº 136/2025, pela fórmula híbrida IPCA + 2% a.a., limitada à SELIC — art. 2º e 3º do Provimento CNJ 207/2025). Este NÃO é o caso de restituição de IR: por ser crédito de natureza tributária, o índice é a SELIC isolada (art. 4º do mesmo Provimento), que já embute juros e correção monetária. Somar uma coluna extra de juros sobre a SELIC configuraria bis in idem/anatocismo e é a causa mais comum de impugnação nesse tipo de cálculo — por isso esta planilha não tem coluna separada de juros na memória mensal.",
  "B15": "Não presume o CPF, os valores retidos, as datas de retenção nem o percentual de honorários contratado — todos são dados do caso concreto que só você possui e precisam ser inseridos. Não gera peça processual, apenas o demonstrativo de cálculo."
 },
 "fund": {
  "A3": "Direito à isenção",
  "B3": "Art. 6º, XIV, da Lei nº 7.713/1988: rendimentos de aposentadoria, reforma ou pensão são isentos de IR quando o beneficiário for portador de doença grave elencada no dispositivo (neoplasia maligna, cardiopatia grave, cegueira, entre outras). Súmula 598/STJ: dispensa laudo oficial quando a doença estiver comprovada por outros meios idôneos.",
  "A4": "Termo inicial da isenção",
  "B4": "Data da comprovação da doença mediante diagnóstico médico (não a data do requerimento administrativo nem a da concessão), salvo prova de que a moléstia já se manifestava em data anterior — jurisprudência do STJ sobre a matéria.",
  "A5": "Direito à restituição",
  "B5": "Art. 165 e 167 do CTN — repetição do indébito tributário. O valor retido após o termo inicial da isenção é devido ao contribuinte com atualização.",
  "A6": "Índice de atualização",
  "B6": "Art. 39, §4º, da Lei nº 9.250/1995: incidência da taxa SELIC, mensal, acumulada, desde o mês do pagamento indevido. Súmula 162/STJ: o termo inicial da correção é o mês do pagamento indevido (recolhimento a maior), não a data do requerimento. Tema Repetitivo 145/STJ (REsp 1.111.175/SP): a SELIC não pode ser cumulada com qualquer outro índice de correção monetária ou de juros. Art. 3º da EC nº 113/2021: SELIC como taxa constitucional única para atualização e mora de débitos da Fazenda Pública. Art. 4º do Provimento CNJ nº 207/2025 (DJe/CNJ nº 242/2025, de 03/11/2025): reafirma que precatórios de natureza tributária são atualizados exclusivamente pela SELIC, mesmo após a mudança trazida pela EC nº 136/2025 para débitos não tributários.",
  "A7": "Por que não se aplica a fórmula IPCA + 2% a.a. da EC 136/2025",
  "B7": "A EC nº 136/2025 (promulgada em 09/09/2025) alterou o índice de atualização de precatórios de natureza NÃO tributária para uma fórmula híbrida (IPCA + juros simples de 2% a.a., limitada à SELIC como teto). O art. 4º do Provimento CNJ nº 207/2025 excetua expressamente os créditos de natureza tributária dessa regra, mantendo-os na SELIC isolada. Como a restituição de IR é crédito tributário, a fórmula híbrida da EC 136/2025 não se aplica a este caso.",
  "A8": "Honorários contratuais",
  "B8": "Art. 22, §4º, da Lei nº 8.906/1994 (Estatuto da Advocacia): os honorários contratuais podem ser destacados do montante principal e pagos diretamente ao advogado, mediante requerimento e juntada do contrato. O STF já decidiu que o advogado com honorários destacados não é credor direto do precatório perante a Fazenda Pública devedora, mas tem direito ao destaque sobre o crédito do constituinte.",
  "A9": "Honorários sucumbenciais",
  "B9": "Art. 85 do CPC — possuem natureza jurídica própria e autônoma em relação aos honorários contratuais (Súmula 306/STJ), não se confundindo com o crédito do cliente nem com os honorários contratuais.",
  "A10": "Tributação da SELIC recebida (observação, pessoa física)",
  "B10": "O Tema 962/STF (RE 1.063.187) afastou a incidência de IRPJ e CSLL sobre a SELIC recebida em repetição de indébito tributário por pessoa jurídica. A extensão desse entendimento à pessoa física depende de exame do caso concreto e não deve ser tratada como automática nesta planilha.",
  "A11": "Memória de cálculo — fórmula aplicada por competência",
  "B11": "Valor Atualizado = IR Retido Indevidamente × Fator SELIC Acumulado. Fórmula na aba 'Memória Mensal', coluna G: =IR_retido × Fator_SELIC. O fator vem da aba 'Índices SELIC' e é calculado pela função FATOR a partir da tabela oficial mensal (Receita Federal ou BACEN) cadastrada no botão 'Índices', com fonte e data da consulta — nunca estimado. Se faltar algum mês na tabela, a planilha mostra #N/D! em vez de calcular.",
  "A12": "Memória de cálculo — honorários",
  "B12": "Honorários contratuais = Crédito bruto atualizado × percentual contratado (aba 'Honorários', célula editável). Valor líquido do cliente = Crédito bruto atualizado − Honorários contratuais. Honorários sucumbenciais permanecem em célula apartada, sem compor a base de cálculo dos honorários contratuais nem o crédito líquido do cliente.",
  "A13": "Auditabilidade",
  "B13": "Todas as células de resultado nesta planilha contêm fórmulas (não valores fixos), de modo que perito, contador judicial, Ministério Público ou parte contrária podem conferir clicando em cada célula e revendo a fórmula e as referências."
 },
 "uso": {
  "A3": "Na petição inicial",
  "B3": "Junte a planilha como documento de prova do quantum debeatur, referenciando-a no pedido de restituição e explicitando no corpo da petição o critério adotado (SELIC única, art. 39, §4º, Lei 9.250/1995) para que o juízo já reconheça a metodologia na sentença.",
  "A4": "Na liquidação de sentença",
  "B4": "Adapte a data-base para a data da liquidação, mantenha a tabela SELIC atualizada até esse marco e apresente a planilha como memória de cálculo do art. 509 do CPC.",
  "A5": "No cumprimento de sentença",
  "B5": "Atualize a data-base para a data de apresentação do cumprimento (art. 523, CPC), reabra a aba 'Índices SELIC' e confira se a tabela cobre todo o novo período.",
  "A6": "Na expedição de RPV",
  "B6": "Confirme o teto de RPV vigente para o ente devedor (varia por ente); a planilha já separa o crédito do cliente do crédito do advogado, facilitando a expedição de duas RPVs distintas quando cabível (art. 22, §4º, Lei 8.906/1994).",
  "A7": "Na expedição de precatório",
  "B7": "Mantenha a atualização pela SELIC até a data de expedição; após o efetivo depósito pelo ente devedor nas contas especiais do tribunal, cessa a incidência de correção e juros (art. 10, Provimento CNJ 207/2025) — não prolongue o cálculo além dessa data.",
  "A8": "Principais causas de impugnação neste tipo de cálculo",
  "B8": "(1) Somar juros de mora à SELIC (bis in idem/anatocismo — a causa mais comum); (2) usar o termo inicial errado (data do requerimento em vez do mês do pagamento indevido, contrariando a Súmula 162/STJ); (3) aplicar a fórmula híbrida IPCA + 2% da EC 136/2025 a um crédito tributário, quando o art. 4º do Provimento CNJ 207/2025 determina SELIC isolada; (4) usar fatores SELIC de fonte não oficial ou desatualizados; (5) incluir competências anteriores ao termo inicial da isenção reconhecida.",
  "A9": "Como evitar impugnações",
  "B9": "Cite a fonte oficial de cada fator SELIC na aba 'Índices SELIC'; deixe a fórmula visível em cada célula (nunca cole valores); explicite o termo inicial da isenção com base no diagnóstico médico juntado aos autos; não inclua juros adicionais sobre a SELIC.",
  "A10": "Compatibilidade com contadores judiciais",
  "B10": "A estrutura (identificação, demonstrativo mensal, honorários apartados, resumo, memória de cálculo com fundamentação) segue o padrão adotado pelos núcleos de cálculo da Justiça Federal, mas cada Vara/TRF pode ter modelo próprio — confirme se há modelo obrigatório publicado no sítio do respectivo tribunal antes de protocolar."
 },
 "docs": {
  "A3": "CPF e identificação da parte",
  "B3": "RG/CNH e CPF da parte autora.",
  "A4": "Doença e data de comprovação",
  "B4": "Laudo médico, exames, relatório do médico assistente com CID e data do diagnóstico (Súmula 598/STJ dispensa laudo oficial se houver prova idônea).",
  "A5": "Valores brutos e IR retido por competência",
  "B5": "Extratos de pagamento (contracheques/informes de rendimentos) e Declaração de Ajuste Anual do IRPF de cada exercício abrangido.",
  "A6": "Fonte pagadora",
  "B6": "Informe de rendimentos emitido pela fonte pagadora (INSS, órgão público, empregador) confirmando os valores retidos.",
  "A7": "Fatores SELIC",
  "B7": "Extrato oficial da Receita Federal (calculadora do contribuinte) ou tabela do BACEN para o período do cálculo.",
  "A8": "Contrato de honorários",
  "B8": "Contrato de prestação de serviços advocatícios assinado, com o percentual contratado, para instruir o pedido de destaque de honorários (art. 22, §4º, Lei 8.906/1994).",
  "A9": "Sentença/decisão",
  "B9": "Cópia da decisão que reconheceu a isenção e determinou a restituição, para conferência do critério de atualização fixado judicialmente."
 },
 "titulos": {
  "fund": "Memória de Cálculo e Fundamentação Jurídica",
  "uso": "Uso Processual da Planilha",
  "docs": "Documentos para Comprovar Cada Dado"
 }
};
  var PRIMEIRA = 5, ULTIMA = 28, LINHA_TOTAL = 30; // linhas de dados da Memoria Mensal

  function aba(nome, larguras, linhas) {
    return { nome: nome, celulas: {}, formatos: {}, estilos: {}, larguras: larguras || {}, linhas: linhas || 20 };
  }
  function por(a, addr, valor, estilo, fmt) {
    if (valor !== undefined && valor !== null && valor !== '') a.celulas[addr] = valor;
    if (estilo) a.estilos[addr] = estilo;
    if (fmt) a.formatos[addr] = fmt;
  }
  // linhas "rotulo | conteudo" a partir da linha inicial
  function paresTexto(a, inicio, itens) {
    itens.forEach(function (it, i) { por(a, 'A' + (inicio + i), it[0], 'rotulo'); por(a, 'B' + (inicio + i), it[1], 'longo'); });
  }
  function ordenados(obj, prefixoCol) {
    return Object.keys(obj).filter(function (k) { return k.charAt(0) === prefixoCol; })
      .sort(function (x, y) { return parseInt(x.slice(1), 10) - parseInt(y.slice(1), 10); });
  }
  function paresDe(textos) { // pares A/B da mesma linha
    return ordenados(textos, 'A').map(function (k) { return [textos[k], textos['B' + k.slice(1)]]; }).filter(function (p) { return p[1] !== undefined; });
  }

  function irDoencaGrave() {
    var leia = aba('Leia-me', { 1: 230, 2: 640 }, 20);
    por(leia, 'A1', 'Planilha de Cálculo Judicial — Isenção de IR por Doença Grave', 'titulo');
    paresTexto(leia, 3, [
      ['O que é esta planilha', TEXTOS.leia.B3],
      ['Como preencher', "Preencha apenas as células AMARELAS. As demais contêm fórmulas e recalculam sozinhas — não digite valores nelas. A aba 'Memória Mensal' tem 24 linhas: use só as necessárias (as linhas vazias não entram na soma). Todos os campos vêm vazios: nada é presumido."],
      ['Ordem de preenchimento', "1) Identificação  2) Índices SELIC  3) Memória Mensal  4) Honorários — as abas Resumo e Fundamentação se atualizam sozinhas."],
      ['Índice de atualização usado — e por quê', TEXTOS.leia.B9],
      ['Ponto de atenção — divergência em relação a um modelo genérico de planilha de precatório', TEXTOS.leia.B11],
      ['Fonte dos fatores SELIC', "Cadastre os índices pelo botão 'Índices' (cole a tabela mensal oficial da Receita Federal ou do BACEN e registre a fonte e a data da consulta). O sistema calcula o fator acumulado a partir dela; se faltar algum mês, a célula mostra #N/D! em vez de estimar. Se preferir, digite o fator direto na aba 'Índices SELIC' (célula B8)."],
      ['O que esta planilha não faz', TEXTOS.leia.B15],
    ]);

    var ident = aba('Identificação', { 1: 330, 2: 520 }, 20);
    por(ident, 'A1', 'Identificação do Processo', 'titulo');
    var rotulos = [
      'Nº do processo', 'Parte autora (nome completo)', 'CPF da parte autora', 'Fonte pagadora / ente devedor',
      'Natureza do crédito', 'Doença (CID)', 'Data de comprovação da doença (diagnóstico)', 'Data de início da isenção reconhecida',
      'Período abrangido pelos cálculos (competência inicial – final)', 'Data-base dos cálculos', 'Critério jurídico adotado', 'Fase processual',
    ];
    rotulos.forEach(function (r, i) {
      por(ident, 'A' + (3 + i), r, 'rotulo');
      por(ident, 'B' + (3 + i), '', 'entrada');
    });
    por(ident, 'B7', 'Tributária (restituição de IR — art. 167, CTN)', 'entrada', 'texto');
    por(ident, 'B13', 'SELIC como índice único (art. 39, §4º, Lei 9.250/1995; Súmula 162/STJ; Tema 145/STJ). Ajuste se a sentença fixou outro termo inicial.', 'entrada', 'texto');
    ident.formatos.B5 = 'texto'; ident.formatos.B3 = 'texto';
    por(ident, 'A16', "Preencha todas as células amarelas antes de prosseguir para a aba 'Memória Mensal'.", 'longo');

    var ind = aba('Índices SELIC', { 1: 400, 2: 300 }, 20);
    por(ind, 'A1', 'Fator SELIC', 'titulo');
    por(ind, 'A3', "O fator é calculado pela tabela cadastrada no botão 'Índices' (função FATOR: multiplica 1 + taxa de cada mês, do termo inicial à data-base, os dois meses inclusive). Para a Súmula 162/STJ, informe como termo inicial o mês seguinte ao pagamento. Você pode substituir B8 por um fator digitado (fonte oficial); não estime.", 'longo');
    por(ind, 'A5', 'Termo inicial da atualização', 'rotulo'); por(ind, 'B5', '', 'entrada', 'data');
    por(ind, 'A6', 'Data-base do cálculo (termo final)', 'rotulo'); por(ind, 'B6', '', 'entrada', 'data');
    por(ind, 'A7', 'Fonte oficial consultada (e data da consulta)', 'rotulo'); por(ind, 'B7', '', 'entrada', 'texto');
    por(ind, 'A8', 'Fator SELIC acumulado (termo inicial → data-base)', 'rotulo'); por(ind, 'B8', '=SE(OU(B5="";B6="");"";FATOR("SELIC";B5;B6))', 'entrada', 'fator');
    por(ind, 'A9', 'Aplicação do índice: 1 = fator único (B8) para todas as competências; 2 = fator por competência (do mês seguinte à retenção até a data-base)', 'rotulo'); por(ind, 'B9', '', 'entrada');

    var mem = aba('Memória Mensal', { 1: 56, 2: 112, 3: 140, 4: 140, 5: 140, 6: 110, 7: 150, 8: 360 }, 40);
    por(mem, 'A1', 'Demonstrativo Mensal do Indébito', 'titulo');
    ['Nº', 'Competência\n(mês/ano)', 'Valor Bruto\nRecebido (R$)', 'Base de Cálculo\ndo IR (R$)', 'IR Retido\nIndevidamente (R$)', 'Fator SELIC\nAcumulado', 'Valor Atualizado\nda Competência (R$)', 'Observações']
      .forEach(function (h, i) { por(mem, String.fromCharCode(65 + i) + '4', h, 'cabecalho'); });
    for (var r = PRIMEIRA; r <= ULTIMA; r++) {
      por(mem, 'A' + r, '=SE(E' + r + '="";"";CONT.NUM(E$' + PRIMEIRA + ':E' + r + '))');
      por(mem, 'B' + r, '', 'entrada', 'mesano');
      por(mem, 'C' + r, '', 'entrada', 'brl');
      por(mem, 'D' + r, '', 'entrada', 'brl');
      por(mem, 'E' + r, '', 'entrada', 'brl');
      por(mem, 'F' + r, "=SE(E" + r + "=\"\";\"\";SE('Índices SELIC'!$B$9=2;SE('Índices SELIC'!$B$6=\"\";\"\";FATOR(\"SELIC\";DATA(ANO(B" + r + ");MES(B" + r + ")+1;1);'Índices SELIC'!$B$6));SE('Índices SELIC'!$B$8=\"\";\"\";'Índices SELIC'!$B$8)))", '', 'fator');
      por(mem, 'G' + r, '=SE(OU(E' + r + '="";F' + r + '="");"";E' + r + '*F' + r + ')', '', 'brl');
      por(mem, 'H' + r, '', 'entrada', 'texto');
    }
    por(mem, 'D' + LINHA_TOTAL, 'TOTAIS', 'total');
    por(mem, 'E' + LINHA_TOTAL, '=SOMA(E' + PRIMEIRA + ':E' + ULTIMA + ')', 'total', 'brl');
    por(mem, 'G' + LINHA_TOTAL, '=SOMA(G' + PRIMEIRA + ':G' + ULTIMA + ')', 'total', 'brl');

    var hon = aba('Honorários', { 1: 480, 2: 300 }, 20);
    por(hon, 'A1', 'Honorários Contratuais e Sucumbenciais', 'titulo');
    por(hon, 'A3', 'Fundamento: art. 22, §4º, da Lei nº 8.906/1994 (Estatuto da Advocacia) — honorários contratuais podem ser destacados do crédito principal e expedidos em favor do advogado, mediante juntada do contrato.', 'longo');
    por(hon, 'A6', 'Crédito bruto atualizado do cliente (R$)', 'rotulo'); por(hon, 'B6', "='Memória Mensal'!G" + LINHA_TOTAL, '', 'brl');
    por(hon, 'A7', 'Percentual de honorários contratuais (%)', 'rotulo'); por(hon, 'B7', '', 'entrada', 'pct');
    por(hon, 'A8', 'Honorários contratuais (R$)', 'rotulo'); por(hon, 'B8', '=B6*B7', '', 'brl');
    por(hon, 'A9', 'Valor líquido destinado ao cliente (R$)', 'rotulo'); por(hon, 'B9', '=B6-B8', '', 'brl');
    por(hon, 'A10', 'Honorários sucumbenciais fixados em sentença — percentual ou valor (conforme dispositivo)', 'rotulo'); por(hon, 'B10', '', 'entrada', 'texto');
    por(hon, 'A11', 'Honorários sucumbenciais (R$) — se percentual, aplicar sobre a base definida na sentença', 'rotulo'); por(hon, 'B11', '', 'entrada', 'brl');

    var res = aba('Resumo', { 1: 440, 2: 300 }, 20);
    por(res, 'A1', 'Quadro-Resumo', 'titulo');
    por(res, 'A3', 'Valor histórico total (IR retido indevidamente)', 'rotulo'); por(res, 'B3', "='Memória Mensal'!E" + LINHA_TOTAL, '', 'brl');
    por(res, 'A4', 'Fator de atualização aplicado', 'rotulo'); por(res, 'B4', "=SE('Índices SELIC'!B9=2;\"Por competência\";'Índices SELIC'!B8)", '', 'fator');
    por(res, 'A5', 'Crédito bruto atualizado (SELIC)', 'rotulo'); por(res, 'B5', '=Honorários!B6', '', 'brl');
    por(res, 'A6', 'Honorários advocatícios contratuais', 'rotulo'); por(res, 'B6', '=Honorários!B8', '', 'brl');
    por(res, 'A7', 'Honorários sucumbenciais (natureza distinta, se houver)', 'rotulo'); por(res, 'B7', '=Honorários!B11', '', 'brl');
    por(res, 'A8', 'Valor líquido destinado ao cliente', 'total'); por(res, 'B8', '=Honorários!B9', 'total', 'brl');
    por(res, 'A10', "Os dados da aba 'Identificação' e os valores desta aba compõem o corpo do demonstrativo a ser juntado aos autos.", 'longo');

    var fund = aba('Fundamentação', { 1: 260, 2: 700 }, 20);
    por(fund, 'A1', TEXTOS.titulos.fund, 'titulo');
    paresTexto(fund, 3, paresDe(TEXTOS.fund).map(function (p) { return p; }));
    var uso = aba('Como Usar', { 1: 260, 2: 700 }, 20);
    por(uso, 'A1', TEXTOS.titulos.uso, 'titulo');
    paresTexto(uso, 3, paresDe(TEXTOS.uso));
    var docs = aba('Documentos Necessários', { 1: 260, 2: 700 }, 20);
    por(docs, 'A1', TEXTOS.titulos.docs, 'titulo');
    paresTexto(docs, 3, paresDe(TEXTOS.docs));

    return { nome: 'Restituição de IR — isenção por doença grave', indices: { SELIC: { fonte: '', consulta: '', serie: {} } }, abas: [leia, ident, ind, mem, hon, res, fund, uso, docs] };
  }

  // ---- Modelo "Atualizacao de valores": o usuario so informa indice, mes final e (data, valor); o fator e o valor corrigido saem sozinhos.
  // A tela de formulario (calculos-ui.js) le e grava ESTAS celulas; por isso o layout e fixo e exportado em `layout`.
  var ATU = { aba: 'Atualização', indice: 'B3', ate: 'B4', regra: 'B5', primeira: 8, ultima: 47, totalLinha: 50 };

  function atualizacaoValores() {
    var a = aba(ATU.aba, { 1: 150, 2: 170, 3: 120, 4: 190, 5: 320 }, 60);
    por(a, 'A1', 'Atualização de valores por índice', 'titulo');
    por(a, 'A3', 'Índice', 'rotulo'); por(a, ATU.indice, 'SELIC', 'entrada', 'texto');
    por(a, 'A4', 'Corrigir até o mês de', 'rotulo'); por(a, ATU.ate, '', 'entrada', 'mesano');
    por(a, 'A5', 'Contar a correção a partir do mês seguinte ao do valor (1 = sim; 0 = a partir do próprio mês)', 'rotulo'); por(a, ATU.regra, '1', 'entrada');
    ['Data do valor', 'Valor original (R$)', 'Fator do índice', 'Valor corrigido (R$)', 'Descrição'].forEach(function (h, i) { por(a, String.fromCharCode(65 + i) + '7', h, 'cabecalho'); });
    for (var r = ATU.primeira; r <= ATU.ultima; r++) {
      var inicio = 'DATA(ANO(A' + r + ');MES(A' + r + ')+$B$5;1)';
      por(a, 'A' + r, '', 'entrada');
      por(a, 'B' + r, '', 'entrada', 'brl');
      por(a, 'C' + r, '=SE(OU(A' + r + '="";B' + r + '="");"";SE(E($B$4<>"";' + inicio + '>$B$4);1;FATOR($B$3;' + inicio + ';$B$4)))', '', 'fator');
      por(a, 'D' + r, '=SE(C' + r + '="";"";B' + r + '*C' + r + ')', '', 'brl');
      por(a, 'E' + r, '', 'entrada', 'texto');
    }
    por(a, 'A' + ATU.totalLinha, 'TOTAIS', 'total');
    por(a, 'B' + ATU.totalLinha, '=SOMA(B' + ATU.primeira + ':B' + ATU.ultima + ')', 'total', 'brl');
    por(a, 'D' + ATU.totalLinha, '=SOMA(D' + ATU.primeira + ':D' + ATU.ultima + ')', 'total', 'brl');
    por(a, 'A' + (ATU.totalLinha + 1), 'Diferença (correção)', 'rotulo');
    por(a, 'D' + (ATU.totalLinha + 1), '=D' + ATU.totalLinha + '-B' + ATU.totalLinha, '', 'brl');
    return { nome: 'Atualização de valores', indices: { SELIC: { fonte: '', consulta: '', serie: {} } }, abas: [a] };
  }

  var MODELOS = [
    { id: 'atualizacao-valores', nome: 'Atualização de valores (corrigir por índice)', descricao: 'Informe o índice, o mês final e os valores com suas datas: a correção sai sozinha.', criar: atualizacaoValores },
    { id: 'ir-doenca-grave', nome: 'Restituição de IR — isenção por doença grave', descricao: 'Memória mensal do IR retido × fator SELIC, honorários e resumo.', criar: irDoencaGrave },
  ];

  return {
    layoutAtualizacao: ATU,
    lista: MODELOS.map(function (m) { return { id: m.id, nome: m.nome, descricao: m.descricao }; }),
    criar: function (id) {
      for (var i = 0; i < MODELOS.length; i++) if (MODELOS[i].id === id) return JSON.parse(JSON.stringify(MODELOS[i].criar()));
      return null;
    },
  };
});
