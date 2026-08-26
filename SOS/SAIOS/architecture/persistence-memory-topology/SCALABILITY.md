# Scalability Assessment

**Agent #196 · Persistence & Memory Topology Reconciliation V1**  
**Read-only assessment — no design of replacements.**

---

## Assumed future departments

Website · SEO · Marketing · Publisher · Finance · HR · Legal · Support · Portfolio · Invoice · PDF · Cover Letter

---

## Current pattern (evidence)

Every existing specialty area that needed “memory” hand-rolled:

```
runtime/<dept>/…Memory.ts
  → SOS/07_LOGS/saios/<dept>/memory/<dept>-learning.json
  → loadX / appendX via writeFileSync
```

Examples already live: adaptive-composer, design-brain, benchmark, publication, competitive-validation, visual-render, scheduler, resume-learning.

None of these:

- appear as store nodes in `dependency-graph.json`  
- extend `BaseAppendOnlyRepository`  
- implement `MemoryService`  
- feed `core/knowledge-learning`

---

## Does the topology scale cleanly?

**No.**

If each future department follows the established pattern, fragmentation increases **O(departments)**:

| Effect | Why |
|--------|-----|
| New undeclared store per department | Manifests do not require store declaration today |
| New bespoke schema per store | No shared satellite contract in use |
| New raw fs writer | Learning layer bypasses BaseAppendOnly |
| No path into Knowledge Authority | Department learning remains stranded (same as today) |
| Naming collisions multiply | Already two `DesignMemory` files; `*-learning.json` overloaded |
| Cross-cutting hub risk repeats | If another worker owns a shared preference file, fan-out coupling repeats `design-memory.json` |

Website department already exists as a runtime module with its own log root (`website-department`) and does **not** yet have a `*-learning.json` — but nothing prevents adding one under the current pattern.

---

## What is missing (identification only — not a design)

Something **fundamental** is missing **as adoption**, not as invention:

1. The repo already has `BaseAppendOnlyRepository` — learning/memory stores do not use it.  
2. The repo already has `MemoryService` tier types — nothing implements them.  
3. Architecture manifests do not enumerate persistence surfaces (only modules).

Therefore future departments will **naturally create another memory implementation** unless store declaration and abstraction adoption are enforced later. This reconciliation does **not** prescribe how; it only records that the gap is structural.

---

## Scalability verification claim

**FAIL condition for “scales cleanly”:** evidence of per-department hand-rolled `*-learning.json` pattern without shared contract.  
**Result:** fragmentation would increase — **documented as FAIL to scale cleanly** (assessment PASS as a verification that the claim was evaluated).
