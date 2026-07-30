"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

import { ServiceClientBillingFields } from "./service-client-billing-fields";
import {
  buildServiceClientWritePayload,
  emptyServiceClientFormState,
  validateServiceClientForm,
  type ServiceClientFormState
} from "../lib/service-client-utils";

type CreateServiceClientFormProps = {
  readonly companyId: string;
};

export function CreateServiceClientForm({ companyId }: CreateServiceClientFormProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<ServiceClientFormState>(emptyServiceClientFormState());
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof ServiceClientFormState, string>>>(
    {}
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function resetForm() {
    setForm(emptyServiceClientFormState());
    setFieldErrors({});
    setSubmitError(null);
  }

  function handleToggle() {
    setIsOpen((open) => {
      if (open) {
        resetForm();
        setSuccessMessage(null);
      }

      return !open;
    });
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

    const response = await fetch(`/api/company-operations/companies/${companyId}/service-clients`, {
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
      setSubmitError(payload.message ?? "No se pudo crear el cliente.");
      return;
    }

    const createdName = payload.serviceClient?.name ?? form.name.trim();
    setSuccessMessage(`${createdName} se creó correctamente.`);
    resetForm();
    setIsOpen(false);
    router.refresh();
  }

  return (
    <div>
      <button type="button" onClick={handleToggle} className="stitch-btn-primary">
        {isOpen ? "Cancelar" : "Crear cliente"}
      </button>

      {successMessage ? (
        <p className="mt-4 stitch-alert-success px-4 py-3 text-sm text-success">{successMessage}</p>
      ) : null}

      {isOpen ? (
        <form onSubmit={handleSubmit} className="mt-4 stitch-card">
          <h2 className="text-sm font-semibold text-on-surface">Nuevo cliente de servicio</h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            El nombre comercial es obligatorio. Completa identidad fiscal, contacto y dirección para
            facturar (Bill To en PDF y correo).
          </p>

          <div className="mt-6">
            <ServiceClientBillingFields
              form={form}
              fieldErrors={fieldErrors}
              disabled={isSubmitting}
              onChange={updateField}
            />
          </div>

          {submitError ? (
            <p className="mt-4 stitch-alert-error px-3.5 py-2.5 text-sm text-error">{submitError}</p>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-2">
            <button type="submit" disabled={isSubmitting} className="stitch-btn-primary disabled:opacity-60">
              {isSubmitting ? "Creando…" : "Crear cliente"}
            </button>
            <button
              type="button"
              onClick={handleToggle}
              disabled={isSubmitting}
              className="rounded-lg stitch-btn-secondary disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
