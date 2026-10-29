// voiceagent — assistente de voz em QUALQUER app (Node 8 da TV, roda como root pelo fmtvd).
// O Input Hook troca o botão de microfone (428) por um "exec" que anota uma linha em /tmp/fmtv-mic; este serviço vê
// o arquivo mudar, grava o áudio pelo voiceinput até você soltar (2º sinal) ou ficar 1 s em silêncio, manda o áudio
// pro Gemini e executa a ação. Resposta: balão ✦ do launcher quando ele está na frente; toast do sistema dentro dos outros apps.
'use strict';
var fs = require('fs'), net = require('net'), https = require('https'), vm = require('vm'), cp = require('child_process');

var APP = 'org.webos.freemytv';
var DIR = '/media/developer/apps/usr/palm/applications/' + APP;
var SOCK = '/tmp/voiceinput_remote1.soc';
var MIC_FILE = '/tmp/fmtv-mic';
var SILENCE_MS = 1000, LOUD_RMS = 700; // fim da fala: 1 s abaixo desse volume (s16le)
var LS_NAME = 'com.webos.lunasend-fmtvvoice'; // start e stop do voiceinput precisam do mesmo nome de chamador
var MAX_MS = 10000, MIN_BYTES = 16000; // até 12 s de fala; menos de 0,5 s é toque acidental
var LOG = '/tmp/fmtvd.log';

function log(m) {
    var d = new Date(), p = function(n) { return ('0' + n).slice(-2); };
    try { fs.appendFileSync(LOG, d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()) + ' voz: ' + m + '\n'); } catch (e) {}
}

// --- Config: a mesma do launcher (config.example.js + config.js do pacote instalado) ---
function loadConfig() {
    var sb = { window: {} };
    ['config.example.js', 'config.js'].forEach(function(f) {
        try { vm.runInNewContext(fs.readFileSync(DIR + '/' + f, 'utf8'), sb); } catch (e) {}
    });
    return Object.assign({}, sb.window.LAUNCHER_DEFAULTS || {}, sb.window.LAUNCHER_CONFIG || {});
}
var CFG = loadConfig();

// --- Luna e HTTP ---
function luna(uri, params, cb, extra) {
    var args = ['-n', '1', '-w', '6000'].concat(extra || []).concat([uri, JSON.stringify(params || {})]);
    cp.execFile('luna-send', args, function(err, out) {
        var j = null;
        try { j = JSON.parse(String(out).trim().split('\n').pop()); } catch (e) {}
        if (cb) cb(j);
    });
}
function request(method, url, headers, body, ms, cb) {
    var u = require('url').parse(url), done = false;
    var req = https.request({ method: method, hostname: u.hostname, path: u.path, headers: headers || {} }, function(res) {
        var buf = [];
        res.on('data', function(d) { buf.push(d); });
        res.on('end', function() { if (!done) { done = true; cb(null, Buffer.concat(buf).toString('utf8'), res.statusCode); } });
    });
    req.on('error', function(e) { if (!done) { done = true; cb(e); } });
    req.setTimeout(ms || 15000, function() { req.abort(); if (!done) { done = true; cb(new Error('timeout')); } });
    if (body) req.write(body);
    req.end();
}
function launchApp(id, params) {
    luna('luna://com.webos.applicationManager/launch', params ? { id: id, params: params } : { id: id });
}

// --- Feedback: balão no launcher ou toast por cima de qualquer app ---
function foreground() { try { return fs.readFileSync('/tmp/fmtv-foreground', 'utf8').trim(); } catch (e) { return ''; } }
function feedback(evento, texto) {
    if (foreground() === APP) {
        launchApp(APP, { voz: { evento: evento, texto: texto || '' } }); // chega no launcher como webOSRelaunch
    } else if (texto || evento === 'ouvindo') {
        luna('luna://com.webos.notification/createToast', { sourceId: APP, message: '✦ ' + (texto || 'Ouvindo…') });
    }
}

// --- Apps e playlists que a IA pode escolher ---
var APPS = [], MY_PLAYLISTS = [], LIKED = 'Músicas curtidas';
function loadApps() {
    var list = (CFG.dock || []).map(function(a) { return { name: a.name, id: a.id }; })
        .concat((CFG.inputs || []).map(function(i) { return { name: i.cap, id: i.app }; }));
    luna('luna://com.webos.applicationManager/listLaunchPoints', {}, function(j) {
        var seen = {};
        list.forEach(function(a) { seen[a.id] = true; });
        ((j && j.launchPoints) || []).forEach(function(lp) {
            var id = lp.id || lp.appId;
            if (id && !seen[id] && lp.title) { seen[id] = true; list.push({ name: lp.title, id: id }); }
        });
        APPS = list;
    });
    APPS = list;
}
function spotifyToken(cb) {
    if (!CFG.spotifyClientId || !CFG.spotifyClientSecret) return cb(null);
    var body = CFG.spotifyRefreshToken ? 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(CFG.spotifyRefreshToken) : 'grant_type=client_credentials';
    request('POST', 'https://accounts.spotify.com/api/token', {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + Buffer.from(CFG.spotifyClientId + ':' + CFG.spotifyClientSecret).toString('base64')
    }, body, 8000, function(err, out) {
        try { cb(JSON.parse(out).access_token); } catch (e) { cb(null); }
    });
}
function loadPlaylists() {
    if (!CFG.spotifyRefreshToken) return;
    spotifyToken(function(tk) {
        if (!tk) return;
        request('GET', 'https://api.spotify.com/v1/me/playlists?limit=50', { Authorization: 'Bearer ' + tk }, null, 10000, function(err, out) {
            try {
                var seen = {};
                MY_PLAYLISTS = (JSON.parse(out).items || []).filter(function(p) {
                    if (!p || !p.name || seen[p.name]) return false;
                    return (seen[p.name] = true);
                }).map(function(p) { return { name: p.name, uri: p.uri }; });
            } catch (e) {}
        });
    });
}
function norm(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, ''); }
function findApp(name) {
    var q = norm(name);
    if (q.length < 3) return null;
    for (var i = 0; i < APPS.length; i++) {
        var n = norm(APPS[i].name);
        if (n === q || n.indexOf(q) === 0 || q.indexOf(n) === 0) return APPS[i];
    }
    return null;
}

// --- Gemini (áudio + funções) ---
var DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
function systemPrompt() {
    var now = new Date(), p = function(n) { return ('0' + n).slice(-2); };
    var fg = foreground(), fgApp = APPS.filter(function(a) { return a.id === fg; })[0];
    return 'Você é o assistente de voz da TV' + (CFG.name ? ' de ' + CFG.name : '') + (CFG.city ? ', em ' + CFG.city.name : '') + '. Agora: ' +
        DIAS[now.getDay()] + ', ' + now.toLocaleDateString('pt-BR') + ', ' + p(now.getHours()) + ':' + p(now.getMinutes()) +
        '. App na tela: ' + (fgApp ? fgApp.name : fg || 'desconhecido') + '.\n' +
        'O pedido vem em áudio (português do Brasil, pode ter nomes em inglês). Se for pra controlar a TV, chame uma função; ' +
        'nas funções escreva a busca corrigida e enxuta. Pedidos de música sem app citado vão pro Spotify; vídeo vai pro YouTube. ' +
        (MY_PLAYLISTS.length ? 'Quando ele falar de playlist "minha", "do meu perfil" ou citar o nome de uma dele, use minha_playlist. ' : '') +
        'Se for pergunta ou conversa, responda em português do Brasil em no máximo 2 frases curtas (até 200 caracteres), sem markdown e sem emoji.' +
        (CFG.voiceHints ? '\nSobre o usuário: ' + CFG.voiceHints : '');
}
function tools() {
    var decl = [
        { name: 'abrir_app', description: 'Abre um app de streaming, entrada HDMI ou app instalado na TV.',
            parameters: { type: 'OBJECT', properties: { app: { type: 'STRING', enum: APPS.map(function(a) { return a.name; }) } }, required: ['app'] } },
        { name: 'youtube', description: 'Toca no YouTube um vídeo, canal, música ou assunto.',
            parameters: { type: 'OBJECT', properties: { busca: { type: 'STRING' } }, required: ['busca'] } },
        { name: 'spotify', description: 'Toca no Spotify uma playlist, artista, álbum ou música (gênero, clima ou nome).',
            parameters: { type: 'OBJECT', properties: { busca: { type: 'STRING' }, tipo: { type: 'STRING', enum: ['playlist', 'artista', 'album', 'musica'] } }, required: ['busca', 'tipo'] } },
        { name: 'volume', description: 'Muda o volume da TV.',
            parameters: { type: 'OBJECT', properties: { acao: { type: 'STRING', enum: ['aumentar', 'diminuir', 'mudo', 'tirar_mudo', 'definir'] },
                nivel: { type: 'INTEGER', description: '0 a 100; em aumentar/diminuir é quantos passos (padrão 3)' } }, required: ['acao'] } },
        { name: 'desligar_tela', description: 'Apaga a tela da TV; o som continua.' },
        { name: 'voltar_inicio', description: 'Volta pra tela inicial (launcher).' }
    ];
    if (MY_PLAYLISTS.length) decl.push({ name: 'minha_playlist', description: 'Toca uma playlist do próprio usuário ou as músicas curtidas dele.',
        parameters: { type: 'OBJECT', properties: { nome: { type: 'STRING', enum: [LIKED].concat(MY_PLAYLISTS.map(function(p) { return p.name; })) } }, required: ['nome'] } });
    return [{ functionDeclarations: decl }];
}
function gemini(model, wavB64, thinking, ms, cb) {
    var gc = { temperature: 0.4, maxOutputTokens: 8192 };
    if (thinking) gc.thinkingConfig = { thinkingLevel: CFG.voiceThinking || 'low' };
    var body = JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt() }] },
        contents: [{ role: 'user', parts: [{ text: 'Pedido em áudio:' }, { inlineData: { mimeType: 'audio/wav', data: wavB64 } }] }],
        tools: tools(), generationConfig: gc
    });
    request('POST', 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + encodeURIComponent(CFG.geminiKey),
        { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, body, ms, function(err, out) {
            var j = null;
            try { j = JSON.parse(out); } catch (e) {}
            cb(err || !j || !j.candidates ? (err || new Error((j && j.error && j.error.message) || 'sem resposta')) : null, j);
        });
}
function understand(wav) {
    if (!CFG.geminiKey) { feedback('erro', 'Configure a chave do Gemini.'); return; }
    feedback('pensando');
    var b64 = wav.toString('base64'), t0 = Date.now();
    var model = CFG.voiceModel || CFG.geminiModel;
    gemini(model, b64, true, 15000, function(err, j) {
        if (!err) return act(j, t0);
        log('Gemini ' + model + ' falhou (' + err.message + '); tentando ' + CFG.geminiModel);
        gemini(CFG.geminiModel, b64, false, 12000, function(err2, j2) {
            if (err2) { log('Gemini falhou: ' + err2.message); feedback('erro', 'Sem conexão com a IA.'); return; }
            act(j2, t0);
        });
    });
}
function act(j, t0) {
    var parts = (j.candidates[0].content && j.candidates[0].content.parts) || [];
    for (var i = 0; i < parts.length; i++) {
        if (parts[i].functionCall) {
            log('ação ' + parts[i].functionCall.name + ' ' + JSON.stringify(parts[i].functionCall.args || {}) + ' (' + (Date.now() - t0) + ' ms)');
            return runTool(parts[i].functionCall.name, parts[i].functionCall.args || {});
        }
    }
    var t = parts.map(function(p) { return p.thought ? '' : p.text || ''; }).join(' ').replace(/\s+/g, ' ').trim();
    log('resposta "' + t + '" (' + (Date.now() - t0) + ' ms)');
    feedback(t ? 'resposta' : 'erro', t || 'Não consegui responder agora.');
}
function runTool(name, a) {
    var AUDIO = 'luna://com.webos.service.audio/master/';
    if (name === 'abrir_app') {
        var app = findApp(a.app || '');
        if (!app) return feedback('erro', 'Não achei o app ' + (a.app || '') + '.');
        feedback('resposta', 'Abrindo ' + app.name + '.');
        launchApp(app.id);
    } else if (name === 'youtube') {
        var q = String(a.busca || '').trim();
        request('GET', 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q),
            { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'pt-BR' }, null, 8000, function(err, html) {
                var m = /"videoId":"([\w-]{11})"/.exec(html || '');
                feedback(m ? 'resposta' : 'erro', m ? 'Tocando “' + q + '” no YouTube.' : 'Não achei esse vídeo; abrindo o YouTube.');
                launchApp('youtube.leanback.v4', m ? { contentTarget: 'v=' + m[1] } : null);
            });
    } else if (name === 'spotify') {
        var sq = String(a.busca || '').trim();
        var st = { playlist: 'playlist', artista: 'artist', album: 'album', musica: 'track' }[a.tipo] || 'playlist';
        spotifyToken(function(tk) {
            if (!tk) { feedback('erro', 'Falta configurar o Spotify; abrindo o app.'); return launchApp('spotify-beehive'); }
            request('GET', 'https://api.spotify.com/v1/search?type=' + st + '&limit=5&market=BR&q=' + encodeURIComponent(sq),
                { Authorization: 'Bearer ' + tk }, null, 8000, function(err, out) {
                    var m = new RegExp('spotify:' + st + ':[A-Za-z0-9]{22}').exec(out || '');
                    feedback(m ? 'resposta' : 'erro', m ? 'Tocando “' + sq + '” no Spotify.' : 'Não achei no Spotify; abrindo o app.');
                    launchApp('spotify-beehive', m ? { contentTarget: m[0] } : null);
                });
        });
    } else if (name === 'minha_playlist') {
        var want = norm(a.nome || ''), pl = want === norm(LIKED) ? { name: LIKED, uri: 'spotify:collection:tracks' } : null;
        for (var k = 0; !pl && k < MY_PLAYLISTS.length; k++) if (norm(MY_PLAYLISTS[k].name) === want) pl = MY_PLAYLISTS[k];
        if (!pl) return feedback('erro', 'Não achei essa playlist no seu perfil.');
        feedback('resposta', 'Tocando “' + pl.name + '” no Spotify.');
        launchApp('spotify-beehive', { contentTarget: pl.uri });
    } else if (name === 'volume') {
        var n = parseInt(a.nivel, 10);
        if (a.acao === 'definir' && n >= 0) { luna(AUDIO + 'setVolume', { volume: Math.min(100, n) }); feedback('resposta', 'Volume em ' + Math.min(100, n) + '.'); }
        else if (a.acao === 'mudo' || a.acao === 'tirar_mudo') { luna(AUDIO + 'setMuted', { muted: a.acao === 'mudo' }); feedback('resposta', a.acao === 'mudo' ? 'Som desligado.' : 'Som ligado.'); }
        else {
            var steps = n > 0 && n <= 20 ? n : 3, method = a.acao === 'diminuir' ? 'volumeDown' : 'volumeUp';
            (function step(i) { if (i < steps) luna(AUDIO + method, {}, function() { step(i + 1); }); })(0);
            feedback('resposta', (a.acao === 'diminuir' ? 'Abaixando' : 'Aumentando') + ' o volume.');
        }
    } else if (name === 'desligar_tela') {
        feedback('resposta', 'Apagando a tela.');
        setTimeout(function() { luna('luna://com.webos.service.tvpower/power/turnOffScreen', {}); }, 1500);
    } else if (name === 'voltar_inicio') {
        launchApp(APP);
    } else feedback('erro', 'Ainda não sei fazer isso.');
}

// --- Gravação: voiceinput (PCM s16le 16 kHz mono) enquanto o botão está apertado ---
var rec = null;
function wavHeader(n) {
    var h = Buffer.alloc(44);
    h.write('RIFF', 0); h.writeUInt32LE(36 + n, 4); h.write('WAVE', 8);
    h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
    h.writeUInt32LE(16000, 24); h.writeUInt32LE(32000, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
    h.write('data', 36); h.writeUInt32LE(n, 40);
    return h;
}
function startRec() {
    if (rec) return;
    var r = rec = { chunks: [], size: 0, sock: null, ended: false, t0: Date.now(), lastLoud: Date.now() };
    feedback('ouvindo');
    // -n 2: sai depois de "subscribed" + "voice start" e libera o nome pro stopStreaming.
    r.proc = cp.execFile('luna-send', ['-i', '-n', '2', '-w', '4000', '-m', LS_NAME, 'luna://com.webos.service.voiceinput/startStreaming',
        JSON.stringify({ keyType: 'thinQtv', subscribe: true, deviceType: 'remote' })], function(err, out) {
        if (/errorCode/.test(out || '')) { log('voiceinput não abriu: ' + String(out).trim()); finishRec(r, true); }
    });
    (function wait(t0) {
        if (r.ended) return;
        if (fs.existsSync(SOCK)) {
            r.sock = net.connect(SOCK);
            r.sock.on('data', function(d) {
                r.chunks.push(d); r.size += d.length;
                var sum = 0, n = Math.floor(d.length / 2);
                for (var i = 0; i < n; i++) { var v = d.readInt16LE(i * 2); sum += v * v; }
                if (n && Math.sqrt(sum / n) > LOUD_RMS) r.lastLoud = Date.now();
                if (Date.now() - r.t0 > 1500 && Date.now() - r.lastLoud > SILENCE_MS) stopRec();
            });
            r.sock.on('error', function() {});
            return;
        }
        if (Date.now() - t0 < 3000) setTimeout(function() { wait(t0); }, 30);
    })(Date.now());
    r.timer = setTimeout(stopRec, MAX_MS);
}
function stopRec() {
    var r = rec;
    if (!r || r.stopping) return;
    r.stopping = true;
    clearTimeout(r.timer);
    try { r.proc.kill(); } catch (e) {}
    luna('luna://com.webos.service.voiceinput/stopStreaming', { keyType: 'thinQtv', deviceType: 'remote' }, null, ['-m', LS_NAME]);
    setTimeout(function() { finishRec(r, false); }, 250); // deixa chegar o finzinho do áudio
}
function finishRec(r, failed) {
    if (r.ended) return;
    r.ended = true;
    clearTimeout(r.timer);
    if (r.sock) r.sock.destroy();
    if (rec === r) rec = null;
    if (failed) return feedback('erro', 'Não consegui abrir o microfone. Tente de novo.');
    if (r.size < MIN_BYTES) { log('fala curta demais (' + r.size + ' bytes), ignorada'); return feedback('erro', 'Não ouvi nada.'); }
    log('áudio ' + (r.size / 32000).toFixed(1) + ' s');
    understand(Buffer.concat([wavHeader(r.size)].concat(r.chunks)));
}

// --- Botão de microfone: o "exec" do Input Hook anota uma linha em /tmp/fmtv-mic a cada sinal ---
function watchMic() {
    var lastSize = 0, lastSignal = 0;
    try { fs.writeFileSync(MIC_FILE, ''); } catch (e) {}
    log('agente ouvindo o botão de microfone (' + MIC_FILE + ')');
    fs.watch('/tmp', function(ev, f) {
        if (f !== 'fmtv-mic') return;
        var size = 0;
        try { size = fs.statSync(MIC_FILE).size; } catch (e) { return; }
        if (size <= lastSize) { lastSize = size; return; }
        lastSize = size;
        var now = Date.now();
        if (now - lastSignal < 250) return; // repetição da mesma tecla
        lastSignal = now;
        if (!rec) startRec();          // 1º sinal: apertou
        else if (now - rec.t0 > 400) stopRec(); // 2º sinal: soltou (se o hook avisar o soltar)
        if (size > 4096) { try { fs.writeFileSync(MIC_FILE, ''); lastSize = 0; } catch (e) {} }
    });
}

loadApps();
loadPlaylists();
setInterval(function() { CFG = loadConfig(); loadApps(); loadPlaylists(); }, 6 * 60 * 60 * 1000);
watchMic();
