# AIOS Canonical Resume Production Intake V1 Report

**Agent:** #205
**Overall:** PASS
**LIVE:** OFF

## Summary

Deterministic Resume Factory intake selects category / title / industry / seniority / objective
before ResumeKnowledgeGateway. Design style remains DesignBriefEngine.

## Selected target

```json
{
  "category": "engineering",
  "title": "Software Engineer",
  "industry": "engineering",
  "seniority": "mid",
  "objective": "Engineering engineering resume with technical project emphasis",
  "role_family": "software_engineer"
}
```

| Check | Result |
|-------|--------|
| deterministic_target_created | PASS |
| category_selected | PASS |
| title_selected | PASS |
| industry_selected | PASS |
| seniority_selected | PASS |
| objective_generated | PASS |
| coverage_analysis_runs | PASS |
| canonical_cycle_consumes_target | PASS |
| default_target_backward_compatible | PASS |
| openai_or_mock_provider_ok | PASS |
| waiting_founder | PASS |
| publication_disabled | PASS |
| live_off | PASS |
| no_legacy_scheduler_import | PASS |
| runtime_guard_present | PASS |
