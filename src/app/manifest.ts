import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ZUBLIN STRABAG Control Gantt Operacional",
    short_name: "Control Gantt",
    description: "Carta gantt operacional para actividades e interferencias mineras.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#edf4f0",
    theme_color: "#0f766e",
    icons: [
      {
        src: "/icons/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
