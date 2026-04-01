"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabaseAuth } from "@/lib/authClient";
import { useAuth } from "@/providers/auth-provider";

export function SiteShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { loading, session, user } = useAuth();
  const isAuthRoute = pathname === "/login" || pathname === "/auth/callback";

  async function signOut() {
    await supabaseAuth.auth.signOut();
    router.replace("/login");
  }

  if (isAuthRoute) {
    return <>{children}</>;
  }

  return (
    <>
      <header
        style={{
          padding: 16,
          borderBottom: "1px solid #ece7db",
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          alignItems: "center",
          flexWrap: "wrap",
          background: "#fffdf7",
        }}
      >
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <strong>Auth Base</strong>
          <Link href="/">Inicio</Link>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          {!loading && session ? (
            <>
              <span style={{ color: "#555", fontSize: 14 }}>
                {user?.email ?? "Sesion activa"}
              </span>
              <button type="button" onClick={() => void signOut()}>
                Cerrar sesion
              </button>
            </>
          ) : (
            <Link href="/login">Login</Link>
          )}
        </div>
      </header>

      <div style={{ padding: 16 }}>{children}</div>
    </>
  );
}
