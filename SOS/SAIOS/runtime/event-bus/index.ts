/**
 * Event Bus public exports.
 */
export { EventBus, runEventBusAsync } from "./EventBus.js";
export {
  defaultEventConfiguration,
  persistEventConfiguration,
  EVENT_BUS_ROOT,
  REPO_ROOT,
} from "./EventConfiguration.js";
export { listRegisteredEvents, REGISTERED_EVENTS } from "./EventRegistry.js";
export { discoverDepartments } from "./DepartmentRouter.js";
export { defaultAutomationRules } from "./AutomationRuleEngine.js";
export type {
  AutomationRule,
  BusEvent,
  DepartmentId,
  EventBusResult,
  EventType,
  RegisteredDepartment,
  Subscription,
} from "./types.js";
