# Provider Lifecycle

**Documentation only. NOT IMPLEMENTED.**

---

## Provider types (future support)

| Type | Notes |
|------|-------|
| Mock | Dry-run / planning; no external network |
| OpenAI | Future adapter |
| Anthropic | Future adapter |
| Gemini | Future adapter |
| Azure OpenAI | Future adapter |
| Local Models | Future adapter |
| Ollama | Future adapter |
| Custom Provider | Future adapter via contract |

No adapters or SDK calls are created by this charter.

---

## Lifecycle (aligns with validation flow)

```
REGISTERED → VALIDATED → CERTIFIED → ACTIVE → DEPRECATED → ARCHIVED
```

See `PROVIDER_VALIDATION_FLOW.md` for state meanings.

---

## Versioning

- Providers version independently of models.  
- Models bind to a provider version range.  
- Breaking capability changes require a new model version.  
- ARCHIVED records remain for audit; never reactivated silently.

---

## One lifecycle authority

Only the Provider Registry advances lifecycle states. Departments and workers cannot.
