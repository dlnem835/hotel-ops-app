import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "One Eyrie Field Operations",
    short_name: "One Eyrie",
    description: "Mobile field operations",
    start_url: "/mobile",
    display: "standalone",
    background_color: "#111111",
    theme_color: "#111111",
  };
}
