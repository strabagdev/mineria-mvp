import "server-only";

import { getSupabaseServerClient } from "@/server/db/supabase";

export type PlanningCatalogTypeRow = {
  id: number;
  category: string;
  slug: string;
  label: string;
};

export type PlanningCatalogDetailRow = {
  id: number;
  type_id: number;
  label: string;
};

const typeSelect = "id, category, slug, label";
const detailSelect = "id, type_id, label";

export async function listPlanningCatalogRows() {
  const db = getSupabaseServerClient();
  const [
    { data: types, error: typesError },
    { data: details, error: detailsError },
  ] =
    await Promise.all([
      db
        .from("planning_catalog_types")
        .select(typeSelect)
        .order("category", { ascending: true })
        .order("label", { ascending: true }),
      db
        .from("planning_catalog_details")
        .select(detailSelect)
        .order("label", { ascending: true }),
    ]);

  if (typesError) {
    throw typesError;
  }

  if (detailsError) {
    throw detailsError;
  }

  return {
    types: (types ?? []) as PlanningCatalogTypeRow[],
    details: (details ?? []) as PlanningCatalogDetailRow[],
  };
}

export async function createPlanningCatalogType(input: {
  category: string;
  slug: string;
  label: string;
}) {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("planning_catalog_types")
    .insert(input)
    .select(typeSelect)
    .single();

  if (error) {
    throw error;
  }

  return data as PlanningCatalogTypeRow;
}

export async function findPlanningCatalogTypeByCategoryAndLabel(
  category: string,
  label: string
) {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("planning_catalog_types")
    .select("id, slug, label")
    .eq("category", category);

  if (error) {
    throw error;
  }

  const normalizedValue = label.trim().toLowerCase();
  const selectedType =
    ((data ?? []) as Array<{ id: number; slug: string; label: string }>).find(
      (type) =>
        type.label.trim().toLowerCase() === normalizedValue ||
        type.slug.trim().toLowerCase() === normalizedValue
    ) ?? null;

  return selectedType ? { id: selectedType.id } : null;
}

export async function findPlanningCatalogDetailByTypeAndLabel(
  typeId: number,
  label: string
) {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("planning_catalog_details")
    .select("id")
    .eq("type_id", typeId)
    .eq("label", label)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as { id: number } | null;
}

export async function createPlanningCatalogDetail(input: {
  type_id: number;
  label: string;
}) {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("planning_catalog_details")
    .insert(input)
    .select(detailSelect)
    .single();

  if (error) {
    throw error;
  }

  return data as PlanningCatalogDetailRow;
}

export async function getPlanningCatalogTypeById(id: number) {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("planning_catalog_types")
    .select(typeSelect)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as PlanningCatalogTypeRow | null;
}

export async function updatePlanningCatalogType(
  id: number,
  input: { category: string; label: string; slug: string }
) {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("planning_catalog_types")
    .update(input)
    .eq("id", id)
    .select(typeSelect)
    .single();

  if (error) {
    throw error;
  }

  return data as PlanningCatalogTypeRow;
}

export async function deletePlanningCatalogType(id: number) {
  const db = getSupabaseServerClient();
  const { error } = await db.from("planning_catalog_types").delete().eq("id", id);

  if (error) {
    throw error;
  }
}

export async function getPlanningCatalogDetailById(id: number) {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("planning_catalog_details")
    .select(detailSelect)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as PlanningCatalogDetailRow | null;
}

export async function updatePlanningCatalogDetail(
  id: number,
  input: { type_id: number; label: string }
) {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("planning_catalog_details")
    .update(input)
    .eq("id", id)
    .select(detailSelect)
    .single();

  if (error) {
    throw error;
  }

  return data as PlanningCatalogDetailRow;
}

export async function deletePlanningCatalogDetail(id: number) {
  const db = getSupabaseServerClient();
  const { error } = await db.from("planning_catalog_details").delete().eq("id", id);

  if (error) {
    throw error;
  }
}
