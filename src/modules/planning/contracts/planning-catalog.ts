import type { PlanningCategoryDto } from "./planning-items";

export type PlanningCatalogDetailDto = {
  id: number;
  label: string;
};

export type PlanningCatalogTypeDto = {
  id: number;
  slug: string;
  label: string;
  details: PlanningCatalogDetailDto[];
};

export type PlanningCatalogCategoryDto = {
  slug: PlanningCategoryDto;
  label: string;
  types: PlanningCatalogTypeDto[];
};

export type PlanningCatalogResponseDto = {
  categories: PlanningCatalogCategoryDto[];
};

export type PlanningCatalogEntityDto = "type" | "detail";

export type PlanningCatalogCreateRequestDto = {
  entity?: PlanningCatalogEntityDto;
  category?: string;
  label?: string;
  type_id?: number;
};

export type PlanningCatalogUpdateRequestDto = PlanningCatalogCreateRequestDto & {
  id?: number;
};

export type PlanningCatalogDeleteRequestDto = {
  entity?: PlanningCatalogEntityDto;
  id?: number;
};
