# Listagens de clientes e processos

A segunda etapa limita as respostas de cadastro de clientes e fichas de processos e carrega as abas financeiras somente quando selecionadas. A visão consolidada de clientes continua disponível por solicitação do usuário.

## Contrato da API

Os GETs autenticados `cliente_cadastro_listar` e `processo_manual_listar` aceitam `pagina` (a partir de 1) e `tamanho` (padrão 25, máximo 100). Sem `pagina`, o formato legado continua funcionando para os consumidores existentes.

- Clientes: `busca` em nome, documento, telefone ou e-mail; `tipo` opcional.
- Processos: `numero`, `cliente`, `tribunal`, `status` e `palavra`.
- A ficha por ID usa `pagina=1&tamanho=1&status=todos&id=…`, independentemente dos filtros da lista.
- A resposta inclui `paginacao: {pagina, tamanho, total, paginas}`. Uma página além do fim é ajustada à última existente.
- O tenant vem exclusivamente da sessão. O proxy não encaminha `tenant_id` nesses filtros.
- Os avisos de monitoramento dos processos trazem contagens globais e amostras de até oito itens por categoria. Não são calculados apenas sobre a página visível.

A busca ignora maiúsculas e acentos. Curingas SQL digitados pelo usuário são tratados literalmente. Os filtros têm até 200 caracteres.

## Publicação em ordem

1. Validar e publicar primeiro o backend `cesar-tobias-lambda`, incluindo o novo módulo `paginacao.py`, pelo fluxo oficial `scripts/deploy_lambda.py` e perfil `cesar-tobias`/VERO-Dev. Nenhuma migration é necessária para esta mudança.
2. Validar o contrato paginado em ambiente apropriado com dados fictícios.
3. Só depois publicar o frontend e o proxy. O cache das páginas usa `20261018-volume1`.

Não enviar esta etapa do site à `main` antes de o backend estar disponível: o site recusa respostas sem metadados de paginação, em vez de apresentar uma lista ilimitada como se fosse uma página.

## Validação local

- Backend: executar `pytest` no ambiente Python 3.12 preparado. Os testes usam banco e integrações simulados.
- Frontend: executar os scripts `tests/*.test.js` com Node; `tests/listagens-paginadas.test.js` cobre filtros, respostas incompletas, proxy e carregamento sob demanda.
- Conferir no navegador: paginação, filtro sem resultados, erro e nova tentativa, avisos globais, ficha fora da página atual e retorno mantendo página/filtros/posição, em desktop e celular.

## Limites desta entrega

As consultas paginadas usam `COUNT`, `LIMIT` e `OFFSET`. Não foi medido um plano de execução em banco real nem aplicado índice novo. Buscas textuais e páginas profundas ainda precisam de medição com volume representativo.

As tabelas financeiras, seletores legados e a visão consolidada ainda não têm paginação no servidor. O Financeiro deixa de consultar todas as abas na abertura; os fluxos financeiros e os cálculos existentes permanecem preservados.
