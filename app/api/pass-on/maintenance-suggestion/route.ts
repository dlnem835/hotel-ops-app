import { NextResponse } from "next/server";
import {
  resolveTenantRequest,
  tenantErrorResponse,
} from "@/app/lib/tenant/server/resolve-tenant-request";
import { shouldRequestPassOnMaintenanceAi } from "@/app/pass-on-log/lib/pass-on-maintenance-gate";
import { classifyPassOnMaintenanceSuggestion } from "@/app/pass-on-log/lib/pass-on-maintenance-suggestion-server";

/**
 * Hybrid Pass-On → maintenance suggestion.
 * Local gate first; AI only when maintenance language is present.
 * Never creates Work Orders.
 */
export async function POST(request: Request) {
  try {
    await resolveTenantRequest(request);
    const body = await request.json().catch(() => ({}));
    const subject = String(body.subject ?? "").trim();
    const message = String(body.message ?? "").trim();

    if (!shouldRequestPassOnMaintenanceAi(subject, message)) {
      return NextResponse.json({
        shouldSuggest: false,
        isLikelyResolved: false,
        roomHint: null,
        itemIssue: null,
        subject: null,
        promptLabel: null,
        confidence: 0,
        gated: true,
      });
    }

    const suggestion = await classifyPassOnMaintenanceSuggestion({
      subject,
      message,
    });

    if (!suggestion) {
      // Provider not configured — fail closed (no suggestion UI).
      return NextResponse.json({
        shouldSuggest: false,
        isLikelyResolved: false,
        roomHint: null,
        itemIssue: null,
        subject: null,
        promptLabel: null,
        confidence: 0,
        providerConfigured: false,
      });
    }

    return NextResponse.json({
      ...suggestion,
      providerConfigured: true,
    });
  } catch (error: unknown) {
    return tenantErrorResponse(error);
  }
}
