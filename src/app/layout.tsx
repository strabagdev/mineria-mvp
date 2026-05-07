import React from "react";
import { PwaRegister } from "@/components/pwa-register";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

export const metadata = {
  title: "ZÜBLIN/STRABAG",
  description: "Carta gantt operacional para actividades e interferencias mineras",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Control Gantt",
    statusBarStyle: "default",
  },
};

export const viewport = {
  themeColor: "#0f766e",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <PwaRegister />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
