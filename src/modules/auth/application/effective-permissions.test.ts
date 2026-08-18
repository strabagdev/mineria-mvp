import { describe, expect, it } from "vitest";
import { PERMISSIONS } from "../contracts/permissions";
import { hasEffectivePermission } from "./effective-permissions";

describe("hasEffectivePermission", () => {
  it("allows a viewer when the effective permission is present", () => {
    expect(hasEffectivePermission({
      role: "viewer",
      effective_permissions: [PERMISSIONS.RECORDS_CREATE],
    }, PERMISSIONS.RECORDS_CREATE)).toBe(true);
  });

  it("denies a viewer when the effective permission is absent", () => {
    expect(hasEffectivePermission({
      role: "viewer",
      effective_permissions: [],
    }, PERMISSIONS.RECORDS_CREATE)).toBe(false);
  });

  it("respects deny overrides through the already-resolved effective permissions", () => {
    expect(hasEffectivePermission({
      role: "operator",
      effective_permissions: [PERMISSIONS.RECORDS_VIEW],
    }, PERMISSIONS.RECORDS_EDIT)).toBe(false);
  });

  it("keeps admin as superadministrator", () => {
    expect(hasEffectivePermission({
      role: "admin",
      effective_permissions: [],
    }, PERMISSIONS.CATALOG_MANAGE)).toBe(true);
  });
});
