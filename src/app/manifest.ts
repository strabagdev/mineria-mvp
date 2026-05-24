import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ZUBLIN STRABAG Control Gantt Operacional",
    short_name: "Control Gantt",
    description: "Carta gantt operacional para actividades e interferencias mineras.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f1f7ef",
    theme_color: "#79c96b",
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
