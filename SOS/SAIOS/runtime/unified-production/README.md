# Unified Resume Production Engine

Single execution entry point for complete resume production lifecycle.

## Flow

```
Founder Objective → Controller → Research → Benchmark → Design Brain
  → Adaptive Composer → Premium Generator V3 → QA → Visual Render
  → Founder Critic → Publication Manager → STOP (Await Founder)
```

## Usage

```typescript
import { runUnifiedProduction } from "./SOS/SAIOS/runtime/unified-production";

const result = await runUnifiedProduction({
  objective: "Premium software engineer resume",
});
```

## Recovery

```typescript
import { resumeRun, retryFailedStage, cancelRun, restartStage } from "./SOS/SAIOS/runtime/unified-production";

await resumeRun("unified-20260706-abc123");
await retryFailedStage("unified-20260706-abc123");
cancelRun("unified-20260706-abc123");
```

## Verify

```bash
npm run unified-production:verify
```

## Output

`SOS/07_LOGS/saios/unified-production/runs/{run_id}/`
