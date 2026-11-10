# Security Fix #3 Phase A — local testing log

Workspace: `C:\Users\Douglas\hotel-ops-app-phase-a`  
Server: `http://localhost:3001`  
Branch: `wip/security-fix-3-phase-a` at `36ae075`  
Do not deploy, push, or merge from this log.

## Approved modules

| Module | Status | Date |
|---|---|---|
| 1 — Inspection Photos | Approved | 2026-10-25 |
| 2 — PM Photos | Approved | 2026-10-25 |
| 3 — Work Order Photos | Approved | 2026-10-25 |
| 4 — Reports Detail Photos | Approved | 2026-10-25 |
| 5 — Mobile Inspection Photos | Approved | 2026-10-25 |
| 6 — Signed URL Refresh | Approved | 2026-11-09 |
| Completed PM reporting cleanup | Approved | 2026-11-09 |

Module 4 manual testing confirmed inspection, PM, and work-order photos display in their Reports detail views.  
Module 5 manual testing confirmed mobile inspection photo upload and signed display.

## Module 7 — Legacy Unprefixed Photo Security

Ready for manual testing on localhost:3001. Automated checks in `scripts/tenant/verify-operational-photo-access.ts`.

Unprefixed historical photos (no `org-{id}/property-{id}/` prefix) are authorized only when they are already stored on a tenant-scoped parent record (inspection session, work order, or PM occurrence). Refresh requires that parent. Signing failure does not return a public URL for legacy photos.

## Phase B follow-up — historical photo refresh

Desktop completed inspections and work-order detail/completion screens now keep a tenant photo parent so signed URLs can refresh after expiry. Reports files were not changed for this fix.

## Phase B — Private Photo Storage (prepared, not applied)

Application fail-closed signed URLs are implemented in this worktree. Migration 069 is on disk and **has not been executed**. Live Supabase buckets remain public until 069 is applied after this app is deployed. See `docs/security-fix-3-phase-b.md` for the exact deployment sequence and rollback.

## Documented for later

- Later cleanup: leftover inspection report Print/PDF markup in Phase A `ReportsInspectionResults.tsx`. See `docs/future-inspection-report-print-pdf-cleanup.md`.
