# AIOS Skill Library Architecture

**Status:** READY — Agent #117.5  
**Next agent remains:** #118 (Mock Provider)  
**Related:** `SOS/SAIOS/AI_BRAIN_ARCHITECTURE.md`, `SOS/SAIOS/AIOS_MODEL_AND_EXECUTION_STRATEGY.md`

---

## Target architecture

```
Founder
   ↓
Executive Brain
   ↓
Brain Router
   ↓
Skill Library
   ↓
Provider Adapter
   ↓
Mock / OpenAI / Local / Future
```

---

## Permanent rules

1. Departments **cannot** send prompts directly  
2. Departments request **Skills**  
3. Skills may compose other Skills  
4. Brain Router routes Skills  
5. Provider Adapter executes Skills  
6. Providers **never** know which department requested them  

---

## Skill hierarchy

### Resume (9)
ATS Analysis · Layout Planning · Typography Planning · Visual Hierarchy · Resume Critique · Founder Feedback Interpretation · Resume JSON Planning · Template Naming · Duplicate Detection

### Website (7)
UX Audit · Accessibility Audit · Design Critique · SEO Review · Competitor Analysis · Performance Review · Bug Analysis  

*(Catalogued; Website Department remains disabled.)*

### Common (6)
Report Generation · Task Summarization · Cost Analysis · Risk Analysis · Planning · Revision Planning

---

## Composition examples

- `resume.resume_critique` → ats_analysis + visual_hierarchy + common.risk_analysis  
- `resume.founder_feedback_interpretation` → common.revision_planning  
- `website.ux_audit` → common.report_generation → common.task_summarization  
- `common.revision_planning` → common.planning  

---

## Provider neutrality

- No model names in skill definitions or requests  
- No vendor SDK in skill layer  
- `stripDepartmentForProvider()` removes department before adapter execution  
- Skills map to Brain **capabilities** + **quality tiers**, not models  

---

## Implementation status

| Item | Status |
|---|---|
| Skill contracts + registry | READY |
| Composition / execution plan | READY |
| Router contract | READY |
| Mock provider execution of skills | MISSING → #118 |
| Department production wiring | MISSING |
| LIVE | OFF |

---

## Verify

```bash
npm run skill-library:verify
```
