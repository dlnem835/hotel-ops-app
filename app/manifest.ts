import type { MetadataRoute } from "next";
import { ICON_VERSION, ONE_EYRIE_BRAND } from "./lib/one-eyrie-brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: `/one-eyrie-field?v=${ICON_VERSION}`,
    name: "One Eyrie Field Operations",
    short_name: "One Eyrie",
    description: "Mobile field operations",
    start_url: "/mobile",
    display: "standalone",
    background_color: "#111111",
    theme_color: "#111111",
    icons: [
      {
        src: ONE_EYRIE_BRAND.icons.icon192,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: ONE_EYRIE_BRAND.icons.icon512,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: ONE_EYRIE_BRAND.icons.icon512,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
