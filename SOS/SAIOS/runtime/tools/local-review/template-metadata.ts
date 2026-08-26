import { readFileSync } from "node:fs";

export type TemplateMetadata = {
  candidate_name: string | null;
  job_title: string | null;
  path: string;
};

/** Extract candidate name and job title from Fabric textbox order (ATS linear). */
export function extractTemplateMetadata(absPath: string): TemplateMetadata {
  const raw = readFileSync(absPath, "utf8");
  const json = JSON.parse(raw) as {
    objects: Array<{ type?: string; text?: string; fontSize?: number; top?: number }>;
  };
  const textboxes = json.objects
    .filter((o) => String(o.type).toLowerCase() === "textbox")
    .sort((a, b) => Number(a.top ?? 0) - Number(b.top ?? 0));

  const nameBox = textboxes.find((o) => {
    const t = String(o.text ?? "").trim();
    return t.length > 0 && !t.startsWith("•") && !/^[A-Z\s]{8,}$/.test(t) && Number(o.fontSize) >= 28;
  });
  const titleBox = textboxes.find(
    (o) =>
      o !== nameBox &&
      Number(o.top) > Number(nameBox?.top ?? 0) &&
      Number(o.top) < Number(nameBox?.top ?? 0) + 120 &&
      !String(o.text ?? "").includes("@"),
  );

  return {
    candidate_name: nameBox ? String(nameBox.text).trim() : null,
    job_title: titleBox ? String(titleBox.text).trim() : null,
    path: absPath,
  };
}
