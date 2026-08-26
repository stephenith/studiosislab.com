# Architectural Exceptions

**Agent #197 · Persistence Ownership & Taxonomy Declaration V1**  
**Declarations only — no implementation recommendations · LIVE OFF**

These exceptions are **officially recorded** so future certifications do not rediscover them as surprises.

---

## E1. MemoryService orphan

**Declaration:** `runtime/memory` exports `MemoryService` / tier store interfaces and `SOS/07_LOGS/saios/memory/{session,project,long-term}/` exist as empty placeholders. **Zero implementations. Zero callers of `tierPath`.**

**Architectural status:** Orphaned abstraction.  
**Adoption status:** Orphaned abstraction.  
**This agent does not implement MemoryService.**

---

## E2. Learning repositories bypass BaseAppendOnlyRepository

**Declaration:** `LearningRepository` and all department `*Memory.ts` writers use raw filesystem helpers. They do **not** extend `BaseAppendOnlyRepository`, despite Phase-2/3 execution stores doing so.

**Architectural status:** Declared gap (Future adoption candidate or Legacy persistence per surface).  
**This agent does not migrate repositories.**

---

## E3. Scheduler owns Operational Memory despite SERVICE role

**Declaration:** `runtime.scheduler` is role SERVICE in `module-roles.json` and writes `scheduler-learning.json` / `job-history.json`, classified here as **Operational Memory** (mislabeled “learning” in code comments).

**Architectural status:** Exception (INFO — remains after freeze).  
**This agent does not change Scheduler.**

---

## E4. design-memory.json is cross-cutting — CANONICAL (Agent #200 / F1)

**Declaration:** Canonical **write owner** remains `runtime/workers/resume-learning`. Readers include design-brain, research, adaptive-composer, founder-critic, resume-production, design-system, founder-dashboard, and missions. **Write authority is not shared.**

**Architectural status:** Declared canonical ownership pattern (resolved F1 vs #195 Resume-only consumption claim).  
**This agent does not move or rename the store.**

---

## E5. Founder Critic remains legacy

**Declaration:** `runtime.founder-critic` is role LEGACY. `critic-learning.json` remains a legacy Department Learning surface. Runtime may still invoke `runFounderCritic` from legacy/mission paths.

**Architectural status:** Legacy Declared.  
**This agent does not remove or rewrite Founder Critic.**

---

## E6. Worker append stores remain temporary — grandfathered (Agent #200 / F3)

**Declaration:** `worker-v2-append.json` and `worker-v3-append.json` are Temporary persistence under resume-production, written into the resume-learning log root.

**Architectural status:** Declared temporary + **grandfathered** under `parallel_learning_store_new` policy (existing stores allowed; new undeclared parallel stores forbidden).  
**This agent does not delete or merge them.**

---

## E11. parallel_learning_store_new policy — RESOLVED (Agent #200 / F3)

**Policy wording (canonical):** `parallel_learning_store_new` forbids creating **new undeclared** parallel learning roots.

**Grandfathered (allowed to remain):**

- `SOS/07_LOGS/saios/learning/` (Department Learning hub — Persistence Ownership surfaces #3–5)  
- Worker append files under that root  

**Not allowed:** Additional undeclared `*-learning.json` roots outside Persistence Ownership declaration without an architecture update.

---

## E12. resume-learning ↔ knowledge-learning — RESOLVED (Agent #200 / F2)

**Determination:** Implementation is **intentionally independent**.  

**Declaration corrected:** `runtime.workers.resume-learning` `allowed_dependencies` no longer lists `core.knowledge-learning`.  

**Runtime:** unchanged (still no import).

---

## E7. Department Learning does not feed Founder Learning

**Declaration:** No department `*-learning.json` store writes into `knowledge/learning/` or Knowledge Authority. Only the FounderDecision → `LearningWriteBack` path (plus provisional critic flags) feeds Founder Learning.

**Architectural status:** Declared topology fact.  
**This agent does not create feed edges.**

---

## E8. KnowledgeConsumer misnomer

**Declaration:** Modules named `KnowledgeConsumer` under adaptive-composer / founder-critic read **design-memory** (Department Learning), not Knowledge Authority.

**Architectural status:** Naming exception (documentation).  
**This agent does not rename modules.**

---

## E9. Two DesignMemory filenames

**Declaration:** `resume-learning/design-memory.ts` and `design-brain/DesignMemory.ts` collide on filename with different types/roots.

**Architectural status:** Naming collision declared.  
**This agent does not rename files.**

---

## E10. Agent #195 partial map superseded — inventory + F1 (Agent #200)

**Declaration:** Agent #196 is the authoritative inventory. Agent #195 remains the historical audit. Agent #200 aligns #195 docs with #197 for design-memory (**cross-cutting readers**; Resume write-owner) and corrects F2/F3 declarations.

**Architectural status:** Supersession complete for F1–F3 at documentation/manifest level.
