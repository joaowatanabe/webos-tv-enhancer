#!/bin/sh
# fmtvd — mantém o launcher como "home" da TV (precisa de root via Homebrew Channel).
#   1. Botão Home / home da LG em primeiro plano  -> abre o launcher
#   2. TV ligou (saiu do standby)                  -> abre o launcher
#   O protetor de tela fica por conta da LG (o daemon não interfere).
# Arquivos de controle (o launcher cria/remove via hbchannel exec):
#   $DIR/autostart-off        existe = itens 1 e 2 desligados
#   /tmp/fmtv-home-bypass     existe = deixa a home da LG abrir até você trocar de app

APP=org.webos.freemytv
LG_HOME=com.webos.app.home
DIR=/var/lib/webosbrew/fmtv
OFF=$DIR/autostart-off
BYPASS=/tmp/fmtv-home-bypass
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

# Cada assinatura num laço próprio: se o luna-send cair, reconecta.
forever() { while true; do "$1"; sleep 5; done; }

log "fmtvd iniciado (pid $$)"
forever watch_foreground &
forever watch_power &

if [ "$1" = "boot" ]; then
    sleep 20
    [ -f "$OFF" ] || launch "boot"
fi
wait
