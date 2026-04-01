import React from "react";
import { SiteShell } from "@/components/site-shell";
import { AuthProvider } from "@/providers/auth-provider";

export const metadata = {
  title: "Auth Base",
  description: "Base minima con Supabase Auth"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          fontFamily: '"Segoe UI", "Helvetica Neue", sans-serif',
          background: "#fffaf1",
          color: "#1c1917",
        }}
      >
        <AuthProvider>
          <SiteShell>{children}</SiteShell>
        </AuthProvider>
      </body>
    </html>
  );
}
