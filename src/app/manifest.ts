import type { MetadataRoute } from "next";

// PRD v3 F-1501: installable on the member's phone, opens straight into the portal. No offline mode.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Leader Team Control · Portal Member",
    short_name: "LTC Member",
    description: "Skill, rencana peningkatan, training, voice, dan cuti member Finishing Line.",
    start_url: "/me",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F9F9FB",
    theme_color: "#EB0A1E",
    lang: "id",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
