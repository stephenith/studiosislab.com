/**
 * DashboardPlugin — Agent #174.
 * Module registration interface for snapshot + route plugins.
 */
import type { SnapshotSource } from "./SnapshotSource.js";
import type { DashboardRouteHandler } from "./RouteRegistry.js";
import type { SnapshotRegistry } from "./SnapshotRegistry.js";
import type { RouteRegistry } from "./RouteRegistry.js";

export type DashboardPlugin = {
  readonly id: string;
  readonly snapshot?: SnapshotSource;
  readonly routes?: DashboardRouteHandler[];
};

export function registerDashboardPlugin(
  plugin: DashboardPlugin,
  opts: {
    snapshots: SnapshotRegistry;
    routes: RouteRegistry;
  },
): void {
  if (plugin.snapshot) {
    opts.snapshots.register(plugin.snapshot);
  }
  for (const route of plugin.routes ?? []) {
    opts.routes.register(route);
  }
}
