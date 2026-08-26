# Execution Boundaries

**Agent #194 · Hard boundaries of the Execution Authority Model**  
**No execution · No dispatch · LIVE OFF**

---

## Hard boundaries

| Boundary | Rule |
|----------|------|
| Planning ≠ Execution | Company Brain plans only |
| Eligibility ≠ Execution | Activation Gate evaluates only |
| Intent ≠ Execution | Execution Authorization records founder intent only |
| Simulation ≠ Execution | Pre-Dispatch Simulation models only; every node remains non-executed |
| Authorization record ≠ Dispatch | Execution Controller writes records only |
| Queue state ≠ Authority | QueueManager persists jobs; never decides whether to execute |
| Scheduling ≠ Authority | Scheduler orders work; never owns execution authority |
| Worker contracts ≠ Spawn | Worker Runtime holds contracts/references; never spawns |
| Capabilities ≠ Dispatch | Department SDK registers capabilities; never dispatches |
| Reasoning ≠ Execution | Brain Router routes provider reasoning; never executes product work |
| Guard ≠ Ownership | Runtime Guard blocks non-canonical engines; never owns execution |

---

## Soft boundaries (documentation / future)

| Topic | Rule |
|-------|------|
| Future dispatch | Must sit **after** Execution Controller in the chain and remain Founder-commissioned |
| Legacy engines | Remain Runtime Guard blocked (`unified-production`, `ProductionExecutor`) |
| Pipeline A | Remains the canonical dry-run spine; not a product dispatch authority |

---

## Forbidden mergers

Do **not** fold into one module:

- Company Brain + QueueManager  
- Execution Controller + Scheduler  
- Worker Runtime + Brain Router  
- Runtime Guard + Execution Controller  
- Department SDK + dispatch  

Any such merger creates a god module and is architecturally forbidden.
