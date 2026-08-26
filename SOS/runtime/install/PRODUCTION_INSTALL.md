# SOS Commander — Production Install

Survives machine reboot when installed via **launchd** (macOS) or **systemd** (Linux).

## Prerequisites

1. Node.js 20+ and npm on the host
2. `cd SOS/runtime && npm install`
3. Configure `SOS/runtime/.env` (Telegram, Resend, etc.)
4. Repository path stable across reboots

## macOS (launchd)

```bash
cd SOS/runtime/install
chmod +x install-macos.sh
./install-macos.sh
```

Follow the printed `launchctl` commands to install and start the user agent.

**Service label:** `com.studiosis.sos-commander`  
**Logs:** `SOS/07_LOGS/commander/launchd.{stdout,stderr}.log`

`KeepAlive` + `RunAtLoad` ensure Commander restarts after reboot and crash.

## Linux (systemd)

```bash
cd SOS/runtime/install
chmod +x install-linux.sh
./install-linux.sh
```

Follow the printed `systemctl` commands. Use `loginctl enable-linger` for user services to survive logout/reboot.

**Unit:** `sos-commander.service`  
**Logs:** `SOS/07_LOGS/commander/systemd.{stdout,stderr}.log`

`Restart=always` and `TimeoutStopSec=180` allow graceful shutdown.

## Graceful shutdown

```bash
cd SOS/runtime
npm run commander:stop    # sends SIGTERM → graceful drain
```

Commander will:

1. Write `SOS/07_LOGS/commander/shutdown.flag`
2. Wait for Developer/QA to finish current work unit
3. Stop workers in order: Dispatcher → Telegram → Approvals → QA → Developer → PM
4. Flush PM/Developer/QA state files
5. Release stale locks
6. Exit cleanly

## Startup recovery

On Commander start (including after reboot):

- Stale developer/QA locks removed (dead PIDs only)
- PM `loop_status` resumed to `running` if paused
- Unfinished Developer execution preserved
- Interrupted QA verification reset (re-verify, no duplicate report)
- Telegram poll offset preserved
- Dispatcher retry queue preserved

Report: `SOS/07_LOGS/commander/last-recovery.json`

## Verification

```bash
npm run commander:audit
npm run commander:recovery-verify
npm run commander:graceful-test      # SIGTERM + state preservation
npm run commander:reboot-simulate    # stop → start → recovery check
```

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `SOS_COMMANDER_DRAIN_MS` | 120000 | Graceful drain wait before SIGTERM |
| `SOS_COMMANDER_WORKER_STOP_MS` | 60000 | Per-worker stop timeout |
| `SOS_WORKER_DRAIN_TIMEOUT_MS` | 300000 | Worker SIGTERM drain max |
