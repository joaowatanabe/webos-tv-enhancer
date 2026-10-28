# 001 — Launcher como tela inicial (fmtvd)

**Status:** implementado na v1.5.0 · testado: redirecionamento da home e bypass · a validar no uso: abrir ao ligar e bloqueio do protetor da LG

## Problema
Um app web do Developer Mode não pode substituir a home da LG nem ler energia/primeiro plano (`Denied method call` em `/power` e `getForegroundAppInfo`). A TV liga e volta da maioria dos apps na home da LG, e depois do modo relógio do launcher entra o protetor de tela da LG.

## Requisitos
1. Ao ligar a TV (saída de standby), abrir o launcher.
2. Quando a home da LG vier pra frente (botão Home, sair de app), abrir o launcher.
3. Existir uma saída pra home original: temporária e permanente.
4. Com o launcher na frente, barrar o protetor de tela da LG; depois de 2 h parado, liberar (descanso do OLED).
5. Nunca travar a TV: se o launcher quebrar, a TV continua usável.

## Desenho
Serviço shell root (`fmtvd.sh`) iniciado no boot pelo `init.d` do Homebrew Channel. Três assinaturas `luna-send -i`, cada uma num laço que reconecta:

| Assinatura | Reação |
|---|---|
| `applicationManager/getForegroundAppInfo` | `com.webos.app.home` na frente → `launch` do launcher (req. 2) |
| `tvpower/power/getPowerState` | `Active Standby`/`Suspend` → `Active` → `launch` (req. 1) |
| `tvpower/power/registerScreenSaverRequest` | responde `responseScreenSaverRequest` com `ack:false` se o launcher está na frente (req. 4) |

Controle por arquivos, escritos pelo launcher via `hbchannel.service/exec`:

| Arquivo | Efeito |
|---|---|
| `/var/lib/webosbrew/fmtv/autostart-off` | desliga req. 1 e 2 (toggle "Abrir sempre aqui") |
| `/tmp/fmtv-home-bypass` | deixa a home da LG até abrir outro app (botão "Home da LG") |
| `/tmp/fmtv-allow-screensaver` | deixa o protetor da LG entrar (criado após 2 h no modo relógio) |

Trava anti-loop: no máximo 3 `launch` por minuto (req. 5).

**Instalação automática:** com `rootDaemon: true`, o launcher copia `app/system/*` pra `/var/lib/webosbrew/` a cada abertura, compara o md5 e reinicia o serviço se mudou. Reinstalar o app atualiza o serviço sozinho.

## Plano (feito)
- [x] Confirmar root via `hbchannel.service/exec` (uid 0) e o `run-parts` do `init.d`.
- [x] Validar o formato das três assinaturas na TV (busybox: `timeout -t`).
- [x] `fmtvd.sh` + `init.d-fmtv` + instalação pelo launcher.
- [x] Botões "Home da LG" e "Abrir sempre aqui" em Ajustes rápidos.
- [x] Teste: home → launcher; bypass → home fica.
- [ ] Validar no uso: ligar a TV pelo controle; protetor da LG barrado (`/tmp/fmtvd.log` registra cada pedido).

## Desinstalar
Pelo launcher: **Abrir sempre aqui: não**. Ou como root:
```sh
kill -TERM -$(cat /tmp/fmtvd.pid); rm -f /var/lib/webosbrew/init.d/fmtv; rm -rf /var/lib/webosbrew/fmtv
```
E `rootDaemon: false` no `config.js`, senão o launcher reinstala.

## Depuração
`/tmp/fmtvd.log` (rotaciona em 200 KB) e `/tmp/fmtv-foreground` (último app na frente).
