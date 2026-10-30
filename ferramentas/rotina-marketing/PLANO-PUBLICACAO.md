# Plano de publicação (nada abaixo foi executado)

Estado em 30/10/2026. Cada passo só roda com **"sim" separado** do César. Ordem obrigatória:
**banco → Lambda → site**. Motivo: o Lambda novo lê colunas que só existem depois da migração;
o site novo funciona com o Lambda antigo (só não mostra os campos novos), então ele vai por último.

| Peça | Onde está | Commit |
|---|---|---|
| Migração 051 + Lambda | `Projetos/wt-marketing-lambda-b` (branch `feat/marketing-arquivos`) | 2 commits (`e4acd76` migração/backend e `4c401f3` correção dos roteiros de migração), descendentes diretos da tag `deploy-2026-10-30-1345`; o que vai para o deploy é o último da branch |
| Site + rotina | `Projetos/wt-marketing-gravei` (branch `feat/marketing-gravei`) | `ab2b0b9` + o commit deste plano: 2 commits à frente de `origin/main` `f7625ba` (fast-forward) |

Antes de cada passo, reconferir: `origin/main` do site ainda é `f7625ba`? a última tag de deploy do
Lambda ainda é `deploy-2026-10-30-1345`? Se outra sessão publicou algo, **parar e reavaliar**
(já houve um deploy que apagou o anterior por usar base errada).

## Passo 1 — Migração 051 no banco de TESTE (Neon de teste)
- O roteiro antigo **recusaria** a 051 (exigia `CREATE TABLE`). Foi corrigido em `4c401f3`: agora aceita
  migração só de colunas, exige que a tabela exista e que as colunas **não** existam, e recusa
  DROP/RENAME dentro do ALTER. Provado num Postgres descartável (só leitura, aplicar, repetir = recusa).
- Você roda no SEU terminal (a conexão é pedida num prompt oculto, nunca vai ao chat), a partir de
  `Projetos/wt-marketing-lambda-b`:
  1. `python scripts/aplicar_migration_neon_teste.py migrations/051_marketing_conteudos_arquivos.sql`
     (só leitura: deve listar as 3 colunas como "ainda nao existe (ok)").
  2. Se estiver certo: o mesmo comando com `--executar`, digitando a frase `APLICAR NO NEON DE TESTE`.
- Conferir: a tabela `marketing_conteudos` ganhou `arquivos`, `sugestao_data`, `sugestao_hora` e a
  verificação final diz "100% ok".
- Desfazer: `ALTER TABLE marketing_conteudos DROP COLUMN arquivos, DROP COLUMN sugestao_data, DROP COLUMN sugestao_hora;`

## Passo 2 — Migração 051 em PRODUÇÃO
- Precisa do MFA do `cesar-dev` e do papel `VERO-DB-Migrator` (você digita o código; nunca no chat).
- `python scripts/aplicar_migration_producao.py migrations/051_marketing_conteudos_arquivos.sql`
  (o script recusa migração com alteração não commitada: já está commitada).
- É aditiva (só colunas com padrão): o Lambda **atual** continua funcionando igual depois dela.
- Conferir: o painel Conteúdo atual segue abrindo e listando.
- Desfazer: o `DROP COLUMN` acima (só perde arquivos/sugestões gravados depois).

## Passo 3 — Lambda
- Pré-requisitos: pasta `vendor_pg/` copiada para a raiz do worktree (está no `.gitignore`), árvore
  limpa, `python scripts/deploy_lambda.py --verificar-base` confirma a tag `deploy-2026-10-30-1345`.
- Rodar o deploy **a partir de `wt-marketing-lambda-b`** (nunca da worktree do Studio: o script
  fixa a função `AssistenteClaude`).
- Conferir: login, Conteúdo (listar/gravei), Triagens, Cálculos, WhatsApp; logs sem erro por 30 min.
- Desfazer: voltar à **versão 59** (restaurar pelo console/CLI; o script não faz rollback).

## Passo 4 — Site
- `git push origin feat/marketing-gravei:main` a partir de `wt-marketing-gravei` (fast-forward;
  GitHub → Vercel publica sozinho). Cache já trocado para `20261030-mkt1` em todas as páginas.
- Conferir no ar (Ctrl+F5): aba Meu dia, Para gravar com Gravar amanhã, carrossel, Gravei/Desfazer.
- Desfazer: promover o deploy anterior na Vercel.

## Passo 5 — Ligar a rotina (só depois dos passos 1-4)
Ver `LEIA-ME.md`: criar o usuário `rotina.marketing` (só permissão Conteúdo) → `configurar_senha.py`
→ `rotina_marketing.py --so-listar` → `agendar_tarefa.ps1`. Primeiro teste real com **um** vídeo bruto
seu em `1-Brutos` e conferir o resultado no painel antes de deixar rodando.

## Pontos de atenção
- **Número 051**: o Studio (só planejamento) também reservou 051-054. Se o Studio for aplicado depois,
  um dos lados é renumerado; hoje não há conflito.
- **Link do Drive**: o botão ▶ Assistir só aparece depois de colar o link em Editar; só toca para quem
  tem acesso ao arquivo no Drive. Nunca foi testado com um arquivo real do Drive.
- **Transcrição**: o Whisper `small` levou ~104 s para 32 s de vídeo; um vídeo de 1 min leva uns 3 min.
- **Saldo da API Anthropic** (aviso de 30/10 sobre o PJe) não afeta esta rotina: ela não usa IA paga.

---

# Rodada 2: edição por vídeo (migração 052). Nada abaixo foi executado.

Já está publicado: banco 051, Lambda `deploy-2026-10-30-1621` (commit `4c401f3`) e site `4ad9c30`.
Falta publicar: a **migração 052** (coluna `edicao`), o **Lambda** com as escolhas de edição (`75297be`)
e o **site** (`796a247`, cache `20261030-mkt2`). Ordem obrigatória: **banco, Lambda, site**.
Antes de cada passo, reconferir as bases (site em `4ad9c30`? última tag de deploy `deploy-2026-10-30-1621`?).

1. **052 no Neon de teste** (você, no terminal, em `wt-marketing-lambda-b`):
   `python scripts/aplicar_migration_neon_teste.py migrations/052_marketing_conteudos_edicao.sql`
   (só leitura) e, se estiver certo, o mesmo com `--executar` + frase `APLICAR NO NEON DE TESTE`.
2. **052 em produção** (você, com o MFA): `python scripts/aplicar_migration_producao.py migrations/052_marketing_conteudos_edicao.sql`.
   Pergunta 1 = código do MFA; pergunta 2 = **só Enter**. **Pare antes da frase e me mande a tela.**
   É só uma coluna com valor padrão: o Lambda atual continua funcionando igual.
3. **Lambda** (eu rodo, após conferências): `python scripts/deploy_lambda.py` a partir de `wt-marketing-lambda-b`.
   Ponto de retorno = a versão que o próprio script publicar (ele avisa o número; **não** assumir).
4. **Site**: `git push origin feat/marketing-gravei:main`. Desfazer: promover o deploy anterior na Vercel.
5. Só então **ligar o agendamento** (`agendar_tarefa.ps1`) e testar com um vídeo seu.
