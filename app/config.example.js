// Configuração padrão do launcher. NÃO coloque dados pessoais aqui.
// Pra personalizar: copie este arquivo para app/config.js (que está no .gitignore)
// e troque só o que quiser. O config.js é mesclado por cima deste arquivo.
window.LAUNCHER_DEFAULTS = {
    // Nome na saudação ("Boa noite, Ana"). Vazio = só "Boa noite".
    name: '',

    // Cidade do clima (Open-Meteo, sem chave). Ache lat/lon em https://open-meteo.com/en/docs
    city: { name: 'São Paulo', lat: -23.5505, lon: -46.6333, timezone: 'America/Sao_Paulo' },

    // Dock: só streaming, na ordem que você usa. "id" é o appId do webOS
    // (veja com `ares-install --device <tv> --list`). "logo" = arquivo em assets/brands/.
    dock: [
        { id: 'youtube.leanback.v4', name: 'YouTube', cat: 'Vídeos, lives e música em 4K HDR', bg: '#ff0033', logo: 'youtube' },
        { id: 'spotify-beehive', name: 'Spotify', cat: 'Músicas, playlists e podcasts', bg: '#1db954', logo: 'spotify' },
        { id: 'netflix', name: 'Netflix', cat: 'Filmes e séries', bg: '#0b0b0f', logo: 'netflix' },
        { id: 'com.wbd.stream', name: 'HBO Max', cat: 'Filmes e séries', bg: '#0b1cff', logo: 'hbomax', wide: true },
        // O SVG amazonprime do simple-icons fica minúsculo no tile; wordmark em texto lê melhor.
        { id: 'amazon', name: 'Prime Video', cat: 'Filmes, séries e esportes', bg: '#0b1f3a', mark: '<span class="wd" style="color:#1ab7ea">prime<span style="color:#fff">video</span></span>' },
        { id: 'com.apple.appletv', name: 'Apple TV', cat: 'Originais Apple', bg: '#060608', logo: 'appletv', wide: true },
        { id: 'globoplaywebos', name: 'Globoplay', cat: 'Novelas, Globo ao vivo e esportes', bg: '#12101a', logo: 'globoplay', wide: true }
    ],

    // Fileira "Entradas & dispositivos". icon: nome de ícone interno ou 'brand:<arquivo>' de assets/brands/.
    inputs: [
        { icon: 'hdmi', cap: 'HDMI 1', app: 'com.webos.app.hdmi1' },
        { icon: 'hdmi', cap: 'HDMI 2', app: 'com.webos.app.hdmi2' },
        { icon: 'airplay', cap: 'AirPlay', app: 'airplay' },
        { icon: 'globe', cap: 'Navegador', app: 'com.webos.app.browser' }
    ],

    // Minutos sem tecla até entrar o modo relógio.
    idleMinutes: 3,

    // Frase do dia gerada pelo Gemini (opcional). Chave grátis em https://aistudio.google.com/apikey
    // Atenção: a chave vai dentro do .ipk instalado na TV. Restrinja-a à Generative Language API.
    geminiKey: '',
    geminiModel: 'gemini-flash-lite-latest',

    // Recursos que exigem TV com root + Homebrew Channel (veja docs/specs/001-home-daemon.md):
    // abrir sempre no launcher, botão "Home da LG" e bloquear o protetor de tela da LG.
    rootDaemon: false
};
