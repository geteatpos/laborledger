"use client";

import { useState } from "react";

import { ReceiveVehiclePanel } from "@/components/employee/ReceiveVehiclePanel";
import { EmployeeJobWorkflowPanel } from "@/components/employee/EmployeeJobWorkflowPanel";

type JobHubMode = "create" | "assigned";

type EmployeeJobsHubPanelProps = {
  readonly initialAssignmentId?: string | null;
  readonly initialMode?: JobHubMode;
};

export function EmployeeJobsHubPanel({
  initialAssignmentId = null,
  initialMode
}: EmployeeJobsHubPanelProps) {
  const [mode, setMode] = useState<JobHubMode>(
    initialMode ?? (initialAssignmentId ? "assigned" : "create")
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <button
          type="button"
          onClick={() => setMode("create")}
          className={`rounded-xl px-3 py-3 text-sm font-semibold ${
            mode === "create"
              ? "bg-brand-600 text-white"
              : "bg-slate-50 text-slate-700 hover:bg-slate-100"
          }`}
        >
          Receive vehicle
        </button>
        <button
          type="button"
          onClick={() => setMode("assigned")}
          className={`rounded-xl px-3 py-3 text-sm font-semibold ${
            mode === "assigned"
              ? "bg-brand-600 text-white"
              : "bg-slate-50 text-slate-700 hover:bg-slate-100"
          }`}
        >
          Assigned jobs
        </button>
      </div>

      {mode === "create" ? (
        <ReceiveVehiclePanel />
      ) : (
        <EmployeeJobWorkflowPanel initialAssignmentId={initialAssignmentId} />
      )}
    </div>
  );
}
