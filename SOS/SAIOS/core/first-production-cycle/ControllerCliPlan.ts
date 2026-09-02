/**
 * Phase 6D — Plan ProductionController options from the existing CLI argv.
 * Default (no --target) is bit-identical to the pre-6D controller invocation.
 */
import {
  DEFAULT_BATCH_SIZE,
  DEFAULT_MAX_OPENAI_PER_BATCH,
  DEFAULT_QUEUE_MAX,
} from "./BatchRunner.js";
import type { ProductionControllerOptions } from "./ProductionController.js";
import {
  resolveCanonicalProductionTarget,
  type CanonicalTargetResolution,
} from "./CanonicalTargetResolver.js";
import type { ProductionTarget } from "./ProductionTarget.js";

const DESIGN_PIN_FLAGS = new Set([
  "--design-family",
  "--architecture",
  "--profile",
  "--layout",
  "--section-order",
  "--family",
]);

export type ControllerCliArgs = {
  size: number;
  sizeSpecified: boolean;
  queueMax: number;
  maxOpenai: number;
  mock: boolean;
  targetRaw: string | null;
  help: boolean;
};

export type ControllerCliPlan =
  | {
      ok: true;
      mode: "default" | "controlled";
      args: ControllerCliArgs;
      production: ProductionControllerOptions;
      resolved: {
        id: string;
        title: string;
        role_family: string;
        category: string;
        target: ProductionTarget;
      } | null;
      target_selection: "natural_strategy" | "canonical_forced";
    }
  | {
      ok: false;
      code:
        | "unknown"
        | "ambiguous"
        | "empty"
        | "invalid_combo"
        | "invalid_size"
        | "design_pin_rejected";
      detail: string;
      exit_code: 1;
      resolution?: CanonicalTargetResolution;
    };

export function parseControllerCliArgs(argv: string[]): ControllerCliArgs {
  let size = DEFAULT_BATCH_SIZE;
  let sizeSpecified = false;
  let queueMax = DEFAULT_QUEUE_MAX;
  let maxOpenai = DEFAULT_MAX_OPENAI_PER_BATCH;
  let mock = false;
  let targetRaw: string | null = null;
  let help = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--size" || a === "--batch-size") {
      size = Number(argv[++i]);
      sizeSpecified = true;
    } else if (a === "--queue-max") {
      queueMax = Number(argv[++i]);
    } else if (a === "--max-openai") {
      maxOpenai = Number(argv[++i]);
    } else if (a === "--mock") {
      mock = true;
    } else if (a === "--target" || a === "--canonical-target") {
      targetRaw = String(argv[++i] ?? "");
    } else if (a === "--help" || a === "-h") {
      help = true;
    }
  }
  if (!Number.isFinite(size) || size < 1) size = DEFAULT_BATCH_SIZE;
  if (!Number.isFinite(queueMax) || queueMax < 1) queueMax = DEFAULT_QUEUE_MAX;
  if (!Number.isFinite(maxOpenai) || maxOpenai < 0) {
    maxOpenai = DEFAULT_MAX_OPENAI_PER_BATCH;
  }
  return { size, sizeSpecified, queueMax, maxOpenai, mock, targetRaw, help };
}

export function planControllerExecution(argv: string[]): ControllerCliPlan {
  if (argv.some((a) => DESIGN_PIN_FLAGS.has(a))) {
    return {
      ok: false,
      code: "design_pin_rejected",
      detail:
        "controlled target may not set design_family, architecture, profile, layout, or section order",
      exit_code: 1,
    };
  }

  const args = parseControllerCliArgs(argv);
  if (args.help) {
    return {
      ok: true,
      mode: "default",
      args,
      production: {
        batch_size: args.size,
        queue_max: args.queueMax,
        max_openai_per_batch: args.maxOpenai,
        force_mock: args.mock,
        select_target: true,
      },
      resolved: null,
      target_selection: "natural_strategy",
    };
  }

  if (args.targetRaw == null) {
    return {
      ok: true,
      mode: "default",
      args,
      production: {
        batch_size: args.size,
        queue_max: args.queueMax,
        max_openai_per_batch: args.maxOpenai,
        force_mock: args.mock,
        select_target: true,
      },
      resolved: null,
      target_selection: "natural_strategy",
    };
  }

  if (args.mock) {
    return {
      ok: false,
      code: "invalid_combo",
      detail: "--target is incompatible with --mock (live proof uses real provider policy)",
      exit_code: 1,
    };
  }

  if (args.sizeSpecified && args.size !== 1) {
    return {
      ok: false,
      code: "invalid_size",
      detail: `--target requires --size 1 (got ${args.size})`,
      exit_code: 1,
    };
  }

  const resolution = resolveCanonicalProductionTarget(args.targetRaw);
  if (!resolution.ok) {
    return {
      ok: false,
      code: resolution.reason,
      detail: resolution.detail,
      exit_code: 1,
      resolution,
    };
  }

  return {
    ok: true,
    mode: "controlled",
    args: { ...args, size: 1 },
    production: {
      batch_size: 1,
      queue_max: args.queueMax,
      max_openai_per_batch: Math.min(args.maxOpenai, 1),
      max_attempts: 1,
      force_mock: false,
      select_target: false,
      forced_targets: [resolution.target],
    },
    resolved: {
      id: resolution.entry.id,
      title: resolution.entry.title,
      role_family: resolution.target.role_family,
      category: resolution.entry.category,
      target: resolution.target,
    },
    target_selection: "canonical_forced",
  };
}

export function controllerHelpText(): string {
  return `Usage: aios:controller:run [--size N] [--queue-max N] [--max-openai N] [--mock] [--target <canonical-id>]`;
}
