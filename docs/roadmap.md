# Roadmap

## Feito
- v1.3.x: design aprovado em código, aerials por streaming, clima Open-Meteo, 3 fileiras; blur removido (faixa preta + lentidão).
- v1.4.0: modo relógio OLED, seletor de plano de fundo, dock que aprende, logos oficiais de HBO Max e Apple TV.
- v1.5.0: config externa (`config.js`) pra uso público; relógio redesenhado (serifado, flutua devagar, barra de segundos); frase do dia via Gemini; serviço root `fmtvd`: abre sempre no launcher, "Home da LG", bloqueia o protetor da LG — ver [specs/001](specs/001-home-daemon.md).

## Próximos
| # | Item | Spec | Observação |
|---|---|---|---|
| 1 | IA pelo microfone do controle | [002](specs/002-ia-no-controle.md) | começar pelos spikes |
| 2 | Fundo com pôsteres de séries/filmes | [003](specs/003-fundo-posteres.md) | precisa de chave do TMDB |
| 3 | Limpeza da TV: apps de fábrica, ads e telemetria | — | levantamento em andamento; nada é removido sem aprovação |

## Descartado
- Widget do Spotify: o login (OAuth) dá trabalho demais pro ganho.
