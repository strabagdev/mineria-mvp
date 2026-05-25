import { describe, expect, it } from "vitest";
import {
  OFFLINE_DATASETS,
  OFFLINE_DB_NAME,
  OFFLINE_DB_VERSION,
  OFFLINE_KEYS,
  OFFLINE_SCOPED_KEY_VERSION,
  OFFLINE_STORES,
  buildOfflineStorageKey,
  buildPlanningDateCacheKey,
  hasOfflineStorageScope,
} from "./localOfflineStore";

describe("local offline storage keys", () => {
  it("documents current IndexedDB schema constants", () => {
    expect(OFFLINE_DB_NAME).toBe("mineria-offline-store");
    expect(OFFLINE_DB_VERSION).toBe(1);
    expect(OFFLINE_STORES).toEqual({
      keyval: "keyval",
      planningByDate: "planningByDate",
    });
    expect(OFFLINE_KEYS).toEqual({
      planningCatalog: "planning-catalog",
      authProfile: "auth-profile",
      planningMutationQueue: "planning-mutation-queue",
    });
    expect(OFFLINE_DATASETS.planningByDate).toBe("planning.byDate");
  });

  it("keeps legacy keys when no tenant/faena scope is available", () => {
    expect(hasOfflineStorageScope()).toBe(false);
    expect(buildOfflineStorageKey("planning-catalog")).toBe("planning-catalog");
    expect(buildPlanningDateCacheKey("2026-05-24")).toBe("2026-05-24");
  });

  it("builds stable scoped keys for future organization/site isolation", () => {
    const scope = {
      userId: "user-1",
      organizationId: "org-1",
      siteId: "site-1",
    };

    expect(hasOfflineStorageScope(scope)).toBe(true);
    expect(buildOfflineStorageKey("planning-catalog", scope)).toBe(
      `${OFFLINE_SCOPED_KEY_VERSION}:user:user-1:org:org-1:site:site-1:planning-catalog`
    );
    expect(buildPlanningDateCacheKey("2026-05-24", scope)).toBe(
      `${OFFLINE_SCOPED_KEY_VERSION}:user:user-1:org:org-1:site:site-1:planning:2026-05-24`
    );
  });

  it("uses explicit default scope segments when only part of the future scope exists", () => {
    expect(buildOfflineStorageKey("reports-catalog-v1", { organizationId: "org-1" })).toBe(
      "v2:user:default:org:org-1:site:default:reports-catalog-v1"
    );
  });

  it("ignores blank scope values to preserve legacy keys", () => {
    const blankScope = { userId: " ", organizationId: "", siteId: null };

    expect(hasOfflineStorageScope(blankScope)).toBe(false);
    expect(buildOfflineStorageKey("auth-profile", blankScope)).toBe("auth-profile");
  });

  it("encodes future scope segments without mutating the dataset key", () => {
    const key = buildOfflineStorageKey("reports-data-v1-start=2026-05-01&level=NTI", {
      userId: "user@example.com",
      organizationId: "org/faena norte",
      siteId: "site 1",
    });

    expect(key).toBe(
      "v2:user:user%40example.com:org:org%2Ffaena%20norte:site:site%201:reports-data-v1-start=2026-05-01&level=NTI"
    );
  });
});
