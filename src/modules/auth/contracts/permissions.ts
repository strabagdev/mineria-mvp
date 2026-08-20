export const PERMISSIONS = {
  RECORDS_VIEW: "records.view",
  RECORDS_CREATE: "records.create",
  RECORDS_EDIT: "records.edit",
  RECORDS_DELETE: "records.delete",
  CATALOG_DATA_READ: "catalog.data.read",
  CATALOG_VIEW: "catalog.view",
  CATALOG_MANAGE: "catalog.manage",
  REPORTS_VIEW: "reports.view",
  USERS_VIEW: "users.view",
  USERS_MANAGE: "users.manage",
  AUDIT_VIEW: "audit.view",
  OPERATIONAL_HEADER_DATA_READ: "operational_header.data.read",
  OPERATIONAL_HEADER_VIEW: "operational_header.view",
  OPERATIONAL_HEADER_MANAGE: "operational_header.manage",
  ASSIGNMENTS_VIEW: "assignments.view",
  ASSIGNMENTS_MANAGE: "assignments.manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const USER_PERMISSION_EFFECTS = {
  ALLOW: "allow",
  DENY: "deny",
} as const;

export type UserPermissionEffect =
  (typeof USER_PERMISSION_EFFECTS)[keyof typeof USER_PERMISSION_EFFECTS];

export type PermissionCapability =
  | "view"
  | "create"
  | "edit"
  | "delete"
  | "manage";

export type PermissionDescriptor = {
  permission: Permission;
  capability: PermissionCapability;
  label: string;
};

export type PermissionModuleDescriptor = {
  id: string;
  group: "operation" | "operational_configuration" | "information" | "administration";
  groupLabel: string;
  label: string;
  permissions: readonly PermissionDescriptor[];
};

export const PERMISSION_CAPABILITY_LABELS = {
  view: "Ver",
  create: "Crear",
  edit: "Editar",
  delete: "Eliminar",
  manage: "Administrar",
} as const satisfies Record<PermissionCapability, string>;

export const PERMISSION_MODULES = [
  {
    id: "records",
    group: "operation",
    groupLabel: "Operacion",
    label: "Registros",
    permissions: [
      { permission: PERMISSIONS.RECORDS_VIEW, capability: "view", label: "Ver registros" },
      { permission: PERMISSIONS.RECORDS_CREATE, capability: "create", label: "Crear registros" },
      { permission: PERMISSIONS.RECORDS_EDIT, capability: "edit", label: "Editar registros" },
      { permission: PERMISSIONS.RECORDS_DELETE, capability: "delete", label: "Eliminar registros" },
    ],
  },
  {
    id: "assignments",
    group: "operation",
    groupLabel: "Operacion",
    label: "Asignaciones",
    permissions: [
      { permission: PERMISSIONS.ASSIGNMENTS_VIEW, capability: "view", label: "Ver asignaciones" },
      {
        permission: PERMISSIONS.ASSIGNMENTS_MANAGE,
        capability: "manage",
        label: "Editar asignaciones",
      },
    ],
  },
  {
    id: "catalog",
    group: "operational_configuration",
    groupLabel: "Configuracion operacional",
    label: "Catalogo",
    permissions: [
      { permission: PERMISSIONS.CATALOG_DATA_READ, capability: "view", label: "Consumir datos del catalogo" },
      { permission: PERMISSIONS.CATALOG_VIEW, capability: "view", label: "Ver catalogo" },
      { permission: PERMISSIONS.CATALOG_MANAGE, capability: "manage", label: "Administrar catalogo" },
    ],
  },
  {
    id: "operational_header",
    group: "operational_configuration",
    groupLabel: "Configuracion operacional",
    label: "Cabecera operacional",
    permissions: [
      {
        permission: PERMISSIONS.OPERATIONAL_HEADER_DATA_READ,
        capability: "view",
        label: "Consumir datos de cabecera operacional",
      },
      {
        permission: PERMISSIONS.OPERATIONAL_HEADER_VIEW,
        capability: "view",
        label: "Ver cabecera operacional",
      },
      {
        permission: PERMISSIONS.OPERATIONAL_HEADER_MANAGE,
        capability: "manage",
        label: "Administrar cabecera operacional",
      },
    ],
  },
  {
    id: "reports",
    group: "information",
    groupLabel: "Informacion",
    label: "Reportes",
    permissions: [
      { permission: PERMISSIONS.REPORTS_VIEW, capability: "view", label: "Ver reportes" },
    ],
  },
  {
    id: "audit",
    group: "information",
    groupLabel: "Informacion",
    label: "Auditoria",
    permissions: [
      { permission: PERMISSIONS.AUDIT_VIEW, capability: "view", label: "Ver auditoria" },
    ],
  },
  {
    id: "users",
    group: "administration",
    groupLabel: "Administracion",
    label: "Usuarios",
    permissions: [
      { permission: PERMISSIONS.USERS_VIEW, capability: "view", label: "Ver usuarios" },
      { permission: PERMISSIONS.USERS_MANAGE, capability: "manage", label: "Administrar usuarios" },
    ],
  },
] as const satisfies readonly PermissionModuleDescriptor[];

export const ALL_PERMISSIONS = Object.values(PERMISSIONS);
