# OpenAI Provider (Agent #201)

ProviderAdapter implementation for the official OpenAI **Responses API**.

- SDK (`openai`) lives **only** in this package.
- BrainRouter selects this adapter via Provider Registry — it never imports `openai`.
- Default registry keeps OpenAI **disabled**; Mock remains the active dry-run provider.
- Real calls require: `OPENAI_API_KEY`, budget env vars, registry flags, `SOS_AI_FOUNDER_OPENAI_ONE_TEST=1`, `SOS_AIOS_LIVE≠1`, and `dry_run=false` on the ReasoningRequest.
- LIVE factory execution, Scheduler, Queue, and Worker Runtime are not involved.

```bash
npm run openai-provider:verify
```
