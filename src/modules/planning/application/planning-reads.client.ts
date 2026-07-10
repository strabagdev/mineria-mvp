import { assertBrowserOnline } from "@/lib/networkStatus";
import type {
  PlanningCatalogResponseDto,
} from "@/modules/planning/contracts/planning-catalog";
import type {
  PlanningItemDto,
  PlanningItemsResponseDto,
} from "@/modules/planning/contracts/planning-items";
import type {
  PlanningCatalog,
  PlanningItem,
} from "@/modules/planning/presentation/planning-page-models";

function toPlanningItem(item: PlanningItemDto): PlanningItem {
  return {
    id: item.id,
    activity_group_id: item.activity_group_id,
    item_date: item.item_date,
    start: item.start_time.slice(0, 5),
    end: item.end_time.slice(0, 5),
    shift: item.shift,
    category: item.category,
    tracking_type: item.tracking_type,
    item_type: item.item_type,
    description: item.description,
    notes: item.notes ?? null,
    operational_header_values: item.operational_header_values,
  };
}

export async function fetchPlanningItems(date: string, accessToken?: string) {
  assertBrowserOnline();

  if (!accessToken) {
    throw new Error("Necesitas iniciar sesion para ver la planificacion.");
  }

  const response = await fetch(`/api/planning-items?date=${encodeURIComponent(date)}`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(String(json.error ?? "No se pudo cargar la planificacion."));
  }

  const payload = json as Partial<PlanningItemsResponseDto>;
  return Array.isArray(payload.items) ? payload.items.map((item) => toPlanningItem(item)) : [];
}

export async function fetchPlanningCatalog(accessToken?: string): Promise<PlanningCatalog> {
  assertBrowserOnline();

  if (!accessToken) {
    throw new Error("Necesitas iniciar sesion para ver el catalogo.");
  }

  const response = await fetch("/api/planning-catalog", {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(String(json.error ?? "No se pudo cargar el catalogo."));
  }

  const payload = json as Partial<PlanningCatalogResponseDto>;
  return {
    categories: Array.isArray(payload.categories) ? payload.categories : [],
  };
}
