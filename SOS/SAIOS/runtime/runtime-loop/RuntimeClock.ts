/**
 * Runtime clock helpers.
 */
export class RuntimeClock {
  readonly startedAt = Date.now();

  now(): Date {
    return new Date();
  }

  nowIso(): string {
    return this.now().toISOString();
  }

  uptimeMs(): number {
    return Date.now() - this.startedAt;
  }

  ageMs(iso: string | null | undefined): number | null {
    if (!iso) return null;
    const t = Date.parse(iso);
    if (Number.isNaN(t)) return null;
    return Date.now() - t;
  }
}
