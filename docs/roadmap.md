# Roadmap

## Feito
- v1.3.x: design aprovado em código, aerials por streaming, clima Open-Meteo, 3 fileiras; blur removido (faixa preta + lentidão).
- v1.4.0: modo relógio OLED, seletor de plano de fundo, dock que aprende, logos oficiais de HBO Max e Apple TV.
- v1.5.0: config externa (`config.js`) pra uso público; relógio redesenhado (serifado, flutua devagar, barra de segundos); frase do dia via Gemini; serviço root `fmtvd`: abre sempre no launcher, "Home da LG", bloqueia o protetor da LG — ver [specs/001](specs/001-home-daemon.md).
- v1.6.0: modo relógio removido (ficava duplicado com o relógio da LG); o `fmtvd` não barra mais o protetor de tela da LG.

## Próximos
| # | Item | Spec | Observação |
|---|---|---|---|
| 1 | Limpeza da TV: apps de fábrica, ads e telemetria | — | levantamento em andamento; nada é removido sem aprovação |
| 2 | IA pelo microfone do controle | [002](specs/002-ia-no-controle.md) | começar pelos spikes |
| 3 | Mais fontes de vídeo pro fundo (além dos aerials da Apple) | — | pesquisar fontes com vídeo direto (mp4/HLS) e licença ok |

## Descartado
- Fundo com pôsteres de séries/filmes ([003](specs/003-fundo-posteres.md)): o João preferiu ampliar as fontes de vídeo.
- Widget do Spotify: o login (OAuth) dá trabalho demais pro ganho.
