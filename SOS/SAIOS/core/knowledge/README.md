# AIOS Knowledge System

Permanent knowledge layer for every department. Replaces the generic Shared Memory idea.

**Agent #120 · dry-run · LIVE OFF · no SDK · no API · no publication**

## Path

```
Department
  → KnowledgeRequest / KnowledgeContext
  → Knowledge Retriever
  → Minimal Knowledge Snapshot
  → Department (then Skills if needed)
```

Departments never read the full corpus.

## Domains

| Domain | Read | Write |
|--------|------|-------|
| Founder | everyone | Founder / Executive Brain |
| Company | everyone | approved architecture changes |
| Project | everyone | Executive Brain / architecture |
| Department | owner (+ exec/founder) | department owner |
| Learning | owner (+ exec/founder) | learning pipeline / exec |
| Runtime | exec / owner / founder | runtime sensors |

## Resume pre-Skill load

```
Founder Knowledge
  → Company Knowledge
  → Resume Department Knowledge
  → Learning Knowledge
  → request Skills via Brain Router
```

Use `KnowledgeManager.loadResumePreSkillKnowledge()`.

## Verify

```bash
npm run knowledge-system:verify
```

## Files

- `KnowledgeManager.ts` — facade
- `KnowledgeEntry.ts` — entry + request contracts
- `KnowledgeRegistry.ts` — seeded six-domain corpus
- `KnowledgeContext.ts` — scoped request builder
- `KnowledgeRetriever.ts` — minimal snapshot retrieval
- `KnowledgeValidator.ts` — validation + verify helpers
- `KnowledgeSnapshot.ts` — snapshot contract
- `KnowledgePolicies.ts` — ownership + retrieval rules
