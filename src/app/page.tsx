"use client";

import Link from "next/link";
import { useAuth } from "@/providers/auth-provider";

export default function Home() {
  const { loading, session, user } = useAuth();

  return (
    <main
      style={{
        minHeight: "calc(100vh - 73px)",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "linear-gradient(180deg, #f7f4ec 0%, #efe9dc 100%)",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 720,
          minHeight: 320,
          borderRadius: 28,
          border: "1px solid #ded6c6",
          background: "rgba(255, 253, 247, 0.88)",
          boxShadow: "0 24px 80px rgba(58, 42, 18, 0.08)",
          padding: 32,
          display: "grid",
          alignContent: "center",
        }}
      >
        <p style={{ margin: 0, fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: "#8b6f3d" }}>
          Base Lista
        </p>
        <h1 style={{ marginBottom: 10, marginTop: 12 }}>Pagina limpia</h1>
        <p style={{ marginTop: 0, color: "#5f5a4f", lineHeight: 1.7, maxWidth: 540 }}>
          Dejamos solamente la autenticacion operativa para construir desde cero sobre una base estable.
        </p>

        {!loading && session ? (
          <p style={{ marginBottom: 0, color: "#4b463d" }}>
            Sesion iniciada con {user?.email ?? "usuario autenticado"}.
          </p>
        ) : (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
            <Link href="/login">Ir a login</Link>
          </div>
        )}
      </section>
    </main>
  );
}
