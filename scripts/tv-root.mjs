// Roda um comando como root na TV, pelo DevTools do launcher (porta 9998) + Homebrew Channel.
// Uso: node scripts/tv-root.mjs "comando"   (TV_IP=192.168.68.103 por padrão; o launcher precisa estar aberto)
const ip = process.env.TV_IP || '192.168.68.103';
const cmd = process.argv[2];
if (!cmd) { console.error('uso: node scripts/tv-root.mjs "comando"'); process.exit(1); }
const pages = await (await fetch(`http://${ip}:9998/json/list`)).json();
if (!pages.length) { console.error('Launcher fechado na TV: abra com `ares-launch --device lgc1 org.webos.freemytv`.'); process.exit(1); }
const ws = new WebSocket(pages[0].webSocketDebuggerUrl);
const expr = `new Promise(r => webOS.service.request("luna://org.webosbrew.hbchannel.service", {method: "exec", parameters: {command: ${JSON.stringify(cmd)}},
    onSuccess: x => r(x.stdoutString || ''), onFailure: e => r('ERR ' + JSON.stringify(e))}))`;
ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: expr, awaitPromise: true, returnByValue: true } }));
ws.onmessage = m => {
    const d = JSON.parse(m.data);
    if (d.id !== 1) return;
    const out = d.result?.result?.value ?? JSON.stringify(d);
    process.stdout.write(out.endsWith('\n') ? out : out + '\n');
    ws.close();
    if (out.startsWith('ERR ')) process.exitCode = 1;
};
