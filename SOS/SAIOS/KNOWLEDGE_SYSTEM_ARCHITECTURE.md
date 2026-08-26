# AIOS Knowledge System Architecture

**Status:** READY (architecture + dry-run seed)  
**Agent:** #120  
**LIVE:** OFF  
**Replaces:** generic Shared Memory idea

---

## Purpose

The Knowledge System is the permanent knowledge layer used by every department.

Departments do **not** dump prompts or browse unrestricted memory. They request a **Knowledge Context**, receive a **Minimal Knowledge Snapshot**, then (if needed) request **Skills** through the Brain Router.

```
Founder → Executive / Brain Router → Skill Library → Provider Adapter
                ↑
         Knowledge System
         (scoped snapshots only)
```

---

## Domains (6)

### 1. Founder Knowledge
- founder preferences
- permanent decisions
- product philosophy
- design philosophy
- typography preferences
- spacing preferences
- approval rules

**Read:** everyone  
**Write:** Founder or Executive Brain only

### 2. Company Knowledge
- StudiosisLab architecture
- coding standards
- JSON specifications
- publication rules
- infrastructure

**Read:** everyone  
**Write:** approved architectural changes only

### 3. Project Knowledge
- active roadmap
- milestones
- completed work
- pending work
- current project state

**Read:** everyone  
**Write:** Executive Brain / architecture

### 4. Department Knowledge
- Resume Department
- Website Department
- Future Departments

Each department owns its operational knowledge.

**Read:** department owner (+ Executive Brain / Founder)  
**Write:** department owner

### 5. Learning Knowledge
- approved outputs
- rejected outputs
- revision history
- quality observations
- common mistakes
- future improvements

**Write:** after approvals/rejections (learning pipeline / Executive Brain)

### 6. Runtime Knowledge
- active tasks
- queue state
- scheduler state
- health
- last heartbeat
- current cycle

**Write:** generated automatically by runtime sensors

---

## Contracts

| Type | Role |
|------|------|
| `KnowledgeRequest` | Department asks for scoped knowledge |
| `KnowledgeContext` | Validated request envelope |
| `KnowledgeSnapshot` | Minimal returned payload |
| `KnowledgeReference` | Pointer without full content |
| `KnowledgePriority` | critical / high / normal / low |
| `KnowledgeScope` | global / department / task / cycle / session |
| `KnowledgeVersion` | semver string on each entry |
| `KnowledgeSource` | founder / executive_brain / architecture_change / … |
| `KnowledgeConfidence` | confirmed / probable / observed / draft |

---

## Retrieval model

```
Department
  ↓
Knowledge Context
  ↓
Knowledge Retriever
  ↓
Minimal Knowledge Snapshot
  ↓
Department
```

### Hard rules
1. No unrestricted reads
2. Domains must be explicit
3. Entry count capped (default 12)
4. Priority floor applied
5. Department-domain isolation by `department_id`
6. Snapshot always `unrestricted: false`, `live: false` in dry-run

---

## Resume Department integration

Resume Department must load the following knowledge before requesting Skills:

```
Founder Knowledge
  ↓
Company Knowledge
  ↓
Resume Department Knowledge
  ↓
Learning Knowledge
  ↓
SkillRequest → Brain Router → Skill Library → Provider
```

API:

```ts
const km = new KnowledgeManager();
const loaded = km.loadResumePreSkillKnowledge({
  purpose: "planning context for ATS Marketing Manager",
  task_id: "…",
});
// loaded.next_step === "request_skills"
// then ResumeBrainGateway.executeSkillRequest(…)
```

Domains used: `founder` → `company` → `department` → `learning`.

QA and Publication Gate remain **deterministic** and do not require provider Skills.

---

## Non-goals (Agent #120)

- No resume template generation
- No OpenAI / SDK / API calls
- No publication
- No LIVE (`SOS_AIOS_LIVE` must stay unset/0)
- No replacement of existing runtime/memory folders yet — this is the canonical architecture layer

---

## Module layout

```
SOS/SAIOS/core/knowledge/
  KnowledgeManager.ts
  KnowledgeEntry.ts
  KnowledgeRegistry.ts
  KnowledgeContext.ts
  KnowledgeRetriever.ts
  KnowledgeValidator.ts
  KnowledgeSnapshot.ts
  KnowledgePolicies.ts
  index.ts
  verify.ts
  package.json
  README.md
```

Architecture doc: this file.  
Verify: `npm run knowledge-system:verify`

---

## Relation to prior Shared Memory

| Old idea | New system |
|----------|------------|
| Shared Memory (generic) | Knowledge System (domain-owned) |
| Unrestricted store | Scoped KnowledgeRequest |
| Session dumps | Minimal KnowledgeSnapshot |
| Ad-hoc paths | Registry + policies |

Component memories (CriticMemory, etc.) may later publish into Learning / Department domains through approved writers — they must not bypass ownership policies.
