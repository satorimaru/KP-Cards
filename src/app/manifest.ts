import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KP-Cards",
    short_name: "KP-Cards",
    description:
      "KP-Cards — play Tiến Lên and more card games online. Same table, friends or bots.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a1210",
    theme_color: "#0a1210",
    categories: ["games", "entertainment"],
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
