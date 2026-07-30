"use client";

import {
  SERVICE_CLIENT_FIELD_CONFIG,
  formatServiceClientFieldLabel,
  type ServiceClientFormState
} from "../lib/service-client-utils";

type ServiceClientBillingFieldsProps = {
  readonly form: ServiceClientFormState;
  readonly fieldErrors: Partial<Record<keyof ServiceClientFormState, string>>;
  readonly disabled?: boolean;
  readonly onChange: (field: keyof ServiceClientFormState, value: string) => void;
  readonly compact?: boolean;
};

export function ServiceClientBillingFields({
  form,
  fieldErrors,
  disabled = false,
  onChange,
  compact = false
}: ServiceClientBillingFieldsProps) {
  const inputClass = compact
    ? "mt-1.5 w-full rounded-lg border border-outline-variant px-3 py-2 text-sm text-on-surface outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20"
    : "mt-1.5 w-full rounded-lg border border-outline-variant px-3.5 py-2.5 text-on-surface outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/20";
  const labelClass = compact
    ? "block text-xs font-medium text-on-surface"
    : "block text-sm font-medium text-on-surface";
  const errorClass = compact ? "mt-1 text-xs text-error" : "mt-1.5 text-sm text-error";

  const sections = [
    { id: "identity" as const, title: "Identidad fiscal" },
    { id: "contact" as const, title: "Contacto" },
    { id: "address" as const, title: "Dirección de facturación" }
  ];

  return (
    <div className="space-y-5">
      <div>
        <label className={labelClass} htmlFor="service-client-name">
          {formatServiceClientFieldLabel("name")}
        </label>
        <input
          id="service-client-name"
          type="text"
          value={form.name}
          onChange={(event) => onChange("name", event.target.value)}
          className={inputClass}
          placeholder="Acme Facilities"
          autoComplete="off"
          disabled={disabled}
        />
        {fieldErrors.name ? <p className={errorClass}>{fieldErrors.name}</p> : null}
      </div>

      {sections.map((section) => {
        const fields = SERVICE_CLIENT_FIELD_CONFIG.filter((field) => field.section === section.id);
        return (
          <div
            key={section.id}
            className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4"
          >
            <h3 className="mb-3 text-sm font-semibold text-on-surface">{section.title}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {fields.map((field) => {
                const wide = field.key.startsWith("address");
                return (
                  <div key={field.key} className={wide ? "sm:col-span-2" : undefined}>
                    <label className={labelClass} htmlFor={`service-client-${field.key}`}>
                      {field.label}
                    </label>
                    <input
                      id={`service-client-${field.key}`}
                      type={field.type ?? "text"}
                      value={form[field.key]}
                      onChange={(event) => onChange(field.key, event.target.value)}
                      className={inputClass}
                      disabled={disabled}
                      autoComplete="off"
                    />
                    {fieldErrors[field.key] ? (
                      <p className={errorClass}>{fieldErrors[field.key]}</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
