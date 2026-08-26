/**
 * Deployment Package — shared types.
 * AGENT #112 — deployable AI OS package (assets only, no deploy)
 */

export type EnvVarSpec = {
  name: string;
  required: boolean;
  description: string;
  default_value?: string;
  secret: boolean;
};

export type HealthSurface = {
  id: string;
  label: string;
  source: string;
  expected: string;
};

export type GeneratedAsset = {
  name: string;
  path: string;
  kind: string;
};

export type EnvironmentValidation = {
  required: EnvVarSpec[];
  optional: EnvVarSpec[];
  missing: string[];
  present_non_secret: string[];
  safe_defaults: Record<string, string>;
  rules: string[];
};

export type DeploymentPackageResult = {
  generated_at: string;
  status: "READY" | "DEGRADED" | "BLOCKED";
  assets: GeneratedAsset[];
  environment: EnvironmentValidation;
  health_surfaces: HealthSurface[];
  checks: Record<string, boolean>;
  output_dir: string;
};
