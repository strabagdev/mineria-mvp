import "server-only";

import {
  listReportSourceRows,
} from "@/server/repositories/reports.repository";
import {
  listPlanningCustomFieldValuesByActivityGroupIds,
  listPlanningCustomFieldValuesByExecutionSegmentIds,
  listPlanningCustomFieldValuesByPlanningItemIds,
} from "@/server/repositories/planning-custom-fields.repository";
import { listPlanningCustomFields } from "@/server/services/planning-custom-fields.service";
import {
  getPlanningAssignmentsForExecutionSegments,
  getPlanningAssignmentsForPlanningItems,
  listAssignmentTypes,
} from "@/server/services/planning-assignments.service";
import { buildReportFromSourceRows } from "@/modules/reporting/application/reporting-calculations";

export type ReportQuery = {
  dateFrom: string;
  dateTo: string;
  shift: string;
  level: string;
  front: string;
  category: string;
  trackingType: string;
  itemType: string;
};

export async function getReport(query: ReportQuery) {
  const { planningRows, realRows } = await listReportSourceRows({
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
  });
  const planningItemIds = planningRows.map((row) => row.id);
  const executionSegmentIds = realRows.map((row) => row.id);
  const activityGroupIds = [
    ...planningRows.map((row) => row.activity_group_id),
    ...realRows.map((row) => row.activity_group_id),
  ];
  const [
    customFields,
    planningItemValues,
    executionSegmentValues,
    activityGroupValues,
    assignmentTypes,
    planningAssignments,
    executionSegmentAssignments,
  ] = await Promise.all([
    listPlanningCustomFields({ activeOnly: false }),
    listPlanningCustomFieldValuesByPlanningItemIds(planningItemIds),
    listPlanningCustomFieldValuesByExecutionSegmentIds(executionSegmentIds),
    listPlanningCustomFieldValuesByActivityGroupIds(activityGroupIds),
    listAssignmentTypes({ activeOnly: false }),
    getPlanningAssignmentsForPlanningItems(planningItemIds),
    getPlanningAssignmentsForExecutionSegments(executionSegmentIds),
  ]);

  return buildReportFromSourceRows(
    query,
    planningRows,
    realRows,
    {
      fields: customFields,
      values: [
        ...planningItemValues,
        ...executionSegmentValues,
        ...activityGroupValues,
      ],
    },
    {
      types: assignmentTypes,
      assignments: [
        ...planningAssignments,
        ...executionSegmentAssignments,
      ],
    }
  );
}
