# Rotina do marketing (você grava, o computador edita, você aprova e posta)

O Windows abre a rotina **todo dia às 08:30 e às 17:30**. Para cada vídeo novo em `1-Brutos` (Drive):

1. **transcreve** a fala (Whisper, no seu computador, sem custo);
2. **liga o vídeo a um conteúdo** do painel: primeiro pelo nome do arquivo no título (ex.: `IMG_2713`),
   depois pelas palavras do título/roteiro, comparadas com a fala (mínimo 2 palavras em comum);
3. **escreve o roteiro sozinha** (a fala) se estiver vazio, e passa Ideia/Para gravar para **Em edição**.
   Se não existe nenhuma ideia parecida, **cria um conteúdo novo** já com o roteiro. Na dúvida, não cria
   nada e avisa no relatório;
4. **só edita depois que você confirmar, no cartão, como quer** (cortar pausas, tipo de legenda);
5. edita (corta pausas, vertical 1080x1920, volume, legenda, capas) e salva em `2-Editados`;
6. grava no painel os arquivos e uma **sugestão** de dia e hora;
7. **entrega numa pasta do seu HD** o vídeo editado, as capas, o roteiro e um `info.txt`.

8. **escreve uma legenda sugerida** a partir do roteiro (por regras, sem custo): você revisa no cartão;
9. **depois que você aprova o agendamento, revisa a legenda e marca "Programar no Metricool"**, cria o
   post no Metricool (Instagram Reel, TikTok e Facebook Reel). No modo `rascunho` (padrão) ele fica como
   rascunho no Metricool para você confirmar lá; no modo `automatico` o Metricool publica sozinho na hora.

Sem o seu aval a rotina **nunca agenda e nunca posta**: a aprovação, a revisão da legenda e o "programar"
são sempre seus. Também **nunca mexe no vídeo original**, e nunca apaga nem sobrescreve nada.

### Como a programação no Metricool se protege

- Só age em conteúdo **Agendado** com legenda **revisada** e "Programar" marcado.
- **Nunca duplica:** grava "enviando" antes de falar com o Metricool e o resultado depois. Se uma rodada
  morrer no meio, a seguinte não repete: avisa no cartão para você conferir no Metricool.
- **Erro nunca é repetido sozinho:** só quando você aperta "Tentar de novo" no cartão.
- Recusa horário que já passou ou está a menos de 15 minutos.
- O vídeo vai ao Metricool por um **endereço temporário** (túnel do `cloudflared`) que existe só durante
  o envio e some em seguida; o Metricool guarda a própria cópia.
- Só funciona se o servidor do painel já souber guardar a publicação (senão não há onde registrar o resultado).

Instalação extra (uma vez): `python autorizar_metricool.py` (clique em Autorizar no navegador; o acesso
fica no cofre do Windows). No `config.json`, veja as chaves `legenda_sugerida` e `metricool` do
`config.exemplo.json`.

## Como usar no dia a dia

1. Se tiver uma ideia, crie só o **título** no painel (roteiro é opcional). Grave e solte o vídeo bruto em `1-Brutos`.
2. Na próxima rodada o conteúdo aparece em **Em edição**. Abra o cartão, marque a edição e clique em
   **Confirmar edição** (pode confirmar antes, se já souber).
3. Na rodada seguinte o vídeo vai para **Agenda de postagem**, em "Prontos: aprove o agendamento".
   Clique em **Aprovar agendamento**.
4. Para postar, abra a pasta **`C:\Users\Marlo\Documents\Prontos para postar`**: uma subpasta por
   conteúdo (`004 - título`), com o vídeo, as capas de Instagram e TikTok, o `roteiro.txt` e o
   `info.txt` (redes e dia/hora, aprovados ou só sugeridos). É só publicar de lá.
5. Para ver o vídeo dentro do painel, cole o link do Drive em **Editar** ("Link do vídeo no Drive").

## Instalação (uma vez, na ordem)

1. **Painel:** em Conexões, crie o usuário `rotina.marketing` com **só** a permissão "Conteúdo (marketing)"
   e uma senha longa. (Não use o seu usuário.)
2. Copie `config.exemplo.json` para `config.json` e confira a pasta do Drive, o usuário e `pasta_publicar`.
3. `python configurar_senha.py`: você digita a senha do usuário da rotina; ela vai para o **cofre do
   Windows** (nunca para arquivo).
4. Teste sem risco: `python rotina_marketing.py --so-listar` (só lista vídeos novos).
5. Ligue: `powershell -ExecutionPolicy Bypass -File agendar_tarefa.ps1`
   (para desligar: o mesmo comando com `-Remover`).

## O que precisa estar ligado

O computador ligado (ou ele roda assim que ligar), o Google Drive para computador montado como `H:`
e você logado no Windows.

## Se algo parecer parado

Veja `_rotina/relatorio-AAAA-MM-DD.json` na pasta `17- MARKETING` do Drive: ele mostra o que cada
rodada fez (processados, criados, entregues, avisos e erros).

## Testes

`python -m unittest test_editar_video test_edicao_video test_rotina_marketing` (nenhum chama a internet).
