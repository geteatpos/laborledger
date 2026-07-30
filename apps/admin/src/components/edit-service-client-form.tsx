"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { ServiceClientBillingFields } from "./service-client-billing-fields";
import {
  buildServiceClientWritePayload,
  serviceClientToFormState,
  validateServiceClientForm,
  type ServiceClientFormState,
  type ServiceClientViewRecord
} from "../lib/service-client-utils";

type EditServiceClientFormProps = {
  readonly serviceClient: Pick<
    ServiceClientViewRecord,
    | "id"
    | "name"
    | "legalName"
    | "taxId"
    | "billingContactName"
    | "phone"
    | "billingEmail"
    | "addressLine1"
    | "addressLine2"
    | "city"
    | "stateRegion"
    | "postalCode"
    | "country"
    | "updatedAt"
  >;
  readonly onSaved?: () => void;
  readonly alwaysOpen?: boolean;
};

export function EditServiceClientForm({
  serviceClient,
  onSaved,
  alwaysOpen = false
}: EditServiceClientFormProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(alwaysOpen);
  const [form, setForm] = useState<ServiceClientFormState>(() => serviceClientToFormState(serviceClient));
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof ServiceClientFormState, string>>>(
    {}
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setForm(serviceClientToFormState(serviceClient));
  }, [serviceClient.id, serviceClient.updatedAt]);

  function handleCancel() {
    setForm(serviceClientToFormState(serviceClient));
    setFieldErrors({});
    setSubmitError(null);
    if (!alwaysOpen) {
      setIsEditing(false);
    }
  }

  function updateField(field: keyof ServiceClientFormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setSuccessMessage(null);

    const errors = validateServiceClientForm(form);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    const response = await fetch(`/api/company-operations/service-clients/${serviceClient.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildServiceClientWritePayload(form))
    });

    const payload = (await response.json().catch(() => ({}))) as {
      message?: string;
      serviceClient?: { name?: string };
    };

    setIsSubmitting(false);

    if (!response.ok) {
      setSubmitError(payload.message ?? "No se pudo actualizar el cliente.");
      return;
    }

    const updatedName = payload.serviceClient?.name ?? form.name.trim();
    setSuccessMessage(`${updatedName} se actualizó.`);
    if (!alwaysOpen) {
      setIsEditing(false);
    }
    onSaved?.();
    router.refresh();
  }

  if (!isEditing) {
    return (
      <button
        type="button"
        onClick={() => {
          setForm(serviceClientToFormState(serviceClient));
          setFieldErrors({});
          setSubmitError(null);
          setSuccessMessage(null);
          setIsEditing(true);
        }}
        className="rounded-lg border border-outline-variant bg-white px-3 py-1.5 text-xs font-medium text-on-surface transition hover:border-outline hover:bg-surface-container-low"
      >
        Editar
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <ServiceClientBillingFields
        form={form}
        fieldErrors={fieldErrors}
        disabled={isSubmitting}
        onChange={updateField}
        compact
      />

      {submitError ? <p className="text-xs text-error">{submitError}</p> : null}
      {successMessage ? <p className="text-xs text-success">{successMessage}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-white hover:bg-secondary disabled:cursor-not-allowed disabled:bg-outline-variant"
        >
          {isSubmitting ? "Guardando…" : "Guardar cambios"}
        </button>
        {!alwaysOpen ? (
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSubmitting}
            className="rounded-lg border border-outline-variant bg-white px-3 py-1.5 text-xs font-medium text-on-surface hover:bg-surface-container-low"
          >
            Cancelar
          </button>
        ) : null}
      </div>
    </form>
  );
}
