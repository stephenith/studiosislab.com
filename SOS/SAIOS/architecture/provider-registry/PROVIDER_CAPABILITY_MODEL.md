# Provider Capability Model

**Documentation only. Reconciled Agent #192.**

---

## Purpose

Capabilities describe what a registered provider/model may be selected for. Brain Router matches skill requirements to **runtime** capability ids from **CapabilityRegistry** — never by hard-coded vendor SDK.

Descriptive architecture tags below are for human docs. Executable ids: see `../provider-authority/CAPABILITY_CROSSWALK.md`.

---

## Capability catalogue (examples — architecture tags)

| Capability | Meaning |
|------------|---------|
| Reasoning | Multi-step / planning language tasks |
| Vision | Image understanding |
| Code | Code generation / analysis |
| Embeddings | Vector embeddings |
| Function Calling | Tool/function calling protocols |
| JSON Mode | Structured JSON outputs |
| Streaming | Token streaming |
| Long Context | Extended context windows |
| Tool Use | External tool orchestration |
| Cost Metadata | Declares unit cost fields |
| Latency Metadata | Declares latency class |
| Availability | Declares availability class |

Additional **runtime** capabilities may be added only via CapabilityRegistry versioning — not ad-hoc in workers.

---

## Binding rules

1. Executable capabilities attach to **CapabilityRegistry** / adapter `supported_capabilities`.  
2. Skills declare **required** capabilities using runtime ids.  
3. Selection fails closed if no enabled provider satisfies the route.  
4. Mock providers may advertise a subset for dry-run only (`MockCapabilities`).  

---

## Non-goals

- Capability tags do not grant execution permission.  
- Capability tags do not store API keys.  
- Capability tags do not bill.
