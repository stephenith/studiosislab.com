# Timeline Department V1

**Agent:** #102  
**Role:** Official AI OS system clock and time-awareness service

## Mission

Provide a shared understanding of:

- current date / time / timezone
- current sprint
- milestones
- deadlines
- pending work
- overdue / upcoming reminders
- historical event stream

Every future AI OS department should consume this service.

## Usage

```bash
npm run timeline-department:verify
```

## Outputs

`SOS/07_LOGS/saios/timeline-department/`

- `timeline-state.json`
- `timeline-events.json`
- `timeline-reminders.json`
- `timeline-summary.md`
- `timeline-history.md`
- `timeline-dashboard.json`
- `timeline-report.md`

## Reminder kinds

`TODAY` · `THIS_WEEK` · `OVERDUE` · `UPCOMING` · `CRITICAL`

Reminder objects are generated for Notification Department consumption.
