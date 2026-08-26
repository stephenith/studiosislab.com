/**
 * Placeholder departments — metadata only (Agent #180).
 */
import { createPlaceholderDepartment } from "../Department.js";
import type { DepartmentContract } from "../DepartmentTypes.js";

export const PLACEHOLDER_DEPARTMENT_SPECS = [
  { department_id: "website", department_name: "Website", department_type: "growth" as const },
  { department_id: "seo", department_name: "SEO", department_type: "growth" as const },
  { department_id: "marketing", department_name: "Marketing", department_type: "growth" as const },
  { department_id: "publisher", department_name: "Publisher", department_type: "operations" as const },
  { department_id: "finance", department_name: "Finance", department_type: "operations" as const },
  { department_id: "support", department_name: "Support", department_type: "support" as const },
  { department_id: "hr", department_name: "HR", department_type: "support" as const },
  { department_id: "legal", department_name: "Legal", department_type: "governance" as const },
] as const;

export function buildPlaceholderDepartments(): DepartmentContract[] {
  return PLACEHOLDER_DEPARTMENT_SPECS.map((s) =>
    createPlaceholderDepartment({
      department_id: s.department_id,
      department_name: s.department_name,
      department_type: s.department_type,
    }),
  );
}
