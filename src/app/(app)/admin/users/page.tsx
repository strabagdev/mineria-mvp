"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  CompactRow,
  DangerAction,
  EmptyState,
  PageHeader,
  Panel,
  PrimaryAction,
  SecondaryAction,
  SectionHeader,
  StatusBadge,
  UserAvatar,
} from "../../../../components/opcl";
import { useAuth } from "@/providers/auth-provider";
import { NETWORK_ERROR_MESSAGE, isBrowserOffline, subscribeNetworkStatus } from "@/lib/networkStatus";
import type { UserRole } from "@/modules/auth/application/auth-types";
import {
  deleteUserPermissionOverride,
  fetchUserPermissionSummary,
  getPermissionVisualState,
  setUserPermissionOverride,
  type UserPermissionSummaryDto,
} from "../../../../modules/auth/application/user-permissions.client";
import {
  PERMISSION_CAPABILITY_LABELS,
  PERMISSION_MODULES,
  PERMISSIONS,
  type Permission,
  type PermissionModuleDescriptor,
} from "../../../../modules/auth/contracts/permissions";
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

type UserStatusFilter = "all" | "active" | "inactive" | "pending" | "rejected";
type PermissionDraft = Partial<Record<Permission, boolean>>;

const emptyCreateForm: CreateUserForm = {
  name: "",
  email: "",
  password: "",
  role: "operator",
};

const PERMISSION_GROUPS = PERMISSION_MODULES.reduce(
  (groups, module) => {
    const existing = groups.find((group) => group.label === module.groupLabel);
    if (existing) {
      existing.modules.push(module);
      return groups;
    }

    groups.push({ label: module.groupLabel, modules: [module] });
    return groups;
  },
  [] as Array<{ label: string; modules: PermissionModuleDescriptor[] }>
);

const PERMISSION_DESCRIPTORS = PERMISSION_MODULES.flatMap((module) =>
  module.permissions.map((descriptor) => ({
    ...descriptor,
    moduleLabel: module.label,
  }))
);

const ROLE_ACCESS_SUMMARY: Record<UserRole, string> = {
  admin: "Acceso total",
  operator: "9 accesos",
  viewer: "5 accesos",
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

function approvalTone(status: AdminUser["approval_status"]) {
  if (status === "approved") {
    return "success" as const;
  }

  if (status === "rejected") {
    return "danger" as const;
  }

  return "warning" as const;
}

function accessTone(account: Pick<AdminUser, "role">, summary: UserPermissionSummaryDto | undefined) {
  if (account.role === "admin") {
    return "total" as const;
  }

  return summary?.overrides.length ? "partial" as const : "neutral" as const;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const { loading, session, profile } = useAuth();
  const offlineScope = React.useMemo(() => {
    const userId = profile?.user_id ?? session?.user?.id ?? null;
    return userId ? { userId } : null;
  }, [profile?.user_id, session?.user?.id]);
  const [users, setUsers] = React.useState<AdminUser[]>([]);
  const [selectedPermissionUser, setSelectedPermissionUser] = React.useState<AdminUser | null>(null);
  const [permissionSummary, setPermissionSummary] = React.useState<UserPermissionSummaryDto | null>(null);
  const [permissionSummaryByUser, setPermissionSummaryByUser] = React.useState<Record<string, UserPermissionSummaryDto>>({});
  const [selectedUserId, setSelectedUserId] = React.useState<string | null>(null);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<UserStatusFilter>("all");
  const [createModalOpen, setCreateModalOpen] = React.useState(false);
  const [passwordModalUser, setPasswordModalUser] = React.useState<AdminUser | null>(null);
  const [permissionDraft, setPermissionDraft] = React.useState<PermissionDraft>({});
  const [createForm, setCreateForm] = React.useState<CreateUserForm>(emptyCreateForm);
  const [passwordByUser, setPasswordByUser] = React.useState<Record<string, string>>({});
  const [message, setMessage] = React.useState("");
  const [permissionMessage, setPermissionMessage] = React.useState("");
  const [offlineUpdatedAt, setOfflineUpdatedAt] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [permissionsBusy, setPermissionsBusy] = React.useState(false);
  const [refreshNonce, setRefreshNonce] = React.useState(0);
  const [canManageUsers, setCanManageUsers] = React.useState<boolean | null>(null);

  const isBaseAdmin = profile?.role === "admin";

  const closePermissionsModal = React.useCallback(() => {
    setSelectedPermissionUser(null);
    setPermissionSummary(null);
    setPermissionMessage("");
    setPermissionDraft({});
  }, []);

  const closeCreateModal = React.useCallback(() => {
    setCreateModalOpen(false);
    setCreateForm(emptyCreateForm);
  }, []);

  const pendingUsers = React.useMemo(
    () => users.filter((account) => account.approval_status === "pending"),
    [users]
  );

  const filteredUsers = React.useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return users.filter((account) => {
      const matchesSearch =
        !normalizedSearch ||
        (account.full_name ?? "").toLowerCase().includes(normalizedSearch) ||
        account.email.toLowerCase().includes(normalizedSearch);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && account.active) ||
        (statusFilter === "inactive" && !account.active) ||
        statusFilter === account.approval_status;

      return matchesSearch && matchesStatus;
    });
  }, [searchTerm, statusFilter, users]);

  const selectedUser = React.useMemo(() => {
    return users.find((account) => account.user_id === selectedUserId) ?? filteredUsers[0] ?? users[0] ?? null;
  }, [filteredUsers, selectedUserId, users]);

  const selectedUserSummary = selectedUser ? permissionSummaryByUser[selectedUser.user_id] : null;

  const permissionDraftChanges = React.useMemo(() => {
    if (!permissionSummary) {
      return 0;
    }

    return PERMISSION_DESCRIPTORS.filter((descriptor) => {
      const current = permissionSummary.effective_permissions.includes(descriptor.permission);
      return permissionDraft[descriptor.permission] !== undefined && permissionDraft[descriptor.permission] !== current;
    }).length;
  }, [permissionDraft, permissionSummary]);

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
    const cached = offlineScope ? await readAdminUsersSnapshot(offlineScope) : null;
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
    if (offlineScope) {
      void saveAdminUsersSnapshot(nextUsers, offlineScope);
    }
  }, [offlineScope, session?.access_token]);

  React.useEffect(() => {
    if (loading) {
      return;
    }

    if (!session || !profile) {
      router.replace("/login");
      return;
    }

    if (isBaseAdmin) {
      setCanManageUsers(true);
      return;
    }

    if (!session?.access_token || !profile?.user_id) {
      router.replace("/");
      return;
    }

    fetchUserPermissionSummary(profile.user_id, session.access_token)
      .then((summary) => {
        if (summary.effective_permissions.includes(PERMISSIONS.USERS_MANAGE)) {
          setCanManageUsers(true);
          return;
        }
        router.replace("/");
      })
      .catch(() => {
        router.replace("/");
      });
  }, [isBaseAdmin, loading, profile, profile?.user_id, router, session, session?.access_token]);

  React.useEffect(() => {
    if (loading || canManageUsers !== true) {
      return;
    }

    requestUsers().catch((error: unknown) => {
      const networkMessage = toNetworkMessage(error);
      if (networkMessage || canUseOfflineSnapshot()) {
        if (!offlineScope) {
          setMessage(NETWORK_ERROR_MESSAGE);
          return;
        }

        void readAdminUsersSnapshot(offlineScope).then((cached) => {
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
  }, [canManageUsers, loading, offlineScope, refreshNonce, requestUsers]);

  React.useEffect(() => {
    if (!users.length) {
      setSelectedUserId(null);
      return;
    }

    if (!selectedUserId || !users.some((account) => account.user_id === selectedUserId)) {
      setSelectedUserId(users[0].user_id);
    }
  }, [selectedUserId, users]);

  React.useEffect(() => {
    if (!selectedPermissionUser) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closePermissionsModal();
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [closePermissionsModal, selectedPermissionUser]);

  React.useEffect(() => {
    if (!createModalOpen) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeCreateModal();
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [closeCreateModal, createModalOpen]);

  React.useEffect(() => {
    if (!passwordModalUser) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPasswordModalUser(null);
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [passwordModalUser]);

  React.useEffect(() => {
    if (
      !selectedUser ||
      !session?.access_token ||
      canManageUsers !== true ||
      permissionSummaryByUser[selectedUser.user_id] ||
      canUseOfflineSnapshot()
    ) {
      return;
    }

    let cancelled = false;
    fetchUserPermissionSummary(selectedUser.user_id, session.access_token)
      .then((summary) => {
        if (!cancelled) {
          setPermissionSummaryByUser((current) => ({ ...current, [selectedUser.user_id]: summary }));
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [canManageUsers, permissionSummaryByUser, selectedUser, session?.access_token]);

  React.useEffect(() => {
    if (!selectedPermissionUser) {
      return;
    }

    const refreshedUser = users.find((account) => account.user_id === selectedPermissionUser.user_id);
    if (!refreshedUser) {
      setSelectedPermissionUser(null);
      setPermissionSummary(null);
      return;
    }

    if (
      refreshedUser.email !== selectedPermissionUser.email ||
      refreshedUser.full_name !== selectedPermissionUser.full_name ||
      refreshedUser.role !== selectedPermissionUser.role ||
      refreshedUser.active !== selectedPermissionUser.active ||
      refreshedUser.approval_status !== selectedPermissionUser.approval_status
    ) {
      setSelectedPermissionUser(refreshedUser);
    }
  }, [selectedPermissionUser, users]);

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

  async function loadUserPermissions(account: AdminUser) {
    if (!session?.access_token) {
      setPermissionMessage("Necesitas iniciar sesion.");
      return;
    }

    setSelectedPermissionUser(account);
    setPermissionSummary(null);
    setPermissionMessage("");
    setPermissionsBusy(true);

    try {
      if (canUseOfflineSnapshot()) {
        throw new Error(NETWORK_ERROR_MESSAGE);
      }

      const summary = await fetchUserPermissionSummary(account.user_id, session.access_token);
      setPermissionSummary(summary);
      setPermissionSummaryByUser((current) => ({ ...current, [account.user_id]: summary }));
      setPermissionDraft(Object.fromEntries(
        PERMISSION_DESCRIPTORS.map((descriptor) => [
          descriptor.permission,
          summary.effective_permissions.includes(descriptor.permission),
        ])
      ));
    } catch (error: unknown) {
      setPermissionMessage(toNetworkMessage(error) || "No se pudo cargar permisos del usuario.");
    } finally {
      setPermissionsBusy(false);
    }
  }

  async function createUser(event: React.FormEvent) {
    event.preventDefault();

    try {
      await adminRequest("POST", createForm);
      setCreateForm(emptyCreateForm);
      setCreateModalOpen(false);
    } catch (error: unknown) {
      setMessage(toNetworkMessage(error) || "No se pudo crear usuario.");
    }
  }

  async function updateUser(payload: Record<string, unknown>) {
    try {
      const selectedUser = selectedPermissionUser;
      await adminRequest("PATCH", payload);
      if (selectedUser && payload.user_id === selectedUser.user_id) {
        await loadUserPermissions(selectedUser);
      }
    } catch (error: unknown) {
      setMessage(toNetworkMessage(error) || "No se pudo actualizar usuario.");
    }
  }

  async function savePermissionChanges() {
    if (!selectedPermissionUser || !session?.access_token) {
      setPermissionMessage("Necesitas iniciar sesion.");
      return;
    }

    setPermissionsBusy(true);
    setPermissionMessage("");

    try {
      let summary = permissionSummary;
      if (!summary) {
        summary = await fetchUserPermissionSummary(selectedPermissionUser.user_id, session.access_token);
      }

      for (const descriptor of PERMISSION_DESCRIPTORS) {
        const permission = descriptor.permission;
        const desired = permissionDraft[permission] ?? summary.effective_permissions.includes(permission);
        const inherited = summary.base_permissions.includes(permission);
        const current = summary.effective_permissions.includes(permission);
        const override = summary.overrides.find((item) => item.permission === permission);

        if (desired === current && (!override || desired !== inherited)) {
          continue;
        }

        if (desired === inherited) {
          summary = await deleteUserPermissionOverride({
            userId: selectedPermissionUser.user_id,
            permission,
            accessToken: session.access_token,
          });
          continue;
        }

        summary = await setUserPermissionOverride({
          userId: selectedPermissionUser.user_id,
          permission,
          effect: desired ? "allow" : "deny",
          accessToken: session.access_token,
        });
      }

      setPermissionSummary(summary);
      setPermissionSummaryByUser((current) => ({ ...current, [selectedPermissionUser.user_id]: summary }));
      setPermissionDraft(Object.fromEntries(
        PERMISSION_DESCRIPTORS.map((descriptor) => [
          descriptor.permission,
          summary.effective_permissions.includes(descriptor.permission),
        ])
      ));
      setPermissionMessage("Cambios de accesos guardados.");
    } catch (error: unknown) {
      setPermissionMessage(toNetworkMessage(error) || "No se pudo guardar los cambios de accesos.");
    } finally {
      setPermissionsBusy(false);
    }
  }

  function getAccessSummary(account: AdminUser) {
    if (account.role === "admin") {
      return "Acceso total";
    }

    const summary = permissionSummaryByUser[account.user_id];
    if (!summary) {
      return ROLE_ACCESS_SUMMARY[account.role];
    }

    return `${summary.effective_permissions.length} accesos`;
  }

  function getEnabledAccessModules(summary: UserPermissionSummaryDto | null) {
    if (!summary) {
      return [];
    }

    return PERMISSION_MODULES.map((module) => ({
      id: module.id,
      label: module.label,
      capabilities: module.permissions
        .filter((descriptor) => summary.effective_permissions.includes(descriptor.permission))
        .map((descriptor) => PERMISSION_CAPABILITY_LABELS[descriptor.capability]),
    })).filter((module) => module.capabilities.length > 0);
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
    <div className="admin-users-page">
      <PageHeader
        title="Usuarios y permisos"
        description="Gestiona usuarios, permisos y solicitudes de acceso."
        action={(
          <PrimaryAction type="button" disabled={busy} onClick={() => setCreateModalOpen(true)}>
          Crear usuario
          </PrimaryAction>
        )}
      />

      <section className="admin-users-workspace" aria-label="Administracion de usuarios y permisos">
        <Panel className="admin-users-directory">
          <SectionHeader
            title="Usuarios"
            meta={<StatusBadge tone="info">{filteredUsers.length} visibles</StatusBadge>}
          />

          <div className="admin-users-filters">
            <label className="field">
              Buscar
              <input
                className="field-input"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Nombre o correo"
              />
            </label>
            <label className="field">
              Estado
              <select
                className="field-input"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as UserStatusFilter)}
              >
                <option value="all">Todos</option>
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
                <option value="pending">Pendientes</option>
                <option value="rejected">Rechazados</option>
              </select>
            </label>
          </div>

          {message ? <p className="feedback">{message}</p> : null}
          {offlineUpdatedAt ? (
            <p className="feedback">
              Datos offline. Ultima sincronizacion: {new Date(offlineUpdatedAt).toLocaleString("es-CL")}
            </p>
          ) : null}

          <div className="admin-user-compact-list" aria-label="Listado compacto de usuarios">
            {filteredUsers.length ? (
              filteredUsers.map((account) => (
                <CompactRow
                  key={account.user_id}
                  type="button"
                  selected={selectedUser?.user_id === account.user_id}
                  className="admin-user-row"
                  onClick={() => setSelectedUserId(account.user_id)}
                >
                  <span className="admin-user-row-identity">
                    <UserAvatar name={account.full_name} email={account.email} userId={account.user_id} />
                    <span className="admin-user-row-main">
                      <strong>{account.full_name || account.email}</strong>
                      <span>{account.email}</span>
                    </span>
                  </span>
                  <span className="admin-user-row-meta">
                    <StatusBadge tone={account.active ? "success" : "neutral"}>{account.active ? "Activo" : "Inactivo"}</StatusBadge>
                    <StatusBadge tone={approvalTone(account.approval_status)}>{approvalLabel(account.approval_status)}</StatusBadge>
                    <StatusBadge tone={accessTone(account, permissionSummaryByUser[account.user_id])}>{getAccessSummary(account)}</StatusBadge>
                  </span>
                </CompactRow>
              ))
            ) : (
              <EmptyState>No hay usuarios para los filtros actuales.</EmptyState>
            )}
          </div>
        </Panel>

        <Panel className="admin-user-detail-panel">
          {selectedUser ? (
            <>
              <SectionHeader
                title="Detalle"
                meta={<StatusBadge tone={accessTone(selectedUser, selectedUserSummary ?? undefined)}>{getAccessSummary(selectedUser)}</StatusBadge>}
              />
              <div className="admin-detail-heading">
                <div className="admin-detail-identity">
                  <UserAvatar
                    name={selectedUser.full_name}
                    email={selectedUser.email}
                    userId={selectedUser.user_id}
                    size="detail"
                  />
                  <div>
                    <h3 className="section-title">{selectedUser.full_name || selectedUser.email}</h3>
                    <p className="body-copy">{selectedUser.email}</p>
                  </div>
                </div>
                <PrimaryAction
                  type="button"
                  disabled={busy}
                  onClick={() => void loadUserPermissions(selectedUser)}
                >
                  Administrar accesos
                </PrimaryAction>
              </div>

              <div className="admin-user-badges">
                <StatusBadge tone={selectedUser.active ? "success" : "neutral"}>
                  {selectedUser.active ? "Activo" : "Inactivo"}
                </StatusBadge>
                <StatusBadge tone={approvalTone(selectedUser.approval_status)}>
                  {approvalLabel(selectedUser.approval_status)}
                </StatusBadge>
                <StatusBadge tone={accessTone(selectedUser, selectedUserSummary ?? undefined)}>
                  {selectedUserSummary
                    ? `${selectedUserSummary.effective_permissions.length} accesos`
                    : getAccessSummary(selectedUser)}
                </StatusBadge>
              </div>

              <section className="admin-detail-section">
                <h4>Accesos efectivos</h4>
                <div className="admin-access-chip-list" aria-label="Accesos efectivos del usuario seleccionado">
                  {getEnabledAccessModules(selectedUserSummary).length ? (
                    getEnabledAccessModules(selectedUserSummary).map((module) => (
                      <div key={module.id} className="admin-access-chip-row">
                        <span>{module.label}</span>
                        <strong>{module.capabilities.join(" · ")}</strong>
                      </div>
                    ))
                  ) : selectedUser.role === "admin" ? (
                    <EmptyState>Acceso total a la plataforma.</EmptyState>
                  ) : (
                    <EmptyState>Los accesos se cargan al seleccionar el usuario.</EmptyState>
                  )}
                </div>
              </section>

              <section className="admin-detail-section">
                <h4>Administracion de cuenta</h4>
                <div className="admin-detail-actions" aria-label="Acciones administrativas del usuario">
                  {selectedUser.approval_status === "pending" ? (
                    <PrimaryAction
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void updateUser({
                          action: "update-approval-status",
                          user_id: selectedUser.user_id,
                          approval_status: "approved",
                        })
                      }
                    >
                      Aprobar solicitud
                    </PrimaryAction>
                  ) : null}

                  <SecondaryAction
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void updateUser({
                        action: "toggle-active",
                        user_id: selectedUser.user_id,
                        active: !selectedUser.active,
                      })
                    }
                  >
                    {selectedUser.active ? "Desactivar" : "Reactivar"}
                  </SecondaryAction>

                  <SecondaryAction
                    type="button"
                    disabled={busy}
                    onClick={() => setPasswordModalUser(selectedUser)}
                  >
                    Actualizar contrasena
                  </SecondaryAction>

                  {selectedUser.deletion_eligible ? (
                    <DangerAction
                      type="button"
                      disabled={busy}
                      onClick={() => void deleteUser(selectedUser)}
                      title="Solo disponible para usuarios sin historial operacional"
                    >
                      Eliminar definitivamente
                    </DangerAction>
                  ) : null}
                </div>
              </section>
            </>
          ) : (
            <EmptyState>Selecciona un usuario para ver el detalle.</EmptyState>
          )}
        </Panel>

        <Panel as="aside" className="admin-access-requests">
          <SectionHeader
            title="Solicitudes de acceso"
            meta={<StatusBadge tone={pendingUsers.length ? "warning" : "neutral"}>{pendingUsers.length}</StatusBadge>}
          />

          {pendingUsers.length ? (
            <div className="admin-request-list" aria-label="Solicitudes de acceso pendientes">
              {pendingUsers.map((account) => (
                <div key={account.user_id} className="admin-request-row">
                  <div>
                    <strong>{account.full_name || account.email}</strong>
                    <p className="muted-inline">{account.email}</p>
                  </div>
                  <div className="admin-request-actions">
                    <SecondaryAction
                      type="button"
                      className="compact"
                      onClick={() => setSelectedUserId(account.user_id)}
                    >
                      Ver
                    </SecondaryAction>
                    <PrimaryAction
                      type="button"
                      disabled={busy}
                      className="compact"
                      onClick={() =>
                        void updateUser({
                          action: "update-approval-status",
                          user_id: account.user_id,
                          approval_status: "approved",
                        })
                      }
                    >
                      Aprobar
                    </PrimaryAction>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState>No hay solicitudes pendientes</EmptyState>
          )}
        </Panel>
      </section>

      {createModalOpen ? (
        <div className="modal-backdrop opcl-modal-backdrop" role="presentation" onClick={closeCreateModal}>
          <section
            className="modal-card create-user-modal opcl-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-user-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">Nueva cuenta</p>
                <h3 id="create-user-title" className="section-title">Crear usuario</h3>
              </div>
              <SecondaryAction type="button" onClick={closeCreateModal}>
                Cerrar
              </SecondaryAction>
            </div>

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

              <div className="modal-actions">
                <SecondaryAction type="button" onClick={closeCreateModal} disabled={busy}>
                  Cancelar
                </SecondaryAction>
                <PrimaryAction type="submit" disabled={busy}>
                  Crear usuario
                </PrimaryAction>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {passwordModalUser ? (
        <div className="modal-backdrop opcl-modal-backdrop" role="presentation" onClick={() => setPasswordModalUser(null)}>
          <section
            className="modal-card create-user-modal opcl-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="password-user-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">Cuenta</p>
                <h3 id="password-user-title" className="section-title">Actualizar contrasena</h3>
                <p className="body-copy">{passwordModalUser.email}</p>
              </div>
              <SecondaryAction type="button" onClick={() => setPasswordModalUser(null)}>
                Cerrar
              </SecondaryAction>
            </div>

            <form
              className="auth-form"
              onSubmit={(event) => {
                event.preventDefault();
                void adminRequest("PATCH", {
                  action: "reset-password",
                  user_id: passwordModalUser.user_id,
                  password: passwordByUser[passwordModalUser.user_id] ?? "",
                })
                  .then(() => setPasswordModalUser(null))
                  .catch((error: unknown) => {
                    setMessage(toNetworkMessage(error) || "No se pudo actualizar usuario.");
                  });
              }}
            >
              <label className="field">
                Nueva contrasena
                <input
                  className="field-input"
                  type="password"
                  value={passwordByUser[passwordModalUser.user_id] ?? ""}
                  onChange={(event) =>
                    setPasswordByUser((current) => ({
                      ...current,
                      [passwordModalUser.user_id]: event.target.value,
                    }))
                  }
                  placeholder="Minimo 8 caracteres"
                />
              </label>

              <div className="modal-actions">
                <SecondaryAction type="button" onClick={() => setPasswordModalUser(null)} disabled={busy}>
                  Cancelar
                </SecondaryAction>
                <PrimaryAction type="submit" disabled={busy}>
                  Actualizar contrasena
                </PrimaryAction>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {selectedPermissionUser ? (
        <div className="modal-backdrop opcl-modal-backdrop" role="presentation" onClick={closePermissionsModal}>
          <section
            className="modal-card access-admin-modal opcl-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="access-admin-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="access-modal-header">
              <div>
                <h3 id="access-admin-title" className="section-title">Administrar accesos</h3>
                <p className="body-copy">
                  {selectedPermissionUser.full_name || selectedPermissionUser.email} · {selectedPermissionUser.email}
                </p>
              </div>
              {selectedPermissionUser.role === "admin" ? (
                <StatusBadge tone="total">Acceso total</StatusBadge>
              ) : permissionSummary ? (
                <StatusBadge tone={permissionSummary.overrides.length ? "partial" : "info"}>
                  {permissionSummary.effective_permissions.length} accesos habilitados
                </StatusBadge>
              ) : null}
            </div>

            <div className="access-modal-body">
              {permissionMessage ? <p className="feedback">{permissionMessage}</p> : null}
              {selectedPermissionUser.role === "admin" ? (
                <div className="access-superadmin-state">
                  <strong>Superadministrador</strong>
                  <p>Este usuario tiene acceso total a la plataforma.</p>
                </div>
              ) : null}

              {!permissionSummary ? (
                <EmptyState>{permissionsBusy ? "Cargando permisos..." : "Sin permisos cargados."}</EmptyState>
              ) : selectedPermissionUser.role === "admin" ? null : (
                <div className="access-toggle-list">
                  {PERMISSION_GROUPS.map((group) => (
                    <section key={group.label} className="access-toggle-group">
                      <h4>{group.label}</h4>
                      {group.modules.map((module) => (
                        <div key={module.id} className="access-toggle-module">
                          <h5>{module.label}</h5>
                          {module.permissions.map((descriptor) => {
                            const state = getPermissionVisualState(permissionSummary, descriptor.permission);
                            const enabled =
                              permissionDraft[descriptor.permission] ?? state.effective;

                            return (
                              <label key={descriptor.permission} className="access-toggle-row">
                                <span>
                                  <strong>{PERMISSION_CAPABILITY_LABELS[descriptor.capability]}</strong>
                                  {state.inherited ? <small>Incluido en acceso base</small> : null}
                                </span>
                                <input
                                  type="checkbox"
                                  role="switch"
                                  checked={enabled}
                                  disabled={permissionsBusy}
                                  aria-label={`${descriptor.label} de ${selectedPermissionUser.email}`}
                                  onChange={(event) =>
                                    setPermissionDraft((current) => ({
                                      ...current,
                                      [descriptor.permission]: event.target.checked,
                                    }))
                                  }
                                />
                              </label>
                            );
                          })}
                        </div>
                      ))}
                    </section>
                  ))}
                </div>
              )}
            </div>

            <div className="access-modal-footer">
              <span className="muted-inline">
                {permissionDraftChanges > 0 ? `${permissionDraftChanges} cambios sin guardar` : "Sin cambios pendientes"}
              </span>
              <div className="modal-actions">
                <SecondaryAction type="button" onClick={closePermissionsModal} disabled={permissionsBusy}>
                  Cancelar
                </SecondaryAction>
                {selectedPermissionUser.role === "admin" ? null : (
                  <PrimaryAction
                    type="button"
                    disabled={permissionsBusy || !permissionSummary || permissionDraftChanges === 0}
                    onClick={() => void savePermissionChanges()}
                  >
                    Guardar cambios
                  </PrimaryAction>
                )}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
