# Provider Failure Model

**Documentation only.**

---

## Failure modes

| Mode | Intent |
|------|--------|
| Timeout | Hard wall-clock on adapter calls; fail closed |
| Retry | Bounded retries with backoff; Cost Ledger aware |
| Circuit breaker | Trip after N failures; mark health degraded |
| Fallback | Alternate CERTIFIED provider only if policy allows |
| Provider unavailable | Selection excludes provider; surface to founder |
| Budget exhausted | Cost Ledger blocks selection |
| Rate limit | Backoff / switch / fail per policy |

---

## Ownership

| Concern | Owner |
|---------|-------|
| Detecting adapter failures | Provider Adapter (future) |
| Updating health projection | Provider Registry |
| Budget failures | Cost Ledger |
| Retry admission | Execution / skill policy (future) |
| Founder visibility | Dashboard (read-only) |

---

## Hard rules

- Failures must not bypass Registry.  
- Fallback must not target DEPRECATED/ARCHIVED.  
- Mock fallback only when explicitly configured and non-LIVE.
