/**
 * RouteRegistry — Agent #174.
 * Registers dashboard HTTP routes without changing response contracts.
 */
import type { IncomingMessage, ServerResponse } from "node:http";

export type DashboardRouteContext = {
  repoRoot: string;
  readBody: (req: IncomingMessage) => Promise<string>;
};

export type RouteMatch = {
  params: Record<string, string>;
};

export type DashboardRouteHandler = {
  id: string;
  method: "GET" | "POST";
  /** Human-readable path pattern, e.g. /api/runtime/system-readiness/:mission_id */
  pathPattern: string;
  /**
   * Return match params or null. Exact and regex matching both supported.
   */
  match: (pathOnly: string, method: string) => RouteMatch | null;
  handle: (
    req: IncomingMessage,
    res: ServerResponse,
    ctx: DashboardRouteContext,
    match: RouteMatch,
  ) => void | Promise<void>;
};

export class RouteRegistry {
  private readonly handlers: DashboardRouteHandler[] = [];

  register(handler: DashboardRouteHandler): void {
    if (this.handlers.some((h) => h.id === handler.id)) {
      throw new Error(`Route already registered: ${handler.id}`);
    }
    this.handlers.push(handler);
  }

  list(): DashboardRouteHandler[] {
    return [...this.handlers];
  }

  paths(): string[] {
    return this.handlers.map((h) => `${h.method} ${h.pathPattern}`);
  }

  clear(): void {
    this.handlers.length = 0;
  }

  /**
   * Try to handle the request. Returns true if a registered route matched.
   */
  async tryHandle(
    req: IncomingMessage,
    res: ServerResponse,
    pathOnly: string,
    ctx: DashboardRouteContext,
  ): Promise<boolean> {
    const method = (req.method ?? "GET").toUpperCase();
    for (const handler of this.handlers) {
      const match = handler.match(pathOnly, method);
      if (!match) continue;
      await handler.handle(req, res, ctx, match);
      return true;
    }
    return false;
  }
}

export const defaultRouteRegistry = new RouteRegistry();

/** Helper: exact path + method match. */
export function exactRoute(
  method: "GET" | "POST",
  path: string,
): (pathOnly: string, m: string) => RouteMatch | null {
  return (pathOnly, m) =>
    m === method && pathOnly === path ? { params: {} } : null;
}

/** Helper: `/prefix/:param` single-segment match; rejects reserved segment. */
export function paramRoute(
  method: "GET" | "POST",
  prefix: string,
  paramName: string,
  reserved?: string[],
): (pathOnly: string, m: string) => RouteMatch | null {
  const re = new RegExp(
    `^${prefix.replace(/\//g, "\\/")}\\/([^/]+)$`,
  );
  return (pathOnly, m) => {
    if (m !== method) return null;
    const matched = pathOnly.match(re);
    if (!matched) return null;
    const value = matched[1]!;
    if (reserved?.includes(value)) return null;
    return { params: { [paramName]: decodeURIComponent(value) } };
  };
}
