# Extension Policy

**Agent #198 · Architecture Governance Framework V1**  
Governance rules for future agents — **documentation only · do not implement**.

---

## General rules for future agents

1. **Read first:** Governance Manifest → relevant authority package → Persistence Ownership (#197) if touching stores.  
2. **Do not invent parallel authorities** when an authority already exists.  
3. **Docs before enforcement:** reconcile/declare before certify/enforce (pattern #191→#192, #196→#197).  
4. **LIVE stays OFF** unless Founder explicitly enables a later activation agent.  
5. **No god modules:** do not consolidate Knowledge + Learning + Execution + Cost into one owner.  
6. **Reference, don’t fork:** update the governance index when adding a new certified package.

---

## How new departments are added

1. Register capability via **Department SDK** patterns (existing platform).  
2. If a persistence store is needed, classify it under **Persistence Taxonomy** (#197) — typically Department Learning or Operational Memory.  
3. Declare owner in architecture docs; **do not** write into Knowledge Authority.  
4. Add module verify; reference from Verification Matrix in a future governance update.  
5. Do **not** hand-roll a second Knowledge Authority or MemoryService implementation without architecture review.

---

## How new providers are added

1. Follow **Provider Authority** / Provider Registry charter.  
2. Route through Skills → Brain Router → Provider.  
3. Estimation stays with adapters/BudgetPolicy; accounting stays with Cost Ledger.  
4. Run `provider-authority:verify` expectations for boundaries.

---

## How new persistence stores are added

1. Assign exactly one taxonomy category (#197).  
2. Assign exactly one canonical owner (no overlap).  
3. Choose adoption status declaration (Native BaseAppendOnly / Legacy / Temporary / Future candidate / Intentional standalone) — **declaration ≠ migration**.  
4. Update Persistence Ownership docs / SURFACES registry in a dedicated docs agent.  
5. Do **not** add stores by silently writing new `*-learning.json` without declaration.

---

## How new workers are added

1. Place under `runtime/workers/` or appropriate runtime path per canonical tree.  
2. Register worker contracts via **Worker Runtime** patterns.  
3. Forbidden: openai_sdk / provider_direct / auto_publish where module-roles forbid.  
4. Workers must not become Knowledge Authority or Cost Authority.

---

## How new telemetry modules are added

1. Extend **Telemetry Authority** (`platform/telemetry`) patterns — do not create a parallel telemetry authority.  
2. Telemetry must not own Learning or Knowledge.  
3. Prefer BaseAppendOnly platform patterns already used by telemetry.

---

## How new execution stages are added

1. Fit into **Execution Authority Model** (#194): name the stage owner; do not create a central executor.  
2. Preserve chain termination: no dispatch after Execution Controller without a Founder-approved Phase activation.  
3. Update Phase 4 charter docs before implementing live dispatch.  
4. Run `execution-authority-model:verify` compatibility (no “sole execution authority” claims).

---

## What this policy does not do

- Does not implement department scaffolding  
- Does not migrate repositories  
- Does not adopt MemoryService or BaseAppendOnly  
- Does not enable execution or providers LIVE  
