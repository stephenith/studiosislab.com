/**
 * BaseMarkdownReporter — Agent #173.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type MarkdownReportSection = {
  heading?: string;
  lines: string[];
};

export class BaseMarkdownReporter {
  write(
    dir: string,
    filename: string,
    title: string,
    sections: MarkdownReportSection[],
  ): string {
    const lines = [`# ${title}`, ""];
    for (const section of sections) {
      if (section.heading) {
        lines.push(`## ${section.heading}`, "");
      }
      lines.push(...section.lines, "");
    }
    mkdirSync(dir, { recursive: true });
    const path = join(dir, filename);
    writeFileSync(path, `${lines.join("\n").replace(/\n+$/, "")}\n`, "utf8");
    return path;
  }

  /** Convenience: header block + body lines + optional trailing list section. */
  writeSimple(opts: {
    dir: string;
    filename: string;
    title: string;
    headerLines: string[];
    listHeading?: string;
    listLines?: string[];
  }): string {
    const sections: MarkdownReportSection[] = [
      { lines: opts.headerLines },
    ];
    if (opts.listHeading || (opts.listLines && opts.listLines.length)) {
      sections.push({
        heading: opts.listHeading,
        lines: opts.listLines ?? [],
      });
    }
    return this.write(opts.dir, opts.filename, opts.title, sections);
  }
}
