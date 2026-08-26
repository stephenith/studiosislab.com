# E2E 24/7 acceptance checklist (Phase J–K)

Do **not** mass-clear Ready for Review. Use one controlled Resume Template for memory/revision proof when ready.

## Restart / reboot (J)

- [ ] `systemctl restart aios-founder-dashboard` → `/api/health` 200 on 127.0.0.1:4310
- [ ] Caddy serves `https://founder.studiosislab.com` with basic_auth
- [ ] `systemctl list-timers | grep aios` shows generation + backup (+ publication if enabled)
- [ ] Optional Founder-authorized VPS reboot → same units return without SSH init scripts

## E2E (K)

1. [ ] HTTPS URL works without SSH tunnel
2. [ ] Generation timer journal shows fire (or `systemctl start aios-generation.service` once)
3. [ ] With waiting_founder ≥ 20: skip/PAUSE `queue_capacity` (backpressure preserved)
4. [ ] Verification generation path OK (`candidates-verify/`) when proving OpenAI without FR growth
5. [ ] REQUEST CHANGES → PENDING → dispatcher completes without CLI (BOUNDED=1)
6. [ ] Deterministic gates fail closed on bad plans
7. [ ] APPROVE promotes related Founder Memory to CONFIRMED
8. [ ] Nightly publication dry-run log exists; AUTO_APPLY still 0 unless Founder enabled
9. [ ] Telegram test alert received (`SOS_AIOS_NOTIFY_LIVE=1` test)
10. [ ] Cost ledger has rows; spend gate blocks when over daily

## Production-ready claim

All MVP bars in the plan §3 + stop gates G1–G7 green.
