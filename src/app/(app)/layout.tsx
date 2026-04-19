import React from "react";
import { SiteShell } from "@/components/site-shell";
import { AuthProvider } from "@/providers/auth-provider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <SiteShell>{children}</SiteShell>
    </AuthProvider>
  );
}
