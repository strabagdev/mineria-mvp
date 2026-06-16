import { describe, expect, it } from "vitest";
import { toRoleLabel } from "./role-labels";

describe("toRoleLabel", () => {
  it("shows operator as Operativo in presentation", () => {
    expect(toRoleLabel("operator")).toBe("Operativo");
  });

  it("shows viewer as Visualizador in presentation", () => {
    expect(toRoleLabel("viewer")).toBe("Visualizador");
  });

  it("shows admin as Administrador in presentation", () => {
    expect(toRoleLabel("admin")).toBe("Administrador");
  });
});
