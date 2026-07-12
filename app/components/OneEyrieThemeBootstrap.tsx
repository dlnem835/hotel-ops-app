import {
  LIGHT_MODE_REQUIRES_ADMIN,
  ONE_EYRIE_DEFAULT_THEME,
  ONE_EYRIE_THEME_STORAGE_KEY,
} from "@/app/lib/one-eyrie-theme";

/** Applies stored theme before paint to avoid a flash of the wrong mode. */
export default function OneEyrieThemeBootstrap() {
  const script = `
(function () {
  var key = ${JSON.stringify(ONE_EYRIE_THEME_STORAGE_KEY)};
  var fallback = ${JSON.stringify(ONE_EYRIE_DEFAULT_THEME)};
  var adminGated = ${JSON.stringify(LIGHT_MODE_REQUIRES_ADMIN)};
  try {
    if (adminGated) {
      document.documentElement.setAttribute("data-theme", fallback);
      document.documentElement.style.colorScheme = fallback;
      return;
    }
    var stored = localStorage.getItem(key);
    var theme = stored === "light" || stored === "dark" ? stored : fallback;
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;
  } catch (e) {
    document.documentElement.setAttribute("data-theme", fallback);
    document.documentElement.style.colorScheme = fallback;
  }
})();
`.trim();

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
