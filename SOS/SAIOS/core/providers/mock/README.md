# Mock Provider — Agent #118

Dry-run-only `ProviderAdapter` implementation for AIOS.

## Rules

- No AI SDK  
- No external API calls  
- Deterministic outputs (same request → same structured response)  
- `SOS_AIOS_LIVE=0`  
- Does not generate real resume templates or publish  

## Flow

```
Brain Router → MockProvider.execute → ReasoningResponse
```

## Verify

```bash
npm run mock-provider:verify
```
