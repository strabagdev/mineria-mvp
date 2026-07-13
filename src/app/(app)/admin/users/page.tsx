"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { NETWORK_ERROR_MESSAGE, isBrowserOffline, subscribeNetworkStatus } from "@/lib/networkStatus";
import type { UserRole } from "@/modules/auth/application/auth-types";
import { USER_ROLE_OPTIONS, toUserRole } from "@/modules/auth/presentation/role-options";
import { toRoleLabel } from "@/modules/auth/presentation/role-labels";
import {
  canUseOfflineSnapshot,
  markSnapshotRefreshSucceeded,
  readAdminUsersSnapshot,
  saveAdminUsersSnapshot,
  toNetworkMessage,
} from "@/lib/reportsOfflineSnapshot";

type AdminUser = {
  user_id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  active: boolean;
  approval_status: "pending" | "approved" | "rejected";
  created_at?: string;
  deletion_eligible?: boolean;
};

type CreateUserForm = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
};

const emptyCreateForm: CreateUserForm = {
  name: "",
  email: "",
  password: "",
  role: "operator",
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
  const [offlineUpdatedAt, setOfflineUpdatedAt] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [refreshNonce, setRefreshNonce] = React.useState(0);

  const canAdmin = profile?.role === "admin";

  React.useEffect(() => {
    function refreshWhenOnline() {
      if (!isBrowserOffline()) {
        setRefreshNonce((current) => current + 1);
      }
    }

    const unsubscribeNetworkStatus = subscribeNetworkStatus(refreshWhenOnline);

    return () => {
      unsubscribeNetworkStatus();
    };
  }, []);

  const requestUsers = React.useCallback(async () => {
    const cached = await readAdminUsersSnapshot();
    if (cached?.value) {
      setUsers(cached.value);
      setOfflineUpdatedAt(cached.updatedAt);
    }

    if (canUseOfflineSnapshot()) {
      if (cached?.value) {
        setMessage("Mostrando ultimo listado de usuarios disponible en modo offline.");
        return;
      }
      throw new Error(NETWORK_ERROR_MESSAGE);
    }

    if (!session?.access_token) {
      setMessage(NETWORK_ERROR_MESSAGE);
      return;
    }

    const response = await fetch("/api/users", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const json = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(String(json.error ?? "No se pudo cargar usuarios."));
    }

    const nextUsers = json.users ?? [];
    setUsers(nextUsers);
    setOfflineUpdatedAt(null);
    markSnapshotRefreshSucceeded();
    void saveAdminUsersSnapshot(nextUsers);
  }, [session?.access_token]);

  React.useEffect(() => {
    if (loading) {
      return;
    }

    if (!session && !profile) {
      router.replace("/login");
      return;
    }

    if (!canAdmin) {
      router.replace("/");
      return;
    }

    requestUsers().catch((error: unknown) => {
      const networkMessage = toNetworkMessage(error);
      if (networkMessage || canUseOfflineSnapshot()) {
        void readAdminUsersSnapshot().then((cached) => {
          if (cached?.value) {
            setUsers(cached.value);
            setOfflineUpdatedAt(cached.updatedAt);
            setMessage("Mostrando ultimo listado de usuarios disponible en modo offline.");
            return;
          }
          setMessage(NETWORK_ERROR_MESSAGE);
        });
        return;
      }
      setMessage("No se pudo cargar usuarios.");
    });
  }, [canAdmin, loading, profile, refreshNonce, requestUsers, router, session]);

  async function adminRequest(method: "POST" | "PATCH" | "DELETE", payload: Record<string, unknown>) {
    if (!session?.access_token) {
      throw new Error("Necesitas iniciar sesion.");
    }

    setBusy(true);
    setMessage("");

    try {
      if (canUseOfflineSnapshot()) {
        throw new Error(NETWORK_ERROR_MESSAGE);
      }

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
      setMessage(toNetworkMessage(error) || "No se pudo crear usuario.");
    }
  }

  async function updateUser(payload: Record<string, unknown>) {
    try {
      await adminRequest("PATCH", payload);
    } catch (error: unknown) {
      setMessage(toNetworkMessage(error) || "No se pudo actualizar usuario.");
    }
  }

  async function deleteUser(account: AdminUser) {
    const confirmation = window.prompt(
      `Se eliminará la identidad y el perfil de este usuario. Esta acción no se puede deshacer.\n\nEscribe ${account.email} para confirmar.`
    );

    if (confirmation !== account.email) {
      setMessage("Eliminacion cancelada.");
      return;
    }

    try {
      await adminRequest("DELETE", { user_id: account.user_id });
      setMessage("Usuario eliminado definitivamente.");
    } catch (error: unknown) {
      setMessage(toNetworkMessage(error) || "No se pudo eliminar usuario.");
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
                    role: toUserRole(event.target.value),
                  }))
                }
              >
                {USER_ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
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
          {offlineUpdatedAt ? (
            <p className="feedback">
              Datos offline. Ultima sincronizacion: {new Date(offlineUpdatedAt).toLocaleString("es-CL")}
            </p>
          ) : null}

          <div className="admin-user-list">
            {users.map((account) => (
              <div key={account.user_id} className="admin-user-card">
                <div className="admin-user-heading">
                  <div>
                    <strong>{account.full_name || account.email}</strong>
                    <p className="muted-inline">{account.email}</p>
                  </div>
                  <div className="admin-user-badges">
                    <span className="session-pill">{toRoleLabel(account.role)}</span>
                    <span className="session-pill">{account.active ? "Activo" : "Inactivo"}</span>
                    <span className="session-pill">{approvalLabel(account.approval_status)}</span>
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
                          role: toUserRole(event.target.value),
                        })
                      }
                    >
                      {USER_ROLE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
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

                  {account.deletion_eligible ? (
                    <div className="field">
                      <span className="muted-inline">Solo para usuarios sin historial.</span>
                      <button
                        type="button"
                        disabled={busy}
                        className="button danger"
                        onClick={() => void deleteUser(account)}
                        title="Solo disponible para usuarios sin historial operacional"
                      >
                        Eliminar definitivamente
                      </button>
                    </div>
                  ) : null}

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
