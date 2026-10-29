#!/bin/sh
# fmtvd — mantém o launcher como "home" da TV (precisa de root via Homebrew Channel).
#   1. Botão Home / home da LG em primeiro plano  -> abre o launcher
#   2. TV ligou (saiu do standby)                  -> abre o launcher
#   3. Botão de microfone (qualquer app) -> voiceagent.js grava o áudio, o Gemini entende e a ação é executada
#      (fallback, se o Input Hook não esconder a tecla: com o launcher na frente, repassa a transcrição da LG)
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
VC=luna://com.webos.service.voiceconductor
TAP=/media/developer/apps/usr/palm/applications/$APP/system/voicetap.js
VOICE_WAV=/tmp/fmtv-voice.wav
AGENT=/media/developer/apps/usr/palm/applications/$APP/system/voiceagent.js

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

notify() {
    # Empurra um evento pro launcher (chega como webOSRelaunch; não passa pela trava anti-loop).
    luna-send -n 1 luna://com.webos.applicationManager/launch "{\"id\":\"$APP\",\"params\":{\"voz\":$1}}" >/dev/null 2>&1
}

listen_session() {
    # As falas só chegam durante a sessão de voz; depois do sessionEnd a assinatura fica parada (o timeout limpa).
    # $1 = pid do voicetap (gravação do áudio em paralelo), pra esperar o WAV antes de avisar o launcher.
    timeout -t 30 luna-send -i $VC/getUtteranceEvents '{"subscribe":true}' 2>/dev/null |
    while read -r line; do
        case "$line" in
        *'"sttResult"'*)
            t=$(echo "$line" | sed -n 's/.*"text":\["\([^"]*\)".*/\1/p')
            [ -z "$t" ] && continue
            # Cancela antes da LG agir (busca/ThinQ): quem responde é o launcher.
            luna-send -n 1 $VC/cancelRecognition '{}' >/dev/null 2>&1
            # A LG manda até 3 transcrições possíveis: vão todas, a IA escolhe pelo sentido.
            alts=$(echo "$line" | sed -n 's/.*"text":\(\[[^]]*\]\).*/\1/p')
            # Espera o voicetap fechar o WAV (até 3 s); com áudio, o Gemini ouve a fala em vez de ler a transcrição da LG.
            i=0; while [ -n "$1" ] && kill -0 "$1" 2>/dev/null && [ $i -lt 30 ]; do usleep 100000; i=$((i + 1)); done
            audio=""; [ -s "$VOICE_WAV" ] && audio=",\"audio\":\"$VOICE_WAV\""
            log "voz: $t${audio:+ (com áudio)}"
            notify "{\"evento\":\"texto\",\"texto\":\"$t\",\"alternativas\":${alts:-[]}$audio}"
            break;;
        *'"sessionEnd"'*) break;;
        esac
    done
}

watch_voice() {
    # Registra o launcher como "interactor" da voz: a LG avisa (setContext) a cada aperto do microfone com ele na frente.
    luna-send -i -a $APP $VC/interactor/register '{"subscribe":true,"type":"foreground"}' 2>/dev/null |
    while read -r line; do
        case "$line" in *'"setContext"'*) ;; *) continue;; esac
        ticket=$(echo "$line" | sed -n 's/.*"voiceTicket":"\([^"]*\)".*/\1/p')
        tp=""
        if [ -f "$TAP" ]; then node "$TAP" "$VOICE_WAV" >/dev/null 2>&1 & tp=$!; fi
        listen_session "$tp" &
        luna-send -n 1 -a $APP $VC/interactor/setContext "{\"voiceTicket\":\"$ticket\",\"inAppIntents\":[]}" >/dev/null 2>&1
        notify '{"evento":"ouvindo"}'
    done
}

watch_agent() {
    [ -f "$AGENT" ] || { sleep 60; return; }
    node "$AGENT" >/dev/null 2>&1
}

# Cada assinatura num laço próprio: se o luna-send cair, reconecta.
forever() { while true; do "$1"; sleep 5; done; }

log "fmtvd iniciado (pid $$)"
forever watch_foreground &
forever watch_power &
forever watch_voice &
forever watch_agent &

if [ "$1" = "boot" ]; then
    sleep 20
    [ -f "$OFF" ] || launch "boot"
fi
wait
