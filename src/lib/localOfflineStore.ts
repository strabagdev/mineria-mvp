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
  planningCustomFields: "planning-custom-fields",
  planningCustomFieldValuesPrefix: "planning-custom-field-values",
  planningAssignmentTypes: "planning-assignment-types",
  planningAssignmentsPrefix: "planning-assignments",
  authProfile: "auth-profile",
  planningMutationQueue: "planning-mutation-queue",
} as const;

export const OFFLINE_DATASETS = {
  planningCatalog: "planning.catalog",
  planningCustomFields: "planning.customFields",
  planningCustomFieldValues: "planning.customFieldValues",
  planningAssignmentTypes: "planning.assignmentTypes",
  planningAssignments: "planning.assignments",
  authProfile: "auth.profile",
  planningMutationQueue: "planning.mutationQueue",
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
  const scopedKey = buildOfflineStorageKey(key, scope);
  const scopedResult = await runTransaction<StoredValue<T> | undefined>(
    OFFLINE_STORES.keyval,
    "readonly",
    (store) => store.get(scopedKey)
  );

  if (scopedResult || scopedKey === key) {
    return scopedResult ?? null;
  }

  const legacyResult = await runTransaction<StoredValue<T> | undefined>(
    OFFLINE_STORES.keyval,
    "readonly",
    (store) => store.get(key)
  );

  return legacyResult ?? null;
}

export async function saveCatalogCache<T>(value: T, scope?: OfflineStorageScope) {
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

export async function savePlanningCustomFieldsCache<T>(value: T, scope?: OfflineStorageScope) {
  await runTransaction(OFFLINE_STORES.keyval, "readwrite", (store) =>
    store.put({
      key: buildOfflineStorageKey(OFFLINE_KEYS.planningCustomFields, scope),
      value,
      updatedAt: new Date().toISOString(),
    } satisfies StoredValue<T>)
  );
}

export async function readPlanningCustomFieldsCache<T>(scope?: OfflineStorageScope) {
  return readKeyValueWithLegacyFallback<T>(OFFLINE_KEYS.planningCustomFields, scope);
}

export async function saveProfileCache<T>(value: T, scope?: OfflineStorageScope) {
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

export async function savePlanningCache<T>(date: string, items: T, scope?: OfflineStorageScope) {
  await runTransaction(OFFLINE_STORES.planningByDate, "readwrite", (store) =>
    store.put({
      date: buildPlanningDateCacheKey(date, scope),
      items,
      updatedAt: new Date().toISOString(),
    } satisfies PlanningCache<T>)
  );
}

export async function readPlanningCache<T>(date: string, scope?: OfflineStorageScope) {
  const scopedDate = buildPlanningDateCacheKey(date, scope);
  const scopedResult = await runTransaction<PlanningCache<T> | undefined>(
    OFFLINE_STORES.planningByDate,
    "readonly",
    (store) => store.get(scopedDate)
  );

  if (scopedResult || scopedDate === date) {
    return scopedResult ?? null;
  }

  const legacyResult = await runTransaction<PlanningCache<T> | undefined>(
    OFFLINE_STORES.planningByDate,
    "readonly",
    (store) => store.get(date)
  );

  return legacyResult ?? null;
}

export async function saveKeyValueCache<T>(key: string, value: T, scope?: OfflineStorageScope) {
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
