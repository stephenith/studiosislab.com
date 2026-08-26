/**
 * Engineering Intelligence CLI — Agent #223.
 * Advisory only. Writes engineering reports only.
 */
import { buildEngineeringIntelligenceReport } from "./EngineeringIntelligence.js";

process.env.SOS_AIOS_LIVE = "0";

const report = buildEngineeringIntelligenceReport({ persist: true });
console.log(
  JSON.stringify(
    {
      ok: true,
      agent: report.agent,
      overall: report.scores.overall,
      recommendation_count: report.recommendation_count,
      open_count: report.open_count,
      severity_summary: report.severity_summary,
      report_path: report.report_path,
      history_path: report.history_path,
      advisory_only: report.advisory_only,
      live: report.live,
      publication_allowed: report.publication_allowed,
      production_triggered: report.production_triggered,
      openai_called: report.openai_called,
      code_modified: report.code_modified,
      project_state_modified: report.project_state_modified,
      duration_ms: report.duration_ms,
    },
    null,
    2,
  ),
);
