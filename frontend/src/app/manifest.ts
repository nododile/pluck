import type { MetadataRoute } from "next";

/**
 * PWA manifest.
 *
 * The killer feature here is `share_target`. When Pluck is installed
 * on Android (Chrome shows an "Install" prompt automatically), it
 * appears in the system Share menu. From inside TikTok or YouTube,
 * the user can tap Share -> Pluck, and we receive the URL via a GET
 * to /?url=...
 *
 * page.tsx watches for that query param on first render and triggers
 * extraction immediately.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pluck",
    short_name: "Pluck",
    description: "Paste a link. Get the file. Done.",
    start_url: "/",
    display: "standalone",
    background_color: "#FAFAF8",
    theme_color: "#FAFAF8",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
    share_target: {
      action: "/",
      method: "GET",
      params: {
        title: "title",
        text: "url",
        url: "url",
      },
    },
  };
}
