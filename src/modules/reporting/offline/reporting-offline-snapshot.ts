"use client";

import {
  type OfflineStorageScope,
  readKeyValueCache,
  saveKeyValueCache,
} from "../../../lib/localOfflineStore";
import {
  NETWORK_ERROR_MESSAGE,
  isBrowserOffline,
  isNetworkRequestError,
  probeNetworkRestored,
} from "../../../lib/networkStatus";
import { recordOperationalEvent } from "../../../lib/observability/logger";
import type { ReportFilters, ReportResponse } from "../contracts/reporting";
import { buildReportQuery } from "../presentation/reporting-helpers";

export type ReportsCatalog = {
  categories: Array<{ slug: "actividad" | "interferencia"; label: string; types: Array<{ id: number; label: string }> }>;
  levels: Array<{ id: number; label: string }>;
};

type SnapshotEnvelope<T> = {
  value: T;
  updatedAt: string;
};

const REPORTS_CATALOG_KEY = "reports-catalog-v1";
const REPORTS_DATA_PREFIX = "reports-data-v1-";
const ADMIN_USERS_KEY = "admin-users-v1";

export function toNetworkMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (isNetworkRequestError(error) || /fetch|network|conexion|conexión/i.test(message)) {
    return NETWORK_ERROR_MESSAGE;
  }
  return "";
}

function reportKey(filters: ReportFilters) {
  return `${REPORTS_DATA_PREFIX}${buildReportQuery(filters)}`;
}

export async function saveCatalogSnapshot(catalog: ReportsCatalog, scope?: OfflineStorageScope) {
  const envelope: SnapshotEnvelope<ReportsCatalog> = { value: catalog, updatedAt: new Date().toISOString() };
  await saveKeyValueCache(REPORTS_CATALOG_KEY, envelope, scope);
  recordOperationalEvent({
    name: "offline.snapshot_saved",
    source: "reportsOfflineSnapshot",
    metadata: { dataset: "reports-catalog" },
  });
}

export async function readCatalogSnapshot(scope?: OfflineStorageScope) {
  const cached = await readKeyValueCache<SnapshotEnvelope<ReportsCatalog>>(REPORTS_CATALOG_KEY, scope).catch(() => null);
  return cached?.value ?? null;
}

export async function saveReportSnapshot(
  filters: ReportFilters,
  report: ReportResponse,
  scope?: OfflineStorageScope
) {
  const envelope: SnapshotEnvelope<ReportResponse> = { value: report, updatedAt: new Date().toISOString() };
  await saveKeyValueCache(reportKey(filters), envelope, scope);
  recordOperationalEvent({
    name: "offline.snapshot_saved",
    source: "reportsOfflineSnapshot",
    metadata: { dataset: "reports-data" },
  });
}

export async function readReportSnapshot(filters: ReportFilters, scope?: OfflineStorageScope) {
  const cached = await readKeyValueCache<SnapshotEnvelope<ReportResponse>>(reportKey(filters), scope).catch(() => null);
  return cached?.value ?? null;
}

export function canUseOfflineSnapshot() {
  return isBrowserOffline();
}

export function markSnapshotRefreshSucceeded() {
  void probeNetworkRestored();
}

export type AdminUsersSnapshot = Array<{
  user_id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "operator" | "viewer";
  active: boolean;
  approval_status: "pending" | "approved" | "rejected";
  created_at?: string;
}>;

export async function saveAdminUsersSnapshot(users: AdminUsersSnapshot, scope?: OfflineStorageScope) {
  const envelope: SnapshotEnvelope<AdminUsersSnapshot> = { value: users, updatedAt: new Date().toISOString() };
  await saveKeyValueCache(ADMIN_USERS_KEY, envelope, scope);
  recordOperationalEvent({
    name: "offline.snapshot_saved",
    source: "reportsOfflineSnapshot",
    metadata: { dataset: "admin-users" },
  });
}

export async function readAdminUsersSnapshot(scope?: OfflineStorageScope) {
  const cached = await readKeyValueCache<SnapshotEnvelope<AdminUsersSnapshot>>(ADMIN_USERS_KEY, scope).catch(() => null);
  return cached?.value ?? null;
}
