"use client";

import { useState } from "react";

import { AddSupervisorForm } from "./add-supervisor-form";
import type { LocationOption } from "../lib/supervisor-assignment-utils";

type AddSupervisorCtaProps = {
  readonly companyId: string;
  readonly companyName: string;
  readonly locations: LocationOption[];
};

export function AddSupervisorCta({ companyId, companyName, locations }: AddSupervisorCtaProps) {
  const [showForm, setShowForm] = useState(false);

  if (showForm) {
    return (
      <AddSupervisorForm
        companyId={companyId}
        companyName={companyName}
        locations={locations}
        onCancel={() => setShowForm(false)}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setShowForm(true)}
      className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
    >
      Add supervisor
    </button>
  );
}
