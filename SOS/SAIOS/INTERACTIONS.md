# SAIOS Interaction Flows — Version 1

## Flow 1 — Founder command → implementation → notification

```mermaid
sequenceDiagram
  autonumber
  participant F as Founder (Telegram)
  participant CAI as Chief AI
  participant MEM as Memory
  participant KB as Knowledge Base
  participant JQ as Job Queue
  participant AR as Agent Registry
  participant CR as Cursor Runner
  participant CA as Cursor Agent CLI
  participant QR as QA Runner
  participant N as Notify (Telegram)

  F->>CAI: "Add ad slot component to hub page"
  CAI->>MEM: load session + project context
  CAI->>KB: resolve vision, standards, roadmap slice
  CAI->>CAI: intent → plan (no code)
  CAI->>JQ: create JOB-plan (pending)
  CAI->>JQ: create JOB-impl (pending, parent=plan)
  CAI->>JQ: create JOB-qa (pending, parent=impl, dep=impl)
  CAI->>JQ: write PRM-JOB-impl.md
  CAI->>AR: request worker type cursor-dev
  AR-->>CAI: WRK-cursor-dev-001
  CAI->>JQ: assign JOB-impl → WRK-001
  CAI->>N: "Queued: JOB-impl"

  CR->>JQ: claim JOB-impl
  JQ-->>CR: running
  CR->>CA: cursor agent --print --trust (PRM content)
  CA-->>CR: stdout + file changes
  CR->>JQ: RPT-JOB-impl.json
  CR->>JQ: JOB-impl → blocked (await qa)

  CAI->>AR: request worker type cursor-qa
  AR-->>CAI: WRK-cursor-qa-001
  CAI->>JQ: assign JOB-qa
  QR->>JQ: claim JOB-qa
  QR->>CA: verify prompt (or scripted checks)
  CA-->>QR: verdict
  QR->>JQ: RPT-JOB-qa.json (pass)
  QR->>JQ: JOB-qa → completed
  CAI->>JQ: JOB-impl → completed, JOB-plan → completed
  CAI->>MEM: append project outcome
  CAI->>N: "Completed: ad slot — QA passed"
  N->>F: Telegram message
```

---

## Flow 2 — Status query (no execution)

```mermaid
sequenceDiagram
  participant F as Founder
  participant CAI as Chief AI
  participant JQ as Job Queue
  participant AR as Agent Registry

  F->>CAI: "What's running?"
  CAI->>JQ: list running + pending
  CAI->>AR: list busy workers
  CAI->>F: summary (no jobs created)
```

Chief AI **does not** spawn Cursor for status queries.

---

## Flow 3 — Approval gate (blocked job)

```mermaid
sequenceDiagram
  participant F as Founder
  participant CAI as Chief AI
  participant JQ as Job Queue
  participant CR as Cursor Runner

  CR->>JQ: JOB-impl blocked (reason: touches src/ hard gate)
  CAI->>F: "Approve JOB-impl? (modifies src/)"
  F->>CAI: "approve"
  CAI->>JQ: JOB-impl pending + note
  Note over CR: Runner picks up on next claim cycle
```

Approvals are orchestration decisions. Chief AI unblocks; runners resume.

---

## Flow 4 — Knowledge injection into worker prompt

```mermaid
flowchart LR
  KB[SOS/01_KNOWLEDGE/]
  CAI[Chief AI]
  PRM[PRM-job.md]
  CR[Cursor Runner]
  CA[Cursor Agent]

  KB -->|read snapshot refs| CAI
  CAI -->|assemble prompt sections| PRM
  PRM --> CR
  CR --> CA
```

Prompt sections (mandatory):

1. Job metadata (id, priority, parent)
2. Founder instruction (verbatim)
3. Knowledge appendix (paths + excerpts)
4. Memory snapshot (session + project relevant lines)
5. Safety rules (scope, no secrets, no unrelated files)
6. Expected report format

---

## Flow 5 — Memory read/write boundaries

| Actor | Session | Project | Long-term |
|-------|---------|---------|-----------|
| Chief AI | R/W | R/W | R/W (curated) |
| Cursor Runner | R | R (append outcome) | R |
| QA Runner | — | R (append verify) | R |
| Founder | via Chief AI | via Chief AI | via Chief AI |

Workers never write long-term memory directly.

---

## Flow 6 — Agent Registry ↔ Runners

```mermaid
flowchart TB
  AR[Agent Registry]
  CR1[Cursor Runner process 1]
  CR2[Cursor Runner process 2]
  QR1[QA Runner process 1]

  AR -->|register on start| CR1 & CR2 & QR1
  CR1 & CR2 & QR1 -->|heartbeat + busy/idle| AR
  AR -->|match capability| JQ[Job Queue assignment]
```

One runner process registers one worker instance. Multiple instances of same type allowed (parallel jobs in v2).

---

## Anti-patterns (forbidden in SAIOS)

| Anti-pattern | Correct pattern |
|--------------|-----------------|
| Chief AI edits `src/` | Create implement job → Cursor Runner |
| Cursor Runner prioritizes queue | Chief AI sets priority at create |
| QA Runner implements fixes | Fail → new implement child job |
| Worker writes founder memory | Report → Chief AI curates long-term |
| Telegram triggers Developer runtime | Telegram → Chief AI → Job Queue only |

---

## Interface touchpoints

All cross-module calls use contracts in `interfaces/types.ts`:

- `ChiefAI.createJobsFromIntent()`
- `JobQueue.create()`, `claim()`, `transition()`
- `AgentRegistry.register()`, `assign()`, `heartbeat()`
- `CursorRunner.execute()` (future)
- `QARunner.verify()` (future)
- `MemoryStore.read()`, `append()`
- `KnowledgeBase.resolveSnapshot()`

No implementation in v1 — signatures document the seams.
