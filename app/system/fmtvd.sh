#!/bin/sh
# fmtvd — mantém o launcher como "home" da TV (precisa de root via Homebrew Channel).
#   1. Botão Home / home da LG em primeiro plano  -> abre o launcher
#   2. TV ligou (saiu do standby)                  -> abre o launcher
#   3. Protetor de tela da LG com o launcher aberto -> barrado (o launcher tem o próprio)
# Arquivos de controle (o launcher cria/remove via hbchannel exec):
#   $DIR/autostart-off        existe = itens 1 e 2 desligados
#   /tmp/fmtv-home-bypass     existe = deixa a home da LG abrir até você trocar de app
#   /tmp/fmtv-allow-screensaver existe = deixa o protetor da LG entrar (descanso do OLED)

APP=org.webos.freemytv
LG_HOME=com.webos.app.home
DIR=/var/lib/webosbrew/fmtv
OFF=$DIR/autostart-off
BYPASS=/tmp/fmtv-home-bypass
ALLOW_SS=/tmp/fmtv-allow-screensaver
FG=/tmp/fmtv-foreground
LAUNCHES=/tmp/fmtv-launches
PIDFILE=/tmp/fmtvd.pid
LOG=/tmp/fmtvd.log

if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then exit 0; fi
echo $$ > "$PIDFILE"

log() {
    [ -f "$LOG" ] && [ "$(wc -c < "$LOG")" -gt 200000 ] && mv "$LOG" "$LOG.1"
    echo "$(date '+%F %T') $*" >> "$LOG"
}

launch() {
    # Trava anti-loop: no máximo 3 aberturas por minuto (se o launcher quebrar, a TV continua usável).
    now=$(date +%s)
    touch "$LAUNCHES"
    recent=$(awk -v t=$((now - 60)) '$1 > t' "$LAUNCHES" | wc -l)
    if [ "$recent" -ge 3 ]; then log "anti-loop: ignorado ($1)"; return; fi
    echo "$now" >> "$LAUNCHES"
    log "abrindo launcher ($1)"
    luna-send -n 1 luna://com.webos.applicationManager/launch "{\"id\":\"$APP\"}" >/dev/null 2>&1
}

watch_foreground() {
    luna-send -i luna://com.webos.applicationManager/getForegroundAppInfo '{"subscribe":true}' 2>/dev/null |
    while read -r line; do
        app=$(echo "$line" | sed -n 's/.*"appId": *"\([^"]*\)".*/\1/p')
        [ -z "$app" ] && continue
        echo "$app" > "$FG"
        if [ "$app" = "$LG_HOME" ]; then
            [ -f "$OFF" ] || [ -f "$BYPASS" ] || launch "home"
        elif [ "$app" != "$APP" ]; then
            rm -f "$BYPASS" # abriu outro app: a home da LG volta a ser redirecionada
        fi
    done
}

watch_power() {
    prev=""
    luna-send -i luna://com.webos.service.tvpower/power/getPowerState '{"subscribe":true}' 2>/dev/null |
    while read -r line; do
        st=$(echo "$line" | sed -n 's/.*"state": *"\([^"]*\)".*/\1/p')
        [ -z "$st" ] && continue
        if [ "$st" = "Active" ] && { [ "$prev" = "Active Standby" ] || [ "$prev" = "Suspend" ]; }; then
            [ -f "$OFF" ] || { sleep 2; launch "ligou"; }
        fi
        prev=$st
    done
}

watch_screensaver() {
    luna-send -i luna://com.webos.service.tvpower/power/registerScreenSaverRequest '{"subscribe":true,"clientName":"fmtvd"}' 2>/dev/null |
    while read -r line; do
        ts=$(echo "$line" | sed -n 's/.*"timestamp": *\([0-9]*\).*/\1/p')
        [ -z "$ts" ] && continue
        if [ "$(cat "$FG" 2>/dev/null)" = "$APP" ] && [ ! -f "$ALLOW_SS" ]; then ack=false; else ack=true; fi
        luna-send -n 1 luna://com.webos.service.tvpower/power/responseScreenSaverRequest \
            "{\"clientName\":\"fmtvd\",\"ack\":$ack,\"timestamp\":$ts}" >/dev/null 2>&1
        log "protetor da LG pedido: ack=$ack ($line)"
    done
}

# Cada assinatura num laço próprio: se o luna-send cair, reconecta.
forever() { while true; do "$1"; sleep 5; done; }

log "fmtvd iniciado (pid $$)"
forever watch_foreground &
forever watch_power &
forever watch_screensaver &

if [ "$1" = "boot" ]; then
    sleep 20
    [ -f "$OFF" ] || launch "boot"
fi
wait
