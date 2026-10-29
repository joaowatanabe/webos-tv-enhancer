# Roadmap

## Feito
- v1.3.x: design aprovado em código, aerials por streaming, clima Open-Meteo, 3 fileiras; blur removido (faixa preta + lentidão).
- v1.4.0: modo relógio OLED, seletor de plano de fundo, dock que aprende, logos oficiais de HBO Max e Apple TV.
- v1.5.0: config externa (`config.js`) pra uso público; relógio redesenhado (serifado, flutua devagar, barra de segundos); frase do dia via Gemini; serviço root `fmtvd`: abre sempre no launcher, "Home da LG", bloqueia o protetor da LG — ver [specs/001](specs/001-home-daemon.md).
- v1.7.0–1.8.0: assistente de voz em qualquer app ([002](specs/002-ia-no-controle.md)): o botão de microfone (Input Hook) aciona o `voiceagent.js`, que grava o áudio do controle pelo `voiceinput` e manda pro Gemini (function calling): YouTube, Spotify (busca + playlists do usuário via OAuth), abrir apps, volume. Balão ✦ na home, toast nos outros apps. Botão Home abre o launcher direto (Input Hook). Fileira "Apps abertos" com RAM livre e botão vermelho pra fechar. UI com mais contraste, fundo escurece ao descer, clima colorido pela temperatura; animações só com transform/opacity. Vídeo de fundo liberado quando o launcher sai da frente.
- v1.6.0: modo relógio removido (ficava duplicado com o relógio da LG); o `fmtvd` não barra mais o protetor de tela da LG.

## Próximos
| # | Item | Spec | Observação |
|---|---|---|---|
| 1 | Limpeza da TV: telemetria, vídeos de demonstração, bloqueio de anúncios | — | em andamento (autorizado pelo João) |
| 2 | Aviso de voz bonito dentro dos apps (overlay próprio em vez do toast) | [002](specs/002-ia-no-controle.md) | testar janela flutuante no webOS |
| 3 | Mais fontes de vídeo pro fundo (além dos aerials da Apple) | — | pesquisar fontes com vídeo direto (mp4/HLS) e licença ok |

## Descartado
- Fundo com pôsteres de séries/filmes ([003](specs/003-fundo-posteres.md)): o João preferiu ampliar as fontes de vídeo.
- Widget do Spotify: o login (OAuth) dá trabalho demais pro ganho.
