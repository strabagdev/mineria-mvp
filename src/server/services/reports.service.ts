import "server-only";

import {
  listReportSourceRows,
} from "@/server/repositories/reports.repository";
import {
  getPlanningAssignmentsForExecutionSegments,
  getPlanningAssignmentsForPlanningItems,
  listAssignmentTypes,
} from "@/server/services/planning-assignments.service";
import {
  listOperationalHeaderFields,
  listOperationalHeaderValuesByActivityGroupIds,
  listOperationalHeaderValuesByExecutionSegmentIds,
  listOperationalHeaderValuesByPlanningItemIds,
} from "@/server/services/operational-header.service";
import { buildReportFromSourceRows } from "@/modules/reporting/application/reporting-calculations";

export type ReportQuery = {
  dateFrom: string;
  dateTo: string;
  shift: string;
  category: string;
  trackingType: string;
  itemType: string;
  operational_header_filters?: Record<string, string>;
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
    assignmentTypes,
    planningAssignments,
    executionSegmentAssignments,
    operationalHeaderFields,
    planningOperationalHeaderValues,
    executionOperationalHeaderValues,
    activityGroupOperationalHeaderValues,
  ] = await Promise.all([
    listAssignmentTypes({ activeOnly: false }),
    getPlanningAssignmentsForPlanningItems(planningItemIds),
    getPlanningAssignmentsForExecutionSegments(executionSegmentIds),
    listOperationalHeaderFields({ activeOnly: false }),
    listOperationalHeaderValuesByPlanningItemIds(planningItemIds),
    listOperationalHeaderValuesByExecutionSegmentIds(executionSegmentIds),
    listOperationalHeaderValuesByActivityGroupIds(activityGroupIds),
  ]);

  return buildReportFromSourceRows(
    query,
    planningRows,
    realRows,
    {
      types: assignmentTypes,
      assignments: [
        ...planningAssignments,
        ...executionSegmentAssignments,
      ],
    },
    {
      fields: operationalHeaderFields,
      values: [
        ...planningOperationalHeaderValues,
        ...executionOperationalHeaderValues,
        ...activityGroupOperationalHeaderValues,
      ],
    }
  );
}
