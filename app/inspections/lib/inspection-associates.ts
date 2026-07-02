import {
  mapMembersToAssociateOptions,
  type MemberNameRecord,
} from "@/app/lib/member-display-name";
import {
  memberJobTitleMatchesInspectionProgram,
  type InspectionAssociateProgram,
} from "@/app/lib/role-permissions";

export type TeamMemberForAssociate = MemberNameRecord & {
  id: number | string;
  job_title?: string | null;
  role?: string | null;
  status?: string | null;
};

export function resolveMemberJobTitle(member: {
  job_title?: string | null;
  role?: string | null;
}): string {
  return (member.job_title || member.role || "").trim();
}

export function isActiveTeamMember(member: { status?: string | null }): boolean {
  const status = (member.status || "Active").trim();
  return status.toLowerCase() === "active";
}

export function filterTeamMembersForInspectionProgram(
  members: TeamMemberForAssociate[],
  program: InspectionAssociateProgram
): TeamMemberForAssociate[] {
  return members.filter((member) => {
    if (!isActiveTeamMember(member)) return false;
    return memberJobTitleMatchesInspectionProgram(
      resolveMemberJobTitle(member),
      program
    );
  });
}

export function mapInspectionAssociateOptions(
  members: TeamMemberForAssociate[],
  program: InspectionAssociateProgram
) {
  return mapMembersToAssociateOptions(
    filterTeamMembersForInspectionProgram(members, program)
  );
}
