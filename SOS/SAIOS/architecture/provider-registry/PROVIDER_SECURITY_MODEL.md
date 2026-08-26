# Provider Security Model

**Documentation only. No secrets handling implementation.**

---

## Principles

| Area | Rule |
|------|------|
| API keys | Stored only in secret stores (future); never in Registry JSON, git, or logs |
| Secrets | Redacted in dashboards; least privilege access |
| Encryption | Secrets encrypted at rest; TLS in transit (future ops) |
| Rotation | Key rotation without changing `provider_id` |
| Audit | Append-only access and validation decisions |
| Least privilege | Adapters receive scoped credentials; workers receive none |

---

## Registry content rules

Allowed: public metadata, capability tags, cost units, validation state.  
Forbidden: raw API keys, bearer tokens, private certs, customer PII in provider records.

---

## Runtime rules (future)

- Workers must not import vendor SDKs.  
- Only Provider Adapters (future) may hold short-lived credentials.  
- Brain Router never logs secrets.  
- LIVE OFF means no credential use for external inference.

---

## Alignment

Matches Phase 4 `EXECUTION_GUARDRAILS.md` security section and dashboard `secrets_redacted` posture.
