/**
 * VPS Provisioning — shared types.
 * AGENT #114 — documentation & assets only; no deploy; no LIVE.
 */

export type ChecklistItem = {
  id: string;
  phase: string;
  title: string;
  required: boolean;
  references_deployment_package: boolean;
};

export type ServerSpec = {
  os: string;
  node: string;
  process_managers: string[];
  proxy: string;
  vcs: string;
  firewall: string;
  intrusion: string;
  ssl: string;
  backups: string;
  log_rotation: string;
};

export type DeploymentStep = {
  order: number;
  title: string;
  detail: string;
  verify_command?: string;
  live_allowed: boolean;
};

export type InfrastructureEstimate = {
  minimum: {
    cpu: string;
    ram: string;
    disk: string;
    bandwidth: string;
    monthly_usd: [number, number];
  };
  recommended: {
    cpu: string;
    ram: string;
    disk: string;
    bandwidth: string;
    monthly_usd: [number, number];
  };
  node: string;
  ubuntu: string;
  capacity_note: string;
};

export type GeneratedDoc = {
  name: string;
  path: string;
  kind: string;
};

export type VpsProvisioningResult = {
  generated_at: string;
  status: "READY" | "DEGRADED" | "BLOCKED";
  agent: "114";
  server_spec: ServerSpec;
  deployment_sequence: DeploymentStep[];
  checklist: ChecklistItem[];
  infrastructure: InfrastructureEstimate;
  docs: GeneratedDoc[];
  deployment_package_reused: boolean;
  deploy_performed: false;
  live_enabled: false;
  checks: Record<string, boolean>;
  output_dir: string;
};
