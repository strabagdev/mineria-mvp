export {
  APPROVAL_STATUS,
  USER_ROLES,
  requireAdminUser,
  requireApprovedUser,
  resolveApprovalStatus,
  resolveRole,
  syncProfileForAuthUser,
} from "@/server/services/access.service";

export type {
  AppProfile,
  ApprovalStatus,
  ProfileSyncResult,
  UserRole,
} from "@/server/services/access.service";
