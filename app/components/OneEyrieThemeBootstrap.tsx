import {
  ONE_EYRIE_DEFAULT_THEME,
} from "@/app/lib/one-eyrie-theme";

/**
 * Applies the default theme before paint to avoid a flash of the wrong mode.
 * Light Mode is gated per-user and cannot be resolved before the session is
 * known, so pre-paint always uses Dark; ThemeProvider upgrades allowlisted
 * users to their stored preference after the session resolves.
 */
export default function OneEyrieThemeBootstrap() {
  const script = `
(function () {
  var fallback = ${JSON.stringify(ONE_EYRIE_DEFAULT_THEME)};
  try {
    document.documentElement.setAttribute("data-theme", fallback);
    document.documentElement.style.colorScheme = fallback;
  } catch (e) {}
})();
`.trim();

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
