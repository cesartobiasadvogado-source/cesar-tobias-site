# Rotina do marketing (grava, o Claude edita, você aprova)

Duas vezes por dia o computador olha a pasta `1-Brutos` do Drive. Para cada vídeo novo ele:

1. transcreve a fala (Whisper, no próprio computador, sem custo);
2. descobre a qual roteiro **Gravado** do painel o vídeo pertence, comparando a fala com o roteiro;
3. edita (corta silêncio, deixa vertical, volume, legenda, capa) e salva em `2-Editados`;
4. grava no painel os arquivos de cada rede e uma **sugestão** de dia e hora.

Ela **nunca agenda e nunca posta**: no painel você vê o vídeo, a capa e a sugestão e aperta
**Aprovar agendamento**. Também **nunca mexe no vídeo original**.

## Como usar no dia a dia

1. Grave, solte o vídeo em `1-Brutos` e aperte **Gravei** no painel (a rotina só casa vídeo com
   roteiro que está como *Gravado*).
2. Na próxima rodada (08:30 ou 17:30) o cartão ganha "Pronto para postar" e "Sugestão".
3. Para ver o vídeo dentro do painel, cole o link do Drive em **Editar** (campo "Link do vídeo no
   Drive"). Sem o link o painel mostra só a miniatura e os nomes dos arquivos.
4. Se a rotina não tiver certeza de qual roteiro é o vídeo, ela **não mexe em nada** e deixa o
   aviso em `_rotina/relatorio-AAAA-MM-DD.json`. Nesse caso confira o roteiro (palavras do
   vídeo parecidas com as do roteiro ajudam).

## Instalação (uma vez, na ordem)

1. **Painel:** em Configurações, crie o usuário `rotina.marketing` com **só** a permissão
   "Conteúdo (marketing)" e uma senha longa. (Não use o seu usuário.)
2. Copie `config.exemplo.json` para `config.json` e confira a pasta e o usuário.
3. `python configurar_senha.py` — você digita a senha do usuário da rotina; ela vai para o
   **cofre do Windows** (nunca para arquivo).
4. Teste sem risco: `python rotina_marketing.py --so-listar` (só lista vídeos novos).
5. Ligue a rotina: `powershell -ExecutionPolicy Bypass -File agendar_tarefa.ps1`
   (para desligar: o mesmo comando com `-Remover`).

## O que precisa estar ligado

O computador ligado (ou ele roda assim que ligar), o Google Drive para computador montado como `H:`
e você logado no Windows. A rotina só funciona depois que a migração 051, o backend e o site novos
estiverem publicados (senão o painel não aceita os campos novos).

## Testes

`python -m unittest test_editar_video test_rotina_marketing` (nenhum chama a internet).
