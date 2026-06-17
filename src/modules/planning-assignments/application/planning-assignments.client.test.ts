import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/networkStatus", () => ({
  assertBrowserOnline: vi.fn(),
}));

function mockJsonResponse(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
}

function getFetchCall() {
  const fetchMock = vi.mocked(fetch);
  const call = fetchMock.mock.calls[0];
  if (!call) throw new Error("Expected fetch to be called.");
  return call;
}

describe("planning assignments client target-aware helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches planning item assignments through the target-aware endpoint", async () => {
    const { fetchPlanningAssignmentsForTarget } = await import("./planning-assignments.client");
    vi.stubGlobal("fetch", vi.fn(() => mockJsonResponse({ assignments: [] })));

    await fetchPlanningAssignmentsForTarget({ target_kind: "planning_item", target_id: 42 }, "token");

    const [url, init] = getFetchCall();
    expect(String(url)).toBe("/api/planning-assignments?target_kind=planning_item&target_id=42");
    expect(init).toMatchObject({
      cache: "no-store",
      headers: expect.objectContaining({ Authorization: "Bearer token" }),
    });
  });

  it("saves planning item assignments with the legacy payload shape", async () => {
    const { savePlanningAssignmentsForTarget } = await import("./planning-assignments.client");
    vi.stubGlobal("fetch", vi.fn(() => mockJsonResponse({ assignments: [] })));
    const assignments = [{ assignment_type_id: 1, instance_order: 1, values: [] }];

    await savePlanningAssignmentsForTarget({ target_kind: "planning_item", target_id: 42 }, assignments, "token");

    const [, init] = getFetchCall();
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      planning_item_id: 42,
      assignments,
    });
  });

  it("saves execution segment assignments with an explicit target", async () => {
    const { savePlanningAssignmentsForTarget } = await import("./planning-assignments.client");
    vi.stubGlobal("fetch", vi.fn(() => mockJsonResponse({ assignments: [] })));
    const assignments = [{ assignment_type_id: 1, instance_order: 1, values: [] }];

    await savePlanningAssignmentsForTarget({ target_kind: "execution_segment", target_id: 77 }, assignments, "token");

    const [, init] = getFetchCall();
    expect(JSON.parse(String(init?.body))).toEqual({
      target: { target_kind: "execution_segment", target_id: 77 },
      assignments,
    });
  });

  it("keeps the legacy fetch wrapper callable", async () => {
    const { fetchPlanningAssignments } = await import("./planning-assignments.client");
    vi.stubGlobal("fetch", vi.fn(() => mockJsonResponse({ assignments: [] })));

    await fetchPlanningAssignments(42, "token");

    const [url] = getFetchCall();
    expect(String(url)).toBe("/api/planning-assignments?target_kind=planning_item&target_id=42");
  });

  it("keeps the legacy save wrapper callable", async () => {
    const { replacePlanningAssignments } = await import("./planning-assignments.client");
    vi.stubGlobal("fetch", vi.fn(() => mockJsonResponse({ assignments: [] })));

    await replacePlanningAssignments({ planning_item_id: 42, assignments: [] }, "token");

    const [, init] = getFetchCall();
    expect(JSON.parse(String(init?.body))).toEqual({
      planning_item_id: 42,
      assignments: [],
    });
  });
});
