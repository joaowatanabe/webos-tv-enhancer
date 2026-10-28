# 002 — IA pelo microfone do controle

**Status:** spec · não iniciado · risco alto (depende de investigação na TV)

## Objetivo
Apertar um botão do Magic Remote, falar, e receber resposta de uma IA mais capaz que a da TV (Gemini, por custo zero de cota Claude), na tela do launcher.

## Restrições conhecidas
- O microfone do controle é capturado pelo sistema (serviço de voz da LG / ThinQ AI), não por apps web. Um app do Developer Mode não recebe áudio do controle por padrão.
- O botão de microfone dispara o assistente da LG; o Google Assistant e a Alexa vêm como apps do sistema.
- Root está disponível (ver 001), o que abre caminhos que um app normal não tem.

## Caminhos a investigar (em ordem de custo)
1. **Texto pelo teclado de voz da LG.** Num `<input>` do launcher, o teclado virtual da LG tem ditado por voz. O ditado vira texto, o texto vai pro Gemini. Zero hacking; só confirmar se o ditado aparece em apps web no webOS 6.
2. **`getUserMedia` no app web.** Testar se o Chromium 79 do webOS expõe algum dispositivo de áudio (controle via BT/RF) com permissão no `appinfo.json`.
3. **Root: interceptar o serviço de voz.** Ver se o resultado de reconhecimento (`com.webos.service.voiceconductor` ou similar) pode ser assinado via `luna-send -i`, pegando o texto que a LG já transcreveu e mandando pro Gemini.
4. **Celular como microfone.** Página web no celular (mesma rede) com Web Speech API → manda o texto pro launcher. Funciona com certeza, mas foge do "usar o controle".

## Plano
1. **Spike (30 min):** botão "Perguntar" no launcher com `<input>`. Abrir o teclado da LG e verificar o ditado. → decide entre os caminhos 1 e 3.
2. **Spike root (1 h):** listar serviços de voz (`ls /usr/share/luna-service2/services.d | grep -i voice`), assinar e logar eventos enquanto se usa o botão de microfone.
3. **MVP:** painel "Pergunte" com histórico curto; Gemini com instrução de responder em 2–3 frases; resposta lida em voz alta só se o TTS da TV for acessível.
4. **Atalho:** remapear um botão via LG Input Hook pra abrir o painel.

## Critério de pronto
Pergunta falada → resposta na tela em menos de 5 s, sem sair do launcher.
