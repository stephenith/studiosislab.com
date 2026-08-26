/**
 * Node.js version health.
 */
import type { SecurityConfiguration } from "./SecurityConfiguration.js";
import type { SecurityFinding } from "./types.js";

export function checkNodeHealth(config: SecurityConfiguration): {
  findings: SecurityFinding[];
  pass: boolean;
} {
  const version = process.version;
  const major = Number(version.replace(/^v/, "").split(".")[0]);
  const ok = major >= config.min_node_major;
  return {
    findings: [
      {
        id: "node-version",
        area: "node",
        level: ok ? "GREEN" : "RED",
        title: ok
          ? `Node ${version} meets minimum v${config.min_node_major}`
          : `Node ${version} below minimum v${config.min_node_major}`,
        detail: version,
        source: "process.version",
        pass: ok,
      },
    ],
    pass: ok,
  };
}
