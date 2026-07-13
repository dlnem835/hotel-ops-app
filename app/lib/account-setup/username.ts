export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 32;

/** Allowed characters after normalization: lowercase letters, digits, dot, underscore, hyphen. */
const USERNAME_PATTERN = /^[a-z0-9._-]+$/;

/** Consistent normalization used everywhere a username is stored or compared. */
export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

export type UsernameValidationResult =
  | { ok: true; normalized: string }
  | { ok: false; error: string };

export function validateUsername(input: string): UsernameValidationResult {
  const normalized = normalizeUsername(input);

  if (!normalized) {
    return { ok: false, error: "Username is required" };
  }
  if (normalized.length < USERNAME_MIN_LENGTH) {
    return {
      ok: false,
      error: `Username must be at least ${USERNAME_MIN_LENGTH} characters`,
    };
  }
  if (normalized.length > USERNAME_MAX_LENGTH) {
    return {
      ok: false,
      error: `Username must be ${USERNAME_MAX_LENGTH} characters or fewer`,
    };
  }
  if (!USERNAME_PATTERN.test(normalized)) {
    return {
      ok: false,
      error:
        "Username may only contain lowercase letters, numbers, dots, underscores, and hyphens",
    };
  }

  return { ok: true, normalized };
}

export const PASSWORD_MIN_LENGTH = 8;

export type PasswordValidationResult = { ok: true } | { ok: false; error: string };

export function validatePassword(
  password: string,
  confirmPassword: string
): PasswordValidationResult {
  if (!password) {
    return { ok: false, error: "Password is required" };
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return {
      ok: false,
      error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
    };
  }
  if (password !== confirmPassword) {
    return { ok: false, error: "Passwords do not match" };
  }
  return { ok: true };
}
