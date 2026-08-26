# Execution Guardrails

**Agent #194 · Certified invariants**  
**Execution must remain impossible.**

---

## Safety flags (remain false)

`execution_allowed` · `dispatch_allowed` · `worker_spawn_allowed` · `provider_allowed` · `queue_insert_allowed` · `scheduler_allowed` · `publishing_allowed` · `live_enabled`

---

## Permanent guardrails

1. **Distributed model only** — never crown a single god-module execution authority.  
2. **Execution Controller** owns authorization records only; it is one stage, not the sole execution authority.  
3. **No product `child_process` / spawn** in Company Brain, Execution Controller, Activation Gate, Execution Authorization, Pre-Dispatch Simulation, Department SDK, Worker Runtime, QueueManager product paths, or Brain Router.  
4. **Runtime Guard** enforces canonical engine access and blocks legacy engines; it does not own execution.  
5. **QueueManager / Scheduler** remain infrastructure; they never become execution authorities.  
6. **Worker Runtime / Department SDK** never dispatch or spawn.  
7. **Company Brain** permanently planning only.  
8. **Brain Router** permanently provider reasoning only.  
9. **LIVE OFF** by default; this certification never enables LIVE.  
10. **Pipeline A** remains the frozen canonical dry-run spine; not a dispatch authority.

---

## Out of scope (this agent)

- No redesign of execution  
- No central execution authority  
- No responsibility moves or mergers  
- No runtime behaviour changes  
- No Runtime Guard / QueueManager / Scheduler / Worker Runtime / Department SDK / Company Brain / Brain Router / Provider Registry / Pipeline A logic changes  
- No execution · No dispatch · No worker spawn · No scheduler activation · No provider activation  

---

## Verify

```bash
SOS_AIOS_LIVE=0 npm run execution-authority-model:verify
```
