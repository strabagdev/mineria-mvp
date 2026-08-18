export {
  APPROVAL_STATUS,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  USER_ROLES,
  getEffectivePermissionsForProfile,
  getPermissionsForRole,
  hasPermission,
  isPermission,
  requireAdminUser,
  requireApprovedUser,
  requireOperationalUser,
  requirePermission,
  resolvePermission,
  resolveApprovalStatus,
  resolveRole,
  syncProfileForAuthUser,
} from "@/server/services/access.service";

export type {
  AppProfile,
  ApprovalStatus,
  Permission,
  ProfileSyncResult,
  UserPermissionOverride,
  UserRole,
} from "@/server/services/access.service";
