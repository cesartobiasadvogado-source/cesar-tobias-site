# Como instalar a extensão (Chrome)

Essa extensão não está na loja do Chrome — é de uso pessoal seu, então a instalação é manual
(uma vez só). Leva 1 minuto.

1. Abra o Chrome e digite na barra de endereço: `chrome://extensions`
2. No canto superior direito, ative **"Modo do desenvolvedor"**.
3. Clique no botão **"Carregar sem compactação"** (ou "Load unpacked").
4. Selecione a pasta `extensao-zoom` (esta pasta onde está este arquivo).
5. Pronto — o ícone da extensão aparece na barra de ferramentas do Chrome (pode precisar
   clicar no ícone de quebra-cabeça 🧩 pra fixar ele visível).
6. Clique no ícone, entre com seu usuário e senha do painel, e clique em **"Autorizar
   microfone"** (aparece uma aba nova — clique em "Autorizar microfone" nela também, e autorize
   quando o Chrome pedir). Isso só precisa ser feito uma vez.

## Como usar numa audiência por Zoom ou Google Meet

1. Faça login uma vez (clique no ícone da extensão, entre com seu usuário e senha do painel) --
   depois disso não precisa mais abrir o popup pra gravar.
2. Entre na audiência normalmente, no navegador (aba do Zoom ou do Meet). Assim que a página
   carregar, uma **barrinha flutuante vertical** aparece sozinha no canto da tela (pode arrastar
   ela pra onde quiser, segurando no ⠿ do topo) -- ela fica ali sempre que você tiver Zoom ou
   Meet aberto, mesmo sem estar gravando ainda:
   - **⏺ Gravar**: clique pra começar a transcrição (não precisa digitar nada antes). Vira **⏹**
     enquanto grava -- clique de novo pra finalizar a audiência.
   - **💬 Legenda** e **✨ Perguntar à IA** abrem o **mesmo painel**, num formato mais alto e
     parecido com o do Tactiq, com duas abas:
     - **Transcrição**: o que está sendo transcrito em tempo real (conexão direta e contínua com
       o serviço de transcrição -- o texto aparece poucos segundos depois de cada fala).
     - **Perguntar à IA**: pergunte algo sobre o que já foi dito até agora (ex: "já foi concedido
       algum prazo?") e a IA responde na hora, com base no que já foi transcrito.
   - **🌐 Idioma**: escolha o idioma da transcrição (Português, English, Español ou Detecção
     automática) -- útil se a audiência for em outro idioma. Pode trocar a qualquer momento.
   - **📷 Print**: tira um print da tela da chamada naquele momento e salva junto da transcrição
     -- útil pra guardar um documento ou slide que alguém mostrou na tela. O print aparece no
     lugar certo dentro do documento final (na hora exata em que foi tirado).
   - Os botões 💬✨📷 só funcionam depois de clicar em ⏺ Gravar (ficam apagados/desativados até lá).
3. Pra identificar o nome de quem fala:
   - **Zoom**: coloque em **"Visualização do orador"** (não Galeria).
   - **Google Meet**: funciona sozinho, não precisa ativar nada -- mas se puder, ativar a
     legenda (tecla **"c"**) ajuda como reforço extra.
   - Em qualquer um dos dois, se você não fizer isso, a gravação continua funcionando normal,
     só que os nomes saem como "Locutor A/B" em vez do nome de verdade.
4. Pode fechar a janelinha da extensão (o popup) — a gravação continua rodando sozinha. Só não
   feche a aba da chamada.
5. Quando a audiência acabar, clique em **⏹** na própria barra flutuante (ou em "Finalizar
   audiência" no popup, dá no mesmo). Assim que aparecer a confirmação de envio, já pode fechar
   a aba -- a transcrição pela IA (que demora de verdade, sem como acelerar) continua sozinha, e
   um **aviso do Windows/Chrome** chega quando estiver pronta. O resultado aparece na aba
   **Audiências** do painel, numa pasta única (**"Transcrições de Audiências (extensão)"**),
   separada das pastas dos clientes.

## Se algo der errado

- Se aparecer erro de sessão expirada, clique em "Trocar de usuário" e entre de novo.
- Se aparecer um aviso de "gravando sem o seu microfone" ao iniciar, é porque a permissão do
  passo 6 da instalação ainda não foi dada -- clique no ícone da extensão, no botão "Autorizar
  microfone" que aparece, e tente iniciar de novo.
- Depois de qualquer atualização desta extensão (arquivos trocados), volte em
  `chrome://extensions` e clique no ícone de recarregar (↻) no card da extensão -- **e também dê
  F5 na aba do Zoom/Meet que já estava aberta** (recarregar só a extensão não atualiza uma aba que
  já estava aberta antes).
