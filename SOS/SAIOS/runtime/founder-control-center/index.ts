/**
 * Founder Control Center public exports.
 */
export { runFounderControlCenter } from "./FounderControlCenterDirector.js";
export {
  FCC_ROOT,
  REPO_ROOT,
  defaultFounderControlConfiguration,
} from "./FounderControlConfiguration.js";
export { discoverDepartments } from "./DepartmentDiscovery.js";
export type {
  FounderControlCenterResult,
  FounderDashboard,
  FounderAction,
} from "./types.js";
