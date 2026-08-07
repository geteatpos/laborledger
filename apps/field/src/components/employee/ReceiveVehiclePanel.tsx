"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { PrimaryActionButton } from "@/components/shared/PrimaryActionButton";
import { MechanicPartsEditor } from "@/components/employee/MechanicPartsEditor";
import { VehicleChecklistPanel } from "@/components/employee/VehicleChecklistPanel";
import { VehiclePhotosCapture } from "@/components/employee/VehiclePhotosCapture";
import { VinCameraScan } from "@/components/employee/VinCameraScan";
import type { FieldChecklist } from "@/lib/field-checklist-client";
import type { FieldJobOptionsResponse } from "@/lib/field-jobs-client";
import {
  formatDecodedVehicleTitle,
  RECEIVE_VEHICLE_PROGRESS_STEPS,
  RECEIVE_VEHICLE_STEP_LABELS,
  receiveVehicleStepIndex,
  type ReceiveVehicleStep
} from "@/lib/field-job-utils";
import { isBrowserOffline } from "@/lib/offline";
import {
  parseScannerVinInput,
  shouldAutoSubmitScannerVin,
  validateWorkerVin,
  VIN_LENGTH
} from "@/lib/worker-scanner-utils";
import { normalizeVinInput } from "@/lib/worker-utils";

export type FieldCreateJobSuccess = {
  workOrderId?: string;
  vehicleId?: string;
  serviceName: string;
  serviceClientName: string;
  vehicleVin: string;
  vehicleTitle?: string;
  notes?: string | null;
  workOrderNumber: string;
  message?: string;
};

type VinPreview = {
  vin: string;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  warnings: string[];
};

type FieldMeResponse = {
  session?: { locationId?: string };
  locationId?: string | null;
};

function stepBackTarget(step: ReceiveVehicleStep): ReceiveVehicleStep | null {
  switch (step) {
    case "vin":
      return "scan";
    case "vehicle":
      return "vin";
    case "customer":
      return "vehicle";
    case "service":
      return "customer";
    case "confirm":
      return "service";
    case "checklist":
      return "confirm";
    case "photos":
      return "checklist";
    case "mechanic":
      return "photos";
    default:
      return null;
  }
}

function ReceiveVehicleProgress({ step }: { readonly step: ReceiveVehicleStep }) {
  const current = receiveVehicleStepIndex(step);
  const total = RECEIVE_VEHICLE_PROGRESS_STEPS.length;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-900">{RECEIVE_VEHICLE_STEP_LABELS[step]}</p>
        <p className="text-xs text-slate-500">
          Step {Math.min(current + 1, total)} of {total}
        </p>
      </div>
      <div className="mt-2 flex gap-1">
        {RECEIVE_VEHICLE_PROGRESS_STEPS.map((progressStep, index) => (
          <div
            key={progressStep}
            className={`h-1.5 flex-1 rounded-full ${
              index <= current ? "bg-brand-600" : "bg-slate-200"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export function ReceiveVehiclePanel() {
  const router = useRouter();
  const vinInputRef = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState<ReceiveVehicleStep>("scan");
  const [options, setOptions] = useState<FieldJobOptionsResponse | null>(null);
  const [defaultLocationId, setDefaultLocationId] = useState("");
  const [enteredVin, setEnteredVin] = useState("");
  const [vinPreview, setVinPreview] = useState<VinPreview | null>(null);
  const [isDecodingVin, setIsDecodingVin] = useState(false);
  const [serviceClientId, setServiceClientId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [serviceCatalogItemId, setServiceCatalogItemId] = useState("");
  const [notes, setNotes] = useState("");
  const [isMechanicOrder, setIsMechanicOrder] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState<FieldCreateJobSuccess | null>(null);
  const [checklistId, setChecklistId] = useState<string | null>(null);

  const filteredLocations = useMemo(
    () =>
      (options?.locations ?? []).filter((location) => location.serviceClientId === serviceClientId),
    [options?.locations, serviceClientId]
  );

  const selectedCustomer = options?.serviceClients.find((client) => client.id === serviceClientId);
  const selectedLocation = filteredLocations.find((location) => location.id === locationId);
  const selectedService = options?.serviceCatalogItems.find((item) => item.id === serviceCatalogItemId);
  const vehicleTitle = vinPreview
    ? formatDecodedVehicleTitle(vinPreview)
    : formatDecodedVehicleTitle({});

  const loadContext = useCallback(async () => {
    if (isBrowserOffline()) {
      setErrorMessage("You are offline. Connect to receive vehicles.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [optionsResponse, meResponse] = await Promise.all([
        fetch("/api/field/jobs/options", { cache: "no-store" }),
        fetch("/api/field/me", { cache: "no-store" })
      ]);

      const optionsPayload = (await optionsResponse.json().catch(() => ({}))) as FieldJobOptionsResponse & {
        message?: string;
      };
      const mePayload = (await meResponse.json().catch(() => ({}))) as FieldMeResponse;

      if (optionsResponse.status === 401 || meResponse.status === 401) {
        router.replace("/field/login");
        return;
      }

      if (!optionsResponse.ok) {
        setErrorMessage(optionsPayload.message ?? "Unable to load receive vehicle options.");
        setIsLoading(false);
        return;
      }

      setOptions(optionsPayload);
      setDefaultLocationId(mePayload.locationId ?? mePayload.session?.locationId ?? "");
      setIsLoading(false);
    } catch {
      setErrorMessage("Network error while loading options.");
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  useEffect(() => {
    if (step === "vin") {
      window.setTimeout(() => vinInputRef.current?.focus(), 0);
    }
  }, [step]);

  useEffect(() => {
    if (!serviceClientId) {
      setLocationId("");
      return;
    }

    const preferred =
      (defaultLocationId &&
      filteredLocations.some((location) => location.id === defaultLocationId)
        ? defaultLocationId
        : null) ?? filteredLocations[0]?.id ?? "";

    if (!filteredLocations.some((location) => location.id === locationId)) {
      setLocationId(preferred);
    }
  }, [defaultLocationId, filteredLocations, locationId, serviceClientId]);

  useEffect(() => {
    if (step !== "vehicle" || !enteredVin) {
      return;
    }

    const normalizedVin = normalizeVinInput(enteredVin);
    const validationError = validateWorkerVin(normalizedVin);
    if (validationError) {
      return;
    }

    let cancelled = false;
    setIsDecodingVin(true);
    setErrorMessage(null);

    void fetch("/api/field/jobs/decode-vin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ vin: normalizedVin })
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as VinPreview & { message?: string };
        if (cancelled) {
          return;
        }

        if (!response.ok) {
          setErrorMessage(payload.message ?? "Unable to look up this VIN.");
          setVinPreview({
            vin: normalizedVin,
            year: null,
            make: null,
            model: null,
            trim: null,
            warnings: []
          });
          return;
        }

        setVinPreview(payload);
      })
      .catch(() => {
        if (!cancelled) {
          setErrorMessage("Network error while looking up VIN.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsDecodingVin(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [enteredVin, step]);

  function handleVinChange(value: string) {
    setEnteredVin(parseScannerVinInput(value).slice(0, VIN_LENGTH));
  }

  function handleVinKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === "Tab") {
      if (shouldAutoSubmitScannerVin(enteredVin, event.key === "Enter" ? "Enter" : "Tab")) {
        event.preventDefault();
        void advanceFromVin();
      }
    }
  }

  async function advanceFromVin() {
    const normalizedVin = normalizeVinInput(enteredVin);
    const validationError = validateWorkerVin(normalizedVin);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setErrorMessage(null);
    setEnteredVin(normalizedVin);
    setStep("vehicle");
  }

  function handleDetectedVin(value: string) {
    const normalizedVin = normalizeVinInput(parseScannerVinInput(value));
    if (!normalizedVin) {
      return;
    }

    setEnteredVin(normalizedVin);
    setErrorMessage(null);
    setStep("vehicle");
  }

  async function handleSubmit() {
    const normalizedVin = normalizeVinInput(enteredVin);
    const validationError = validateWorkerVin(normalizedVin);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    if (!serviceClientId || !locationId || !serviceCatalogItemId) {
      setErrorMessage("Select customer, location, and service.");
      return;
    }

    if (isBrowserOffline()) {
      setErrorMessage("You are offline. Vehicle was not received.");
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/field/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          enteredVin: normalizedVin,
          serviceClientId,
          locationId,
          serviceCatalogItemId,
          notes: notes.trim() || undefined
        })
      });

      const payload = (await response.json().catch(() => ({}))) as FieldCreateJobSuccess & {
        message?: string;
      };

      if (response.status === 401) {
        router.replace("/field/login");
        return;
      }

      setIsBusy(false);

      if (!response.ok) {
        console.error("[ReceiveVehicle] Failed to create job. Status:", response.status, "Payload:", payload);
        setErrorMessage(payload.message ?? "Unable to receive vehicle.");
        return;
      }

      setSuccess({
        workOrderId: payload.workOrderId,
        vehicleId: payload.vehicleId,
        serviceName: payload.serviceName,
        serviceClientName: payload.serviceClientName,
        vehicleVin: payload.vehicleVin,
        vehicleTitle: payload.vehicleTitle,
        notes: payload.notes,
        workOrderNumber: payload.workOrderNumber,
        message: payload.message
      });
      setIsBusy(false);

      console.log("[ReceiveVehicle] Job created. WorkOrder:", payload.workOrderId, "Vehicle:", payload.vehicleId, "Has both IDs:", Boolean(payload.workOrderId && payload.vehicleId));

      if (payload.workOrderId && payload.vehicleId) {
        await startInspectionChecklist(payload.workOrderId, payload.vehicleId);
      } else {
        console.log("[ReceiveVehicle] Missing workOrderId or vehicleId, going directly to done");
        setStep("done");
      }
    } catch (error) {
      console.error("[ReceiveVehicle] Network error creating job:", error);
      setIsBusy(false);
      setErrorMessage("Network error. Vehicle was not received.");
    }
  }

  async function startInspectionChecklist(
    workOrderId: string,
    _vehicleId: string
  ) {
    if (isBrowserOffline()) {
      setErrorMessage(
        "Vehicle received, but you are offline — inspection will be skipped. Reconnect to complete it later."
      );
      setStep("done");
      return;
    }

    try {
      const response = await fetch("/api/field/checklist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workOrderId })
      });
      const payload = (await response.json().catch(() => ({}))) as FieldChecklist & {
        message?: string;
      };

      if (response.status === 401) {
        console.error("[Checklist] 401 Unauthorized creating checklist for workOrder:", workOrderId);
        setErrorMessage("Sign in required.");
        setStep("photos");
        return;
      }

      if (response.ok && payload.id) {
        console.log("[Checklist] Created successfully. ID:", payload.id, "WorkOrder:", workOrderId, "Vehicle:", _vehicleId);
        setChecklistId(payload.id);
        setStep("checklist");
        return;
      }

      console.error("[Checklist] Failed to create checklist for workOrder:", workOrderId, "Status:", response.status, "Payload:", payload);
      setErrorMessage(payload.message ?? "Inspection unavailable. Continuing to photos.");
      setStep("photos");
    } catch (error) {
      console.error("[Checklist] Network error creating checklist for workOrder:", workOrderId, error);
      setErrorMessage("Network error during inspection. Continuing to photos.");
      setStep("photos");
    }
  }

  function handleChecklistComplete() {
    console.log("[ReceiveVehicle] handleChecklistComplete called, transitioning to photos");
    setChecklistId(null);
    setStep("photos");
  }

  function handlePhotosComplete() {
    console.log("[ReceiveVehicle] handlePhotosComplete called, isMechanicOrder:", isMechanicOrder, "transitioning to", isMechanicOrder ? "mechanic" : "done");
    if (isMechanicOrder) {
      setStep("mechanic");
      return;
    }
    setStep("done");
  }

  function handleMechanicDone() {
    console.log("[ReceiveVehicle] handleMechanicDone called, transitioning to done");
    setIsBusy(false);
    setErrorMessage(null);
    setSuccess((prev) =>
      prev
        ? {
            ...prev,
            message:
              "Your mechanic order has been submitted. The supervisor will review and contact the vehicle owner."
          }
        : prev
    );
    setStep("done");
  }

  function handleReceiveAnother() {
    setStep("scan");
    setEnteredVin("");
    setVinPreview(null);
    setServiceClientId("");
    setLocationId("");
    setServiceCatalogItemId("");
    setNotes("");
    setIsMechanicOrder(false);
    setSuccess(null);
    setChecklistId(null);
    setErrorMessage(null);
  }

  function goBack() {
    const previous = stepBackTarget(step);
    if (previous) {
      setErrorMessage(null);
      setStep(previous);
    }
  }

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
        Loading…
      </div>
    );
  }

  if (step === "done" && success) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-emerald-900">Vehicle received</h2>
          <p className="mt-2 text-sm text-emerald-800">
            {success.message ?? "Vehicle received. Pending services are available in My Work."}
          </p>
          <dl className="mt-4 space-y-2 text-sm text-emerald-900">
            <div>
              <dt className="font-medium">Vehicle</dt>
              <dd>
                {success.vehicleTitle || "Vehicle"} ·{" "}
                <span className="font-mono">{success.vehicleVin}</span>
              </dd>
            </div>
            <div>
              <dt className="font-medium">Customer</dt>
              <dd>{success.serviceClientName}</dd>
            </div>
            <div>
              <dt className="font-medium">Service</dt>
              <dd>{success.serviceName}</dd>
            </div>
            <div>
              <dt className="font-medium">Work order</dt>
              <dd>{success.workOrderNumber}</dd>
            </div>
          </dl>
        </div>

        <div className="grid gap-3">
          <Link
            href="/field/work"
            className="flex justify-center rounded-xl bg-brand-600 px-4 py-3.5 text-base font-semibold text-white hover:bg-brand-800"
          >
            Go to My Work
          </Link>
          <button
            type="button"
            onClick={handleReceiveAnother}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-base font-semibold text-slate-800"
          >
            Receive another vehicle
          </button>
          <Link
            href="/field/home"
            className="flex justify-center rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-semibold text-slate-700"
          >
            Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      {step !== "scan" ? <ReceiveVehicleProgress step={step} /> : null}

      {step === "scan" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Scan VIN</h2>
          <p className="mt-1 text-sm text-slate-600">
            Point your camera at the barcode or enter the VIN manually.
          </p>
          <div className="mt-4">
            <VinCameraScan disabled={isBusy} onDetected={handleDetectedVin} />
          </div>
          <button
            type="button"
            onClick={() => setStep("vin")}
            className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-semibold text-slate-800"
          >
            Enter VIN manually
          </button>
        </section>
      ) : null}

      {step === "vin" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Enter VIN</h2>
          <p className="mt-1 text-sm text-slate-600">Type or scan the 17-character VIN.</p>
          <input
            ref={vinInputRef}
            value={enteredVin}
            onChange={(event) => handleVinChange(event.target.value)}
            onKeyDown={handleVinKeyDown}
            className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-4 text-center font-mono text-lg uppercase tracking-widest"
            maxLength={VIN_LENGTH}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
          />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <PrimaryActionButton label="Back" variant="secondary" onClick={goBack} />
            <PrimaryActionButton
              label="Continue"
              variant="kiosk"
              disabled={enteredVin.length !== VIN_LENGTH}
              onClick={() => void advanceFromVin()}
            />
          </div>
        </section>
      ) : null}

      {step === "vehicle" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Confirm vehicle</h2>
          <p className="mt-1 text-sm text-slate-600">Check the VIN and vehicle details.</p>
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-lg font-semibold text-slate-900">
              {isDecodingVin ? "Looking up vehicle…" : vehicleTitle}
            </p>
            <p className="mt-1 font-mono text-sm text-slate-600">{normalizeVinInput(enteredVin)}</p>
            {vinPreview?.trim ? (
              <p className="mt-1 text-sm text-slate-500">{vinPreview.trim}</p>
            ) : null}
          </div>
          {vinPreview?.warnings?.length ? (
            <ul className="mt-3 space-y-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {vinPreview.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <PrimaryActionButton label="Back" variant="secondary" onClick={goBack} />
            <PrimaryActionButton
              label="Confirm vehicle"
              variant="kiosk"
              disabled={isDecodingVin}
              onClick={() => setStep("customer")}
            />
          </div>
        </section>
      ) : null}

      {step === "customer" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Confirm customer</h2>
          <p className="mt-1 text-sm text-slate-600">Who is this vehicle for?</p>
          <select
            value={serviceClientId}
            onChange={(event) => setServiceClientId(event.target.value)}
            className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-3.5 text-base"
          >
            <option value="">Select customer…</option>
            {(options?.serviceClients ?? []).map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <PrimaryActionButton label="Back" variant="secondary" onClick={goBack} />
            <PrimaryActionButton
              label="Continue"
              variant="kiosk"
              disabled={!serviceClientId}
              onClick={() => setStep("service")}
            />
          </div>
        </section>
      ) : null}

      {step === "service" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Select service</h2>
          <p className="mt-1 text-sm text-slate-600">Choose the service to perform on this vehicle.</p>

          {filteredLocations.length > 1 ? (
            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-700" htmlFor="receive-location">
                Location
              </label>
              <select
                id="receive-location"
                value={locationId}
                onChange={(event) => setLocationId(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3.5 text-base"
              >
                {filteredLocations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </div>
          ) : filteredLocations.length === 1 && selectedLocation ? (
            <p className="mt-3 text-sm text-slate-600">Location: {selectedLocation.name}</p>
          ) : (
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              This customer has no active location. Choose a different customer or ask a manager to
              finish setup in Admin.
            </p>
          )}

          <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="receive-service">
            Service
          </label>
          <select
            id="receive-service"
            value={serviceCatalogItemId}
            onChange={(event) => setServiceCatalogItemId(event.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3.5 text-base"
          >
            <option value="">Select service…</option>
            {(options?.serviceCatalogItems ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
                {item.category ? ` · ${item.category}` : ""}
              </option>
            ))}
          </select>

          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-amber-50 px-4 py-3">
            <input
              type="checkbox"
              checked={isMechanicOrder}
              onChange={(event) => setIsMechanicOrder(event.target.checked)}
              className="mt-1 h-5 w-5"
            />
            <span>
              <span className="block text-sm font-semibold text-slate-900">
                Mechanic work order
              </span>
              <span className="block text-xs text-slate-600">
                Requires supervisor approval before any work begins. You will document the parts after
                photo intake.
              </span>
            </span>
          </label>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <PrimaryActionButton label="Back" variant="secondary" onClick={goBack} />
            <PrimaryActionButton
              label="Continue"
              variant="kiosk"
              disabled={!serviceCatalogItemId || !locationId}
              onClick={() => setStep("confirm")}
            />
          </div>
        </section>
      ) : null}

      {step === "confirm" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Review and receive</h2>
          <p className="mt-1 text-sm text-slate-600">Confirm details before creating the job.</p>

          <dl className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Vehicle</dt>
              <dd className="mt-0.5 font-medium text-slate-900">
                {vehicleTitle} · <span className="font-mono">{normalizeVinInput(enteredVin)}</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Customer</dt>
              <dd className="mt-0.5 font-medium text-slate-900">{selectedCustomer?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Location</dt>
              <dd className="mt-0.5 font-medium text-slate-900">{selectedLocation?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Service</dt>
              <dd className="mt-0.5 font-medium text-slate-900">{selectedService?.name ?? "—"}</dd>
            </div>
          </dl>

          <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="receive-notes">
            Notes (optional)
          </label>
          <textarea
            id="receive-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-base"
            placeholder="Damage, keys, special instructions…"
          />

          <div className="mt-4 grid grid-cols-2 gap-3">
            <PrimaryActionButton label="Back" variant="secondary" onClick={goBack} disabled={isBusy} />
            <PrimaryActionButton
              label={isBusy ? "Receiving…" : "Receive vehicle"}
              variant="kiosk"
              disabled={isBusy}
              onClick={() => void handleSubmit()}
            />
          </div>
        </section>
      ) : null}

      {step === "checklist" && checklistId ? (
        <VehicleChecklistPanel checklistId={checklistId} onComplete={handleChecklistComplete} />
      ) : null}

      {step === "photos" && success?.vehicleId && success?.workOrderId ? (
        <VehiclePhotosCapture
          vehicleId={success.vehicleId}
          workOrderId={success.workOrderId}
          onDone={handlePhotosComplete}
        />
      ) : null}

      {step === "mechanic" && success?.vehicleId && success?.workOrderId ? (
        <MechanicPartsEditor
          workOrderId={success.workOrderId}
          vehicleId={success.vehicleId}
          vin={normalizeVinInput(enteredVin)}
          onDone={handleMechanicDone}
        />
      ) : null}

      {errorMessage ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}

/** @deprecated Use ReceiveVehiclePanel */
export const EmployeeCreateJobPanel = ReceiveVehiclePanel;
