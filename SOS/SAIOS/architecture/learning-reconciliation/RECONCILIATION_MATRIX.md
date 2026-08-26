# Reconciliation Matrix

**Agent #195**  
Status ∈ { MATCH, PARTIAL, CONFLICT, LEGACY, PLACEHOLDER }

| Subsystem | Declared role | Runtime role | Status | Notes |
|-----------|---------------|--------------|--------|-------|
| `core/knowledge` | Knowledge Authority | Knowledge Authority (6 domains) | **MATCH** | Seed registry + retrieval policy |
| `core/knowledge-learning` | Learning layer | Founder-decision learning write-back | **PARTIAL** | Canonical for founder learning; not global learning |
| Founder Review (`founder-decisions` + gate) | Founder Gate → feeds learning | Writes decisions; triggers `LearningWriteBack` | **MATCH** | Terminal human approval + learning trigger |
| `core/resume-critic` | Evaluation scoring | Produces `CriticResult` | **MATCH** | |
| `core/critic-gate` | Evaluation gate | Produces `GateResult`; provisional learning | **MATCH** | |
| `runtime/workers/resume-learning` | Learning worker; depends on knowledge-learning | Departmental design-memory engine; independent root | **CONFLICT** | Declared deps / forbidden parallel store vs reality |
| `SOS/07_LOGS/saios/learning/` | (undeclared in dependency-graph) | Operational Resume memory | **PARTIAL** | Real & valuable; undeclared topology |
| Learning append v2/v3 | (undeclared) | Worker-side append into departmental root | **PLACEHOLDER** / satellite writes | Temporary worker artifacts |
| Competitive Memory | WORKER Evaluation | Satellite memory store | **PARTIAL** | Valid satellite; not in declared learning graph |
| Visual Render Memory | WORKER | Satellite memory store | **PARTIAL** | Same |
| `runtime/founder-critic` + CriticMemory | LEGACY Evaluation duplicate | Live duplicate evaluator + memory | **LEGACY** | |
| `runtime/knowledge` | LEGACY Knowledge duplicate | Type shim | **LEGACY** | |
| `runtime/memory` | SERVICE; no parallel knowledge authority | Type contracts only | **PLACEHOLDER** | |
| Worker Runtime (`runtime/worker-runtime`) | No learning writes | No learning/knowledge imports | **MATCH** | Clean |
| Telemetry | Observability contracts | No learning imports | **MATCH** | Clean |
| Company Brain | Planning only | Read-only knowledge-system artifacts | **MATCH** | Clean |
| Execution Controller | Authorization records | No learning imports | **MATCH** | Clean |

---

## Verdict key

- **MATCH** — declaration and runtime agree  
- **PARTIAL** — partially aligned; naming or topology incomplete  
- **CONFLICT** — declaration contradicts runtime  
- **LEGACY** — marked or behaving as superseded duplicate  
- **PLACEHOLDER** — contracts without persistence / temporary artifacts  
