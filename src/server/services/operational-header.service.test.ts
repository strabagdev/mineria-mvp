import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  countOperationalHeaderOptionsByFieldId: vi.fn(),
  countOperationalHeaderValuesByOptionId: vi.fn(),
  countOperationalHeaderValuesByFieldId: vi.fn(),
  createOperationalHeaderOptionDependency: vi.fn(),
  createOperationalHeaderFieldOption: vi.fn(),
  createOperationalHeaderField: vi.fn(),
  deleteOperationalHeaderOptionDependency: vi.fn(),
  deleteOperationalHeaderFieldOption: vi.fn(),
  deleteOperationalHeaderField: vi.fn(),
  findOperationalHeaderOptionDependencyRow: vi.fn(),
  findOperationalHeaderFieldOptionRow: vi.fn(),
  findOperationalHeaderFieldRow: vi.fn(),
  listOperationalHeaderFieldRows: vi.fn(),
  listOperationalHeaderFieldOptionRows: vi.fn(),
  listOperationalHeaderOptionDependencyRows: vi.fn(),
  listOperationalHeaderValueRowsByActivityGroupIds: vi.fn(),
  listOperationalHeaderValueRowsByPlanningItemIds: vi.fn(),
  listOperationalHeaderValueRowsByExecutionSegmentIds: vi.fn(),
  updateOperationalHeaderFieldOption: vi.fn(),
  updateOperationalHeaderField: vi.fn(),
  upsertOperationalHeaderValueForPlanningItem: vi.fn(),
  upsertOperationalHeaderValueForExecutionSegment: vi.fn(),
}));

vi.mock("@/server/repositories/operational-header.repository", () => ({
  countOperationalHeaderOptionsByFieldId: mocks.countOperationalHeaderOptionsByFieldId,
  countOperationalHeaderValuesByOptionId: mocks.countOperationalHeaderValuesByOptionId,
  countOperationalHeaderValuesByFieldId: mocks.countOperationalHeaderValuesByFieldId,
  createOperationalHeaderOptionDependency: mocks.createOperationalHeaderOptionDependency,
  createOperationalHeaderFieldOption: mocks.createOperationalHeaderFieldOption,
  createOperationalHeaderField: mocks.createOperationalHeaderField,
  deleteOperationalHeaderOptionDependency: mocks.deleteOperationalHeaderOptionDependency,
  deleteOperationalHeaderFieldOption: mocks.deleteOperationalHeaderFieldOption,
  deleteOperationalHeaderField: mocks.deleteOperationalHeaderField,
  findOperationalHeaderOptionDependencyRow: mocks.findOperationalHeaderOptionDependencyRow,
  findOperationalHeaderFieldOptionRow: mocks.findOperationalHeaderFieldOptionRow,
  findOperationalHeaderFieldRow: mocks.findOperationalHeaderFieldRow,
  listOperationalHeaderFieldRows: mocks.listOperationalHeaderFieldRows,
  listOperationalHeaderFieldOptionRows: mocks.listOperationalHeaderFieldOptionRows,
  listOperationalHeaderOptionDependencyRows: mocks.listOperationalHeaderOptionDependencyRows,
  listOperationalHeaderValueRowsByActivityGroupIds: mocks.listOperationalHeaderValueRowsByActivityGroupIds,
  listOperationalHeaderValueRowsByPlanningItemIds: mocks.listOperationalHeaderValueRowsByPlanningItemIds,
  listOperationalHeaderValueRowsByExecutionSegmentIds: mocks.listOperationalHeaderValueRowsByExecutionSegmentIds,
  updateOperationalHeaderFieldOption: mocks.updateOperationalHeaderFieldOption,
  updateOperationalHeaderField: mocks.updateOperationalHeaderField,
  upsertOperationalHeaderValueForPlanningItem: mocks.upsertOperationalHeaderValueForPlanningItem,
  upsertOperationalHeaderValueForExecutionSegment: mocks.upsertOperationalHeaderValueForExecutionSegment,
}));

vi.mock("server-only", () => ({}));

describe("operational header H1", () => {
  const legacyFieldRows = [
    {
      id: 1,
      slug: "nivel",
      label: "Nivel",
      input_type: "select",
      required: true,
      active: true,
      sort_order: 10,
      grouping_order: null,
      groupable: true,
      filterable: true,
      visible_in_gantt: true,
      exportable: true,
    },
    {
      id: 2,
      slug: "frente",
      label: "Frente",
      input_type: "text",
      required: true,
      active: true,
      sort_order: 20,
      grouping_order: null,
      groupable: true,
      filterable: true,
      visible_in_gantt: true,
      exportable: true,
    },
  ];
  const levelOptions = [
    {
      id: 10,
      field_id: 1,
      value: "nti",
      label: "NTI",
      active: true,
      sort_order: 10,
      metadata: {},
    },
    {
      id: 11,
      field_id: 1,
      value: "nnm",
      label: "NNM",
      active: true,
      sort_order: 20,
      metadata: {},
    },
  ];

  it("defines the operational header migration tables and seed", () => {
    const sql = readFileSync("supabase/sql/011_operational_header.sql", "utf8");

    expect(sql).toContain("create table if not exists operational_header_fields");
    expect(sql).toContain("create table if not exists operational_header_field_options");
    expect(sql).toContain("create table if not exists operational_header_option_dependencies");
    expect(sql).toContain("create table if not exists operational_header_values");
    expect(sql).toContain("('nivel', 'Nivel', 'select', true, true, 10, true, true, true, true, 'level')");
    expect(sql).toContain("('frente', 'Frente', 'text', true, true, 20, true, true, true, true, 'front')");
  });

  it("adds grouping_order as nullable structural metadata without backfilling order", () => {
    const sql = readFileSync("supabase/sql/016_operational_header_grouping_order.sql", "utf8");

    expect(sql).toContain("add column if not exists grouping_order integer null");
    expect(sql).toContain("pg_notify('pgrst', 'reload schema')");
    expect(sql).not.toMatch(/\bupdate\s+operational_header_fields\b/i);
  });

  it("keeps the planning item value writer idempotent", () => {
    const source = readFileSync("src/server/repositories/operational-header.repository.ts", "utf8");

    expect(source).toContain("export async function upsertOperationalHeaderValueForPlanningItem");
    expect(source).toContain(".eq(\"field_id\", payload.field_id)");
    expect(source).toContain(".eq(\"planning_item_id\", payload.planning_item_id)");
    expect(source).toContain("if (updated)");
    expect(source).toContain(".insert(payload)");
  });

  it("selects grouping_order with operational header fields", () => {
    const source = readFileSync("src/server/repositories/operational-header.repository.ts", "utf8");

    expect(source).toContain("sort_order, grouping_order, groupable");
  });

  it("keeps the execution segment value writer idempotent", () => {
    const source = readFileSync("src/server/repositories/operational-header.repository.ts", "utf8");

    expect(source).toContain("export async function upsertOperationalHeaderValueForExecutionSegment");
    expect(source).toContain(".eq(\"field_id\", payload.field_id)");
    expect(source).toContain(".eq(\"execution_segment_id\", payload.execution_segment_id)");
    expect(source).toContain("if (updated)");
    expect(source).toContain(".insert(payload)");
  });

  it("hardens active legacy fields and option dependencies", () => {
    const sql = readFileSync("supabase/sql/012_operational_header_hardening.sql", "utf8");

    expect(sql).toContain("operational_header_fields_active_legacy_column_uidx");
    expect(sql).toContain("where legacy_column is not null");
    expect(sql).toContain("and active = true");
    expect(sql).toContain("unique (id, field_id)");
    expect(sql).toContain("foreign key (option_id, field_id)");
    expect(sql).toContain("foreign key (depends_on_option_id, depends_on_field_id)");
    expect(sql).not.toMatch(/\bdelete\s+from\b/i);
    expect(sql).not.toMatch(/\btruncate\b/i);
  });

  it("drops retired custom field tables without touching audit or core planning tables", () => {
    const sql = readFileSync("supabase/sql/013_drop_planning_custom_fields.sql", "utf8");
    const valuesIndex = sql.indexOf("drop table if exists planning_custom_field_values");
    const optionsIndex = sql.indexOf("drop table if exists planning_custom_field_options");
    const fieldsIndex = sql.indexOf("drop table if exists planning_custom_fields");

    expect(valuesIndex).toBeGreaterThanOrEqual(0);
    expect(optionsIndex).toBeGreaterThan(valuesIndex);
    expect(fieldsIndex).toBeGreaterThan(optionsIndex);
    expect(sql).not.toMatch(/\bcascade\b/i);
    expect(sql).not.toMatch(/\baudit_(events|logs)\b/i);
    expect(sql).not.toMatch(/\bplanning_items\b/i);
    expect(sql).not.toMatch(/\bactivity_execution_segments\b/i);
    expect(sql).not.toMatch(/\boperational_header_/i);
    expect(sql).not.toMatch(/\bplanning_assignments\b/i);
  });

  it("drops residual planning item level storage without adding another legacy source", () => {
    const sql = readFileSync("supabase/sql/015_drop_planning_items_level_residual.sql", "utf8");

    expect(sql).toContain("alter table if exists planning_items");
    expect(sql).toContain("drop column if exists level");
    expect(sql).not.toMatch(/\badd column\b/i);
    expect(sql).not.toMatch(/\bfront\b/i);
    expect(sql).not.toMatch(/\blegacy_column\b/i);
    expect(sql).toContain("pg_notify('pgrst', 'reload schema')");
  });

  it("keeps backfill idempotent and compatible with empty source tables", () => {
    const sql = readFileSync("supabase/sql/011_operational_header.sql", "utf8");

    expect(sql).toContain("from planning_items item");
    expect(sql).toContain("from activity_execution_segments segment");
    expect(sql).toContain("on conflict (field_id, planning_item_id) where planning_item_id is not null do update");
    expect(sql).toContain("on conflict (field_id, execution_segment_id) where execution_segment_id is not null do update");
    expect(sql).toContain("item.level");
    expect(sql).toContain("item.front");
  });

  it("documents the conceptual boundary from custom fields and assignments", () => {
    const markdown = readFileSync("docs/OPERATIONAL_HEADER_MODEL.md", "utf8");

    expect(markdown).toContain("Cabecera Operacional es la unica fuente de verdad");
    expect(markdown).toContain("Custom Fields fue eliminado del modelo vigente");
    expect(markdown).toContain("Asignaciones concentra recursos y atributos asociados");
    expect(markdown).toContain("columnas funcionales");
  });

  it("composes fields with their options", async () => {
    vi.resetAllMocks();
    mocks.listOperationalHeaderFieldRows.mockResolvedValue(legacyFieldRows);
    mocks.listOperationalHeaderFieldOptionRows.mockResolvedValue([levelOptions[0]]);

    const { listOperationalHeaderFields } = await import("./operational-header.service");
    const fields = await listOperationalHeaderFields({ activeOnly: true });

    expect(mocks.listOperationalHeaderFieldRows).toHaveBeenCalledWith({ activeOnly: true });
    expect(mocks.listOperationalHeaderFieldOptionRows).toHaveBeenCalledWith({ activeOnly: true });
    expect(fields).toEqual([
      expect.objectContaining({
        slug: "nivel",
        options: [expect.objectContaining({ label: "NTI" })],
      }),
      expect.objectContaining({
        slug: "frente",
        options: [],
      }),
    ]);
  });

  it("exposes value readers by activity group, planning item and execution segment", async () => {
    vi.resetAllMocks();
    mocks.listOperationalHeaderValueRowsByActivityGroupIds.mockResolvedValue([]);
    mocks.listOperationalHeaderValueRowsByPlanningItemIds.mockResolvedValue([]);
    mocks.listOperationalHeaderValueRowsByExecutionSegmentIds.mockResolvedValue([]);
    const service = await import("./operational-header.service");

    await service.listOperationalHeaderValuesByActivityGroupIds(["group-1"]);
    await service.listOperationalHeaderValuesByPlanningItemIds([1]);
    await service.listOperationalHeaderValuesByExecutionSegmentIds([2]);

    expect(mocks.listOperationalHeaderValueRowsByActivityGroupIds).toHaveBeenCalledWith(["group-1"]);
    expect(mocks.listOperationalHeaderValueRowsByPlanningItemIds).toHaveBeenCalledWith([1]);
    expect(mocks.listOperationalHeaderValueRowsByExecutionSegmentIds).toHaveBeenCalledWith([2]);
  });

  it("returns operational header config with fields, options and valid dependencies", async () => {
    vi.resetAllMocks();
    mocks.listOperationalHeaderFieldRows.mockResolvedValue(legacyFieldRows);
    mocks.listOperationalHeaderFieldOptionRows.mockResolvedValue(levelOptions);
    mocks.listOperationalHeaderOptionDependencyRows.mockResolvedValue([
      {
        id: 100,
        field_id: 1,
        option_id: 10,
        depends_on_field_id: 1,
        depends_on_option_id: 11,
      },
      {
        id: 101,
        field_id: 999,
        option_id: 10,
        depends_on_field_id: 1,
        depends_on_option_id: 11,
      },
    ]);
    const { getOperationalHeaderConfig } = await import("./operational-header.service");

    const config = await getOperationalHeaderConfig({ activeOnly: true });

    expect(mocks.listOperationalHeaderFieldRows).toHaveBeenCalledWith({ activeOnly: true });
    expect(mocks.listOperationalHeaderFieldOptionRows).toHaveBeenCalledWith({ activeOnly: true });
    expect(config.fields[0]).toMatchObject({
      slug: "nivel",
      options: levelOptions,
    });
    expect(config.dependencies).toEqual([
      {
        id: 100,
        field_id: 1,
        option_id: 10,
        depends_on_field_id: 1,
        depends_on_option_id: 11,
      },
    ]);
  });

  it("syncs dynamic planning item operational header values", async () => {
    vi.resetAllMocks();
    const dynamicFields = [
      ...legacyFieldRows,
      {
        id: 30,
        slug: "departamento",
        label: "Departamento",
        input_type: "select",
        required: true,
        active: true,
        sort_order: 30,
        groupable: true,
        filterable: true,
        visible_in_gantt: true,
        exportable: true,
      },
      {
        id: 31,
        slug: "area",
        label: "Area",
        input_type: "text",
        required: false,
        active: true,
        sort_order: 40,
        groupable: true,
        filterable: true,
        visible_in_gantt: true,
        exportable: true,
      },
    ];
    mocks.listOperationalHeaderFieldRows.mockResolvedValue(dynamicFields);
    mocks.listOperationalHeaderFieldOptionRows.mockResolvedValue([
      ...levelOptions,
      { id: 300, field_id: 30, value: "mina", label: "Mina", active: true, sort_order: 10, metadata: {} },
    ]);
    mocks.upsertOperationalHeaderValueForPlanningItem.mockImplementation((input) => Promise.resolve({
      id: input.field_id,
      execution_segment_id: null,
      ...input,
    }));
    const { syncDynamicOperationalHeaderForPlanningItem } = await import("./operational-header.service");

    await syncDynamicOperationalHeaderForPlanningItem({
      planningItemId: 123,
      activityGroupId: "group-1",
      values: [
        { field_id: 1, value: "NTI" },
        { field_id: 2, value: "Frente A" },
        { field_id: 30, value: "Mina" },
        { field_id: 31, value: "Area Norte" },
      ],
    });

    expect(mocks.upsertOperationalHeaderValueForPlanningItem).toHaveBeenCalledWith({
      field_id: 1,
      activity_group_id: "group-1",
      planning_item_id: 123,
      option_id: 10,
      value_text: null,
    });
    expect(mocks.upsertOperationalHeaderValueForPlanningItem).toHaveBeenCalledWith({
      field_id: 2,
      activity_group_id: "group-1",
      planning_item_id: 123,
      option_id: null,
      value_text: "Frente A",
    });
    expect(mocks.upsertOperationalHeaderValueForPlanningItem).toHaveBeenCalledWith({
      field_id: 30,
      activity_group_id: "group-1",
      planning_item_id: 123,
      option_id: 300,
      value_text: null,
    });
    expect(mocks.upsertOperationalHeaderValueForPlanningItem).toHaveBeenCalledWith({
      field_id: 31,
      activity_group_id: "group-1",
      planning_item_id: 123,
      option_id: null,
      value_text: "Area Norte",
    });
    expect(mocks.upsertOperationalHeaderValueForPlanningItem).toHaveBeenCalledTimes(4);
  });

  it("prepares operational header values without deriving legacy columns", async () => {
    vi.resetAllMocks();
    mocks.listOperationalHeaderFieldRows.mockResolvedValue([
      ...legacyFieldRows,
      {
        id: 30,
        slug: "departamento",
        label: "Departamento",
        input_type: "text",
        required: false,
        active: true,
        sort_order: 30,
        groupable: true,
        filterable: true,
        visible_in_gantt: true,
        exportable: true,
      },
    ]);
    mocks.listOperationalHeaderFieldOptionRows.mockResolvedValue(levelOptions);
    const { prepareOperationalHeaderMutationValues } = await import("./operational-header.service");

    const prepared = await prepareOperationalHeaderMutationValues([
      { field_id: 1, value: "nti" },
      { field_id: 2, value: "Frente A" },
      { field_id: 30, value: "Mina" },
    ]);

    expect(prepared).toEqual({
      values: [
        { field_id: 1, value: "NTI", option_id: 10 },
        { field_id: 2, value: "Frente A", option_id: null },
        { field_id: 30, value: "Mina", option_id: null },
      ],
    });
  });

  it("blocks missing required operational header fields", async () => {
    vi.resetAllMocks();
    mocks.listOperationalHeaderFieldRows.mockResolvedValue(legacyFieldRows);
    mocks.listOperationalHeaderFieldOptionRows.mockResolvedValue(levelOptions);
    const { prepareOperationalHeaderMutationValues } = await import("./operational-header.service");

    await expect(prepareOperationalHeaderMutationValues([
      { field_id: 2, value: "Frente A" },
    ])).rejects.toThrow("El campo de cabecera operacional \"Nivel\" es obligatorio.");
  });

  it("blocks missing required dynamic operational header values", async () => {
    vi.resetAllMocks();
    mocks.listOperationalHeaderFieldRows.mockResolvedValue([{
      ...legacyFieldRows[1],
      id: 30,
      slug: "departamento",
      label: "Departamento",
      input_type: "text",
      required: true,
    }]);
    mocks.listOperationalHeaderFieldOptionRows.mockResolvedValue([]);
    const { syncDynamicOperationalHeaderForPlanningItem } = await import("./operational-header.service");

    await expect(syncDynamicOperationalHeaderForPlanningItem({
      planningItemId: 123,
      activityGroupId: "group-1",
      values: [],
    })).rejects.toThrow("El campo de cabecera operacional \"Departamento\" es obligatorio.");
    expect(mocks.upsertOperationalHeaderValueForPlanningItem).not.toHaveBeenCalled();
  });

  it("blocks invalid dynamic select options", async () => {
    vi.resetAllMocks();
    mocks.listOperationalHeaderFieldRows.mockResolvedValue([{
      ...legacyFieldRows[0],
      id: 30,
      slug: "departamento",
      label: "Departamento",
      required: false,
    }]);
    mocks.listOperationalHeaderFieldOptionRows.mockResolvedValue([
      { id: 300, field_id: 30, value: "mina", label: "Mina", active: true, sort_order: 10, metadata: {} },
    ]);
    const { syncDynamicOperationalHeaderForPlanningItem } = await import("./operational-header.service");

    await expect(syncDynamicOperationalHeaderForPlanningItem({
      planningItemId: 123,
      activityGroupId: "group-1",
      values: [{ field_id: 30, value: "Invalida" }],
    })).rejects.toThrow("La opcion seleccionada para \"Departamento\" no es valida.");
    expect(mocks.upsertOperationalHeaderValueForPlanningItem).not.toHaveBeenCalled();
  });

  it("blocks inactive dynamic select options", async () => {
    vi.resetAllMocks();
    mocks.listOperationalHeaderFieldRows.mockResolvedValue([{
      ...legacyFieldRows[0],
      id: 30,
      slug: "departamento",
      label: "Departamento",
      required: false,
    }]);
    mocks.listOperationalHeaderFieldOptionRows.mockResolvedValue([
      { id: 300, field_id: 30, value: "mina", label: "Mina", active: false, sort_order: 10, metadata: {} },
    ]);
    mocks.listOperationalHeaderOptionDependencyRows.mockResolvedValue([]);
    const { syncDynamicOperationalHeaderForPlanningItem } = await import("./operational-header.service");

    await expect(syncDynamicOperationalHeaderForPlanningItem({
      planningItemId: 123,
      activityGroupId: "group-1",
      values: [{ field_id: 30, value: "Mina", option_id: 300 }],
    })).rejects.toThrow("La opcion seleccionada para \"Departamento\" no es valida.");
    expect(mocks.upsertOperationalHeaderValueForPlanningItem).not.toHaveBeenCalled();
  });

  it("allows dependent select values when the parent selection permits them", async () => {
    vi.resetAllMocks();
    mocks.listOperationalHeaderFieldRows.mockResolvedValue([
      { ...legacyFieldRows[0], required: false },
      { ...legacyFieldRows[0], id: 30, slug: "frente", label: "Frente", required: true, sort_order: 20 },
    ]);
    mocks.listOperationalHeaderFieldOptionRows.mockResolvedValue([
      { id: 10, field_id: 1, value: "nti", label: "NTI", active: true, sort_order: 10, metadata: {} },
      { id: 300, field_id: 30, value: "frente_2", label: "Frente 2", active: true, sort_order: 10, metadata: {} },
    ]);
    mocks.listOperationalHeaderOptionDependencyRows.mockResolvedValue([
      { id: 500, field_id: 30, option_id: 300, depends_on_field_id: 1, depends_on_option_id: 10 },
    ]);
    mocks.upsertOperationalHeaderValueForPlanningItem.mockImplementation((input) => Promise.resolve({
      id: input.field_id,
      execution_segment_id: null,
      ...input,
    }));
    const { syncDynamicOperationalHeaderForPlanningItem } = await import("./operational-header.service");

    await syncDynamicOperationalHeaderForPlanningItem({
      planningItemId: 123,
      activityGroupId: "group-1",
      values: [
        { field_id: 1, value: "NTI" },
        { field_id: 30, value: "Frente 2" },
      ],
    });

    expect(mocks.upsertOperationalHeaderValueForPlanningItem).toHaveBeenCalledWith(expect.objectContaining({
      field_id: 30,
      option_id: 300,
    }));
  });

  it("blocks dependent select values when the parent selection does not permit them", async () => {
    vi.resetAllMocks();
    mocks.listOperationalHeaderFieldRows.mockResolvedValue([
      { ...legacyFieldRows[0], required: false },
      { ...legacyFieldRows[0], id: 30, slug: "frente", label: "Frente", required: true, sort_order: 20 },
    ]);
    mocks.listOperationalHeaderFieldOptionRows.mockResolvedValue([
      { id: 10, field_id: 1, value: "nti", label: "NTI", active: true, sort_order: 10, metadata: {} },
      { id: 11, field_id: 1, value: "nnm", label: "NNM", active: true, sort_order: 20, metadata: {} },
      { id: 300, field_id: 30, value: "frente_2", label: "Frente 2", active: true, sort_order: 10, metadata: {} },
    ]);
    mocks.listOperationalHeaderOptionDependencyRows.mockResolvedValue([
      { id: 500, field_id: 30, option_id: 300, depends_on_field_id: 1, depends_on_option_id: 10 },
    ]);
    const { syncDynamicOperationalHeaderForPlanningItem } = await import("./operational-header.service");

    await expect(syncDynamicOperationalHeaderForPlanningItem({
      planningItemId: 123,
      activityGroupId: "group-1",
      values: [
        { field_id: 1, value: "NNM" },
        { field_id: 30, value: "Frente 2" },
      ],
    })).rejects.toThrow("La opcion seleccionada para \"Frente\" no esta permitida para la seleccion actual de \"Nivel\".");
    expect(mocks.upsertOperationalHeaderValueForPlanningItem).not.toHaveBeenCalled();
  });

  it("does not require a dependent field while its parent has no value", async () => {
    vi.resetAllMocks();
    mocks.listOperationalHeaderFieldRows.mockResolvedValue([
      { ...legacyFieldRows[0], required: false },
      { ...legacyFieldRows[0], id: 30, slug: "frente", label: "Frente", required: true, sort_order: 20 },
    ]);
    mocks.listOperationalHeaderFieldOptionRows.mockResolvedValue([
      { id: 10, field_id: 1, value: "nti", label: "NTI", active: true, sort_order: 10, metadata: {} },
      { id: 300, field_id: 30, value: "frente_2", label: "Frente 2", active: true, sort_order: 10, metadata: {} },
    ]);
    mocks.listOperationalHeaderOptionDependencyRows.mockResolvedValue([
      { id: 500, field_id: 30, option_id: 300, depends_on_field_id: 1, depends_on_option_id: 10 },
    ]);
    const { syncDynamicOperationalHeaderForPlanningItem } = await import("./operational-header.service");

    await syncDynamicOperationalHeaderForPlanningItem({
      planningItemId: 123,
      activityGroupId: "group-1",
      values: [],
    });

    expect(mocks.upsertOperationalHeaderValueForPlanningItem).not.toHaveBeenCalled();
  });

  it("explains required dependent fields with no options for the selected parent", async () => {
    vi.resetAllMocks();
    mocks.listOperationalHeaderFieldRows.mockResolvedValue([
      { ...legacyFieldRows[0], required: false },
      { ...legacyFieldRows[0], id: 30, slug: "frente", label: "Frente", required: true, sort_order: 20 },
    ]);
    mocks.listOperationalHeaderFieldOptionRows.mockResolvedValue([
      { id: 10, field_id: 1, value: "nti", label: "NTI", active: true, sort_order: 10, metadata: {} },
      { id: 11, field_id: 1, value: "nnm", label: "NNM", active: true, sort_order: 20, metadata: {} },
      { id: 300, field_id: 30, value: "frente_2", label: "Frente 2", active: true, sort_order: 10, metadata: {} },
    ]);
    mocks.listOperationalHeaderOptionDependencyRows.mockResolvedValue([
      { id: 500, field_id: 30, option_id: 300, depends_on_field_id: 1, depends_on_option_id: 10 },
    ]);
    const { syncDynamicOperationalHeaderForPlanningItem } = await import("./operational-header.service");

    await expect(syncDynamicOperationalHeaderForPlanningItem({
      planningItemId: 123,
      activityGroupId: "group-1",
      values: [{ field_id: 1, value: "NNM" }],
    })).rejects.toThrow("No hay opciones disponibles para \"Frente\" con la seleccion actual de \"Nivel\".");
  });

  it("ignores inactive dynamic fields", async () => {
    vi.resetAllMocks();
    mocks.listOperationalHeaderFieldRows.mockResolvedValue([]);
    mocks.listOperationalHeaderFieldOptionRows.mockResolvedValue([]);
    const { syncDynamicOperationalHeaderForPlanningItem } = await import("./operational-header.service");

    await syncDynamicOperationalHeaderForPlanningItem({
      planningItemId: 123,
      activityGroupId: "group-1",
      values: [{ field_id: 99, value: "No guardar" }],
    });

    expect(mocks.upsertOperationalHeaderValueForPlanningItem).not.toHaveBeenCalled();
  });

  it("syncs dynamic execution segment operational header values", async () => {
    vi.resetAllMocks();
    mocks.listOperationalHeaderFieldRows.mockResolvedValue([{
      ...legacyFieldRows[0],
      id: 30,
      slug: "departamento",
      label: "Departamento",
      required: true,
    }]);
    mocks.listOperationalHeaderFieldOptionRows.mockResolvedValue([
      { id: 300, field_id: 30, value: "mina", label: "Mina", active: true, sort_order: 10, metadata: {} },
    ]);
    mocks.upsertOperationalHeaderValueForExecutionSegment.mockImplementation((input) => Promise.resolve({
      id: input.field_id,
      planning_item_id: null,
      ...input,
    }));
    const { syncDynamicOperationalHeaderForExecutionSegment } = await import("./operational-header.service");

    await syncDynamicOperationalHeaderForExecutionSegment({
      executionSegmentId: 456,
      activityGroupId: "group-1",
      values: [{ field_id: 30, value: "Mina" }],
    });

    expect(mocks.upsertOperationalHeaderValueForExecutionSegment).toHaveBeenCalledWith({
      field_id: 30,
      activity_group_id: "group-1",
      execution_segment_id: 456,
      option_id: 300,
      value_text: null,
    });
  });

  it("blocks missing required dynamic values for execution segments", async () => {
    vi.resetAllMocks();
    mocks.listOperationalHeaderFieldRows.mockResolvedValue([{
      ...legacyFieldRows[1],
      id: 30,
      slug: "departamento",
      label: "Departamento",
      input_type: "text",
      required: true,
    }]);
    mocks.listOperationalHeaderFieldOptionRows.mockResolvedValue([]);
    const { syncDynamicOperationalHeaderForExecutionSegment } = await import("./operational-header.service");

    await expect(syncDynamicOperationalHeaderForExecutionSegment({
      executionSegmentId: 456,
      activityGroupId: "group-1",
      values: [],
    })).rejects.toThrow("El campo de cabecera operacional \"Departamento\" es obligatorio.");
    expect(mocks.upsertOperationalHeaderValueForExecutionSegment).not.toHaveBeenCalled();
  });

  it("blocks invalid dynamic select options for execution segments", async () => {
    vi.resetAllMocks();
    mocks.listOperationalHeaderFieldRows.mockResolvedValue([{
      ...legacyFieldRows[0],
      id: 30,
      slug: "departamento",
      label: "Departamento",
      required: false,
    }]);
    mocks.listOperationalHeaderFieldOptionRows.mockResolvedValue([
      { id: 300, field_id: 30, value: "mina", label: "Mina", active: true, sort_order: 10, metadata: {} },
    ]);
    const { syncDynamicOperationalHeaderForExecutionSegment } = await import("./operational-header.service");

    await expect(syncDynamicOperationalHeaderForExecutionSegment({
      executionSegmentId: 456,
      activityGroupId: "group-1",
      values: [{ field_id: 30, value: "Invalida" }],
    })).rejects.toThrow("La opcion seleccionada para \"Departamento\" no es valida.");
    expect(mocks.upsertOperationalHeaderValueForExecutionSegment).not.toHaveBeenCalled();
  });

  it("ignores inactive dynamic fields for execution segments", async () => {
    vi.resetAllMocks();
    mocks.listOperationalHeaderFieldRows.mockResolvedValue([]);
    mocks.listOperationalHeaderFieldOptionRows.mockResolvedValue([]);
    const { syncDynamicOperationalHeaderForExecutionSegment } = await import("./operational-header.service");

    await syncDynamicOperationalHeaderForExecutionSegment({
      executionSegmentId: 456,
      activityGroupId: "group-1",
      values: [{ field_id: 99, value: "No guardar" }],
    });

    expect(mocks.upsertOperationalHeaderValueForExecutionSegment).not.toHaveBeenCalled();
  });

  it("creates editable operational header fields with normalized snake_case slug", async () => {
    vi.resetAllMocks();
    mocks.findOperationalHeaderFieldRow.mockResolvedValue(null);
    mocks.createOperationalHeaderField.mockImplementation((input) => Promise.resolve({
      id: 30,
      ...input,
    }));
    const { createOperationalHeaderFieldDefinition } = await import("./operational-header.service");

    const field = await createOperationalHeaderFieldDefinition({
      slug: "Area Operacional",
      label: "Area Operacional",
      inputType: "text",
      required: false,
      active: true,
      sortOrder: 30,
      groupingOrder: null,
      groupable: true,
      filterable: true,
      visibleInGantt: false,
      exportable: true,
    });

    expect(mocks.createOperationalHeaderField).toHaveBeenCalledWith({
      slug: "area_operacional",
      label: "Area Operacional",
      input_type: "text",
      required: false,
      active: true,
      sort_order: 30,
      grouping_order: null,
      groupable: true,
      filterable: true,
      visible_in_gantt: false,
      exportable: true,
    });
    expect(field).toEqual(expect.objectContaining({
      slug: "area_operacional",
      options: [],
    }));
  });

  it("updates slug and input type for Nivel and Frente like regular fields when unused", async () => {
    vi.resetAllMocks();
    mocks.findOperationalHeaderFieldRow.mockResolvedValue(legacyFieldRows[0]);
    mocks.countOperationalHeaderValuesByFieldId.mockResolvedValue(0);
    mocks.updateOperationalHeaderField.mockResolvedValue({
      ...legacyFieldRows[0],
      slug: "nivel_operacional",
      input_type: "text",
    });
    const { updateOperationalHeaderFieldDefinition } = await import("./operational-header.service");

    const field = await updateOperationalHeaderFieldDefinition({
      id: 1,
      updates: { slug: "Nivel Operacional", inputType: "text" },
    });

    expect(mocks.updateOperationalHeaderField).toHaveBeenCalledWith(1, {
      slug: "nivel_operacional",
      input_type: "text",
    });
    expect(field).toEqual(expect.objectContaining({ slug: "nivel_operacional", input_type: "text" }));
  });

  it("allows converting Frente from text to select when it has no values", async () => {
    vi.resetAllMocks();
    mocks.findOperationalHeaderFieldRow.mockResolvedValue(legacyFieldRows[1]);
    mocks.countOperationalHeaderValuesByFieldId.mockResolvedValue(0);
    mocks.updateOperationalHeaderField.mockResolvedValue({
      ...legacyFieldRows[1],
      input_type: "select",
    });
    const { updateOperationalHeaderFieldDefinition } = await import("./operational-header.service");

    const field = await updateOperationalHeaderFieldDefinition({
      id: 2,
      updates: { inputType: "select" },
    });

    expect(mocks.countOperationalHeaderValuesByFieldId).toHaveBeenCalledWith(2);
    expect(mocks.updateOperationalHeaderField).toHaveBeenCalledWith(2, {
      input_type: "select",
    });
    expect(field).toEqual(expect.objectContaining({ input_type: "select" }));
  });

  it("allows converting a text field to select with existing values without rewriting them", async () => {
    vi.resetAllMocks();
    mocks.findOperationalHeaderFieldRow.mockResolvedValue({
      ...legacyFieldRows[1],
      id: 40,
      slug: "sector",
    });
    mocks.countOperationalHeaderValuesByFieldId.mockResolvedValue(2);
    mocks.updateOperationalHeaderField.mockResolvedValue({
      ...legacyFieldRows[1],
      id: 40,
      slug: "sector",
      input_type: "select",
    });
    const { updateOperationalHeaderFieldDefinition } = await import("./operational-header.service");

    const field = await updateOperationalHeaderFieldDefinition({
      id: 40,
      updates: { inputType: "select" },
    });

    expect(mocks.countOperationalHeaderValuesByFieldId).toHaveBeenCalledWith(40);
    expect(mocks.updateOperationalHeaderField).toHaveBeenCalledWith(40, {
      input_type: "select",
    });
    expect(mocks.upsertOperationalHeaderValueForPlanningItem).not.toHaveBeenCalled();
    expect(mocks.upsertOperationalHeaderValueForExecutionSegment).not.toHaveBeenCalled();
    expect(field).toEqual(expect.objectContaining({ input_type: "select" }));
  });

  it("blocks converting Frente when it already has values", async () => {
    vi.resetAllMocks();
    mocks.findOperationalHeaderFieldRow.mockResolvedValue({
      ...legacyFieldRows[1],
      input_type: "select",
    });
    mocks.countOperationalHeaderValuesByFieldId.mockResolvedValue(2);
    const { updateOperationalHeaderFieldDefinition } = await import("./operational-header.service");

    await expect(updateOperationalHeaderFieldDefinition({
      id: 2,
      updates: { inputType: "text" },
    })).rejects.toThrow("No se puede cambiar el tipo porque el campo ya tiene valores.");
    expect(mocks.updateOperationalHeaderField).not.toHaveBeenCalled();
  });

  it("allows Nivel and Frente to update label, sort order and flags", async () => {
    vi.resetAllMocks();
    mocks.findOperationalHeaderFieldRow.mockResolvedValue(legacyFieldRows[0]);
    mocks.updateOperationalHeaderField.mockResolvedValue({
      ...legacyFieldRows[0],
      label: "Nivel operacional",
      sort_order: 5,
      groupable: false,
    });
    const { updateOperationalHeaderFieldDefinition } = await import("./operational-header.service");

    const field = await updateOperationalHeaderFieldDefinition({
      id: 1,
      updates: {
        label: "Nivel operacional",
        sortOrder: 5,
        groupingOrder: 2,
        groupable: false,
      },
    });

    expect(mocks.updateOperationalHeaderField).toHaveBeenCalledWith(1, {
      label: "Nivel operacional",
      sort_order: 5,
      grouping_order: 2,
      groupable: false,
    });
    expect(field).toEqual(expect.objectContaining({
      label: "Nivel operacional",
      options: [],
    }));
  });

  it("blocks non text-to-select input type changes when a field already has values", async () => {
    vi.resetAllMocks();
    mocks.findOperationalHeaderFieldRow.mockResolvedValue({
      ...legacyFieldRows[1],
      id: 40,
      slug: "sector",
      input_type: "select",
    });
    mocks.countOperationalHeaderValuesByFieldId.mockResolvedValue(2);
    const { updateOperationalHeaderFieldDefinition } = await import("./operational-header.service");

    await expect(updateOperationalHeaderFieldDefinition({
      id: 40,
      updates: { inputType: "text" },
    })).rejects.toThrow("No se puede cambiar el tipo porque el campo ya tiene valores.");
    expect(mocks.updateOperationalHeaderField).not.toHaveBeenCalled();
  });

  it("deletes unused fields including Nivel and Frente", async () => {
    vi.resetAllMocks();
    mocks.findOperationalHeaderFieldRow.mockResolvedValue(legacyFieldRows[1]);
    mocks.countOperationalHeaderValuesByFieldId.mockResolvedValue(0);
    mocks.countOperationalHeaderOptionsByFieldId.mockResolvedValue(0);
    const { deleteUnusedOperationalHeaderFieldDefinition } = await import("./operational-header.service");

    await expect(deleteUnusedOperationalHeaderFieldDefinition({ id: 2 })).resolves.toEqual({
      deleted: true,
      reason: null,
      valueCount: 0,
      optionCount: 0,
    });
    expect(mocks.deleteOperationalHeaderField).toHaveBeenCalledWith(2);
  });

  it("blocks delete when a field has values or options", async () => {
    vi.resetAllMocks();
    mocks.findOperationalHeaderFieldRow.mockResolvedValue({
      ...legacyFieldRows[1],
      id: 60,
      slug: "especialidad",
    });
    mocks.countOperationalHeaderValuesByFieldId.mockResolvedValue(0);
    mocks.countOperationalHeaderOptionsByFieldId.mockResolvedValue(3);
    const { deleteUnusedOperationalHeaderFieldDefinition } = await import("./operational-header.service");

    await expect(deleteUnusedOperationalHeaderFieldDefinition({ id: 60 })).resolves.toEqual({
      deleted: false,
      reason: "options",
      valueCount: 0,
      optionCount: 3,
    });
    expect(mocks.deleteOperationalHeaderField).not.toHaveBeenCalled();
  });

  it("creates options only for select fields", async () => {
    vi.resetAllMocks();
    mocks.findOperationalHeaderFieldRow.mockResolvedValue(legacyFieldRows[0]);
    mocks.findOperationalHeaderFieldOptionRow.mockResolvedValue(null);
    mocks.createOperationalHeaderFieldOption.mockImplementation((input) => Promise.resolve({
      id: 70,
      ...input,
    }));
    const { createOperationalHeaderOptionDefinition } = await import("./operational-header.service");

    const option = await createOperationalHeaderOptionDefinition({
      fieldId: 1,
      value: "Nivel Alto",
      label: "Nivel Alto",
      active: true,
      sortOrder: 30,
      metadata: { color: "blue" },
    });

    expect(mocks.createOperationalHeaderFieldOption).toHaveBeenCalledWith({
      field_id: 1,
      value: "nivel_alto",
      label: "Nivel Alto",
      active: true,
      sort_order: 30,
      metadata: { color: "blue" },
    });
    expect(option).toEqual(expect.objectContaining({ value: "nivel_alto" }));
  });

  it("blocks options for text fields", async () => {
    vi.resetAllMocks();
    mocks.findOperationalHeaderFieldRow.mockResolvedValue(legacyFieldRows[1]);
    const { createOperationalHeaderOptionDefinition } = await import("./operational-header.service");

    await expect(createOperationalHeaderOptionDefinition({
      fieldId: 2,
      value: "frente_1",
      label: "Frente 1",
      active: true,
      sortOrder: 10,
      metadata: {},
    })).rejects.toThrow("Solo los campos select pueden tener opciones.");
    expect(mocks.createOperationalHeaderFieldOption).not.toHaveBeenCalled();
  });

  it("blocks invalid option metadata", async () => {
    vi.resetAllMocks();
    mocks.findOperationalHeaderFieldRow.mockResolvedValue(legacyFieldRows[0]);
    const { createOperationalHeaderOptionDefinition } = await import("./operational-header.service");

    await expect(createOperationalHeaderOptionDefinition({
      fieldId: 1,
      value: "nti_extra",
      label: "NTI Extra",
      active: true,
      sortOrder: 10,
      metadata: [] as unknown as Record<string, never>,
    })).rejects.toThrow("La metadata de la opcion debe ser un objeto JSON.");
  });

  it("edits and deactivates options", async () => {
    vi.resetAllMocks();
    mocks.findOperationalHeaderFieldOptionRow
      .mockResolvedValueOnce(levelOptions[0])
      .mockResolvedValueOnce(null);
    mocks.findOperationalHeaderFieldRow.mockResolvedValue(legacyFieldRows[0]);
    mocks.updateOperationalHeaderFieldOption.mockResolvedValue({
      ...levelOptions[0],
      value: "nti_actualizado",
      label: "NTI Actualizado",
      active: false,
    });
    const { updateOperationalHeaderOptionDefinition } = await import("./operational-header.service");

    const option = await updateOperationalHeaderOptionDefinition({
      id: 10,
      updates: {
        value: "NTI Actualizado",
        label: "NTI Actualizado",
        active: false,
      },
    });

    expect(mocks.updateOperationalHeaderFieldOption).toHaveBeenCalledWith(10, {
      value: "nti_actualizado",
      label: "NTI Actualizado",
      active: false,
    });
    expect(option).toEqual(expect.objectContaining({ active: false }));
  });

  it("deletes unused options", async () => {
    vi.resetAllMocks();
    mocks.findOperationalHeaderFieldOptionRow.mockResolvedValue(levelOptions[0]);
    mocks.countOperationalHeaderValuesByOptionId.mockResolvedValue(0);
    const { deleteUnusedOperationalHeaderOptionDefinition } = await import("./operational-header.service");

    await expect(deleteUnusedOperationalHeaderOptionDefinition({ id: 10 })).resolves.toEqual({
      deleted: true,
      reason: null,
      usageCount: 0,
    });
    expect(mocks.deleteOperationalHeaderFieldOption).toHaveBeenCalledWith(10);
  });

  it("blocks deleting used options", async () => {
    vi.resetAllMocks();
    mocks.findOperationalHeaderFieldOptionRow.mockResolvedValue(levelOptions[0]);
    mocks.countOperationalHeaderValuesByOptionId.mockResolvedValue(4);
    const { deleteUnusedOperationalHeaderOptionDefinition } = await import("./operational-header.service");

    await expect(deleteUnusedOperationalHeaderOptionDefinition({ id: 10 })).resolves.toEqual({
      deleted: false,
      reason: "used",
      usageCount: 4,
    });
    expect(mocks.deleteOperationalHeaderFieldOption).not.toHaveBeenCalled();
  });

  it("creates dependencies between active options from different select fields", async () => {
    vi.resetAllMocks();
    const frontSelectField = {
      ...legacyFieldRows[0],
      id: 3,
      slug: "frente",
      label: "Frente",
    };
    const frontOption = {
      id: 30,
      field_id: 3,
      value: "gt3",
      label: "GT3",
      active: true,
      sort_order: 10,
      metadata: {},
    };
    mocks.findOperationalHeaderFieldRow
      .mockResolvedValueOnce(frontSelectField)
      .mockResolvedValueOnce(legacyFieldRows[0]);
    mocks.findOperationalHeaderFieldOptionRow
      .mockResolvedValueOnce(frontOption)
      .mockResolvedValueOnce(levelOptions[0]);
    mocks.findOperationalHeaderOptionDependencyRow
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    mocks.createOperationalHeaderOptionDependency.mockResolvedValue({
      id: 300,
      field_id: 3,
      option_id: 30,
      depends_on_field_id: 1,
      depends_on_option_id: 10,
    });
    const { createOperationalHeaderDependencyDefinition } = await import("./operational-header.service");

    const dependency = await createOperationalHeaderDependencyDefinition({
      fieldId: 3,
      optionId: 30,
      dependsOnFieldId: 1,
      dependsOnOptionId: 10,
    });

    expect(mocks.createOperationalHeaderOptionDependency).toHaveBeenCalledWith({
      field_id: 3,
      option_id: 30,
      depends_on_field_id: 1,
      depends_on_option_id: 10,
    });
    expect(dependency).toEqual(expect.objectContaining({ id: 300 }));
  });

  it("blocks dependencies in the same field", async () => {
    vi.resetAllMocks();
    const { createOperationalHeaderDependencyDefinition } = await import("./operational-header.service");

    await expect(createOperationalHeaderDependencyDefinition({
      fieldId: 1,
      optionId: 10,
      dependsOnFieldId: 1,
      dependsOnOptionId: 11,
    })).rejects.toThrow("No se puede crear una dependencia entre opciones del mismo campo.");
  });

  it("blocks dependencies when an option does not belong to the selected field", async () => {
    vi.resetAllMocks();
    mocks.findOperationalHeaderFieldRow
      .mockResolvedValueOnce(legacyFieldRows[0])
      .mockResolvedValueOnce({
        ...legacyFieldRows[0],
        id: 3,
        slug: "frente",
        label: "Frente",
      });
    mocks.findOperationalHeaderFieldOptionRow
      .mockResolvedValueOnce({ ...levelOptions[0], field_id: 99 })
      .mockResolvedValueOnce({ ...levelOptions[1], id: 30, field_id: 3 });
    const { createOperationalHeaderDependencyDefinition } = await import("./operational-header.service");

    await expect(createOperationalHeaderDependencyDefinition({
      fieldId: 1,
      optionId: 10,
      dependsOnFieldId: 3,
      dependsOnOptionId: 30,
    })).rejects.toThrow("La opcion indicada no pertenece al campo seleccionado.");
  });

  it("blocks duplicate dependencies", async () => {
    vi.resetAllMocks();
    const frontSelectField = {
      ...legacyFieldRows[0],
      id: 3,
      slug: "frente",
      label: "Frente",
    };
    mocks.findOperationalHeaderFieldRow
      .mockResolvedValueOnce(frontSelectField)
      .mockResolvedValueOnce(legacyFieldRows[0]);
    mocks.findOperationalHeaderFieldOptionRow
      .mockResolvedValueOnce({ ...levelOptions[0], id: 30, field_id: 3 })
      .mockResolvedValueOnce(levelOptions[0]);
    mocks.findOperationalHeaderOptionDependencyRow
      .mockResolvedValueOnce({ id: 300 })
      .mockResolvedValueOnce(null);
    const { createOperationalHeaderDependencyDefinition } = await import("./operational-header.service");

    await expect(createOperationalHeaderDependencyDefinition({
      fieldId: 3,
      optionId: 30,
      dependsOnFieldId: 1,
      dependsOnOptionId: 10,
    })).rejects.toThrow("Ya existe esta dependencia de cabecera operacional.");
  });

  it("blocks simple dependency cycles", async () => {
    vi.resetAllMocks();
    const frontSelectField = {
      ...legacyFieldRows[0],
      id: 3,
      slug: "frente",
      label: "Frente",
    };
    mocks.findOperationalHeaderFieldRow
      .mockResolvedValueOnce(frontSelectField)
      .mockResolvedValueOnce(legacyFieldRows[0]);
    mocks.findOperationalHeaderFieldOptionRow
      .mockResolvedValueOnce({ ...levelOptions[0], id: 30, field_id: 3 })
      .mockResolvedValueOnce(levelOptions[0]);
    mocks.findOperationalHeaderOptionDependencyRow
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 301 });
    const { createOperationalHeaderDependencyDefinition } = await import("./operational-header.service");

    await expect(createOperationalHeaderDependencyDefinition({
      fieldId: 3,
      optionId: 30,
      dependsOnFieldId: 1,
      dependsOnOptionId: 10,
    })).rejects.toThrow("No se puede crear un ciclo entre dependencias de opciones.");
  });

  it("deletes dependencies", async () => {
    vi.resetAllMocks();
    mocks.findOperationalHeaderOptionDependencyRow.mockResolvedValue({
      id: 300,
      field_id: 3,
      option_id: 30,
      depends_on_field_id: 1,
      depends_on_option_id: 10,
    });
    const { deleteOperationalHeaderDependencyDefinition } = await import("./operational-header.service");

    await expect(deleteOperationalHeaderDependencyDefinition({ id: 300 })).resolves.toEqual({
      deleted: true,
      dependency: {
        id: 300,
        field_id: 3,
        option_id: 30,
        depends_on_field_id: 1,
        depends_on_option_id: 10,
      },
    });
    expect(mocks.deleteOperationalHeaderOptionDependency).toHaveBeenCalledWith(300);
  });
});
