import "server-only";

import OpenAI from "openai";
import { WORK_ORDER_ITEM_ISSUES } from "@/app/maintenance/lib/work-order-item-issues";
import { classifyWorkOrderItemIssue } from "@/app/maintenance/lib/work-order-item-issues";
import {
  EMPTY_PASS_ON_MAINTENANCE_SUGGESTION,
  extractPassOnRoomHint,
  isAllowedWorkOrderItemIssue,
  type PassOnMaintenanceSuggestion,
} from "@/app/pass-on-log/lib/pass-on-maintenance-gate";

const MODEL = "gpt-4o-mini";

function getOpenAiClient(): OpenAI | null {
  const apiKey = (process.env.OPENAI_API_KEY ?? "").trim();
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

type AiPayload = {
  shouldSuggest: boolean;
  isLikelyResolved: boolean;
  roomHint: string | null;
  itemIssue: string | null;
  subject: string | null;
  promptLabel: string | null;
  confidence: number;
};

function buildFallbackSuggestion(
  subject: string,
  message: string
): PassOnMaintenanceSuggestion {
  const roomHint = extractPassOnRoomHint(subject, message);
  const itemIssue = classifyWorkOrderItemIssue({
    description: message,
    details: subject,
  });
  const roomPart = roomHint ? ` in Room ${roomHint}` : "";
  const label = `${itemIssue}${roomPart}`;
  return {
    shouldSuggest: true,
    isLikelyResolved: false,
    roomHint,
    itemIssue,
    subject: subject.trim() || itemIssue,
    promptLabel: label,
    confidence: 0.45,
  };
}

/**
 * AI classification for Pass-On draft maintenance suggestions.
 * Returns null when the provider is not configured (caller should not suggest).
 */
export async function classifyPassOnMaintenanceSuggestion(input: {
  subject: string;
  message: string;
}): Promise<PassOnMaintenanceSuggestion | null> {
  const subject = input.subject.trim();
  const message = input.message.trim();
  if (!subject && !message) return EMPTY_PASS_ON_MAINTENANCE_SUGGESTION;

  const client = getOpenAiClient();
  if (!client) return null;

  const itemList = WORK_ORDER_ITEM_ISSUES.join(", ");
  const localRoomHint = extractPassOnRoomHint(subject, message);

  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You classify hotel Pass-On log notes for maintenance Work Order suggestions.
Return JSON only with keys:
shouldSuggest (boolean), isLikelyResolved (boolean), roomHint (string|null),
itemIssue (string|null — must be one of: ${itemList}),
subject (string|null — concise Work Order subject),
promptLabel (string|null — short phrase like "Shower Door in Room 303"),
confidence (number 0-1).

Rules:
- shouldSuggest=true only for an ACTIVE maintenance issue that still needs work.
- If the note says something was already repaired/fixed/resolved/completed, set isLikelyResolved=true and shouldSuggest=false.
- Do not invent rooms. Prefer an explicit room number when present.
- itemIssue must be from the provided catalog exactly, or null.
- Never assign or invent Work Order priority.
- Be conservative: when unsure whether work is still needed, shouldSuggest=false.`,
        },
        {
          role: "user",
          content: JSON.stringify({
            subject,
            message,
            localRoomHint,
          }),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() || "{}";
    const parsed = JSON.parse(raw) as Partial<AiPayload>;

    const isLikelyResolved = Boolean(parsed.isLikelyResolved);
    let shouldSuggest = Boolean(parsed.shouldSuggest) && !isLikelyResolved;
    const confidence = Math.max(
      0,
      Math.min(1, Number(parsed.confidence) || 0)
    );
    if (confidence < 0.55) shouldSuggest = false;

    const itemRaw = String(parsed.itemIssue || "").trim();
    const itemIssue = isAllowedWorkOrderItemIssue(itemRaw)
      ? itemRaw
      : classifyWorkOrderItemIssue({ description: message, details: subject });

    const roomHint =
      (parsed.roomHint && String(parsed.roomHint).trim()) ||
      localRoomHint ||
      null;

    const conciseSubject =
      (parsed.subject && String(parsed.subject).trim()) ||
      subject ||
      itemIssue;

    const promptLabel =
      (parsed.promptLabel && String(parsed.promptLabel).trim()) ||
      (roomHint ? `${itemIssue} in Room ${roomHint}` : itemIssue);

    if (!shouldSuggest) {
      return {
        shouldSuggest: false,
        isLikelyResolved,
        roomHint,
        itemIssue,
        subject: conciseSubject,
        promptLabel,
        confidence,
      };
    }

    return {
      shouldSuggest: true,
      isLikelyResolved: false,
      roomHint,
      itemIssue,
      subject: conciseSubject,
      promptLabel,
      confidence,
    };
  } catch (error) {
    console.error("[pass-on-maintenance-suggestion] openai failed", error);
    // Soft fallback only when local gate already decided text is maintenance-like.
    return buildFallbackSuggestion(subject, message);
  }
}
