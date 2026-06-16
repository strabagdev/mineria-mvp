import React from "react";
import { PwaRegister } from "@/components/pwa-register";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

export const metadata = {
  title: "OpsAhead - Minería",
  description: "Carta gantt operacional para actividades e interferencias mineras",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "MINERÍA",
    statusBarStyle: "default",
  },
};

export const viewport = {
  themeColor: "#151D26",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body>
        <ThemeProvider>
          <PwaRegister />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
