// voicetap — grava o áudio do microfone do controle durante uma sessão de voz da LG, como 2º cliente do socket
// do voiceinput (PCM s16le, 16 kHz, mono), e salva um WAV pro launcher mandar ao Gemini.
// Uso (o fmtvd chama ao receber setContext): node voicetap.js /tmp/fmtv-voice.wav
var net = require('net'), fs = require('fs');
var SOCK = '/tmp/voiceinput_remote1.soc', OUT = process.argv[2] || '/tmp/fmtv-voice.wav';
var RATE = 16000, MAX_MS = 15000, WAIT_MS = 4000;
var chunks = [], size = 0, started = Date.now();

function wavHeader(n) {
    var h = Buffer.alloc(44);
    h.write('RIFF', 0); h.writeUInt32LE(36 + n, 4); h.write('WAVE', 8);
    h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
    h.writeUInt32LE(RATE, 24); h.writeUInt32LE(RATE * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
    h.write('data', 36); h.writeUInt32LE(n, 40);
    return h;
}
function finish() {
    if (!size) process.exit(1);
    // Grava em .tmp e renomeia: o launcher nunca lê um WAV pela metade.
    fs.writeFileSync(OUT + '.tmp', Buffer.concat([wavHeader(size)].concat(chunks)));
    fs.renameSync(OUT + '.tmp', OUT);
    process.exit(0);
}
function connect() {
    var s = net.connect(SOCK);
    s.on('data', function(d) { chunks.push(d); size += d.length; });
    s.on('close', finish);
    s.on('error', finish);
    setTimeout(function() { s.destroy(); }, MAX_MS);
}
try { fs.unlinkSync(OUT); } catch (e) {}
// O socket aparece logo depois do setContext; espera até 4 s por ele.
(function wait() {
    if (fs.existsSync(SOCK)) return connect();
    if (Date.now() - started > WAIT_MS) process.exit(1);
    setTimeout(wait, 30);
})();
