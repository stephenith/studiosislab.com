# Resume Department ↔ Brain Router Integration — Agent #119/#121

Dry-run integration layer. Resume Department loads **Knowledge** first, then requests **Skills** (not prompts).

```
Resume Department
  → KnowledgeManager
  → KnowledgeRetriever
  → KnowledgeSnapshot
  → ResumeBrainGateway
  → SkillRequest
  → Brain Router
  → Mock Provider
  → Structured Response
  → Resume Department
```

## Entry point (Agent #121/#122)

Use `ResumeKnowledgeGateway.executeWithKnowledge()` — always retrieves:

Founder → Company → Department → Learning

before Skills. `ResumeBrainGateway.executeSkillRequest(skill, snapshot)` requires the snapshot.

Factory Cursor executors (`createMockCursorResearchExecutor`, `createMockCursorExecutor`) are gateway-backed via `ResumeFactoryEntryBridge` (Agent #122).

## Rules

- No raw prompts  
- No OpenAI / model names  
- No template JSON generation in this layer  
- No publication / no persistence in this layer  
- `SOS_AIOS_LIVE=0`  
- QA & publication_gate remain **deterministic**  

## Mapping

| Operation | Target |
|---|---|
| planning | `resume.layout_planning` |
| founder_revision | `resume.founder_feedback_interpretation` |
| resume_critique | `resume.resume_critique` |
| report | `common.report_generation` |
| duplicate_review | `resume.duplicate_detection` |
| qa | deterministic only |
| publication_gate | deterministic only |

## Verify

```bash
npm run resume-integration:verify
npm run knowledge-gateway:verify
npm run resume-factory-migration:verify
```
