# First Complete Autonomous Resume Department Cycle

End-to-end dry-run (Agents #205–#222A):

```
Portfolio → Strategy → Intake
AutonomousProductionService
  → (decision) → ProductionController
  → Health → Budget → Batch → … → WAITING_FOUNDER
  → AdaptiveSchedulingPolicy → sleep(next_interval_ms) → repeat
OperationsDashboard (read-only)
OperationalPolicyAdvisor (read-only recommendations)
Founder Command Center (read-only observation shell over spine)
Engineering Intelligence (advisory engineering governance — independent)
```

## Engineering Intelligence (#223)

**Owns:** engineering analysis, scoring, recommendations, history.

**Never:** edits code, production, policies, project-state, Runtime Guard, OpenAI.

```bash
npm run aios:engineering:run
npm run aios:engineering:verify
```

## Founder Command Center Foundation (#222A)

**Owns:** Founder-facing observation aggregation + dashboard shell navigation.

**Never:** production, autonomous start/stop, advisor apply, policy edits, BatchRunner imports.

```bash
npm run aios:founder-command-center:verify
```

Host: `SOS/SAIOS/dashboard` · API: `GET /api/founder-command-center`

## Operational Policy Advisor (#221)

**Owns:** historical analysis + advisory recommendations only.

**Never:** modifies scheduling, budget, strategy, or production policies; never executes production.

```bash
npm run aios:advisor:run
npm run aios:advisor:verify
```

## Adaptive scheduling (#220)

**Owns:** next sleep interval only (`RUN_SOON` | `NORMAL` | `SLOW_DOWN` | `PAUSE`).

**Does not own:** what to build, health/budget verdicts, or production execution.

### Precedence

1. **PAUSE** — queue full, failure cooldown, critical state unavailable, operational pause  
2. **SLOW_DOWN** — unhealthy, budget DENY, near-capacity queue, stale dashboard, daily pressure  
3. **RUN_SOON** — healthy + budget ALLOW + capacity + recommendations + idle acceleration  
4. **NORMAL** — default, or forced by fast-cycle protection  

### Commands

```bash
npm run aios:schedule:run
npm run aios:schedule:verify
npm run aios:autonomous:run -- --adaptive --mock
npm run aios:dashboard:run
npm run aios:advisor:run
```

No LIVE · No publication · ProductionController remains the sole production entry point.
