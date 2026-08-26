# AI Brain (Provider-Neutral) — Agent #117

Contracts, policies, and routing for all AIOS intelligence requests.

## Permanent rule

Departments and AIOS core **never** depend on OpenAI, Cursor, a local model, or any vendor SDK directly.

```
Department → ReasoningRequest → BrainRouter → ProviderAdapter → Mock|OpenAI|Local|Future
```

Departments request **capabilities**, not model names.

## Cursor

Cursor is a **development / complex-code execution tool**, not an AI Brain provider. Routine Resume Factory production must not require Cursor. A future Execution Engine contract is separate from this brain.

## Status

| Item | Status |
|---|---|
| Contracts & policies | READY (#117) |
| Mock Provider | MISSING → Agent #118 |
| OpenAI / Local adapters | MISSING (disabled) |
| Live Event Bus wiring | NOT_REQUIRED for #117 |
| Cost ledger | MISSING |

## Verify

```bash
npm run ai-brain-architecture:verify
```

## Docs

- `SOS/SAIOS/AI_BRAIN_ARCHITECTURE.md`
- `SOS/SAIOS/AIOS_MODEL_AND_EXECUTION_STRATEGY.md`
