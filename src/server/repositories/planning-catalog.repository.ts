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

export type PlanningLevelRow = {
  id: number;
  slug: string;
  label: string;
};

const typeSelect = "id, category, slug, label";
const detailSelect = "id, type_id, label";
const levelSelect = "id, slug, label";

export async function listPlanningCatalogRows() {
  const db = getSupabaseServerClient();
  const [
    { data: types, error: typesError },
    { data: details, error: detailsError },
    { data: levels, error: levelsError },
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
      db
        .from("planning_levels")
        .select(levelSelect)
        .order("id", { ascending: true }),
    ]);

  if (typesError) {
    throw typesError;
  }

  if (detailsError) {
    throw detailsError;
  }

  if (levelsError) {
    throw levelsError;
  }

  return {
    types: (types ?? []) as PlanningCatalogTypeRow[],
    details: (details ?? []) as PlanningCatalogDetailRow[],
    levels: (levels ?? []) as PlanningLevelRow[],
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

export async function findPlanningLevelByLabel(label: string) {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("planning_levels")
    .select("id")
    .eq("label", label)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as { id: number } | null;
}

export async function findPlanningCatalogTypeByCategoryAndLabel(
  category: string,
  label: string
) {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("planning_catalog_types")
    .select("id")
    .eq("category", category)
    .eq("label", label)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as { id: number } | null;
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

export async function createPlanningLevel(input: { slug: string; label: string }) {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("planning_levels")
    .insert(input)
    .select(levelSelect)
    .single();

  if (error) {
    throw error;
  }

  return data as PlanningLevelRow;
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

export async function getPlanningLevelById(id: number) {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("planning_levels")
    .select(levelSelect)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as PlanningLevelRow | null;
}

export async function updatePlanningLevel(
  id: number,
  input: { label: string; slug: string }
) {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("planning_levels")
    .update(input)
    .eq("id", id)
    .select(levelSelect)
    .single();

  if (error) {
    throw error;
  }

  return data as PlanningLevelRow;
}

export async function deletePlanningLevel(id: number) {
  const db = getSupabaseServerClient();
  const { error } = await db.from("planning_levels").delete().eq("id", id);

  if (error) {
    throw error;
  }
}
