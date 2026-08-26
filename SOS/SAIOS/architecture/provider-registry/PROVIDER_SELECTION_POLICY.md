# Provider Selection Policy

**Documentation only. Reconciled Agent #192 — matches runtime composition.**

---

## Routing chain

```
Skills
  ↓
Brain Router
  ↓
Provider Registry (enablement) + ModelRoutingPolicy
  ↓
Validation (adapter / ProviderValidation)
  ↓
Cost Policy (BudgetPolicy gate + Cost Ledger accounting)
  ↓
Provider Adapter
  ↓
Provider
```

ProviderRegistry does **not** alone perform routing. BrainRouter composes enablement + policies.

---

## Selection steps (design / current dry-run)

1. **Skill intent** — skill declares task class + required capabilities (runtime ids).  
2. **Brain Router** — `planBrainRoute` / `executeViaMockProvider`.  
3. **Registry filter** — only enabled providers (`assertOnlyMockActive` today).  
4. **Validation gate** — deterministic-only reject; privacy; mock request validation.  
5. **Cost Policy** — budget env blocks real providers; Cost Ledger owns accounting.  
6. **Adapter invoke** — Mock only; never from workers directly.  

---

## Priority heuristics (future)

1. Founder-pinned provider for a mission (if set)  
2. Department policy defaults  
3. Capability fit score  
4. Cost class within budget  
5. Latency class  
6. Mock fallback only when explicitly allowed and LIVE OFF / dry-run  

---

## Hard rules

- No direct model access from skills/workers/departments.  
- No worker-to-provider communication.  
- No selection without Registry identity (enablement).  
- Mock is valid for planning/simulation; not for LIVE production inference.
