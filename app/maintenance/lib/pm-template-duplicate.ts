import { normalizeChecklist } from "./pm-checklist-draft";
import { PmChecklist, PmTemplate, PmTemplateInput } from "./pm-types";

export type PmTemplateWithAssignment = {
  template: PmTemplate;
  assignment: {
    area_id: number | null;
    asset_label: string | null;
    start_date: string;
    end_date: string | null;
    status: PmTemplate["status"];
  } | null;
};

export type PmDuplicateTarget = {
  name?: string;
  area_id?: number | null;
  asset_label?: string | null;
  start_date?: string;
};

function cloneChecklist(checklist: PmChecklist): PmChecklist {
  return normalizeChecklist(JSON.parse(JSON.stringify(checklist)) as PmChecklist);
}

export function buildDuplicatePmTemplateName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "Copy";
  if (/\scopy$/i.test(trimmed)) return trimmed;
  return `${trimmed} Copy`;
}

export function buildDuplicatePmTemplateInput(
  source: PmTemplateWithAssignment,
  target: PmDuplicateTarget = {}
): Partial<PmTemplateInput> {
  const { template, assignment } = source;

  return {
    name: target.name ?? buildDuplicatePmTemplateName(template.name),
    description: template.description,
    frequency: template.frequency,
    estimated_minutes: template.estimated_minutes,
    assigned_role: template.assigned_role,
    assigned_member_id: template.assigned_member_id,
    applies_to: template.applies_to,
    checklist: cloneChecklist(template.checklist),
    status: template.status,
    assignment: {
      area_id:
        target.area_id !== undefined
          ? target.area_id
          : (assignment?.area_id ?? null),
      asset_label:
        target.asset_label !== undefined
          ? target.asset_label
          : (assignment?.asset_label ?? null),
      start_date: target.start_date ?? assignment?.start_date ?? "",
      end_date: assignment?.end_date ?? null,
      status: assignment?.status ?? "Active",
    },
  };
}

/** For future bulk duplicate: one source template → many area/name targets. */
export function buildBulkDuplicatePmTemplateInputs(
  source: PmTemplateWithAssignment,
  targets: PmDuplicateTarget[]
): Partial<PmTemplateInput>[] {
  return targets.map((target) => buildDuplicatePmTemplateInput(source, target));
}

export function toPmTemplateWithAssignment(
  result: {
    template: PmTemplate;
    assignment: {
      area_id: number | null;
      asset_label: string | null;
      start_date: string;
      end_date: string | null;
      status: string;
    } | null;
  }
): PmTemplateWithAssignment {
  return {
    template: result.template,
    assignment: result.assignment
      ? {
          area_id: result.assignment.area_id,
          asset_label: result.assignment.asset_label,
          start_date: result.assignment.start_date,
          end_date: result.assignment.end_date,
          status: result.assignment.status as PmTemplate["status"],
        }
      : null,
  };
}
