"use client";

import Link from "next/link";
import { useAuth } from "@/providers/auth-provider";

export default function Home() {
  const { loading, session, user } = useAuth();

  return (
    <section
      style={{
        display: "grid",
        gap: 24,
      }}
    >
      <div
        style={{
          display: "grid",
          gap: 16,
        }}
      >
        <div
          style={{
            display: "grid",
            gap: 24,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          {[
            {
              label: "Estado",
              value: !loading && session ? "Activo" : "Listo",
              detail: "La base ya puede autenticar usuarios con Supabase Auth.",
            },
            {
              label: "Acceso",
              value: "Email + password",
              detail: "También puedes usar magic link desde la misma pantalla de login.",
            },
            {
              label: "Destino",
              value: "/",
              detail: "Después del login aterrizas en una página inicial limpia.",
            },
          ].map((item) => (
            <article
              key={item.label}
              style={{
                borderRadius: 24,
                border: "1px solid #d6d3d1",
                background: "#fafaf9",
                padding: 20,
              }}
            >
              <p style={{ margin: 0, fontSize: 14, color: "#78716c" }}>{item.label}</p>
              <p style={{ margin: "10px 0 0", fontSize: 28, fontWeight: 700, color: "#1c1917" }}>
                {item.value}
              </p>
              <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.6, color: "#57534e" }}>
                {item.detail}
              </p>
            </article>
          ))}
        </div>

        <article
          style={{
            width: "100%",
            minHeight: 320,
            borderRadius: 32,
            border: "1px solid rgba(214, 211, 209, 0.8)",
            background: "#ffffff",
            boxShadow: "0 18px 40px rgba(120, 86, 45, 0.08)",
            padding: 32,
            display: "grid",
            alignContent: "center",
          }}
        >
          <p style={{ margin: 0, fontSize: 12, letterSpacing: "0.25em", textTransform: "uppercase", color: "#b45309", fontWeight: 700 }}>
            Panel inicial
          </p>
          <h2 style={{ marginBottom: 10, marginTop: 12, fontSize: 34, lineHeight: 1.1, color: "#1c1917" }}>
            Página limpia con estilo Order System
          </h2>
          <p style={{ marginTop: 0, color: "#57534e", lineHeight: 1.7, maxWidth: 640, fontSize: 15 }}>
            La interfaz ahora replica la misma familia visual: tonos crema, superficies blancas cálidas, bordes suaves y jerarquía pensada para una operación simple.
          </p>

          {!loading && session ? (
            <div
              style={{
                marginTop: 8,
                borderRadius: 24,
                border: "1px solid #d6d3d1",
                background: "#fafaf9",
                padding: 18,
                maxWidth: 520,
              }}
            >
              <p style={{ margin: 0, fontSize: 14, color: "#78716c" }}>Sesión activa</p>
              <p style={{ margin: "8px 0 0", fontSize: 18, fontWeight: 600, color: "#1c1917" }}>
                {user?.email ?? "usuario autenticado"}
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
              <Link
                href="/login"
                style={{
                  borderRadius: 24,
                  border: "1px solid #fcd34d",
                  background: "#fef3c7",
                  padding: "14px 18px",
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#92400e",
                }}
              >
                Ir a login
              </Link>
            </div>
          )}
        </article>
      </div>

      <article
        style={{
          borderRadius: 32,
          border: "1px solid rgba(214, 211, 209, 0.8)",
          background: "#ffffff",
          boxShadow: "0 18px 40px rgba(120, 86, 45, 0.08)",
          padding: 24,
          display: "grid",
          gap: 14,
        }}
      >
        <p style={{ margin: 0, fontSize: 12, letterSpacing: "0.25em", textTransform: "uppercase", color: "#b45309", fontWeight: 700 }}>
          Próximo paso
        </p>
        <h3 style={{ margin: 0, fontSize: 20, color: "#1c1917" }}>Base visual ya alineada</h3>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: "#57534e", maxWidth: 760 }}>
          Desde aquí podemos seguir replicando componentes del `order-system` para cualquier módulo nuevo que montemos, manteniendo la misma identidad visual desde el primer flujo.
        </p>
      </article>
    </section>
  );
}
