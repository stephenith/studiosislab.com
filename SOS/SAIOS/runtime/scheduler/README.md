# Autonomous Resume Factory Scheduler

24×7 operational controller for the Resume AI Platform.

## Role

Decides **WHEN**, **WHAT**, and **HOW MANY** to produce. Never generates resumes itself.

## Architecture

```
VPS / Server → Autonomous Scheduler → Production Queue → Unified Production Engine → Founder Review Queue → WAIT
```

## Usage

```bash
# Headless persistent mode
npm run start --prefix SOS/SAIOS/runtime/scheduler

# Single tick (cron-friendly)
npx tsx -e "import { tickScheduler } from './SchedulerDirector.js'; tickScheduler()"
```

## Verify

```bash
npm run scheduler:verify
```

## Founder rules

- Never publish automatically
- Never bypass founder approval
- Never modify `src/` or production artifacts
