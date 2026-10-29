// Login único no Spotify (OAuth) pra o assistente tocar as SUAS playlists e curtidas.
// Pré-requisito: no app do developer.spotify.com, Redirect URI = http://127.0.0.1:8888/callback
// Uso: node scripts/spotify-login.mjs   -> abre o navegador; ao autorizar, grava spotifyRefreshToken em app/config.js
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG = path.join(ROOT, 'app', 'config.js');
const REDIRECT = 'http://127.0.0.1:8888/callback';
const SCOPES = 'playlist-read-private playlist-read-collaborative user-library-read';

// Lê só os campos do Spotify do config.js (sem imprimir nada dele).
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(CONFIG, 'utf8'), sandbox);
const cfg = Object.values(sandbox.window).find(o => o && o.spotifyClientId) || {};
if (!cfg.spotifyClientId || !cfg.spotifyClientSecret) {
    console.error('Falta spotifyClientId/spotifyClientSecret em app/config.js.');
    process.exit(1);
}

const state = crypto.randomBytes(12).toString('hex');
const authUrl = 'https://accounts.spotify.com/authorize?' + new URLSearchParams({
    client_id: cfg.spotifyClientId, response_type: 'code', redirect_uri: REDIRECT, scope: SCOPES, state
});

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, REDIRECT);
    if (url.pathname !== '/callback') { res.writeHead(404).end(); return; }
    const code = url.searchParams.get('code');
    if (url.searchParams.get('state') !== state || !code) {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Login cancelado ou inválido.');
        finish('Login cancelado: ' + (url.searchParams.get('error') || 'state inválido'), 1);
        return;
    }
    const r = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: 'Basic ' + Buffer.from(cfg.spotifyClientId + ':' + cfg.spotifyClientSecret).toString('base64')
        },
        body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT })
    });
    const j = await r.json();
    if (!j.refresh_token) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Falhou ao trocar o código.');
        finish('Erro do Spotify: ' + (j.error_description || j.error || r.status), 1);
        return;
    }
    saveRefreshToken(j.refresh_token);
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Pronto! Pode fechar esta aba e voltar pro terminal.');
    finish('Login feito: spotifyRefreshToken gravado em app/config.js. Rode ./scripts/deploy.sh.', 0);
});

function saveRefreshToken(token) {
    let s = fs.readFileSync(CONFIG, 'utf8');
    if (/\bspotifyRefreshToken\s*:/.test(s)) s = s.replace(/(\bspotifyRefreshToken\s*:\s*)(['"]).*?\2/, `$1'${token}'`);
    else { const i = s.indexOf('{', s.indexOf('=')) + 1; s = s.slice(0, i) + `\n    spotifyRefreshToken: '${token}',` + s.slice(i); }
    fs.writeFileSync(CONFIG, s);
}

function finish(msg, code) { console.log(msg); server.close(); process.exitCode = code; }

server.listen(8888, '127.0.0.1', () => {
    console.log('Abrindo o navegador pra autorizar o Spotify… (se não abrir, cole este link)\n' + authUrl);
    execFile('open', [authUrl]);
});
setTimeout(() => finish('Tempo esgotado (3 min) sem autorização.', 1), 180000).unref();
