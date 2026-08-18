import { afterEach, describe, expect, it, vi } from "vitest";
import { PERMISSION_MODULES, PERMISSIONS } from "../contracts/permissions";
import {
  deleteUserPermissionOverride,
  fetchUserPermissionSummary,
  getPermissionVisualState,
  setUserPermissionOverride,
  type UserPermissionSummaryDto,
} from "./user-permissions.client";

vi.mock("@/lib/networkStatus", () => ({
  assertBrowserOnline: vi.fn(),
}));

const operatorSummary: UserPermissionSummaryDto = {
  user_id: "operator-1",
  role: "operator",
  base_permissions: [
    PERMISSIONS.RECORDS_VIEW,
    PERMISSIONS.RECORDS_CREATE,
    PERMISSIONS.RECORDS_EDIT,
    PERMISSIONS.RECORDS_DELETE,
    PERMISSIONS.CATALOG_VIEW,
  ],
  overrides: [],
  effective_permissions: [
    PERMISSIONS.RECORDS_VIEW,
    PERMISSIONS.RECORDS_CREATE,
    PERMISSIONS.RECORDS_EDIT,
    PERMISSIONS.RECORDS_DELETE,
    PERMISSIONS.CATALOG_VIEW,
  ],
};

function mockJsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

function getFetchCall() {
  const fetchMock = vi.mocked(fetch);
  const call = fetchMock.mock.calls[0];
  if (!call) throw new Error("Expected fetch to be called.");
  return call;
}

describe("user permissions client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads effective permissions through the permissions API", async () => {
    vi.stubGlobal("fetch", vi.fn(() => mockJsonResponse(operatorSummary)));

    const summary = await fetchUserPermissionSummary("operator-1", "token");
    const [url, init] = getFetchCall();

    expect(summary).toEqual(operatorSummary);
    expect(String(url)).toBe("/api/users/permissions?user_id=operator-1");
    expect(init).toMatchObject({
      cache: "no-store",
      headers: expect.objectContaining({ Authorization: "Bearer token" }),
    });
  });

  it("renders inherited, allow and deny visual states without collapsing them into booleans", () => {
    expect(getPermissionVisualState(operatorSummary, PERMISSIONS.RECORDS_EDIT)).toMatchObject({
      controlValue: "inherit",
      inherited: true,
      effective: true,
      label: "Heredado del rol",
    });

    const withAllow: UserPermissionSummaryDto = {
      ...operatorSummary,
      overrides: [{ permission: PERMISSIONS.CATALOG_MANAGE, effect: "allow" }],
      effective_permissions: [...operatorSummary.effective_permissions, PERMISSIONS.CATALOG_MANAGE],
    };
    expect(getPermissionVisualState(withAllow, PERMISSIONS.CATALOG_MANAGE)).toMatchObject({
      controlValue: "allow",
      inherited: false,
      effective: true,
      label: "Permitido manualmente",
    });

    const withDeny: UserPermissionSummaryDto = {
      ...operatorSummary,
      overrides: [{ permission: PERMISSIONS.RECORDS_EDIT, effect: "deny" }],
      effective_permissions: operatorSummary.effective_permissions.filter(
        (permission) => permission !== PERMISSIONS.RECORDS_EDIT
      ),
    };
    expect(getPermissionVisualState(withDeny, PERMISSIONS.RECORDS_EDIT)).toMatchObject({
      controlValue: "deny",
      inherited: true,
      effective: false,
      label: "Denegado manualmente",
    });
  });

  it("shows admin as total access even when a deny override exists", () => {
    const adminSummary: UserPermissionSummaryDto = {
      user_id: "admin-1",
      role: "admin",
      base_permissions: Object.values(PERMISSIONS),
      overrides: [{ permission: PERMISSIONS.RECORDS_EDIT, effect: "deny" }],
      effective_permissions: Object.values(PERMISSIONS),
    };

    expect(getPermissionVisualState(adminSummary, PERMISSIONS.RECORDS_EDIT)).toMatchObject({
      controlValue: "inherit",
      inherited: true,
      effective: true,
      override: "deny",
      label: "Total por admin; deny sin efecto",
    });
  });

  it("creates allow and deny overrides through the permissions API", async () => {
    vi.stubGlobal("fetch", vi.fn(() => mockJsonResponse(operatorSummary)));

    await setUserPermissionOverride({
      userId: "operator-1",
      permission: PERMISSIONS.CATALOG_MANAGE,
      effect: "allow",
      accessToken: "token",
    });
    let [, init] = getFetchCall();
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      user_id: "operator-1",
      permission: PERMISSIONS.CATALOG_MANAGE,
      effect: "allow",
    });

    vi.mocked(fetch).mockClear();
    await setUserPermissionOverride({
      userId: "operator-1",
      permission: PERMISSIONS.RECORDS_EDIT,
      effect: "deny",
      accessToken: "token",
    });
    [, init] = getFetchCall();
    expect(JSON.parse(String(init?.body))).toEqual({
      user_id: "operator-1",
      permission: PERMISSIONS.RECORDS_EDIT,
      effect: "deny",
    });
  });

  it("deletes an override to return to inherited behavior", async () => {
    vi.stubGlobal("fetch", vi.fn(() => mockJsonResponse(operatorSummary)));

    await deleteUserPermissionOverride({
      userId: "operator-1",
      permission: PERMISSIONS.RECORDS_EDIT,
      accessToken: "token",
    });
    const [url, init] = getFetchCall();

    expect(String(url)).toBe("/api/users/permissions");
    expect(init?.method).toBe("DELETE");
    expect(JSON.parse(String(init?.body))).toEqual({
      user_id: "operator-1",
      permission: PERMISSIONS.RECORDS_EDIT,
    });
  });

  it("throws API errors without changing local state optimistically", async () => {
    vi.stubGlobal("fetch", vi.fn(() => mockJsonResponse({ error: "Sin permisos." }, 403)));

    await expect(
      setUserPermissionOverride({
        userId: "operator-1",
        permission: PERMISSIONS.CATALOG_MANAGE,
        effect: "allow",
        accessToken: "token",
      })
    ).rejects.toThrow("Sin permisos.");
  });

  it("keeps assignments.manage technical key while showing the editable assignments label", () => {
    const assignments = PERMISSION_MODULES.find((module) => module.id === "assignments");
    const manage = assignments?.permissions.find(
      (descriptor) => descriptor.permission === PERMISSIONS.ASSIGNMENTS_MANAGE
    );

    expect(manage).toMatchObject({
      permission: "assignments.manage",
      label: "Editar asignaciones",
    });
  });
});
