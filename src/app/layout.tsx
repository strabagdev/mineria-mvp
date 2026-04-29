import React from "react";
import "./globals.css";

export const metadata = {
  title: "ZÜBLIN/STRABAG",
  description: "Carta gantt operacional para actividades e interferencias mineras",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
