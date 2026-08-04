import type { FieldJobOptionsResponse } from "@/lib/field-jobs-client";
import type { WorkerAssignmentRecord } from "@/lib/worker-utils";

export type ServiceCatalogItem = FieldJobOptionsResponse["serviceCatalogItems"][number] & {
  sortOrder?: number;
};

export type ServiceChecklistRow = {
  catalogItemId: string;
  name: string;
  category: string | null;
  marked: boolean;
  preassigned: boolean;
  serviceLineId: string | null;
  onlyOnWorkOrder: boolean;
};

export type FinalizeSummary = {
  workOrderNumber: string;
  completedServiceCount: number;
  completedServices: string[];
  totalDurationMs: number | null;
  message: string;
};

export function sortCatalogItems(
  items: ServiceCatalogItem[]
): ServiceCatalogItem[] {
  return [...items].sort((left, right) => {
    const leftOrder = left.sortOrder ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.sortOrder ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    return left.name.localeCompare(right.name);
  });
}

export function collectPreassignedCatalogIds(assignment: WorkerAssignmentRecord): Set<string> {
  return new Set(
    assignment.serviceLines
      .filter((line) => Boolean(line.serviceCatalogItemId))
      .map((line) => line.serviceCatalogItemId)
  );
}

export function buildServiceChecklistRows(
  catalogItems: ServiceCatalogItem[],
  assignment: WorkerAssignmentRecord,
  preassignedCatalogIds: Set<string>
): ServiceChecklistRow[] {
  const lineByCatalogId = new Map(
    assignment.serviceLines.map((line) => [line.serviceCatalogItemId, line])
  );
  const catalogIds = new Set<string>();
  const rows: ServiceChecklistRow[] = [];

  for (const item of sortCatalogItems(catalogItems)) {
    catalogIds.add(item.id);
    const line = lineByCatalogId.get(item.id);
    rows.push({
      catalogItemId: item.id,
      name: item.name,
      category: item.category,
      marked: Boolean(line?.completion),
      preassigned: preassignedCatalogIds.has(item.id),
      serviceLineId: line?.id ?? null,
      onlyOnWorkOrder: false
    });
  }

  for (const line of assignment.serviceLines) {
    if (catalogIds.has(line.serviceCatalogItemId)) {
      continue;
    }

    rows.push({
      catalogItemId: line.serviceCatalogItemId,
      name: line.serviceNameSnapshot,
      category: line.serviceCategorySnapshot,
      marked: Boolean(line.completion),
      preassigned: preassignedCatalogIds.has(line.serviceCatalogItemId),
      serviceLineId: line.id,
      onlyOnWorkOrder: true
    });
  }

  return rows;
}

export function countMarkedServices(rows: ServiceChecklistRow[]): {
  marked: number;
  total: number;
} {
  return {
    marked: rows.filter((row) => row.marked).length,
    total: rows.length
  };
}

export function applyMarkToAssignment(
  assignment: WorkerAssignmentRecord,
  input: {
    serviceCatalogItemId: string;
    serviceName: string;
    workOrderServiceLineId: string;
    serviceCompletionId: string;
    completedAt: string;
    employeeId: string;
    employeeName: string;
    category?: string | null;
  }
): WorkerAssignmentRecord {
  const existing = assignment.serviceLines.find(
    (line) => line.serviceCatalogItemId === input.serviceCatalogItemId
  );

  const completion = {
    serviceCompletionId: input.serviceCompletionId,
    completedAt: input.completedAt,
    completedByEmployeeId: input.employeeId,
    completedByEmployeeName: input.employeeName
  };

  if (existing) {
    return {
      ...assignment,
      serviceLines: assignment.serviceLines.map((line) =>
        line.serviceCatalogItemId === input.serviceCatalogItemId
          ? { ...line, completion }
          : line
      )
    };
  }

  return {
    ...assignment,
    serviceLines: [
      ...assignment.serviceLines,
      {
        id: input.workOrderServiceLineId,
        serviceCatalogItemId: input.serviceCatalogItemId,
        serviceNameSnapshot: input.serviceName,
        serviceCategorySnapshot: input.category ?? null,
        completion
      }
    ]
  };
}

export function revertFailedServiceSync(
  action: "mark" | "unmark",
  optimisticAssignment: WorkerAssignmentRecord,
  baseAssignment: WorkerAssignmentRecord,
  catalogItemId: string,
  preassignedCatalogIds: Set<string>
): WorkerAssignmentRecord {
  if (action === "mark") {
    return applyUnmarkToAssignment(
      optimisticAssignment,
      catalogItemId,
      preassignedCatalogIds
    );
  }

  const baseLine = baseAssignment.serviceLines.find(
    (line) => line.serviceCatalogItemId === catalogItemId
  );
  if (!baseLine?.completion) {
    return baseAssignment;
  }

  return applyMarkToAssignment(optimisticAssignment, {
    serviceCatalogItemId: catalogItemId,
    serviceName: baseLine.serviceNameSnapshot,
    workOrderServiceLineId: baseLine.id,
    serviceCompletionId: baseLine.completion.serviceCompletionId,
    completedAt: baseLine.completion.completedAt,
    employeeId: baseLine.completion.completedByEmployeeId,
    employeeName: baseLine.completion.completedByEmployeeName,
    category: baseLine.serviceCategorySnapshot
  });
}

export function applyUnmarkToAssignment(
  assignment: WorkerAssignmentRecord,
  serviceCatalogItemId: string,
  preassignedCatalogIds: Set<string>
): WorkerAssignmentRecord {
  if (preassignedCatalogIds.has(serviceCatalogItemId)) {
    return {
      ...assignment,
      serviceLines: assignment.serviceLines.map((line) =>
        line.serviceCatalogItemId === serviceCatalogItemId
          ? { ...line, completion: null }
          : line
      )
    };
  }

  return {
    ...assignment,
    serviceLines: assignment.serviceLines.filter(
      (line) => line.serviceCatalogItemId !== serviceCatalogItemId
    )
  };
}

export function formatWorkOrderDuration(totalDurationMs: number | null): string {
  if (totalDurationMs === null || totalDurationMs < 0) {
    return "—";
  }

  const totalMinutes = Math.round(totalDurationMs / 60_000);
  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
}

export function buildFinalizeSummary(
  assignment: WorkerAssignmentRecord,
  payload: {
    workOrderNumber?: string;
    completedServiceCount?: number;
    totalDurationMs?: number | null;
    message?: string;
  }
): FinalizeSummary {
  const completedServices = assignment.serviceLines
    .filter((line) => line.completion)
    .map((line) => line.serviceNameSnapshot);

  return {
    workOrderNumber: payload.workOrderNumber ?? assignment.workOrderNumber,
    completedServiceCount:
      payload.completedServiceCount ?? completedServices.length,
    completedServices,
    totalDurationMs: payload.totalDurationMs ?? null,
    message: payload.message ?? "Work order finalized."
  };
}
