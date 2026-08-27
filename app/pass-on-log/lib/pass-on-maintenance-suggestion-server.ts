import "server-only";

import OpenAI from "openai";
import {
  WORK_ORDER_ITEM_ISSUES,
  classifyWorkOrderItemIssue,
} from "@/app/maintenance/lib/work-order-item-issues";
import {
  EMPTY_PASS_ON_MAINTENANCE_SUGGESTION,
  extractPassOnRoomHint,
  isAllowedWorkOrderItemIssue,
  isPassOnMaintenanceLikelyResolved,
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

function buildConversationalPromptLabel(
  itemIssue: string | null,
  roomHint: string | null
): string {
  const issue = (itemIssue || "maintenance").trim();
  const article = /^[aeiou]/i.test(issue) ? "an" : "a";
  const roomPart = roomHint ? ` in Room ${roomHint}` : "";
  return `This sounds like ${article} ${issue} issue${roomPart}.`;
}

function buildLocalSuggestion(
  subject: string,
  message: string
): PassOnMaintenanceSuggestion {
  const roomHint = extractPassOnRoomHint(subject, message);
  const itemIssue = classifyWorkOrderItemIssue({
    description: message,
    details: subject,
  });
  return {
    shouldSuggest: true,
    isLikelyResolved: false,
    roomHint,
    itemIssue,
    subject: subject.trim() || itemIssue,
    promptLabel: buildConversationalPromptLabel(itemIssue, roomHint),
    confidence: 0.7,
  };
}

/**
 * AI classification for Pass-On draft maintenance suggestions.
 * Returns null when the provider is not configured (caller should not suggest).
 *
 * Local gate already confirmed maintenance language. AI's main job is to reject
 * already-resolved notes; when AI is unsure/unavailable, fall back to a local
 * deterministic suggestion so clear issues still surface.
 */
export async function classifyPassOnMaintenanceSuggestion(input: {
  subject: string;
  message: string;
}): Promise<PassOnMaintenanceSuggestion | null> {
  const subject = input.subject.trim();
  const message = input.message.trim();
  if (!subject && !message) return EMPTY_PASS_ON_MAINTENANCE_SUGGESTION;

  if (isPassOnMaintenanceLikelyResolved(subject, message)) {
    return {
      ...EMPTY_PASS_ON_MAINTENANCE_SUGGESTION,
      isLikelyResolved: true,
    };
  }

  const client = getOpenAiClient();
  if (!client) return null;

  const itemList = WORK_ORDER_ITEM_ISSUES.join(", ");
  const localRoomHint = extractPassOnRoomHint(subject, message);
  const localFallback = buildLocalSuggestion(subject, message);

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
promptLabel (string|null — one short conversational sentence like "This sounds like a Shower Door issue in Room 303."),
confidence (number 0-1).

Rules:
- shouldSuggest=true for an ACTIVE maintenance issue that still needs work (broken, leaking, won't close, not cooling, etc.).
- If the note says something was already repaired/fixed/resolved/completed, set isLikelyResolved=true and shouldSuggest=false.
- Do not invent rooms. Prefer an explicit room number when present.
- itemIssue must be from the provided catalog exactly, or null.
- Never assign or invent Work Order priority.
- Prefer shouldSuggest=true when the note clearly reports a guest/staff maintenance problem that is not already fixed.
- promptLabel must be a single natural sentence starting with "This sounds like" — never mention AI.`,
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
    if (isLikelyResolved) {
      return {
        ...EMPTY_PASS_ON_MAINTENANCE_SUGGESTION,
        isLikelyResolved: true,
        confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
      };
    }

    let shouldSuggest = Boolean(parsed.shouldSuggest);
    const confidence = Math.max(
      0,
      Math.min(1, Number(parsed.confidence) || 0)
    );

    // Local gate already saw maintenance language. If AI is uncertain, still
    // surface the deterministic local suggestion rather than staying silent.
    if (!shouldSuggest || confidence < 0.4) {
      return localFallback;
    }

    const itemRaw = String(parsed.itemIssue || "").trim();
    const itemIssue = isAllowedWorkOrderItemIssue(itemRaw)
      ? itemRaw
      : localFallback.itemIssue;

    const roomHint =
      (parsed.roomHint && String(parsed.roomHint).trim()) ||
      localRoomHint ||
      null;

    const conciseSubject =
      (parsed.subject && String(parsed.subject).trim()) ||
      subject ||
      itemIssue;

    const parsedLabel = parsed.promptLabel && String(parsed.promptLabel).trim();
    const promptLabel =
      parsedLabel && /^this sounds like/i.test(parsedLabel)
        ? parsedLabel
        : buildConversationalPromptLabel(itemIssue, roomHint);

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
    return localFallback;
  }
}
