import { bootstrapEnv } from "./bootstrap-env.js";

/**
 * @deprecated Prefer automatic bootstrap via config import or tsx --import.
 */
export function loadEnvFile(_path?: string): void {
  bootstrapEnv();
}
