/**
 * Default automation rules — route intents between departments via events only.
 */
import type { AutomationRule, AutomationTrace, BusEvent } from "./types.js";

export function defaultAutomationRules(): AutomationRule[] {
  return [
    {
      id: "rule-security-warning",
      name: "Security warning cascade",
      trigger: "SECURITY_WARNING",
      enabled: true,
      actions: [
        {
          target_department: "notification-department",
          intent: "Collect security warning alert payload (do not send live)",
        },
        {
          target_department: "timeline-department",
          emit: "TIMELINE_REMINDER",
          intent: "Create reminder for security follow-up",
        },
        {
          target_department: "production-dashboard",
          intent: "Reflect security warning on dashboard state",
        },
      ],
    },
    {
      id: "rule-security-critical",
      name: "Security critical cascade",
      trigger: "SECURITY_CRITICAL",
      enabled: true,
      actions: [
        {
          target_department: "notification-department",
          intent: "Queue critical security alert",
        },
        {
          target_department: "timeline-department",
          emit: "TIMELINE_REMINDER",
          intent: "Create CRITICAL reminder",
        },
        {
          target_department: "runtime-manager",
          intent: "Surface critical health to runtime supervisor",
        },
        {
          target_department: "production-dashboard",
          intent: "Mark factory health degraded/critical",
        },
      ],
    },
    {
      id: "rule-website-warning",
      name: "Website warning cascade",
      trigger: "WEBSITE_WARNING",
      enabled: true,
      actions: [
        {
          target_department: "notification-department",
          intent: "Queue website warning",
        },
        {
          target_department: "production-dashboard",
          intent: "Update website health indicator",
        },
      ],
    },
    {
      id: "rule-publication-released",
      name: "Publication released cascade",
      trigger: "PUBLICATION_RELEASED",
      enabled: true,
      actions: [
        {
          target_department: "notification-department",
          intent: "Queue release notification",
        },
        {
          target_department: "production-dashboard",
          intent: "Refresh publication status",
        },
        {
          target_department: "founder-dashboard",
          intent: "Record release on founder surface",
        },
        {
          target_department: "catalog-integrity",
          intent: "Note catalog change after release",
        },
      ],
    },
    {
      id: "rule-founder-review-pending",
      name: "Founder review pending cascade",
      trigger: "FOUNDER_REVIEW_PENDING",
      enabled: true,
      actions: [
        {
          target_department: "notification-department",
          intent: "Queue founder review reminder",
        },
        {
          target_department: "timeline-department",
          emit: "TIMELINE_REMINDER",
          intent: "Track founder review deadline",
        },
        {
          target_department: "founder-dashboard",
          intent: "Highlight pending review",
        },
      ],
    },
    {
      id: "rule-batch-completed",
      name: "Batch completed cascade",
      trigger: "BATCH_COMPLETED",
      enabled: true,
      actions: [
        {
          target_department: "production-dashboard",
          intent: "Update batch health",
        },
        {
          target_department: "notification-department",
          intent: "Queue batch completion notice",
        },
      ],
    },
    {
      id: "rule-system-critical",
      name: "System critical cascade",
      trigger: "SYSTEM_CRITICAL",
      enabled: true,
      actions: [
        {
          target_department: "notification-department",
          intent: "Queue system critical alert",
        },
        {
          target_department: "runtime-manager",
          intent: "Escalate to runtime recovery path",
        },
        {
          target_department: "timeline-department",
          emit: "TIMELINE_REMINDER",
          intent: "Log critical system incident",
        },
      ],
    },
  ];
}

export class AutomationRuleEngine {
  constructor(private readonly rules: AutomationRule[]) {}

  list(): AutomationRule[] {
    return this.rules.map((r) => ({ ...r, actions: [...r.actions] }));
  }

  matching(eventType: BusEvent["type"]): AutomationRule[] {
    return this.rules.filter((r) => r.enabled && r.trigger === eventType);
  }

  apply(event: BusEvent): AutomationTrace[] {
    return this.matching(event.type).map((rule) => ({
      rule_id: rule.id,
      trigger_event_id: event.id,
      trigger_type: event.type,
      actions_taken: rule.actions.map((action) => ({
        target_department: action.target_department,
        emit: action.emit,
        intent: action.intent,
        status: "applied" as const,
      })),
      at: new Date().toISOString(),
    }));
  }

  toDocument(generatedAt: string) {
    return {
      generated_at: generatedAt,
      count: this.rules.length,
      enabled_count: this.rules.filter((r) => r.enabled).length,
      rules: this.list(),
    };
  }
}
