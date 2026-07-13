<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:theme-rules -->
# Theme — Dark Mode is production

Light Mode is experimental and authorized to a **single platform-owner account by `auth.users.id` UUID only**, via the server-only env var `LIGHT_MODE_ALLOWED_USER_ID`. The one decision point is `isLightModeAllowedForUser` in `app/lib/theme/server/light-mode-access.ts`; the client only ever receives a boolean from `GET /api/theme/light-mode`. Everyone else always receives Dark Mode.

When building new pages or features:
- Implement and ship **Dark Mode first** — it is the production design source of truth.
- Do not delete or regress existing Light Mode CSS; scope light rules with `html[data-theme="light"]`.
- Do not expose Light Mode to unauthorized users, and never read the authorized UUID on the client or via `NEXT_PUBLIC_*`.
<!-- END:theme-rules -->
