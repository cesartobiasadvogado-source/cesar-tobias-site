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

## Como usar numa audiência por Zoom

1. Entre na audiência normalmente pelo Zoom, no navegador (aba do Zoom aberta e em foco).
2. Clique no ícone da extensão.
3. **Coloque o Zoom em "Visualização do orador"** (não Galeria) — é assim que a extensão consegue
   identificar quem está falando e colocar o nome certo na transcrição. Sem isso, ainda funciona,
   só que volta a sair "Locutor A/B" em vez do nome.
4. Digite o nome do cliente e clique em **"Iniciar transcrição"**.
5. Pode fechar essa janelinha da extensão — a gravação continua rodando sozinha. Só não feche a
   aba do Zoom.
6. Quando a audiência acabar, clique de novo no ícone da extensão e em **"Finalizar audiência"**.
   O envio e a transcrição podem levar alguns minutos — pode fechar a janelinha, o resultado
   aparece na aba **Audiências** do painel, do mesmo jeito que já acontece hoje.

## Se algo der errado

- Se aparecer erro de sessão expirada, clique em "Trocar de usuário" e entre de novo.
- Se aparecer um aviso de "gravando sem o seu microfone" ao iniciar, é porque a permissão do
  passo 6 da instalação ainda não foi dada -- clique no ícone da extensão, no botão "Autorizar
  microfone" que aparece, e tente iniciar de novo.
- Depois de qualquer atualização desta extensão (arquivos trocados), volte em
  `chrome://extensions` e clique no ícone de recarregar (↻) no card da extensão.
