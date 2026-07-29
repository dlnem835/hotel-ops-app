import "server-only";

import { getAppBaseUrl, getShippoApiToken, getShippoWebhookSecret } from "@/app/lib/shipping/env";

export type ShippoWebhookEnsureResult = {
  ok: boolean;
  action: "created" | "already_registered" | "skipped" | "failed";
  message: string;
  webhookUrl: string | null;
};

function shippoIsTestToken(token: string): boolean {
  return token.startsWith("shippo_test_");
}

function buildWebhookUrl(secret: string): string {
  return `${getAppBaseUrl()}/api/webhooks/shippo?token=${encodeURIComponent(secret)}`;
}

/**
 * Ensure a Shippo account webhook exists for track_updated pointing at this app.
 * Idempotent: lists existing webhooks and creates only if missing.
 * Requires SHIPPO_API_TOKEN + SHIPPO_WEBHOOK_SECRET + a publicly reachable NEXT_PUBLIC_APP_URL.
 */
export async function ensureShippoTrackUpdatedWebhook(): Promise<ShippoWebhookEnsureResult> {
  const secret = getShippoWebhookSecret();
  if (!secret) {
    return {
      ok: false,
      action: "skipped",
      message: "SHIPPO_WEBHOOK_SECRET is not set",
      webhookUrl: null,
    };
  }

  let token: string;
  try {
    token = getShippoApiToken();
  } catch (error) {
    return {
      ok: false,
      action: "skipped",
      message:
        error instanceof Error ? error.message : "Shippo API token unavailable",
      webhookUrl: null,
    };
  }

  const webhookUrl = buildWebhookUrl(secret);
  const isTest = shippoIsTestToken(token);

  try {
    const listResponse = await fetch("https://api.goshippo.com/webhooks", {
      method: "GET",
      headers: {
        Authorization: `ShippoToken ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!listResponse.ok) {
      const text = await listResponse.text();
      return {
        ok: false,
        action: "failed",
        message: `List webhooks failed (${listResponse.status}): ${text.slice(0, 200)}`,
        webhookUrl,
      };
    }

    const listed = (await listResponse.json()) as {
      results?: Array<{
        url?: string;
        event?: string;
        active?: boolean;
        is_test?: boolean;
      }>;
    };

    const existing = (listed.results || []).find((hook) => {
      const url = String(hook.url || "");
      const event = String(hook.event || "");
      return (
        hook.active !== false &&
        (event === "track_updated" || event === "all") &&
        (url === webhookUrl ||
          (url.includes("/api/webhooks/shippo") &&
            url.includes(encodeURIComponent(secret))))
      );
    });

    if (existing) {
      return {
        ok: true,
        action: "already_registered",
        message: "Shippo track_updated webhook already registered",
        webhookUrl,
      };
    }

    const createResponse = await fetch("https://api.goshippo.com/webhooks", {
      method: "POST",
      headers: {
        Authorization: `ShippoToken ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: webhookUrl,
        event: "track_updated",
        is_test: isTest,
      }),
    });

    if (!createResponse.ok) {
      const text = await createResponse.text();
      return {
        ok: false,
        action: "failed",
        message: `Create webhook failed (${createResponse.status}): ${text.slice(0, 200)}`,
        webhookUrl,
      };
    }

    return {
      ok: true,
      action: "created",
      message: "Registered Shippo track_updated webhook",
      webhookUrl,
    };
  } catch (error) {
    return {
      ok: false,
      action: "failed",
      message: error instanceof Error ? error.message : "Webhook ensure failed",
      webhookUrl,
    };
  }
}
