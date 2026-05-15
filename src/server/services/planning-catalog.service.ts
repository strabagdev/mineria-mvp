import "server-only";

import { writeAuditLog } from "@/lib/auditLog";
import {
  createPlanningCatalogDetail,
  createPlanningCatalogType,
  createPlanningLevel,
  deletePlanningCatalogDetail,
  deletePlanningCatalogType,
  deletePlanningLevel,
  getPlanningCatalogDetailById,
  getPlanningCatalogTypeById,
  getPlanningLevelById,
  listPlanningCatalogRows,
  updatePlanningCatalogDetail,
  updatePlanningCatalogType,
  updatePlanningLevel,
} from "@/server/repositories/planning-catalog.repository";

const categoryLabels = {
  actividad: "Actividad",
  interferencia: "Interferencia",
} as const;

type AuditActor = Parameters<typeof writeAuditLog>[0]["actor"];

export function slugifyPlanningCatalogValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function getPlanningCatalog() {
  const { types, details, levels } = await listPlanningCatalogRows();
  const groupedDetails = new Map<number, Array<{ id: number; label: string }>>();

  for (const detail of details) {
    const current = groupedDetails.get(detail.type_id) ?? [];
    current.push({ id: detail.id, label: detail.label });
    groupedDetails.set(detail.type_id, current);
  }

  const categories = (Object.entries(categoryLabels) as Array<
    [keyof typeof categoryLabels, string]
  >).map(([slug, label]) => ({
    slug,
    label,
    types: types
      .filter((type) => type.category === slug)
      .map((type) => ({
        id: type.id,
        slug: type.slug,
        label: type.label,
        details: groupedDetails.get(type.id) ?? [],
      })),
  }));

  return { categories, levels };
}

export async function createCatalogType(input: {
  actor: AuditActor;
  category: string;
  label: string;
  slug: string;
}) {
  const type = await createPlanningCatalogType({
    category: input.category,
    slug: input.slug,
    label: input.label,
  });

  await writeAuditLog({
    actor: input.actor,
    action: "catalog.type.created",
    entityType: "planning_catalog_type",
    entityId: type.id,
    after: type,
  });

  return type;
}

export async function createCatalogDetail(input: {
  actor: AuditActor;
  typeId: number;
  label: string;
}) {
  const detail = await createPlanningCatalogDetail({
    type_id: input.typeId,
    label: input.label,
  });

  await writeAuditLog({
    actor: input.actor,
    action: "catalog.detail.created",
    entityType: "planning_catalog_detail",
    entityId: detail.id,
    after: detail,
  });

  return detail;
}

export async function createCatalogLevel(input: {
  actor: AuditActor;
  label: string;
  slug: string;
}) {
  const level = await createPlanningLevel({ slug: input.slug, label: input.label });

  await writeAuditLog({
    actor: input.actor,
    action: "catalog.level.created",
    entityType: "planning_level",
    entityId: level.id,
    after: level,
  });

  return level;
}

export async function updateCatalogType(input: {
  actor: AuditActor;
  id: number;
  category: string;
  label: string;
  slug: string;
}) {
  const beforeData = await getPlanningCatalogTypeById(input.id);
  const type = await updatePlanningCatalogType(input.id, {
    category: input.category,
    label: input.label,
    slug: input.slug,
  });

  await writeAuditLog({
    actor: input.actor,
    action: "catalog.type.updated",
    entityType: "planning_catalog_type",
    entityId: type.id,
    before: beforeData,
    after: type,
  });

  return type;
}

export async function updateCatalogDetail(input: {
  actor: AuditActor;
  id: number;
  typeId: number;
  label: string;
}) {
  const beforeData = await getPlanningCatalogDetailById(input.id);
  const detail = await updatePlanningCatalogDetail(input.id, {
    type_id: input.typeId,
    label: input.label,
  });

  await writeAuditLog({
    actor: input.actor,
    action: "catalog.detail.updated",
    entityType: "planning_catalog_detail",
    entityId: detail.id,
    before: beforeData,
    after: detail,
  });

  return detail;
}

export async function updateCatalogLevel(input: {
  actor: AuditActor;
  id: number;
  label: string;
  slug: string;
}) {
  const beforeData = await getPlanningLevelById(input.id);
  const level = await updatePlanningLevel(input.id, {
    label: input.label,
    slug: input.slug,
  });

  await writeAuditLog({
    actor: input.actor,
    action: "catalog.level.updated",
    entityType: "planning_level",
    entityId: level.id,
    before: beforeData,
    after: level,
  });

  return level;
}

export async function deleteCatalogType(input: { actor: AuditActor; id: number }) {
  const beforeData = await getPlanningCatalogTypeById(input.id);
  await deletePlanningCatalogType(input.id);

  await writeAuditLog({
    actor: input.actor,
    action: "catalog.type.deleted",
    entityType: "planning_catalog_type",
    entityId: input.id,
    before: beforeData,
  });
}

export async function deleteCatalogDetail(input: { actor: AuditActor; id: number }) {
  const beforeData = await getPlanningCatalogDetailById(input.id);
  await deletePlanningCatalogDetail(input.id);

  await writeAuditLog({
    actor: input.actor,
    action: "catalog.detail.deleted",
    entityType: "planning_catalog_detail",
    entityId: input.id,
    before: beforeData,
  });
}

export async function deleteCatalogLevel(input: { actor: AuditActor; id: number }) {
  const beforeData = await getPlanningLevelById(input.id);
  await deletePlanningLevel(input.id);

  await writeAuditLog({
    actor: input.actor,
    action: "catalog.level.deleted",
    entityType: "planning_level",
    entityId: input.id,
    before: beforeData,
  });
}

