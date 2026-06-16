import { describe, expect, it } from "vitest";
import { USER_ROLE_OPTIONS, toUserRole } from "./role-options";

describe("USER_ROLE_OPTIONS", () => {
  it("exposes the three assignable roles in admin order", () => {
    expect(USER_ROLE_OPTIONS).toEqual([
      { value: "admin", label: "Administrador" },
      { value: "operator", label: "Operativo" },
      { value: "viewer", label: "Visualizador" },
    ]);
  });
});

describe("toUserRole", () => {
  it("keeps viewer assignable and falls back unknown values to viewer", () => {
    expect(toUserRole("admin")).toBe("admin");
    expect(toUserRole("operator")).toBe("operator");
    expect(toUserRole("viewer")).toBe("viewer");
    expect(toUserRole("other")).toBe("viewer");
  });
});
