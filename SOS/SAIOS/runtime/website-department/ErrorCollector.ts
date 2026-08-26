/**
 * Collects structured errors during website health runs.
 */
export class ErrorCollector {
  private readonly errors: string[] = [];

  add(message: string): void {
    this.errors.push(message);
  }

  addAll(messages: string[]): void {
    this.errors.push(...messages);
  }

  list(): string[] {
    return [...this.errors];
  }

  get hasErrors(): boolean {
    return this.errors.length > 0;
  }

  clear(): void {
    this.errors.length = 0;
  }
}
