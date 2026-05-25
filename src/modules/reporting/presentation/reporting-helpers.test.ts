import { describe, expect, it } from "vitest";

import {
  buildReportQuery,
  formatHours,
  formatReportDate,
  toDisplayCategory,
  toTrackingLabel,
} from "./reporting-helpers";

describe("reporting presentation helpers", () => {
  it("builds report queries with trimmed non-empty filters only", () => {
    expect(
      buildReportQuery({
        date_from: " 2026-05-01 ",
        date_to: "2026-05-07",
        shift: "",
        level: " Nivel 1 ",
        front: " ",
        category: "actividad",
        tracking_type: "",
        item_type: " Perforacion ",
      })
    ).toBe("date_from=2026-05-01&date_to=2026-05-07&level=Nivel+1&category=actividad&item_type=Perforacion");
  });

  it("formats report labels without changing DTO values", () => {
    expect(formatHours(12.25)).toBe("12,3");
    expect(formatReportDate("2026-05-07")).toBe("07-05-2026");
    expect(toDisplayCategory("actividad")).toBe("Actividad");
    expect(toDisplayCategory("interferencia")).toBe("Interferencia");
    expect(toTrackingLabel("programado")).toBe("Programado");
    expect(toTrackingLabel("real")).toBe("Real");
  });
});
