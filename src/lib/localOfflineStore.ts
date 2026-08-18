"use client";

import { recordOperationalEvent } from "./observability/logger";

export const OFFLINE_DB_NAME = "mineria-offline-store";
export const OFFLINE_DB_VERSION = 1;
export const OFFLINE_SCOPED_KEY_VERSION = "v2";

export const OFFLINE_STORES = {
  keyval: "keyval",
  planningByDate: "planningByDate",
} as const;

export const OFFLINE_KEYS = {
  planningCatalog: "planning-catalog",
  planningAssignmentTypes: "planning-assignment-types",
  planningAssignmentsPrefix: "planning-assignments",
  assignmentTargetsPrefix: "assignments",
  authProfile: "auth-profile",
  planningMutationQueue: "planning-mutation-queue",
  syncCursorPrefix: "sync-cursor",
} as const;

export const OFFLINE_DATASETS = {
  planningCatalog: "planning.catalog",
  planningAssignmentTypes: "planning.assignmentTypes",
  planningAssignments: "planning.assignments",
  authProfile: "auth.profile",
  planningMutationQueue: "planning.mutationQueue",
  syncCursor: "sync.cursor",
  planningByDate: "planning.byDate",
  keyValueSnapshot: "shared.keyValueSnapshot",
} as const;

export type OfflineStorageScope = {
  userId?: string | null;
  organizationId?: string | null;
  siteId?: string | null;
};

type StoredValue<T> = {
  key: string;
  value: T;
  updatedAt: string;
};

type PlanningCache<T> = {
  date: string;
  items: T;
  updatedAt: string;
};

function normalizeScopePart(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? encodeURIComponent(normalized) : "default";
}

export function hasOfflineStorageScope(scope?: OfflineStorageScope) {
  return Boolean(scope?.userId?.trim() || scope?.organizationId?.trim() || scope?.siteId?.trim());
}

export function hasRequiredOfflineUserScope(scope?: OfflineStorageScope) {
  return Boolean(scope?.userId?.trim());
}

function assertOfflineUserScope(scope?: OfflineStorageScope) {
  if (!hasRequiredOfflineUserScope(scope)) {
    throw new Error("Offline storage requires a user scope.");
  }
}

export function buildOfflineStorageKey(key: string, scope?: OfflineStorageScope) {
  if (!hasOfflineStorageScope(scope)) {
    return key;
  }

  return [
    OFFLINE_SCOPED_KEY_VERSION,
    "user",
    normalizeScopePart(scope?.userId),
    "org",
    normalizeScopePart(scope?.organizationId),
    "site",
    normalizeScopePart(scope?.siteId),
    key,
  ].join(":");
}

export function buildPlanningDateCacheKey(date: string, scope?: OfflineStorageScope) {
  if (!hasOfflineStorageScope(scope)) {
    return date;
  }

  return buildOfflineStorageKey(`planning:${date}`, scope);
}

export function buildOfflineScopePrefix(scope: OfflineStorageScope) {
  assertOfflineUserScope(scope);
  return [
    OFFLINE_SCOPED_KEY_VERSION,
    "user",
    normalizeScopePart(scope.userId),
    "org",
    normalizeScopePart(scope.organizationId),
    "site",
    normalizeScopePart(scope.siteId),
  ].join(":");
}

export function buildPlanningAssignmentsCacheKey(planningItemId: number) {
  return `${OFFLINE_KEYS.planningAssignmentsPrefix}:${planningItemId}`;
}

function openOfflineDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(OFFLINE_STORES.keyval)) {
        db.createObjectStore(OFFLINE_STORES.keyval, { keyPath: "key" });
      }

      if (!db.objectStoreNames.contains(OFFLINE_STORES.planningByDate)) {
        db.createObjectStore(OFFLINE_STORES.planningByDate, { keyPath: "date" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function runTransaction<T>(
  storeName: (typeof OFFLINE_STORES)[keyof typeof OFFLINE_STORES],
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is not available."));
  }

  return openOfflineDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        const request = operation(store);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
          recordOperationalEvent({
            level: "error",
            name: "indexeddb.transaction_failed",
            source: "localOfflineStore",
            metadata: { storeName, mode, phase: "request" },
          });
          reject(request.error);
        };
        transaction.oncomplete = () => db.close();
        transaction.onerror = () => {
          db.close();
          recordOperationalEvent({
            level: "error",
            name: "indexeddb.transaction_failed",
            source: "localOfflineStore",
            metadata: { storeName, mode, phase: "transaction" },
          });
          reject(transaction.error);
        };
      })
  );
}

async function readKeyValueWithLegacyFallback<T>(key: string, scope?: OfflineStorageScope) {
  assertOfflineUserScope(scope);
  const scopedKey = buildOfflineStorageKey(key, scope);
  const scopedResult = await runTransaction<StoredValue<T> | undefined>(
    OFFLINE_STORES.keyval,
    "readonly",
    (store) => store.get(scopedKey)
  );

  return scopedResult ?? null;
}

export async function saveCatalogCache<T>(value: T, scope?: OfflineStorageScope) {
  assertOfflineUserScope(scope);
  await runTransaction(OFFLINE_STORES.keyval, "readwrite", (store) =>
    store.put({
      key: buildOfflineStorageKey(OFFLINE_KEYS.planningCatalog, scope),
      value,
      updatedAt: new Date().toISOString(),
    } satisfies StoredValue<T>)
  );
}

export async function readCatalogCache<T>(scope?: OfflineStorageScope) {
  return readKeyValueWithLegacyFallback<T>(OFFLINE_KEYS.planningCatalog, scope);
}

export async function saveProfileCache<T>(value: T, scope?: OfflineStorageScope) {
  assertOfflineUserScope(scope);
  await runTransaction(OFFLINE_STORES.keyval, "readwrite", (store) =>
    store.put({
      key: buildOfflineStorageKey(OFFLINE_KEYS.authProfile, scope),
      value,
      updatedAt: new Date().toISOString(),
    } satisfies StoredValue<T>)
  );
}

export async function readProfileCache<T>(scope?: OfflineStorageScope) {
  return readKeyValueWithLegacyFallback<T>(OFFLINE_KEYS.authProfile, scope);
}

export async function savePendingPlanningMutations<T>(value: T, scope?: OfflineStorageScope) {
  assertOfflineUserScope(scope);
  await runTransaction(OFFLINE_STORES.keyval, "readwrite", (store) =>
    store.put({
      key: buildOfflineStorageKey(OFFLINE_KEYS.planningMutationQueue, scope),
      value,
      updatedAt: new Date().toISOString(),
    } satisfies StoredValue<T>)
  );
}

export async function readPendingPlanningMutations<T>(scope?: OfflineStorageScope) {
  return readKeyValueWithLegacyFallback<T>(OFFLINE_KEYS.planningMutationQueue, scope);
}

export async function saveSyncCursor(domain: string, cursor: number, scope?: OfflineStorageScope) {
  assertOfflineUserScope(scope);
  await runTransaction(OFFLINE_STORES.keyval, "readwrite", (store) =>
    store.put({
      key: buildOfflineStorageKey(`${OFFLINE_KEYS.syncCursorPrefix}:${domain}`, scope),
      value: cursor,
      updatedAt: new Date().toISOString(),
    } satisfies StoredValue<number>)
  );
}

export async function readSyncCursor(domain: string, scope?: OfflineStorageScope) {
  const cachedCursor = await readKeyValueWithLegacyFallback<number>(
    `${OFFLINE_KEYS.syncCursorPrefix}:${domain}`,
    scope
  );

  return Number(cachedCursor?.value ?? 0);
}

export async function savePlanningCache<T>(date: string, items: T, scope?: OfflineStorageScope) {
  assertOfflineUserScope(scope);
  await runTransaction(OFFLINE_STORES.planningByDate, "readwrite", (store) =>
    store.put({
      date: buildPlanningDateCacheKey(date, scope),
      items,
      updatedAt: new Date().toISOString(),
    } satisfies PlanningCache<T>)
  );
}

export async function readPlanningCache<T>(date: string, scope?: OfflineStorageScope) {
  assertOfflineUserScope(scope);
  const scopedDate = buildPlanningDateCacheKey(date, scope);
  const scopedResult = await runTransaction<PlanningCache<T> | undefined>(
    OFFLINE_STORES.planningByDate,
    "readonly",
    (store) => store.get(scopedDate)
  );

  return scopedResult ?? null;
}

export async function saveKeyValueCache<T>(key: string, value: T, scope?: OfflineStorageScope) {
  assertOfflineUserScope(scope);
  await runTransaction(OFFLINE_STORES.keyval, "readwrite", (store) =>
    store.put({
      key: buildOfflineStorageKey(key, scope),
      value,
      updatedAt: new Date().toISOString(),
    } satisfies StoredValue<T>)
  );
}

export async function readKeyValueCache<T>(key: string, scope?: OfflineStorageScope) {
  return readKeyValueWithLegacyFallback<T>(key, scope);
}

async function deleteKeysByPrefix(
  storeName: (typeof OFFLINE_STORES)[keyof typeof OFFLINE_STORES],
  prefix: string,
  keyField: "key" | "date",
  shouldDelete: (key: string) => boolean = () => true
) {
  if (typeof indexedDB === "undefined") {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    openOfflineDb().then((db) => {
      const transaction = db.transaction(storeName, "readwrite");
      const store = transaction.objectStore(storeName);
      const cursorRequest = store.openCursor();

      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor) {
          return;
        }

        const value = cursor.value as Partial<Record<typeof keyField, unknown>>;
        const key = typeof value[keyField] === "string" ? value[keyField] : "";
        if (key.startsWith(prefix) && shouldDelete(key)) {
          cursor.delete();
        }
        cursor.continue();
      };
      cursorRequest.onerror = () => {
        db.close();
        reject(cursorRequest.error);
      };
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    }).catch(reject);
  });
}

export async function clearOfflineDataForScope(
  scope: OfflineStorageScope,
  options: { preservePlanningMutationQueue?: boolean } = {}
) {
  const prefix = `${buildOfflineScopePrefix(scope)}:`;
  const scopedQueueKey = buildOfflineStorageKey(OFFLINE_KEYS.planningMutationQueue, scope);

  await Promise.all([
    deleteKeysByPrefix(
      OFFLINE_STORES.keyval,
      prefix,
      "key",
      (key) => !options.preservePlanningMutationQueue || key !== scopedQueueKey
    ),
    deleteKeysByPrefix(OFFLINE_STORES.planningByDate, prefix, "date"),
  ]);

  recordOperationalEvent({
    name: "offline.snapshot_saved",
    source: "localOfflineStore",
    metadata: { hasUserScope: hasRequiredOfflineUserScope(scope) },
  });
}
