"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";

type AdminUser = {
  user_id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "viewer";
  active: boolean;
  approval_status: "pending" | "approved" | "rejected";
  created_at?: string;
};

type CreateUserForm = {
  name: string;
  email: string;
  password: string;
  role: "admin" | "viewer";
};

const emptyCreateForm: CreateUserForm = {
  name: "",
  email: "",
  password: "",
  role: "viewer",
};

function approvalLabel(status: AdminUser["approval_status"]) {
  if (status === "approved") {
    return "Aprobado";
  }

  if (status === "rejected") {
    return "Rechazado";
  }

  return "Pendiente";
}

export default function AdminUsersPage() {
  const router = useRouter();
  const { loading, session, profile } = useAuth();
  const [users, setUsers] = React.useState<AdminUser[]>([]);
  const [createForm, setCreateForm] = React.useState<CreateUserForm>(emptyCreateForm);
  const [passwordByUser, setPasswordByUser] = React.useState<Record<string, string>>({});
  const [message, setMessage] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const canAdmin = profile?.role === "admin";

  const requestUsers = React.useCallback(async () => {
    if (!session?.access_token) {
      return;
    }

    const response = await fetch("/api/users", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const json = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(String(json.error ?? "No se pudo cargar usuarios."));
    }

    setUsers(json.users ?? []);
  }, [session?.access_token]);

  React.useEffect(() => {
    if (loading) {
      return;
    }

    if (!session) {
      router.replace("/login");
      return;
    }

    if (!canAdmin) {
      router.replace("/");
      return;
    }

    requestUsers().catch((error: unknown) => {
      setMessage(error instanceof Error ? error.message : "No se pudo cargar usuarios.");
    });
  }, [canAdmin, loading, requestUsers, router, session]);

  async function adminRequest(method: "POST" | "PATCH", payload: Record<string, unknown>) {
    if (!session?.access_token) {
      throw new Error("Necesitas iniciar sesion.");
    }

    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/users", {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });
      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(String(json.error ?? "No se pudo actualizar usuarios."));
      }

      await requestUsers();
      setMessage("Cambios guardados.");
    } finally {
      setBusy(false);
    }
  }

  async function createUser(event: React.FormEvent) {
    event.preventDefault();

    try {
      await adminRequest("POST", createForm);
      setCreateForm(emptyCreateForm);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "No se pudo crear usuario.");
    }
  }

  async function updateUser(payload: Record<string, unknown>) {
    try {
      await adminRequest("PATCH", payload);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar usuario.");
    }
  }

  return (
    <div className="dashboard-stack">
      <section className="surface-card hero padded">
        <p className="eyebrow">Administracion</p>
        <h2 className="section-title">Usuarios y permisos</h2>
        <p className="body-copy">
          Crea cuentas directas en Supabase Auth, aprueba solicitudes de acceso y controla roles o bloqueos internos.
        </p>
      </section>

      <section className="ops-grid">
        <article className="surface-card padded">
          <p className="eyebrow">Accesos</p>
          <h3 className="section-title">Crear usuario</h3>

          <form onSubmit={createUser} className="auth-form">
            <label className="field">
              Nombre
              <input
                className="field-input"
                value={createForm.name}
                onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Nombre completo"
              />
            </label>

            <label className="field">
              Correo
              <input
                className="field-input"
                type="email"
                value={createForm.email}
                onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))}
                placeholder="usuario@empresa.com"
              />
            </label>

            <label className="field">
              Contrasena inicial
              <input
                className="field-input"
                type="password"
                value={createForm.password}
                onChange={(event) => setCreateForm((current) => ({ ...current, password: event.target.value }))}
                placeholder="Minimo 8 caracteres"
              />
            </label>

            <label className="field">
              Rol
              <select
                className="field-input"
                value={createForm.role}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    role: event.target.value === "admin" ? "admin" : "viewer",
                  }))
                }
              >
                <option value="viewer">Visualizador</option>
                <option value="admin">Administrador</option>
              </select>
            </label>

            <button type="submit" disabled={busy} className="button primary">
              Crear usuario
            </button>
          </form>
        </article>

        <article className="surface-card padded">
          <p className="eyebrow">Solicitudes</p>
          <h3 className="section-title">Usuarios del sistema</h3>

          {message ? <p className="feedback">{message}</p> : null}

          <div className="admin-user-list">
            {users.map((account) => (
              <div key={account.user_id} className="admin-user-card">
                <div className="admin-user-heading">
                  <div>
                    <strong>{account.full_name || account.email}</strong>
                    <p className="muted-inline">{account.email}</p>
                  </div>
                  <div className="admin-user-badges">
                    <span className="header-session-pill">{account.role}</span>
                    <span className="header-session-pill">{account.active ? "Activo" : "Inactivo"}</span>
                    <span className="header-session-pill">{approvalLabel(account.approval_status)}</span>
                  </div>
                </div>

                <div className="admin-user-actions">
                  {account.approval_status === "pending" ? (
                    <button
                      type="button"
                      disabled={busy}
                      className="button primary"
                      onClick={() =>
                        void updateUser({
                          action: "update-approval-status",
                          user_id: account.user_id,
                          approval_status: "approved",
                        })
                      }
                    >
                      Aprobar
                    </button>
                  ) : null}

                  <label className="field">
                    Rol
                    <select
                      className="field-input"
                      value={account.role}
                      onChange={(event) =>
                        void updateUser({
                          action: "update-role",
                          user_id: account.user_id,
                          role: event.target.value,
                        })
                      }
                    >
                      <option value="viewer">Visualizador</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </label>

                  <button
                    type="button"
                    disabled={busy}
                    className="button"
                    onClick={() =>
                      void updateUser({
                        action: "toggle-active",
                        user_id: account.user_id,
                        active: !account.active,
                      })
                    }
                  >
                    {account.active ? "Desactivar" : "Activar"}
                  </button>

                  <label className="field">
                    Nueva contrasena
                    <input
                      className="field-input"
                      type="password"
                      value={passwordByUser[account.user_id] ?? ""}
                      onChange={(event) =>
                        setPasswordByUser((current) => ({
                          ...current,
                          [account.user_id]: event.target.value,
                        }))
                      }
                      placeholder="Minimo 8 caracteres"
                    />
                  </label>

                  <button
                    type="button"
                    disabled={busy}
                    className="button"
                    onClick={() =>
                      void updateUser({
                        action: "reset-password",
                        user_id: account.user_id,
                        password: passwordByUser[account.user_id] ?? "",
                      })
                    }
                  >
                    Actualizar clave
                  </button>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
