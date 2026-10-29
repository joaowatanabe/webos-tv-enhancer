# webos-tv-enhancer

[English](README.md) · **Português**

Launcher estilo Apple TV e melhorias para TVs LG com **webOS 6**.
Fundo com vídeos aerial da Apple, dock só com os seus streamings, clima e, em TVs com root, a opção de virar a tela inicial da TV, com assistente de voz no microfone do Magic Remote.

> Projeto independente, sem vínculo com a LG. Marcas pertencem aos respectivos donos.

## Testado em

- **LG OLED48C1PSA** (OLED C1 48"), **webOS 6.5.3** (firmware 03.53.45)
- Instalação via LG Developer Mode + `@webos-tools/cli` num Mac

Deve funcionar em outras TVs webOS 6 (C1, G1, A1 etc.), mas **não há garantia**: só foi testado no modelo acima. Relatos de outros modelos são bem-vindos nas issues.

Começou como fork do [FreeMyTvWebOS](https://github.com/danielthejoker18/FreeMyTvWebOS) (MIT) e foi reescrito do zero.

## Recursos

| | Precisa de root? |
|---|---|
| Fundo com 42 aerials da Apple por streaming (0 MB no disco), seletor por categoria ou preto OLED | não |
| Dock só de streaming, que aprende o app mais usado em cada período do dia | não |
| Clima via Open-Meteo (sem chave), próximas horas e condições | não |
| Frase do dia gerada pelo Gemini (opcional, chave grátis) | não |
| Fileiras de entradas (HDMI, AirPlay), ajustes rápidos e apps instalados | não |
| Pixel shift contra burn-in | não |
| **Abrir sempre no launcher** (ao ligar e no botão Home), botão "Home da LG" pra voltar à home original | **sim** |
| **Assistente de voz** no microfone do Magic Remote: responde perguntas (Gemini) e executa comandos (abrir apps, YouTube, Spotify, volume, apagar tela) | **sim** |

## Instalação

### 1. Pré-requisitos

- TV LG com webOS 6 e o app **Developer Mode** ativo ([guia oficial](https://webostv.developer.lge.com/develop/getting-started/developer-mode-app)).
- No computador: Node.js e o CLI da LG:
  ```bash
  npm install -g @webos-tools/cli
  ares-setup-device   # cadastre a TV; anote o nome que der pra ela (ex.: minhatv)
  ```

### 2. Sua configuração

```bash
git clone https://github.com/joaowatanabe/webos-tv-enhancer.git
cd webos-tv-enhancer
cp .env.example .env                       # DEVICE=<nome da TV no ares-setup-device>
cp app/config.example.js app/config.js     # sua config pessoal (fica fora do git)
```

Edite `app/config.js` com o que quiser mudar. Tudo que você não definir vem de `config.example.js`:

```js
window.LAUNCHER_CONFIG = {
    name: 'Ana',
    city: { name: 'Curitiba', lat: -25.4284, lon: -49.2733, timezone: 'America/Sao_Paulo' },
    geminiKey: '',        // opcional: https://aistudio.google.com/apikey
    spotifyClientId: '',  // opcional (voz → Spotify): https://developer.spotify.com/dashboard
    spotifyClientSecret: '',
    rootDaemon: false     // true só se a TV tiver root + Homebrew Channel
};
```

- **Dock:** copie o array `dock` do `config.example.js` e reordene/remova. O `id` de cada app sai de `ares-install --device <tv> --list`.
- **Entradas:** o array `inputs` define a fileira de HDMI/AirPlay (ex.: `{ icon: 'brand:playstation4', cap: 'PS5 · HDMI 2', app: 'com.webos.app.hdmi2' }`).

### 3. Instalar

```bash
./scripts/deploy.sh     # empacota, instala e abre na TV
```

Ao atualizar, suba a `version` em `app/appinfo.json` antes.

## Root (opcional)

Com a TV rooteada e o [Homebrew Channel](https://github.com/webosbrew/webos-homebrew-channel) com o serviço elevado, ligue `rootDaemon: true`. Na primeira abertura, o launcher instala um serviço pequeno (`app/system/fmtvd.sh`) em `/var/lib/webosbrew/`, que roda no boot e:

- abre o launcher quando a TV liga e quando a home da LG aparece (botão Home, sair de um app);

Pra voltar à home original: **Ajustes rápidos → Home da LG** (vale até você abrir outro app) ou **Abrir sempre aqui: não** (desliga de vez). Tem uma trava anti-loop: no máximo 3 aberturas por minuto. Detalhes e desinstalação em [`docs/specs/001-home-daemon.md`](docs/specs/001-home-daemon.md).

## Assistente de voz (root)

Com `rootDaemon: true` e `geminiKey` preenchida, segure o botão de microfone do Magic Remote e fale. A LG transcreve, o serviço `fmtvd` repassa o texto ao launcher e o Gemini (function calling) decide:

- **Pergunta:** a resposta aparece num balão ✦ no topo da tela.
- **Comando:** abrir apps, tocar vídeo no YouTube, tocar no Spotify (Web API + deep link; precisa de `spotifyClientId`/`spotifyClientSecret`), mudar volume, apagar a tela.

Detalhes em [`docs/specs/002-ia-no-controle.md`](docs/specs/002-ia-no-controle.md).

## Roadmap

Limpeza da TV (apps de fábrica, ads, telemetria) e mais fontes de vídeo pro fundo. Ver [`docs/roadmap.md`](docs/roadmap.md).

## Controle

Setas navegam · **OK** abre · **Voltar** sobe pro dock ou fecha o seletor.

## Limites do webOS 6 (Chromium 79)

- **Nada de `backdrop-filter` sobre o vídeo.** O vídeo roda num plano de hardware que o blur não enxerga: vira faixa preta e deixa tudo lento.
- **Um único `<video>`.** Dois vídeos 2K decodificando juntos pesam na TV.
- **Sem `cqw`, `aspect-ratio` nem `gap` em flexbox.** O layout usa px fixos pra 1920×1080.
- **JS em ES5** e sombras curtas (glow grande custa caro a cada passo das setas).

## Estrutura

```
app/
  index.html            launcher inteiro (HTML + CSS + JS)
  config.example.js     configuração padrão (versionada)
  config.js             sua configuração (gitignored)
  system/fmtvd.sh       serviço root opcional
  system/init.d-fmtv    gancho de boot do Homebrew Channel
  assets/brands/        logos (fontes em SOURCES.md)
scripts/deploy.sh
docs/roadmap.md, docs/specs/
```

## Segurança

- `app/config.js` e `.env` ficam fora do git. Não versione chaves.
- A chave do Gemini vai dentro do `.ipk` instalado na TV (é um app web, roda no cliente). Restrinja a chave à Generative Language API no Google Cloud.

## Créditos e licença

Licença MIT (arquivo [`LICENSE`](LICENSE)). Base: FreeMyTvWebOS, © 2026 Daniel. Catálogo de aerials levantado do Lumen Launcher; vídeos servidos pela Apple. Logos são marcas dos respectivos donos, usados só como atalhos de app.
