"use client";

import { readKeyValueCache, saveKeyValueCache } from "@/lib/localOfflineStore";
import { NETWORK_ERROR_MESSAGE, isBrowserOffline, isNetworkRequestError, markNetworkRestored } from "@/lib/networkStatus";
import { buildReportQuery, type ReportFilters, type ReportResponse } from "@/lib/reports";

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

export async function saveCatalogSnapshot(catalog: ReportsCatalog) {
  const envelope: SnapshotEnvelope<ReportsCatalog> = { value: catalog, updatedAt: new Date().toISOString() };
  await saveKeyValueCache(REPORTS_CATALOG_KEY, envelope);
}

export async function readCatalogSnapshot() {
  const cached = await readKeyValueCache<SnapshotEnvelope<ReportsCatalog>>(REPORTS_CATALOG_KEY).catch(() => null);
  return cached?.value ?? null;
}

export async function saveReportSnapshot(filters: ReportFilters, report: ReportResponse) {
  const envelope: SnapshotEnvelope<ReportResponse> = { value: report, updatedAt: new Date().toISOString() };
  await saveKeyValueCache(reportKey(filters), envelope);
}

export async function readReportSnapshot(filters: ReportFilters) {
  const cached = await readKeyValueCache<SnapshotEnvelope<ReportResponse>>(reportKey(filters)).catch(() => null);
  return cached?.value ?? null;
}

export function canUseOfflineSnapshot() {
  return isBrowserOffline();
}

export function markSnapshotRefreshSucceeded() {
  markNetworkRestored();
}

export type AdminUsersSnapshot = Array<{
  user_id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "viewer";
  active: boolean;
  approval_status: "pending" | "approved" | "rejected";
  created_at?: string;
}>;

export async function saveAdminUsersSnapshot(users: AdminUsersSnapshot) {
  const envelope: SnapshotEnvelope<AdminUsersSnapshot> = { value: users, updatedAt: new Date().toISOString() };
  await saveKeyValueCache(ADMIN_USERS_KEY, envelope);
}

export async function readAdminUsersSnapshot() {
  const cached = await readKeyValueCache<SnapshotEnvelope<AdminUsersSnapshot>>(ADMIN_USERS_KEY).catch(() => null);
  return cached?.value ?? null;
}
