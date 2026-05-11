"use client";

const DB_NAME = "mineria-offline-store";
const DB_VERSION = 1;
const CATALOG_KEY = "planning-catalog";
const PROFILE_KEY = "auth-profile";
const PLANNING_MUTATION_QUEUE_KEY = "planning-mutation-queue";

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

function openOfflineDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains("keyval")) {
        db.createObjectStore("keyval", { keyPath: "key" });
      }

      if (!db.objectStoreNames.contains("planningByDate")) {
        db.createObjectStore("planningByDate", { keyPath: "date" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function runTransaction<T>(
  storeName: "keyval" | "planningByDate",
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
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => db.close();
        transaction.onerror = () => {
          db.close();
          reject(transaction.error);
        };
      })
  );
}

export async function saveCatalogCache<T>(value: T) {
  await runTransaction("keyval", "readwrite", (store) =>
    store.put({
      key: CATALOG_KEY,
      value,
      updatedAt: new Date().toISOString(),
    } satisfies StoredValue<T>)
  );
}

export async function readCatalogCache<T>() {
  const result = await runTransaction<StoredValue<T> | undefined>("keyval", "readonly", (store) =>
    store.get(CATALOG_KEY)
  );

  return result ?? null;
}

export async function saveProfileCache<T>(value: T) {
  await runTransaction("keyval", "readwrite", (store) =>
    store.put({
      key: PROFILE_KEY,
      value,
      updatedAt: new Date().toISOString(),
    } satisfies StoredValue<T>)
  );
}

export async function readProfileCache<T>() {
  const result = await runTransaction<StoredValue<T> | undefined>("keyval", "readonly", (store) =>
    store.get(PROFILE_KEY)
  );

  return result ?? null;
}

export async function savePendingPlanningMutations<T>(value: T) {
  await runTransaction("keyval", "readwrite", (store) =>
    store.put({
      key: PLANNING_MUTATION_QUEUE_KEY,
      value,
      updatedAt: new Date().toISOString(),
    } satisfies StoredValue<T>)
  );
}

export async function readPendingPlanningMutations<T>() {
  const result = await runTransaction<StoredValue<T> | undefined>("keyval", "readonly", (store) =>
    store.get(PLANNING_MUTATION_QUEUE_KEY)
  );

  return result ?? null;
}

export async function savePlanningCache<T>(date: string, items: T) {
  await runTransaction("planningByDate", "readwrite", (store) =>
    store.put({
      date,
      items,
      updatedAt: new Date().toISOString(),
    } satisfies PlanningCache<T>)
  );
}

export async function readPlanningCache<T>(date: string) {
  const result = await runTransaction<PlanningCache<T> | undefined>("planningByDate", "readonly", (store) =>
    store.get(date)
  );

  return result ?? null;
}
