# Capability Vocabulary Crosswalk

**Agent #192 · Documentation only**  
**No runtime capability changes · CapabilityRegistry remains canonical**

---

## Rule

**Runtime identifiers** in `SOS/SAIOS/core/ai-brain/CapabilityRegistry.ts` / `types.ts` are the **only** executable vocabulary.

Architecture / charter names in `PROVIDER_CAPABILITY_MODEL.md` (Agent #190) are **descriptive tags** for human docs and future model metadata. They must not be treated as alternate ids.

---

## Crosswalk

| Architecture / charter name | Runtime capability id(s) | Class | Notes |
|-----------------------------|--------------------------|-------|-------|
| Reasoning | `design_planning`, `founder_feedback_interpretation`, `failure_diagnosis`, `production_strategy`, `revision_planning` | strong_reasoning | Multi-step planning / judgment |
| Vision | `complex_visual_critique` | strong_reasoning | Image/layout critique path; no separate vision id yet |
| Code | *(none dedicated)* | — | No runtime `code_*` capability; deterministic code paths stay out of providers |
| Embeddings | *(none)* | — | Not implemented; do not invent |
| Function Calling | *(none)* | — | Not implemented; tool protocols future |
| JSON Mode | `structured_json_generation` | economical_intelligence | Structured outputs |
| Streaming | *(none)* | — | Not implemented |
| Long Context | *(none)* | — | Not implemented; may become metadata later |
| Tool Use | *(none)* | — | Cursor/Firecrawl are Tools, not Brain capabilities |
| Cost Metadata | `cost_arithmetic` (deterministic — **must not** hit providers) | deterministic_only | Arithmetic is code-only |
| Latency Metadata | *(none)* | — | Future routing metadata, not a capability id |
| Availability | *(none)* | — | Health/availability is adapter/registry concern, not a capability |

### Runtime-only capabilities (no charter synonym)

| Runtime id | Class | Charter mapping |
|------------|-------|-----------------|
| `task_classification` | economical | covered under Reasoning (narrow) |
| `report_summarization` | economical | Reasoning / report |
| `log_interpretation` | economical | Reasoning (narrow) |
| `duplicate_explanation` | economical | Reasoning (narrow) |
| `status_reporting` | economical | Reasoning (narrow) |
| `scheduling` | deterministic_only | never to provider |
| `time_tracking` | deterministic_only | never to provider |
| `catalog_id_assignment` | deterministic_only | never to provider |
| `checksum` | deterministic_only | never to provider |
| `dimension_validation` | deterministic_only | never to provider |
| `ats_rule_validation` | deterministic_only | never to provider |
| `publication_gate` | deterministic_only | never to provider |
| `server_monitoring` | deterministic_only | never to provider |

---

## Binding rules

1. Skills and requests use **runtime** ids only.  
2. Charter tags may appear in docs and future model records as labels.  
3. Adding a runtime capability requires updating `types.ts` + `CapabilityRegistry.ts` — not the charter alone.  
4. MockCapabilities advertises a subset by importing CapabilityRegistry — it does not fork the catalogue.
