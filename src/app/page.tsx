"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SectionCard } from "@/components/section-card";
import { useAuth } from "@/providers/auth-provider";

type PlanningItem = {
  id: number;
  description: string;
  item_date: string;
  start: string;
  end: string;
  shift: string;
  level: string;
  front: string;
  category: "actividad" | "interferencia";
  item_type: string;
  notes?: string | null;
};

type PlanningItemApi = {
  id: number;
  item_date: string;
  start_time: string;
  end_time: string;
  shift: string;
  level: string;
  front: string;
  category: "actividad" | "interferencia";
  item_type: string;
  description: string;
  notes?: string | null;
};

type CatalogDetail = {
  id: number;
  label: string;
};

type CatalogType = {
  id: number;
  slug: string;
  label: string;
  details: CatalogDetail[];
};

type CatalogCategory = {
  slug: "actividad" | "interferencia";
  label: string;
  types: CatalogType[];
};

type PlanningItemForm = {
  item_date: string;
  start_time: string;
  end_time: string;
  shift: string;
  level: string;
  front: string;
  category: "actividad" | "interferencia";
  item_type: string;
  description: string;
  notes: string;
};

type TypeAdminForm = {
  category: "actividad" | "interferencia";
  label: string;
};

type DetailAdminForm = {
  category: "actividad" | "interferencia";
  typeId: string;
  label: string;
};

type EditTypeForm = {
  id: number;
  category: "actividad" | "interferencia";
  label: string;
};

type EditDetailForm = {
  id: number;
  category: "actividad" | "interferencia";
  typeId: string;
  label: string;
};

type EditingPlanningItem = {
  id: number;
};

type ShiftScale = {
  shift: string;
  label: string;
  description: string;
  startMinutes: number;
  endMinutes: number;
  wrapsMidnight: boolean;
  slotMinutes: number;
  slotCount: number;
  hourMarks: Array<{
    key: string;
    label: string;
    major: boolean;
  }>;
};

function toMinutes(time: string) {
  const normalized = time.slice(0, 5);
  const [hours, minutes] = normalized.split(":").map(Number);
  return hours * 60 + minutes;
}

function toTimeLabel(totalMinutes: number) {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
  }).format(new Date(`${value}T00:00:00`));
}

function toDisplayCategory(category: PlanningItem["category"]) {
  return category === "interferencia" ? "Interferencia" : "Actividad";
}

function formatDuration(start: string, end: string) {
  const startMinutes = toMinutes(start);
  let endMinutes = toMinutes(end);

  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60;
  }

  const diff = endMinutes - startMinutes;
  const hours = Math.floor(diff / 60);
  const minutes = diff % 60;

  if (!hours) {
    return `${minutes}m`;
  }

  if (!minutes) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

function buildShiftScale(shift: string, label: string, description: string, start: string, end: string, wrapsMidnight: boolean): ShiftScale {
  const startMinutes = toMinutes(start);
  const rawEndMinutes = toMinutes(end);
  const endMinutes = wrapsMidnight ? rawEndMinutes + 24 * 60 : rawEndMinutes;
  const slotMinutes = 30;
  const slotCount = Math.ceil((endMinutes - startMinutes) / slotMinutes);
  const hourMarks = Array.from({ length: slotCount }, (_, index) => {
    const minutes = startMinutes + index * slotMinutes;
    return {
      key: `${shift}-${minutes}`,
      label: toTimeLabel(minutes),
      major: minutes % 60 === 0,
    };
  });

  return {
    shift,
    label,
    description,
    startMinutes,
    endMinutes,
    wrapsMidnight,
    slotMinutes,
    slotCount,
    hourMarks,
  };
}

function buildDynamicShiftScale(shift: string, items: PlanningItem[]): ShiftScale {
  const slotMinutes = 30;
  const positioned = items.map((item) => {
    const start = toMinutes(item.start);
    let end = toMinutes(item.end);

    if (end <= start) {
      end += 24 * 60;
    }

    return { start, end };
  });

  const minStart = Math.min(...positioned.map((item) => item.start));
  const maxEnd = Math.max(...positioned.map((item) => item.end));
  const roundedStart = Math.floor(minStart / slotMinutes) * slotMinutes;
  const roundedEnd = Math.ceil(maxEnd / slotMinutes) * slotMinutes;
  const slotCount = Math.max(1, Math.ceil((roundedEnd - roundedStart) / slotMinutes));
  const hourMarks = Array.from({ length: slotCount }, (_, index) => {
    const minutes = roundedStart + index * slotMinutes;
    return {
      key: `${shift}-${minutes}`,
      label: toTimeLabel(minutes),
      major: minutes % 60 === 0,
    };
  });

  return {
    shift,
    label: `Turno ${shift}`,
    description: `Escala operativa ${toTimeLabel(roundedStart)} - ${toTimeLabel(roundedEnd)}`,
    startMinutes: roundedStart,
    endMinutes: roundedEnd,
    wrapsMidnight: roundedEnd > 24 * 60,
    slotMinutes,
    slotCount,
    hourMarks,
  };
}

function getShiftScale(shift: string, items: PlanningItem[]) {
  if (shift === "Dia") {
    return buildShiftScale("Dia", "Turno Dia", "Escala operativa 08:00 - 19:30", "08:00", "19:30", false);
  }

  if (shift === "Noche") {
    return buildShiftScale("Noche", "Turno Noche", "Escala operativa 20:00 - 07:30", "20:00", "07:30", true);
  }

  return buildDynamicShiftScale(shift, items);
}

function positionMinutesInScale(time: string, scale: ShiftScale) {
  let minutes = toMinutes(time);

  if (scale.wrapsMidnight && minutes < scale.startMinutes) {
    minutes += 24 * 60;
  }

  return minutes;
}

function toInitialPlanningForm(categories: CatalogCategory[]): PlanningItemForm {
  const defaultCategory = categories[0] ?? {
    slug: "actividad" as const,
    label: "Actividad",
    types: [],
  };
  const defaultType = defaultCategory.types[0];
  const defaultDetail = defaultType?.details[0];

  return {
    item_date: new Date().toISOString().slice(0, 10),
    start_time: "07:00",
    end_time: "08:00",
    shift: "Dia",
    level: "",
    front: "",
    category: defaultCategory.slug,
    item_type: defaultType?.label ?? "",
    description: defaultDetail?.label ?? "",
    notes: "",
  };
}

function syncPlanningForm(form: PlanningItemForm, categories: CatalogCategory[]) {
  const fallback = toInitialPlanningForm(categories);
  const selectedCategory =
    categories.find((category) => category.slug === form.category) ??
    categories.find((category) => category.slug === fallback.category);

  if (!selectedCategory) {
    return fallback;
  }

  const selectedType =
    selectedCategory.types.find((type) => type.label === form.item_type) ?? selectedCategory.types[0];
  const selectedDetail =
    selectedType?.details.find((detail) => detail.label === form.description) ?? selectedType?.details[0];

  return {
    ...form,
    category: selectedCategory.slug,
    item_type: selectedType?.label ?? "",
    description: selectedDetail?.label ?? "",
  };
}

function syncDetailAdminForm(form: DetailAdminForm, categories: CatalogCategory[]) {
  const selectedCategory =
    categories.find((category) => category.slug === form.category) ?? categories[0] ?? null;

  if (!selectedCategory) {
    return { category: "actividad" as const, typeId: "", label: form.label };
  }

  const selectedType =
    selectedCategory.types.find((type) => String(type.id) === form.typeId) ?? selectedCategory.types[0] ?? null;

  return {
    ...form,
    category: selectedCategory.slug,
    typeId: selectedType ? String(selectedType.id) : "",
  };
}

async function fetchPlanningItems() {
  const response = await fetch("/api/planning-items", { cache: "no-store" });
  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(String(json.error ?? "No se pudo cargar la planificacion."));
  }

  return Array.isArray(json.items)
    ? json.items.map((item: PlanningItemApi) => ({
        id: item.id,
        item_date: item.item_date,
        start: item.start_time.slice(0, 5),
        end: item.end_time.slice(0, 5),
        shift: item.shift,
        level: item.level,
        front: item.front,
        category: item.category,
        item_type: item.item_type,
        description: item.description,
        notes: item.notes ?? null,
      }))
    : [];
}

async function fetchPlanningCatalog() {
  const response = await fetch("/api/planning-catalog", { cache: "no-store" });
  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(String(json.error ?? "No se pudo cargar el catalogo."));
  }

  return Array.isArray(json.categories) ? (json.categories as CatalogCategory[]) : [];
}

export default function Home() {
  const { loading, session, user } = useAuth();
  const [planningItems, setPlanningItems] = useState<PlanningItem[]>([]);
  const [catalog, setCatalog] = useState<CatalogCategory[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [itemsError, setItemsError] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [editingPlanningItem, setEditingPlanningItem] = useState<EditingPlanningItem | null>(null);
  const [catalogBusy, setCatalogBusy] = useState(false);
  const [catalogFormError, setCatalogFormError] = useState("");
  const [formState, setFormState] = useState<PlanningItemForm>(toInitialPlanningForm([]));
  const [typeForm, setTypeForm] = useState<TypeAdminForm>({
    category: "actividad",
    label: "",
  });
  const [detailForm, setDetailForm] = useState<DetailAdminForm>({
    category: "actividad",
    typeId: "",
    label: "",
  });
  const [editingType, setEditingType] = useState<EditTypeForm | null>(null);
  const [editingDetail, setEditingDetail] = useState<EditDetailForm | null>(null);

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        setItemsLoading(true);
        setCatalogLoading(true);
        setItemsError("");
        setCatalogError("");

        const [nextItems, nextCatalog] = await Promise.all([
          fetchPlanningItems(),
          fetchPlanningCatalog(),
        ]);

        if (!active) {
          return;
        }

        setPlanningItems(nextItems);
        setCatalog(nextCatalog);
        setFormState((current) => syncPlanningForm(current, nextCatalog));
        setDetailForm((current) => syncDetailAdminForm(current, nextCatalog));
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "No se pudieron cargar los datos del dashboard.";

        if (active) {
          setItemsError(message);
          setCatalogError(message);
        }
      } finally {
        if (active) {
          setItemsLoading(false);
          setCatalogLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      active = false;
    };
  }, []);

  function resetPlanningForm() {
    setFormState(syncPlanningForm(toInitialPlanningForm(catalog), catalog));
    setFormError("");
    setEditingPlanningItem(null);
  }

  async function refreshPlanningItems() {
    const nextItems = await fetchPlanningItems();
    setPlanningItems(nextItems);
  }

  async function refreshCatalog() {
    const nextCatalog = await fetchPlanningCatalog();
    setCatalog(nextCatalog);
    setFormState((current) => syncPlanningForm(current, nextCatalog));
    setDetailForm((current) => syncDetailAdminForm(current, nextCatalog));
    setEditingDetail((current) =>
      current ? syncDetailAdminForm(current, nextCatalog) : null
    );
  }

  async function mutateCatalog(method: "POST" | "PATCH" | "DELETE", payload: Record<string, unknown>) {
    if (!session?.access_token) {
      throw new Error("Necesitas iniciar sesion para administrar el catalogo.");
    }

    const response = await fetch("/api/planning-catalog", {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(payload),
    });
    const json = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(String(json.error ?? "No se pudo actualizar el catalogo."));
    }

    await refreshCatalog();
  }

  async function handleCreateItem(event: React.FormEvent) {
    event.preventDefault();
    setFormError("");

    if (!session?.access_token) {
      setFormError("Necesitas iniciar sesion para registrar actividades.");
      return;
    }

    setFormBusy(true);

    try {
      const response = await fetch("/api/planning-items", {
        method: editingPlanningItem ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(
          editingPlanningItem ? { id: editingPlanningItem.id, ...formState } : formState
        ),
      });
      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(String(json.error ?? "No se pudo crear el registro."));
      }

      await refreshPlanningItems();
      setIsModalOpen(false);
      resetPlanningForm();
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : "No se pudo crear el registro.");
    } finally {
      setFormBusy(false);
    }
  }

  function openEditPlanningItem(item: PlanningItem) {
    const nextCategory =
      catalog.find((category) => category.slug === item.category) ?? null;
    const nextType = nextCategory?.types.find((type) => type.label === item.item_type) ?? nextCategory?.types[0] ?? null;
    const nextDetail = nextType?.details.find((detail) => detail.label === item.description) ?? nextType?.details[0] ?? null;

    setFormState({
      item_date: item.item_date,
      start_time: item.start,
      end_time: item.end,
      shift: item.shift,
      level: item.level,
      front: item.front,
      category: item.category,
      item_type: nextType?.label ?? item.item_type,
      description: nextDetail?.label ?? item.description,
      notes: item.notes ?? "",
    });
    setEditingPlanningItem({ id: item.id });
    setFormError("");
    setIsModalOpen(true);
  }

  async function handleDeletePlanningItem(id: number) {
    setFormError("");

    if (!session?.access_token) {
      setFormError("Necesitas iniciar sesion para eliminar registros.");
      return;
    }

    setFormBusy(true);

    try {
      const response = await fetch("/api/planning-items", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id }),
      });
      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(String(json.error ?? "No se pudo eliminar el registro."));
      }

      await refreshPlanningItems();
      if (editingPlanningItem?.id === id) {
        resetPlanningForm();
        setIsModalOpen(false);
      }
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : "No se pudo eliminar el registro.");
    } finally {
      setFormBusy(false);
    }
  }

  async function handleCreateType(event: React.FormEvent) {
    event.preventDefault();
    setCatalogFormError("");

    if (!session?.access_token) {
      setCatalogFormError("Necesitas iniciar sesion para administrar el catalogo.");
      return;
    }

    setCatalogBusy(true);

    try {
      await mutateCatalog("POST", {
        entity: "type",
        category: typeForm.category,
        label: typeForm.label,
      });
      setTypeForm((current) => ({ ...current, label: "" }));
    } catch (error: unknown) {
      setCatalogFormError(error instanceof Error ? error.message : "No se pudo crear el tipo.");
    } finally {
      setCatalogBusy(false);
    }
  }

  async function handleCreateDetail(event: React.FormEvent) {
    event.preventDefault();
    setCatalogFormError("");

    if (!session?.access_token) {
      setCatalogFormError("Necesitas iniciar sesion para administrar el catalogo.");
      return;
    }

    setCatalogBusy(true);

    try {
      await mutateCatalog("POST", {
        entity: "detail",
        type_id: Number(detailForm.typeId),
        label: detailForm.label,
      });
      setDetailForm((current) => ({ ...current, label: "" }));
    } catch (error: unknown) {
      setCatalogFormError(error instanceof Error ? error.message : "No se pudo crear el detalle.");
    } finally {
      setCatalogBusy(false);
    }
  }

  async function handleUpdateType(event: React.FormEvent) {
    event.preventDefault();
    if (!editingType) {
      return;
    }

    setCatalogFormError("");
    setCatalogBusy(true);

    try {
      await mutateCatalog("PATCH", {
        entity: "type",
        id: editingType.id,
        category: editingType.category,
        label: editingType.label,
      });
      setEditingType(null);
    } catch (error: unknown) {
      setCatalogFormError(error instanceof Error ? error.message : "No se pudo editar el tipo.");
    } finally {
      setCatalogBusy(false);
    }
  }

  async function handleUpdateDetail(event: React.FormEvent) {
    event.preventDefault();
    if (!editingDetail) {
      return;
    }

    setCatalogFormError("");
    setCatalogBusy(true);

    try {
      await mutateCatalog("PATCH", {
        entity: "detail",
        id: editingDetail.id,
        type_id: Number(editingDetail.typeId),
        label: editingDetail.label,
      });
      setEditingDetail(null);
    } catch (error: unknown) {
      setCatalogFormError(error instanceof Error ? error.message : "No se pudo editar el detalle.");
    } finally {
      setCatalogBusy(false);
    }
  }

  async function handleDeleteType(id: number) {
    setCatalogFormError("");
    setCatalogBusy(true);

    try {
      await mutateCatalog("DELETE", {
        entity: "type",
        id,
      });
      if (editingType?.id === id) {
        setEditingType(null);
      }
      if (editingDetail) {
        setEditingDetail(null);
      }
    } catch (error: unknown) {
      setCatalogFormError(error instanceof Error ? error.message : "No se pudo eliminar el tipo.");
    } finally {
      setCatalogBusy(false);
    }
  }

  async function handleDeleteDetail(id: number) {
    setCatalogFormError("");
    setCatalogBusy(true);

    try {
      await mutateCatalog("DELETE", {
        entity: "detail",
        id,
      });
      if (editingDetail?.id === id) {
        setEditingDetail(null);
      }
    } catch (error: unknown) {
      setCatalogFormError(error instanceof Error ? error.message : "No se pudo eliminar el detalle.");
    } finally {
      setCatalogBusy(false);
    }
  }

  const selectedCategory =
    catalog.find((category) => category.slug === formState.category) ?? null;
  const availableTypes = selectedCategory?.types ?? [];
  const selectedType =
    availableTypes.find((type) => type.label === formState.item_type) ?? availableTypes[0] ?? null;
  const availableDescriptions = selectedType?.details ?? [];
  const detailTypesForAdmin =
    catalog.find((category) => category.slug === detailForm.category)?.types ?? [];
  const hasPlanning = planningItems.length > 0;
  const orderedShifts = ["Dia", "Noche"];
  const shiftSections = [
    ...orderedShifts
      .map((shift) => {
        const items = planningItems.filter((item) => item.shift === shift);
        return items.length ? { shift, items, scale: getShiftScale(shift, items) } : null;
      })
      .filter((section): section is { shift: string; items: PlanningItem[]; scale: ShiftScale } => Boolean(section)),
    ...[...new Set(planningItems.map((item) => item.shift))]
      .filter((shift) => !orderedShifts.includes(shift))
      .map((shift) => {
        const items = planningItems.filter((item) => item.shift === shift);
        return { shift, items, scale: getShiftScale(shift, items) };
      }),
  ];

  return (
    <section className="home-grid">
      <article className="surface-card hero hero-operational">
        <p className="eyebrow">Operacion</p>
        <h2 className="hero-title">Carta Gantt operativa</h2>
        <p className="body-copy">
          Registro diario de actividades e interferencias por fecha, turno, nivel, frente, tipo y detalle. El foco de esta pantalla es la secuencia operacional.
        </p>

        {itemsError ? <p className="feedback">{itemsError}</p> : null}
        {catalogError && catalogError !== itemsError ? <p className="feedback">{catalogError}</p> : null}

        <div className="section-toolbar">
          {!loading && session ? (
            <div className="hero-session">
              <p className="metric-label">Sesion activa</p>
              <p className="hero-session-value">{user?.email ?? "usuario autenticado"}</p>
            </div>
          ) : (
            <Link href="/login" className="button primary">
              Ingresar al panel
            </Link>
          )}

          <div className="toolbar-actions">
            <button
              type="button"
              className="button"
              onClick={() => setIsCatalogModalOpen(true)}
              disabled={!session || catalogLoading}
            >
              Configurar catalogo
            </button>
            <button
              type="button"
              className="button primary"
              onClick={() => {
                resetPlanningForm();
                setIsModalOpen(true);
              }}
              disabled={!session || catalogLoading || !catalog.length}
            >
              Nuevo registro
            </button>
          </div>
        </div>
      </article>

      <SectionCard eyebrow="Gantt" title="Programacion del dia">
        <div className="gantt-shell">
          <div className="gantt-body">
            {itemsLoading ? <p className="body-copy">Cargando planificacion...</p> : null}

            {!itemsLoading && !hasPlanning ? (
              <div className="empty-state">
                <p className="ops-kicker">Sin registros</p>
                <p className="ops-copy">
                  La tabla `planning_items` existe, pero todavia no tiene actividades o interferencias para mostrar.
                </p>
              </div>
            ) : null}

            {shiftSections.map((section) => (
              <section key={section.shift} className="gantt-section">
                <div className="gantt-section-header">
                  <div>
                    <p className="eyebrow">Escala por turno</p>
                    <h3 className="card-title" style={{ marginTop: 10 }}>
                      {section.scale.label}
                    </h3>
                    <p className="body-copy" style={{ marginTop: 8 }}>
                      {section.scale.description}
                    </p>
                  </div>
                  <span className="catalog-count">{section.items.length} registros</span>
                </div>

                <div className="gantt-header">
                  <div className="gantt-header-meta">Evento</div>
                  <div
                    className="gantt-header-timeline"
                    style={{ gridTemplateColumns: `repeat(${section.scale.slotCount}, minmax(0, 1fr))` }}
                  >
                    {section.scale.hourMarks.map((mark) => (
                      <span key={mark.key} className={mark.major ? "major" : "minor"}>
                        {mark.major ? mark.label : ""}
                      </span>
                    ))}
                  </div>
                </div>

                {section.items.map((item) => {
                  const start = positionMinutesInScale(item.start, section.scale);
                  let end = positionMinutesInScale(item.end, section.scale);

                  if (end <= start) {
                    end += 24 * 60;
                  }

                  const scaleSpan = section.scale.endMinutes - section.scale.startMinutes;
                  const startOffset = ((start - section.scale.startMinutes) / scaleSpan) * 100;
                  const width = ((end - start) / scaleSpan) * 100;
                  const duration = formatDuration(item.start, item.end);
                  const isCompactBar = width < 18;

                  return (
                    <article key={item.id} className="gantt-row">
                      <div className="gantt-meta">
                        <div className="gantt-title-row">
                          <h3>{item.description}</h3>
                          <span className={`category-pill ${item.category === "interferencia" ? "warning" : "success"}`}>
                            {toDisplayCategory(item.category)}
                          </span>
                          <span className="gantt-type-pill">{item.item_type}</span>
                        </div>
                        <div className="gantt-meta-chips">
                          <span className="gantt-info-chip strong">{item.front}</span>
                          <span className="gantt-info-chip strong">{item.level}</span>
                          <span className="gantt-info-chip">{item.shift}</span>
                          <span className="gantt-info-chip">{formatDateLabel(item.item_date)}</span>
                        </div>
                        <div className="gantt-row-actions">
                          <button
                            type="button"
                            className="button small"
                            onClick={() => openEditPlanningItem(item)}
                          >
                            Editar
                          </button>
                        </div>
                      </div>

                      <div
                        className="gantt-track"
                        style={{ gridTemplateColumns: `repeat(${section.scale.slotCount}, minmax(0, 1fr))` }}
                      >
                        <div className="gantt-track-frame" />
                        {section.scale.hourMarks.map((mark) => (
                          <span
                            key={`${item.id}-${mark.key}`}
                            className={`gantt-column ${mark.major ? "major" : "minor"}`}
                          />
                        ))}
                        <div
                          className={`gantt-bar ${item.category === "interferencia" ? "warning" : "success"} ${isCompactBar ? "compact" : ""}`}
                          style={{ left: `${startOffset}%`, width: `${width}%` }}
                        >
                          <span className="gantt-bar-main">
                            {item.start} - {item.end}
                          </span>
                          {!isCompactBar ? <span className="gantt-bar-separator">•</span> : null}
                          {!isCompactBar ? <span className="gantt-bar-duration">{duration}</span> : null}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </section>
            ))}
          </div>
        </div>
      </SectionCard>

      {isModalOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setIsModalOpen(false)}>
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="planning-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">Administracion</p>
                <h2 id="planning-modal-title" className="card-title" style={{ marginTop: 12 }}>
                  {editingPlanningItem ? "Editar actividad o interferencia" : "Crear actividad o interferencia"}
                </h2>
              </div>
                <button type="button" className="button" onClick={() => setIsModalOpen(false)}>
                  Cerrar
                </button>
            </div>

            <form className="modal-form" onSubmit={handleCreateItem}>
              <label className="field">
                Categoria
                <select
                  className="field-input"
                  value={formState.category}
                  onChange={(event) => {
                    const category = event.target.value as "actividad" | "interferencia";
                    const nextCategory =
                      catalog.find((entry) => entry.slug === category) ?? null;
                    const nextType = nextCategory?.types[0] ?? null;
                    const nextDetail = nextType?.details[0] ?? null;

                    setFormState((current) => ({
                      ...current,
                      category,
                      item_type: nextType?.label ?? "",
                      description: nextDetail?.label ?? "",
                    }));
                  }}
                >
                  {catalog.map((category) => (
                    <option key={category.slug} value={category.slug}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="modal-grid">
                <label className="field">
                  Tipo
                  <select
                    className="field-input"
                    value={formState.item_type}
                    onChange={(event) => {
                      const nextType =
                        availableTypes.find((type) => type.label === event.target.value) ?? null;

                      setFormState((current) => ({
                        ...current,
                        item_type: nextType?.label ?? "",
                        description: nextType?.details[0]?.label ?? "",
                      }));
                    }}
                  >
                    {availableTypes.map((type) => (
                      <option key={type.id} value={type.label}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  Detalle
                  <select
                    className="field-input"
                    value={formState.description}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, description: event.target.value }))
                    }
                  >
                    {availableDescriptions.map((detail) => (
                      <option key={detail.id} value={detail.label}>
                        {detail.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  Fecha
                  <input
                    className="field-input"
                    type="date"
                    value={formState.item_date}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, item_date: event.target.value }))
                    }
                  />
                </label>

                <label className="field">
                  Turno
                  <select
                    className="field-input"
                    value={formState.shift}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, shift: event.target.value }))
                    }
                  >
                    <option value="Dia">Dia</option>
                    <option value="Tarde">Tarde</option>
                    <option value="Noche">Noche</option>
                  </select>
                </label>

                <label className="field">
                  Hora inicio
                  <input
                    className="field-input"
                    type="time"
                    value={formState.start_time}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, start_time: event.target.value }))
                    }
                  />
                </label>

                <label className="field">
                  Hora termino
                  <input
                    className="field-input"
                    type="time"
                    value={formState.end_time}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, end_time: event.target.value }))
                    }
                  />
                </label>

                <label className="field">
                  Nivel
                  <input
                    className="field-input"
                    value={formState.level}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, level: event.target.value }))
                    }
                    placeholder="Ej: Nivel 840"
                  />
                </label>

                <label className="field">
                  Frente
                  <input
                    className="field-input"
                    value={formState.front}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, front: event.target.value }))
                    }
                    placeholder="Ej: Frente Norte 2"
                  />
                </label>
              </div>

              <label className="field">
                Notas
                <textarea
                  className="field-input field-textarea"
                  value={formState.notes}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, notes: event.target.value }))
                  }
                  placeholder="Observaciones operacionales, restricciones o contexto"
                />
              </label>

              {formError ? <p className="feedback">{formError}</p> : null}

              <div className="modal-actions">
                {editingPlanningItem ? (
                  <button
                    type="button"
                    className="button danger"
                    onClick={() => void handleDeletePlanningItem(editingPlanningItem.id)}
                    disabled={formBusy}
                  >
                    {formBusy ? "Eliminando..." : "Eliminar registro"}
                  </button>
                ) : null}
                <button type="button" className="button" onClick={() => setIsModalOpen(false)} disabled={formBusy}>
                  Cancelar
                </button>
                <button type="submit" className="button primary" disabled={formBusy || !availableDescriptions.length}>
                  {formBusy ? "Guardando..." : editingPlanningItem ? "Guardar cambios" : "Guardar registro"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isCatalogModalOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setIsCatalogModalOpen(false)}>
          <div
            className="modal-card catalog-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="catalog-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">Catalogo</p>
                <h2 id="catalog-modal-title" className="card-title" style={{ marginTop: 12 }}>
                  Configuracion jerarquica
                </h2>
                <p className="body-copy" style={{ marginTop: 8 }}>
                  Aqui administras como se comporta el formulario: categoria, tipo y detalle.
                </p>
              </div>
              <button type="button" className="button" onClick={() => setIsCatalogModalOpen(false)}>
                Cerrar
              </button>
            </div>

            <div className="catalog-admin-grid">
              <div className="catalog-admin-column">
                <article className="surface-card soft padded">
                  <p className="eyebrow">Nuevo tipo</p>
                  <form className="modal-form" onSubmit={handleCreateType}>
                    <label className="field">
                      Categoria
                      <select
                        className="field-input"
                        value={typeForm.category}
                        onChange={(event) =>
                          setTypeForm((current) => ({
                            ...current,
                            category: event.target.value as "actividad" | "interferencia",
                          }))
                        }
                      >
                        {catalog.map((category) => (
                          <option key={category.slug} value={category.slug}>
                            {category.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="field">
                      Nombre del tipo
                      <input
                        className="field-input"
                        value={typeForm.label}
                        onChange={(event) =>
                          setTypeForm((current) => ({ ...current, label: event.target.value }))
                        }
                        placeholder="Ej: logistica"
                      />
                    </label>

                    <button type="submit" className="button primary" disabled={catalogBusy || !typeForm.label.trim()}>
                      Agregar tipo
                    </button>
                  </form>
                </article>

                <article className="surface-card soft padded">
                  <p className="eyebrow">Nuevo detalle</p>
                  <form className="modal-form" onSubmit={handleCreateDetail}>
                    <label className="field">
                      Categoria
                      <select
                        className="field-input"
                        value={detailForm.category}
                        onChange={(event) =>
                          setDetailForm((current) =>
                            syncDetailAdminForm(
                              {
                                ...current,
                                category: event.target.value as "actividad" | "interferencia",
                                typeId: "",
                              },
                              catalog
                            )
                          )
                        }
                      >
                        {catalog.map((category) => (
                          <option key={category.slug} value={category.slug}>
                            {category.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="field">
                      Tipo
                      <select
                        className="field-input"
                        value={detailForm.typeId}
                        onChange={(event) =>
                          setDetailForm((current) => ({ ...current, typeId: event.target.value }))
                        }
                      >
                        {detailTypesForAdmin.map((type) => (
                          <option key={type.id} value={type.id}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="field">
                      Nombre del detalle
                      <input
                        className="field-input"
                        value={detailForm.label}
                        onChange={(event) =>
                          setDetailForm((current) => ({ ...current, label: event.target.value }))
                        }
                        placeholder="Ej: Desviacion de trafico interior mina"
                      />
                    </label>

                    <button
                      type="submit"
                      className="button primary"
                      disabled={catalogBusy || !detailForm.typeId || !detailForm.label.trim()}
                    >
                      Agregar detalle
                    </button>
                  </form>
                </article>

                {catalogFormError ? <p className="feedback">{catalogFormError}</p> : null}
              </div>

              <div className="catalog-tree">
                {catalogLoading ? <p className="body-copy">Cargando catalogo...</p> : null}

                {catalog.map((category) => (
                  <article key={category.slug} className="catalog-category-card">
                    <div className="catalog-category-header">
                      <div>
                        <p className="eyebrow">Categoria</p>
                        <h3 className="card-title" style={{ marginTop: 10 }}>
                          {category.label}
                        </h3>
                      </div>
                      <span className="catalog-count">{category.types.length} tipos</span>
                    </div>

                    <div className="catalog-type-list">
                      {category.types.map((type) => (
                        <div key={type.id} className="catalog-type-card">
                          <div className="catalog-type-header">
                            <div className="catalog-type-heading">
                              <strong>{type.label}</strong>
                              <span className="catalog-count">{type.details.length} detalles</span>
                            </div>
                            <div className="catalog-inline-actions">
                              <button
                                type="button"
                                className="button small"
                                onClick={() =>
                                  setEditingType({
                                    id: type.id,
                                    category: category.slug,
                                    label: type.label,
                                  })
                                }
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                className="button small danger"
                                onClick={() => void handleDeleteType(type.id)}
                                disabled={catalogBusy}
                              >
                                Eliminar
                              </button>
                            </div>
                          </div>

                          {editingType?.id === type.id ? (
                            <form className="catalog-edit-form" onSubmit={handleUpdateType}>
                              <label className="field">
                                Categoria
                                <select
                                  className="field-input"
                                  value={editingType.category}
                                  onChange={(event) =>
                                    setEditingType((current) =>
                                      current
                                        ? {
                                            ...current,
                                            category: event.target.value as "actividad" | "interferencia",
                                          }
                                        : current
                                    )
                                  }
                                >
                                  {catalog.map((entry) => (
                                    <option key={entry.slug} value={entry.slug}>
                                      {entry.label}
                                    </option>
                                  ))}
                                </select>
                              </label>

                              <label className="field">
                                Nombre del tipo
                                <input
                                  className="field-input"
                                  value={editingType.label}
                                  onChange={(event) =>
                                    setEditingType((current) =>
                                      current ? { ...current, label: event.target.value } : current
                                    )
                                  }
                                />
                              </label>

                              <div className="catalog-inline-actions">
                                <button type="submit" className="button small primary" disabled={catalogBusy || !editingType.label.trim()}>
                                  Guardar
                                </button>
                                <button type="button" className="button small" onClick={() => setEditingType(null)}>
                                  Cancelar
                                </button>
                              </div>
                            </form>
                          ) : null}

                          <div className="catalog-detail-list">
                            {type.details.map((detail) => (
                              <div key={detail.id} className="catalog-detail-row">
                                {editingDetail?.id === detail.id ? (
                                  <form className="catalog-edit-form detail" onSubmit={handleUpdateDetail}>
                                    <label className="field">
                                      Categoria
                                      <select
                                        className="field-input"
                                        value={editingDetail.category}
                                        onChange={(event) =>
                                          setEditingDetail((current) =>
                                            current
                                              ? syncDetailAdminForm(
                                                  {
                                                    ...current,
                                                    category: event.target.value as "actividad" | "interferencia",
                                                    typeId: "",
                                                  },
                                                  catalog
                                                )
                                              : current
                                          )
                                        }
                                      >
                                        {catalog.map((entry) => (
                                          <option key={entry.slug} value={entry.slug}>
                                            {entry.label}
                                          </option>
                                        ))}
                                      </select>
                                    </label>

                                    <label className="field">
                                      Tipo
                                      <select
                                        className="field-input"
                                        value={editingDetail.typeId}
                                        onChange={(event) =>
                                          setEditingDetail((current) =>
                                            current ? { ...current, typeId: event.target.value } : current
                                          )
                                        }
                                      >
                                        {(catalog.find((entry) => entry.slug === editingDetail.category)?.types ?? []).map((entry) => (
                                          <option key={entry.id} value={entry.id}>
                                            {entry.label}
                                          </option>
                                        ))}
                                      </select>
                                    </label>

                                    <label className="field">
                                      Detalle
                                      <input
                                        className="field-input"
                                        value={editingDetail.label}
                                        onChange={(event) =>
                                          setEditingDetail((current) =>
                                            current ? { ...current, label: event.target.value } : current
                                          )
                                        }
                                      />
                                    </label>

                                    <div className="catalog-inline-actions">
                                      <button type="submit" className="button small primary" disabled={catalogBusy || !editingDetail.label.trim() || !editingDetail.typeId}>
                                        Guardar
                                      </button>
                                      <button type="button" className="button small" onClick={() => setEditingDetail(null)}>
                                        Cancelar
                                      </button>
                                    </div>
                                  </form>
                                ) : (
                                  <>
                                    <span className="catalog-detail-chip">{detail.label}</span>
                                    <div className="catalog-inline-actions">
                                      <button
                                        type="button"
                                        className="button small"
                                        onClick={() =>
                                          setEditingDetail({
                                            id: detail.id,
                                            category: category.slug,
                                            typeId: String(type.id),
                                            label: detail.label,
                                          })
                                        }
                                      >
                                        Editar
                                      </button>
                                      <button
                                        type="button"
                                        className="button small danger"
                                        onClick={() => void handleDeleteDetail(detail.id)}
                                        disabled={catalogBusy}
                                      >
                                        Eliminar
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
