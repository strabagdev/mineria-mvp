import type {
  PlanningCatalogCategoryDto,
  PlanningCatalogDetailDto,
  PlanningCatalogTypeDto,
} from "@/modules/planning/contracts/planning-catalog";
import type {
  PlanningCategoryDto,
  PlanningItemOperationalHeaderValueDto,
  PlanningTrackingTypeDto,
} from "@/modules/planning/contracts/planning-items";
import type { GanttGroupingPathEntry } from "./planning-page-helpers";

export type PlanningItem = {
  id: number;
  activity_group_id: string;
  description: string;
  item_date: string;
  start: string;
  end: string;
  shift: string;
  category: PlanningCategoryDto;
  tracking_type: PlanningTrackingTypeDto;
  item_type: string;
  notes?: string | null;
  operational_header_values?: PlanningItemOperationalHeaderValueDto[];
  sync_status?: "pending";
};

export type CatalogDetail = PlanningCatalogDetailDto;
export type CatalogType = PlanningCatalogTypeDto;
export type CatalogCategory = PlanningCatalogCategoryDto;
export type PlanningCatalog = {
  categories: CatalogCategory[];
};

export type PlanningItemForm = {
  activity_group_id: string;
  item_date: string;
  start_time: string;
  end_time: string;
  shift: string;
  category: PlanningCategoryDto;
  tracking_type: PlanningTrackingTypeDto;
  item_type: string;
  description: string;
  notes: string;
};

export type DetailAdminForm = {
  category: PlanningCategoryDto;
  typeId: string;
  label: string;
};

export type TypeAdminForm = {
  category: PlanningCategoryDto;
  label: string;
};

export type EditTypeForm = {
  id: number;
  category: PlanningCategoryDto;
  label: string;
};

export type EditDetailForm = {
  id: number;
  category: PlanningCategoryDto;
  typeId: string;
  label: string;
};

export type PlanningGroup = {
  key: string;
  activity_group_id: string;
  item_date: string;
  shift: string;
  category: PlanningCategoryDto;
  item_type: string;
  description: string;
  notes?: string | null;
  programado: PlanningItem | null;
  realSegments: PlanningItem[];
  gantt_group_path?: GanttGroupingPathEntry[];
};
