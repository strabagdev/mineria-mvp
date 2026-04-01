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
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, #fff8e8, transparent 35%), linear-gradient(180deg, #fffaf1 0%, #f6efe1 100%)",
      }}
    >
      <div
        style={{
          margin: "0 auto",
          maxWidth: 1280,
          minHeight: "100vh",
          padding: 24,
        }}
      >
        <header
          style={{
            marginBottom: 24,
            border: "1px solid rgba(214, 211, 209, 0.8)",
            borderRadius: 32,
            background: "rgba(255, 255, 255, 0.85)",
            boxShadow: "0 20px 50px rgba(120, 86, 45, 0.08)",
            backdropFilter: "blur(14px)",
            padding: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "0.25em",
                    textTransform: "uppercase",
                    color: "#b45309",
                  }}
                >
                  Order System Style
                </p>
                <h1
                  style={{
                    margin: "8px 0 0",
                    fontSize: 32,
                    lineHeight: 1.1,
                    color: "#1c1917",
                  }}
                >
                  Auth Base
                </h1>
                <p
                  style={{
                    margin: "8px 0 0",
                    maxWidth: 680,
                    fontSize: 14,
                    lineHeight: 1.6,
                    color: "#57534e",
                  }}
                >
                  Base mínima con autenticación lista para levantar un producto nuevo sobre una interfaz limpia.
                </p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <Link
                  href="/"
                  style={{
                    borderRadius: 18,
                    border: "1px solid #d6d3d1",
                    background: "#fafaf9",
                    padding: "12px 16px",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#44403c",
                  }}
                >
                  Inicio
                </Link>
                {!loading && session ? (
                  <>
                    <span style={{ color: "#57534e", fontSize: 14 }}>
                      {user?.email ?? "Sesion activa"}
                    </span>
                    <button
                      type="button"
                      onClick={() => void signOut()}
                      style={{
                        borderRadius: 999,
                        border: "1px solid #d6d3d1",
                        background: "#fafaf9",
                        padding: "12px 18px",
                        fontSize: 14,
                        fontWeight: 600,
                        color: "#44403c",
                        cursor: "pointer",
                      }}
                    >
                      Cerrar sesión
                    </button>
                  </>
                ) : (
                  <Link
                    href="/login"
                    style={{
                      borderRadius: 999,
                      border: "1px solid #fcd34d",
                      background: "#fef3c7",
                      padding: "12px 18px",
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#92400e",
                    }}
                  >
                    Login
                  </Link>
                )}
              </div>
            </div>
          </div>
        </header>

        <main>{children}</main>
      </div>
    </div>
  );
}
