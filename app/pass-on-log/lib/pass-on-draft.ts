export type PassOnDraft = {
  authUserId: string;
  author: string;
  subject: string;
  priority: string;
  entryDate: string;
  message: string;
  updatedAt: string;
};

export type PassOnDraftSnapshot = Pick<
  PassOnDraft,
  "subject" | "priority" | "entryDate" | "message"
>;

const STORAGE_KEY_PREFIX = "one-eyrie-pass-on-draft:";

export function emptyPassOnDraftSnapshot(
  entryDate = ""
): PassOnDraftSnapshot {
  return {
    subject: "",
    priority: "Normal",
    entryDate,
    message: "",
  };
}

export function passOnDraftSnapshotsEqual(
  a: PassOnDraftSnapshot,
  b: PassOnDraftSnapshot
) {
  return (
    a.subject === b.subject &&
    a.priority === b.priority &&
    a.entryDate === b.entryDate &&
    a.message === b.message
  );
}

export function passOnDraftHasContent(snapshot: PassOnDraftSnapshot) {
  return Boolean(snapshot.subject.trim() || snapshot.message.trim());
}

export function formatPassOnDraftSavedTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}


export function loadPassOnDraft(authUserId: string): PassOnDraft | null {
  if (typeof window === "undefined" || !authUserId) return null;

  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${authUserId}`);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as PassOnDraft;
    if (parsed.authUserId !== authUserId) return null;

    return parsed;
  } catch {
    return null;
  }
}

export function savePassOnDraft(draft: PassOnDraft): void {
  if (typeof window === "undefined") return;

  localStorage.setItem(
    `${STORAGE_KEY_PREFIX}${draft.authUserId}`,
    JSON.stringify({
      ...draft,
      updatedAt: new Date().toISOString(),
    })
  );
}

export function clearPassOnDraft(authUserId: string): void {
  if (typeof window === "undefined" || !authUserId) return;
  localStorage.removeItem(`${STORAGE_KEY_PREFIX}${authUserId}`);
}
