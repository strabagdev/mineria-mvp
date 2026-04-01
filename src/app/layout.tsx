import React from "react";
import "./globals.css";
import { SiteShell } from "@/components/site-shell";
import { AuthProvider } from "@/providers/auth-provider";

export const metadata = {
  title: "Mineria MVP",
  description: "Carta gantt operacional para actividades e interferencias mineras",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <AuthProvider>
          <SiteShell>{children}</SiteShell>
        </AuthProvider>
      </body>
    </html>
  );
}
