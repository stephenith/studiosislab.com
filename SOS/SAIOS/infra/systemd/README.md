# AIOS systemd units (24/7 Resume Template Department)

Templates for VPS install under `/etc/systemd/system/`.

## Units

| Unit | Role |
|------|------|
| `aios-founder-dashboard.service` | Founder dashboard + revision dispatcher |
| `aios-generation.service` | Oneshot autonomous generation (batch 5, queue_max 20) |
| `aios-generation-morning.timer` | 08:50 Asia/Kolkata |
| `aios-generation-evening.timer` | 17:50 Asia/Kolkata |
| `aios-backup.service` / `.timer` | Daily critical-data backup |
| `aios-publication-nightly.service` / `.timer` | Nightly publication plan+verify (AUTO_APPLY off by default) |

## Environment

Use `/etc/aios/aios.env` (mode 600) for:

- `SOS_AIOS_LIVE=0`
- `SOS_AI_FOUNDER_OPENAI_BOUNDED=1` (after cost ledger proven)
- `OPENAI_API_KEY=...`
- budget ceilings
- `SOS_AIOS_NOTIFY_LIVE=0|1`
- `SOS_AIOS_PUBLICATION_AUTO_APPLY=0`

Never commit real `/etc/aios/aios.env`.

## Install (VPS)

```bash
cp SOS/SAIOS/infra/systemd/*.service SOS/SAIOS/infra/systemd/*.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now aios-founder-dashboard.service
systemctl enable --now aios-backup.timer
# After gates G2–G3:
systemctl enable --now aios-generation-morning.timer aios-generation-evening.timer
# After Vercel verify:
systemctl enable --now aios-publication-nightly.timer
```
