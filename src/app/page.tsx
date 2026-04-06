"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { useAuth } from "@/providers/auth-provider";

type PlanningItem = {
  id: number;
  activity_group_id: string;
  description: string;
  item_date: string;
  start: string;
  end: string;
  shift: string;
  level: string;
  front: string;
  category: "actividad" | "interferencia";
  tracking_type: "programado" | "real";
  item_type: string;
  notes?: string | null;
};

type PlanningItemApi = {
  id: number;
  activity_group_id: string;
  item_date: string;
  start_time: string;
  end_time: string;
  shift: string;
  level: string;
  front: string;
  category: "actividad" | "interferencia";
  tracking_type: "programado" | "real";
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
  activity_group_id: string;
  item_date: string;
  start_time: string;
  end_time: string;
  shift: string;
  level: string;
  front: string;
  category: "actividad" | "interferencia";
  tracking_type: "programado" | "real";
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

type ViewingPlanningItem = PlanningItem | null;

type PlanningGroup = {
  key: string;
  activity_group_id: string;
  item_date: string;
  shift: string;
  level: string;
  front: string;
  category: "actividad" | "interferencia";
  item_type: string;
  description: string;
  notes?: string | null;
  programado: PlanningItem | null;
  real: PlanningItem | null;
};

type GanttScale = {
  startMinutes: number;
  endMinutes: number;
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

function formatCurrentDateLabel(value: Date) {
  const formatted = new Intl.DateTimeFormat("es-CL", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(value);

  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function toDisplayCategory(category: PlanningItem["category"]) {
  return category === "interferencia" ? "Interferencia" : "Actividad";
}

function toTrackingTypeLabel(trackingType: PlanningItem["tracking_type"]) {
  return trackingType === "programado" ? "Programado" : "Real";
}

function buildPlanningItemAriaLabel(item: PlanningItem, duration: string) {
  return [
    item.description,
    `${toDisplayCategory(item.category)}, ${item.item_type}`,
    `Vista ${toTrackingTypeLabel(item.tracking_type)}`,
    `Frente ${item.front}, nivel ${item.level}`,
    `Turno ${item.shift}, ${formatDateLabel(item.item_date)}`,
    `Horario ${item.start} a ${item.end}, duracion ${duration}`,
  ].join(". ");
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

function buildGanttScale(start: string, end: string, wrapsMidnight: boolean): GanttScale {
  const startMinutes = toMinutes(start);
  const rawEndMinutes = toMinutes(end);
  const slotMinutes = 30;
  const baseEndMinutes = wrapsMidnight ? rawEndMinutes + 24 * 60 : rawEndMinutes;
  const spanMinutes = baseEndMinutes - startMinutes;
  const slotCount = Math.ceil(spanMinutes / slotMinutes);
  const endMinutes = baseEndMinutes;
  const hourMarks = Array.from({ length: slotCount }, (_, index) => {
    const minutes = startMinutes + index * slotMinutes;
    return {
      key: `gantt-${minutes}`,
      label: toTimeLabel(minutes),
      major: minutes % 60 === 0,
    };
  });

  return {
    startMinutes,
    endMinutes,
    slotMinutes,
    slotCount,
    hourMarks,
  };
}
function positionMinutesInScale(time: string, scale: GanttScale) {
  let minutes = toMinutes(time);

  if (minutes < scale.startMinutes) {
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
    activity_group_id: crypto.randomUUID(),
    item_date: new Date().toISOString().slice(0, 10),
    start_time: "07:00",
    end_time: "08:00",
    shift: "Dia",
    level: "",
    front: "",
    category: defaultCategory.slug,
    tracking_type: "programado",
    item_type: defaultType?.label ?? "",
    description: defaultDetail?.label ?? "",
    notes: "",
  };
}

function syncPlanningForm(form: PlanningItemForm, categories: CatalogCategory[]) {
  const fallback = toInitialPlanningForm(categories);
  const normalizedCategory =
    form.tracking_type === "programado" ? ("actividad" as const) : form.category;
  const selectedCategory =
    categories.find((category) => category.slug === normalizedCategory) ??
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

function groupPlanningItems(items: PlanningItem[]) {
  const groups = new Map<string, PlanningGroup>();

  for (const item of items) {
    const existingGroup = groups.get(item.activity_group_id);

    if (existingGroup) {
      existingGroup[item.tracking_type] = item;
      continue;
    }

    groups.set(item.activity_group_id, {
      key: item.activity_group_id,
      activity_group_id: item.activity_group_id,
      item_date: item.item_date,
      shift: item.shift,
      level: item.level,
      front: item.front,
      category: item.category,
      item_type: item.item_type,
      description: item.description,
      notes: item.notes ?? null,
      programado: item.tracking_type === "programado" ? item : null,
      real: item.tracking_type === "real" ? item : null,
    });
  }

  return Array.from(groups.values()).sort((left, right) => {
    const leftItem = left.programado ?? left.real;
    const rightItem = right.programado ?? right.real;

    if (!leftItem || !rightItem) {
      return 0;
    }

    return `${leftItem.item_date}-${leftItem.start}`.localeCompare(`${rightItem.item_date}-${rightItem.start}`);
  });
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
        activity_group_id: item.activity_group_id,
        item_date: item.item_date,
        start: item.start_time.slice(0, 5),
        end: item.end_time.slice(0, 5),
        shift: item.shift,
        level: item.level,
        front: item.front,
        category: item.category,
        tracking_type: item.tracking_type,
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
  const { session } = useAuth();
  const todayIso = new Date().toISOString().slice(0, 10);
  const [planningItems, setPlanningItems] = useState<PlanningItem[]>([]);
  const [catalog, setCatalog] = useState<CatalogCategory[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [itemsError, setItemsError] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [viewingPlanningItem, setViewingPlanningItem] = useState<ViewingPlanningItem>(null);
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

  useEffect(() => {
    if (formState.tracking_type !== "programado" || formState.category === "actividad") {
      return;
    }

    const activityCategory = catalog.find((category) => category.slug === "actividad") ?? null;
    const nextType = activityCategory?.types[0] ?? null;
    const nextDetail = nextType?.details[0] ?? null;

    setFormState((current) => ({
      ...current,
      category: "actividad",
      item_type: nextType?.label ?? "",
      description: nextDetail?.label ?? "",
    }));
  }, [catalog, formState.category, formState.tracking_type]);

  useEffect(() => {
    setFormState((current) => ({ ...current, item_date: selectedDate }));
  }, [selectedDate]);

  function resetPlanningForm() {
    const nextForm = syncPlanningForm(toInitialPlanningForm(catalog), catalog);
    setFormState({ ...nextForm, item_date: selectedDate });
    setFormError("");
    setEditingPlanningItem(null);
  }

  function openPlanningDetail(item: PlanningItem) {
    setViewingPlanningItem(item);
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
      current ? { ...current, ...syncDetailAdminForm(current, nextCatalog) } : null
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
    if (selectedDate !== todayIso) {
      return;
    }

    const nextCategory =
      catalog.find((category) => category.slug === item.category) ?? null;
    const nextType = nextCategory?.types.find((type) => type.label === item.item_type) ?? nextCategory?.types[0] ?? null;
    const nextDetail = nextType?.details.find((detail) => detail.label === item.description) ?? nextType?.details[0] ?? null;

    setFormState({
      activity_group_id: item.activity_group_id,
      item_date: item.item_date,
      start_time: item.start,
      end_time: item.end,
      shift: item.shift,
      level: item.level,
      front: item.front,
      category: item.category,
      tracking_type: item.tracking_type,
      item_type: nextType?.label ?? item.item_type,
      description: nextDetail?.label ?? item.description,
      notes: item.notes ?? "",
    });
    setEditingPlanningItem({ id: item.id });
    setFormError("");
    setViewingPlanningItem(null);
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

  const isRealForm = formState.tracking_type === "real";
  const availableFormCategories = isRealForm
    ? catalog
    : catalog.filter((category) => category.slug === "actividad");
  const selectedCategory =
    availableFormCategories.find((category) => category.slug === formState.category) ??
    availableFormCategories[0] ??
    null;
  const availableTypes = selectedCategory?.types ?? [];
  const selectedType =
    availableTypes.find((type) => type.label === formState.item_type) ?? availableTypes[0] ?? null;
  const availableDescriptions = selectedType?.details ?? [];
  const detailTypesForAdmin =
    catalog.find((category) => category.slug === detailForm.category)?.types ?? [];
  const filteredPlanningItems = planningItems.filter((item) => item.item_date === selectedDate);
  const hasPlanning = filteredPlanningItems.length > 0;
  const groupedPlanningItems = groupPlanningItems(filteredPlanningItems);
  const ganttScale = buildGanttScale("08:00", "08:00", true);
  const selectedDateLabel = formatCurrentDateLabel(new Date(`${selectedDate}T00:00:00`));
  const isHistoricalView = selectedDate !== todayIso;
  const formContextLabel = isRealForm ? "Real" : "Programacion";
  const planningModalTitle = editingPlanningItem
    ? `Editar ${isRealForm ? "real" : "programacion"}`
    : `Crear ${isRealForm ? "real" : "programacion"}`;
  const planningSubmitLabel = editingPlanningItem
    ? `Guardar ${isRealForm ? "real" : "programacion"}`
    : `Guardar ${isRealForm ? "real" : "programacion"}`;
  const planningDeleteLabel = `Eliminar ${isRealForm ? "real" : "programacion"}`;

  function renderGanttBar(item: PlanningItem | null, layer: "programado" | "real") {
    if (!item) {
      return null;
    }

    const start = positionMinutesInScale(item.start, ganttScale);
    let end = positionMinutesInScale(item.end, ganttScale);

    if (end <= start) {
      end += 24 * 60;
    }

    const scaleSpan = ganttScale.endMinutes - ganttScale.startMinutes;
    const startOffset = ((start - ganttScale.startMinutes) / scaleSpan) * 100;
    const width = ((end - start) / scaleSpan) * 100;
    const duration = formatDuration(item.start, item.end);
    const ariaLabel = buildPlanningItemAriaLabel(item, duration);

    return (
      <div
        className={`gantt-bar ${item.category === "interferencia" ? "warning" : "success"} ${layer}`}
        aria-label={ariaLabel}
        role="button"
        tabIndex={0}
        onClick={() => openPlanningDetail(item)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openPlanningDetail(item);
          }
        }}
        style={{ left: `${startOffset}%`, width: `${width}%` }}
      />
    );
  }

  function openCreatePlanningVariant(group: PlanningGroup, trackingType: "programado" | "real") {
    if (isHistoricalView) {
      return;
    }

    const sourceItem = group[trackingType] ?? group.programado ?? group.real;
    const nextCategory = catalog.find((category) => category.slug === group.category) ?? null;
    const nextType = nextCategory?.types.find((type) => type.label === group.item_type) ?? nextCategory?.types[0] ?? null;
    const nextDetail =
      nextType?.details.find((detail) => detail.label === group.description) ?? nextType?.details[0] ?? null;

    setFormState({
      activity_group_id: group.activity_group_id,
      item_date: sourceItem?.item_date ?? group.item_date,
      start_time: sourceItem?.start ?? "07:00",
      end_time: sourceItem?.end ?? "08:00",
      shift: sourceItem?.shift ?? group.shift,
      level: sourceItem?.level ?? group.level,
      front: sourceItem?.front ?? group.front,
      category: group.category,
      tracking_type: trackingType,
      item_type: nextType?.label ?? group.item_type,
      description: nextDetail?.label ?? group.description,
      notes: sourceItem?.notes ?? group.notes ?? "",
    });
    setEditingPlanningItem(null);
    setFormError("");
    setViewingPlanningItem(null);
    setIsModalOpen(true);
  }

  return (
    <section className="home-grid">
      <article className="surface-card hero hero-operational">
        <div className="hero-operational-line">
          <div className="hero-operational-copy">
            <div className="hero-badge-row">
              <span className="hero-badge hero-badge-strong">Planificacion diaria</span>
              <span className="hero-badge">Programado vs real</span>
            </div>
            <h2 className="hero-title">Seguimiento operativo del turno</h2>
            <p className="body-copy">
              Registra la programacion del dia y contrasta su ejecucion real dentro de una misma grilla operativa.
            </p>
          </div>

          <div className="hero-date-chip" aria-label={`Fecha visualizada ${selectedDateLabel}`}>
            <span className="hero-date-label">{isHistoricalView ? "Fecha historica" : "Fecha actual"}</span>
            <strong className="hero-date-value">{selectedDateLabel}</strong>
          </div>
        </div>

        <div className="hero-operational-footer">
          <div className="hero-inline-block">
            <p className="hero-inline-note">
              {isHistoricalView
                ? "Modo historico: puedes revisar registros anteriores, pero sin editar ni agregar cambios."
                : "Gestion operativa simple, enfocada en registrar y comparar sin ruido visual."}
            </p>
            <div className="history-controls" aria-label="Selector de fecha">
              <label className="field history-field">
                <span className="history-label">Visualizar dia</span>
                <input
                  className="field-input history-input"
                  type="date"
                  max={todayIso}
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                />
              </label>
              {isHistoricalView ? (
                <button type="button" className="button" onClick={() => setSelectedDate(todayIso)}>
                  Volver a hoy
                </button>
              ) : null}
            </div>
          </div>
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
                setFormState((current) => ({ ...current, tracking_type: "programado" }));
                setIsModalOpen(true);
              }}
              disabled={!session || catalogLoading || !catalog.length || isHistoricalView}
            >
              Nueva programacion
            </button>
          </div>
        </div>

        {itemsError ? <p className="feedback">{itemsError}</p> : null}
        {catalogError && catalogError !== itemsError ? <p className="feedback">{catalogError}</p> : null}
      </article>

      <section className="gantt-stage">
        <div className="gantt-shell">
          <div className="gantt-body">
            {itemsLoading ? <p className="body-copy">Cargando planificacion...</p> : null}

            {!itemsLoading && !hasPlanning ? (
              <div className="empty-state">
                <p className="ops-kicker">Sin registros</p>
                <p className="ops-copy">
                  No hay actividades ni interferencias registradas para {formatDateLabel(selectedDate)}.
                </p>
              </div>
            ) : null}

            {hasPlanning ? (
              <section className="gantt-section">
                <div className="gantt-section-header">
                  <div className="gantt-legend" aria-label="Leyenda de barras">
                    <span className="gantt-legend-chip programado">Programado</span>
                    <span className="gantt-legend-chip real">Real</span>
                  </div>
                </div>

                <div className="gantt-header">
                  <div className="gantt-header-meta">Evento</div>
                  <div
                    className="gantt-header-timeline"
                    style={{ gridTemplateColumns: `repeat(${ganttScale.slotCount}, minmax(0, 1fr))` }}
                  >
                    {ganttScale.hourMarks.map((mark, index) => (
                      <span
                        key={mark.key}
                        className={[
                          mark.major ? "major" : "minor",
                          mark.major && index === 0 ? "first-major" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        {mark.major ? <span className="gantt-hour-label">{mark.label}</span> : null}
                      </span>
                    ))}
                  </div>
                </div>

                <div
                  className="gantt-rows"
                  style={
                    {
                      "--gantt-slot-count": String(ganttScale.slotCount),
                    } as CSSProperties
                  }
                >
                  <div className="gantt-rows-timeline-bg" aria-hidden="true" />

                  {groupedPlanningItems.map((group) => {
                    return (
                      <article key={group.key} className="gantt-row gantt-row-dual">
                        <div className="gantt-meta">
                          <div className="gantt-meta-primary">
                            <h3 title={group.description}>{group.description}</h3>
                            <div className="gantt-meta-line">
                              <div className="field-list">
                                <span className={`category-pill ${group.category === "interferencia" ? "warning" : "success"}`}>
                                  {toDisplayCategory(group.category)}
                                </span>
                                <span className="field-chip">{group.item_type}</span>
                              </div>

                              <div className="gantt-meta-secondary">
                                {!isHistoricalView && group.programado ? (
                                  <button
                                    type="button"
                                    className="button icon-button programado"
                                    onClick={() => openEditPlanningItem(group.programado!)}
                                    aria-label={`Editar programacion de ${group.description}`}
                                    title="Editar programacion"
                                  >
                                    <span aria-hidden="true">P</span>
                                  </button>
                                ) : null}
                                {!isHistoricalView && group.real ? (
                                  <button
                                    type="button"
                                    className="button icon-button real"
                                    onClick={() => openEditPlanningItem(group.real!)}
                                    aria-label={`Editar real de ${group.description}`}
                                    title="Editar real"
                                  >
                                    <span aria-hidden="true">R</span>
                                  </button>
                                ) : null}
                                {!isHistoricalView && group.programado && !group.real ? (
                                  <button
                                    type="button"
                                    className="button icon-button real"
                                    onClick={() => openCreatePlanningVariant(group, "real")}
                                    aria-label={`Agregar real a ${group.description}`}
                                    title="Agregar real"
                                  >
                                    <span aria-hidden="true">+</span>
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="gantt-track gantt-track-compare">
                          {renderGanttBar(group.programado, "programado")}
                          {renderGanttBar(group.real, "real")}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </section>

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
                <p className="eyebrow">{formContextLabel}</p>
                <h2 id="planning-modal-title" className="card-title" style={{ marginTop: 12 }}>
                  {planningModalTitle}
                </h2>
              </div>
                <button type="button" className="button" onClick={() => setIsModalOpen(false)}>
                  Cerrar
                </button>
            </div>

            <form className="modal-form" onSubmit={handleCreateItem}>
              {isRealForm ? (
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
                    {availableFormCategories.map((category) => (
                      <option key={category.slug} value={category.slug}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className="field">
                  Categoria
                  <input className="field-input" value="Actividad" readOnly />
                </label>
              )}

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
                    {formBusy ? "Eliminando..." : planningDeleteLabel}
                  </button>
                ) : null}
                <button type="button" className="button" onClick={() => setIsModalOpen(false)} disabled={formBusy}>
                  Cancelar
                </button>
                <button type="submit" className="button primary" disabled={formBusy || !availableDescriptions.length}>
                  {formBusy ? "Guardando..." : planningSubmitLabel}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {viewingPlanningItem ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setViewingPlanningItem(null)}>
          <div
            className="modal-card detail-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="planning-detail-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">Detalle</p>
                <h2 id="planning-detail-title" className="card-title" style={{ marginTop: 12 }}>
                  {viewingPlanningItem.description}
                </h2>
              </div>
              <button type="button" className="button" onClick={() => setViewingPlanningItem(null)}>
                Cerrar
              </button>
            </div>

            <div className="detail-modal-grid">
              <article className="detail-card">
                <p className="detail-label">Vista</p>
                <p className="detail-value">{toTrackingTypeLabel(viewingPlanningItem.tracking_type)}</p>
              </article>
              <article className="detail-card">
                <p className="detail-label">Categoria</p>
                <p className="detail-value">{toDisplayCategory(viewingPlanningItem.category)}</p>
              </article>
              <article className="detail-card">
                <p className="detail-label">Tipo</p>
                <p className="detail-value">{viewingPlanningItem.item_type}</p>
              </article>
              <article className="detail-card">
                <p className="detail-label">Fecha</p>
                <p className="detail-value">{formatDateLabel(viewingPlanningItem.item_date)}</p>
              </article>
              <article className="detail-card">
                <p className="detail-label">Turno</p>
                <p className="detail-value">{viewingPlanningItem.shift}</p>
              </article>
              <article className="detail-card">
                <p className="detail-label">Horario</p>
                <p className="detail-value">
                  {viewingPlanningItem.start} - {viewingPlanningItem.end}
                </p>
              </article>
              <article className="detail-card">
                <p className="detail-label">Duracion</p>
                <p className="detail-value">{formatDuration(viewingPlanningItem.start, viewingPlanningItem.end)}</p>
              </article>
              <article className="detail-card">
                <p className="detail-label">Nivel</p>
                <p className="detail-value">{viewingPlanningItem.level}</p>
              </article>
              <article className="detail-card">
                <p className="detail-label">Frente</p>
                <p className="detail-value">{viewingPlanningItem.front}</p>
              </article>
            </div>

            {viewingPlanningItem.notes ? (
              <article className="detail-notes-card">
                <p className="detail-label">Notas</p>
                <p className="detail-notes-copy">{viewingPlanningItem.notes}</p>
              </article>
            ) : null}

            <div className="modal-actions">
              <button type="button" className="button" onClick={() => setViewingPlanningItem(null)}>
                Cerrar
              </button>
              {!isHistoricalView ? (
                <button
                  type="button"
                  className="button primary"
                  onClick={() => openEditPlanningItem(viewingPlanningItem)}
                >
                  Editar registro
                </button>
              ) : null}
            </div>
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
                                              ? {
                                                  ...current,
                                                  ...syncDetailAdminForm(
                                                    {
                                                      ...current,
                                                      category: event.target.value as "actividad" | "interferencia",
                                                      typeId: "",
                                                    },
                                                    catalog
                                                  ),
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
