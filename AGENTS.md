<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:theme-rules -->
# Theme — Dark Mode is production

Light Mode is in development and **gated to administrators** (`LIGHT_MODE_REQUIRES_ADMIN` in `app/lib/one-eyrie-theme.ts`). All users except admins always receive Dark Mode.

When building new pages or features:
- Implement and ship **Dark Mode first** — it is the production design source of truth.
- Do not delete or regress existing Light Mode CSS; scope light rules with `html[data-theme="light"]`.
- Do not expose Light Mode to non-admin users.
<!-- END:theme-rules -->
