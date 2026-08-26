# Cursor Runner Module

**Role:** **Exclusive** execution boundary for Cursor Agent CLI. All implementation work flows through here. Commander / Chief AI never edit code.

---

## Responsibilities

| Responsibility | Description |
|----------------|-------------|
| Launch Cursor Agent | `cursor agent --print --trust --workspace {repo}` |
| Load job prompt | Read `PRM-{job_id}.md` from Job Queue record |
| Enforce scope | Pass safety rules in prompt; log scope in report |
| Capture output | stdout/stderr, duration, exit code |
| Write execution report | `RPT-{job_id}.json` |
| Update job state | `running` → `blocked` (hand off QA) or error path |
| Register heartbeat | Agent Registry instance busy/idle |

---

## Non-responsibilities

- Intent classification (Chief AI)
- Priority decisions (Chief AI / Job Queue)
- QA verdict (QA Runner)
- Founder notification (Chief AI)

---

## Execution contract

### Input

- `Job` with `job_type` ∈ `implement`, `research`
- `prompt_path` must exist
- `assigned_worker` must match this instance

### CLI invocation (reference)

```bash
cursor agent --print --trust \
  --workspace "${REPO_ROOT}" \
  --output-format json \
  ${CURSOR_FORCE:+--force} \
  "$(cat "${PROMPT_PATH}")"
```

Environment: `CURSOR_API_KEY` or logged-in agent session.

### Output

`ExecutionReport` JSON:

- `job_id`, `worker_id`, `exit_code`, `duration_ms`
- `output_preview` (truncated)
- `files_changed[]` (from agent report or git diff summary)
- `error` if failed
- `cursor_agent_version`

---

## Isolation (v2)

- `--worktree` per job for parallel agents
- One runner process = one worker instance in Registry

---

## Failure handling

| Failure | Job transition | Chief AI notified |
|---------|----------------|-------------------|
| Auth missing | `blocked` | Yes — setup required |
| Exit non-zero | `blocked` or retry `pending` | Yes |
| Timeout | `blocked` | Yes |
| Scope violation (post diff) | `blocked` | Yes — approval |

Retry policy set by Chief AI in `metadata.max_attempts`.

---

## Relation to legacy

| Legacy | Cursor Runner |
|--------|---------------|
| `SOS/runtime/.../work-orders/cursor-cli.ts` | Precursor — adopt patterns |
| `SOS/runtime/.../developer/strategies/*` | **Deprecated** — no Node impl |
| Developer `autonomous-execute.ts` | Replaced entirely |

Legacy files **not modified** in v1.

---

## Interfaces

See `CursorRunner`, `ExecutionReport` in `interfaces/types.ts`.

---

## Security

- Runner runs on trusted VPS only
- `--trust` only in headless mode on isolated host
- No founder prompts bypassing Job Queue record
