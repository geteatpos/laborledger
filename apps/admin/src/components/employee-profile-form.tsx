"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";

import { MaterialIcon } from "./ui/material-icon";
import type { EmployeeProfile } from "../lib/employee-utils";
import {
  formatEmployeeAddress,
  formatEmployeeDate,
  formatEmergencyContact
} from "../lib/employee-utils";

type EmployeeProfileFormProps = {
  readonly employeeId: string;
  readonly companyId: string;
  readonly initialData: EmployeeProfile | null;
  readonly disabled?: boolean;
  readonly onProfileChange?: () => void;
};

type ProfileFieldError = {
  phone?: string;
  email?: string;
  title?: string;
  department?: string;
  hireDate?: string;
  terminationDate?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateOrRegion?: string;
  postalCode?: string;
  countryCode?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelationship?: string;
};

type SectionKey = "contact" | "job" | "address" | "emergency";

function validateEmail(email: string): string | null {
  if (!email.trim()) {
    return null; // Email is optional
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return "Formato de correo inválido.";
  }
  return null;
}

function validatePhone(phone: string): string | null {
  if (!phone.trim()) {
    return null; // Phone is optional
  }
  // Allow various phone formats
  const phoneRegex = /^[\d\s\-+()]{7,20}$/;
  if (!phoneRegex.test(phone)) {
    return "Formato de teléfono inválido.";
  }
  return null;
}

export function EmployeeProfileForm({
  employeeId,
  companyId,
  initialData,
  disabled = false,
  onProfileChange
}: EmployeeProfileFormProps) {
  const router = useRouter();
  const [profile, setProfile] = useState<EmployeeProfile | null>(initialData);
  const [isLoading, setIsLoading] = useState(!initialData);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<SectionKey | null>(null);
  const [formValues, setFormValues] = useState<Partial<EmployeeProfile>>({});
  const [fieldErrors, setFieldErrors] = useState<ProfileFieldError>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Fetch profile data
  useEffect(() => {
    if (initialData) {
      setProfile(initialData);
      return;
    }

    let cancelled = false;

    async function loadProfile() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const response = await fetch(
          `/api/company-operations/companies/${companyId}/employees/${employeeId}/profile`
        );

        if (cancelled) {
          return;
        }

        if (!response.ok) {
          const errorPayload = (await response.json().catch(() => ({}))) as {
            message?: string | string[];
          };
          const message = Array.isArray(errorPayload.message)
            ? errorPayload.message.join(" ")
            : errorPayload.message ?? "No se pudo cargar el perfil.";
          setLoadError(message);
          return;
        }

        const data = (await response.json().catch(() => null)) as EmployeeProfile | null;

        if (cancelled) {
          return;
        }

        if (!data) {
          setLoadError("Respuesta inválida del servidor.");
          return;
        }

        setProfile(data);
      } catch {
        if (!cancelled) {
          setLoadError("Error de conexión. Intenta de nuevo.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [companyId, employeeId, initialData]);

  const handleEditStart = useCallback((section: SectionKey) => {
    if (profile) {
      setFormValues({
        phone: profile.phone,
        email: profile.email,
        title: profile.title,
        department: profile.department,
        hireDate: profile.hireDate,
        terminationDate: profile.terminationDate,
        addressLine1: profile.addressLine1,
        addressLine2: profile.addressLine2,
        city: profile.city,
        stateOrRegion: profile.stateOrRegion,
        postalCode: profile.postalCode,
        countryCode: profile.countryCode,
        emergencyContactName: profile.emergencyContactName,
        emergencyContactPhone: profile.emergencyContactPhone,
        emergencyContactRelationship: profile.emergencyContactRelationship
      });
      setFieldErrors({});
      setSubmitError(null);
      setSuccessMessage(null);
    }
    setEditingSection(section);
  }, [profile]);

  function handleCancelEdit() {
    setEditingSection(null);
    setFormValues({});
    setFieldErrors({});
    setSubmitError(null);
  }

  function handleValueChange<K extends keyof EmployeeProfile>(field: K, value: string) {
    setFormValues((prev) => ({ ...prev, [field]: value }));
    // Clear field error when user types
    if (fieldErrors[field as keyof ProfileFieldError]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  function validateForm(): boolean {
    const errors: ProfileFieldError = {};

    if (formValues.email !== undefined) {
      const emailError = validateEmail(formValues.email ?? "");
      if (emailError) {
        errors.email = emailError;
      }
    }

    if (formValues.phone !== undefined) {
      const phoneError = validatePhone(formValues.phone ?? "");
      if (phoneError) {
        errors.phone = phoneError;
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    setShowConfirm(true);
  }

  async function handleConfirmSave() {
    setIsSubmitting(true);
    setSubmitError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(
        `/api/company-operations/companies/${companyId}/employees/${employeeId}/profile`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(formValues)
        }
      );

      const payload = (await response.json().catch(() => ({}))) as {
        message?: string | string[];
      };

      if (!response.ok) {
        const message = Array.isArray(payload.message)
          ? payload.message.join(" ")
          : payload.message ?? "No se pudo guardar el perfil.";
        setSubmitError(message);
        return;
      }

      setSuccessMessage("Perfil actualizado correctamente.");
      setEditingSection(null);
      setShowConfirm(false);
      onProfileChange?.();
      router.refresh();
    } catch {
      setSubmitError("Error de conexión. Intenta de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="stitch-skeleton h-20 w-full" />
        <div className="stitch-skeleton h-20 w-full" />
        <div className="stitch-skeleton h-20 w-full" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-error/30 bg-error-container p-4">
        <p className="text-sm text-on-error-container">{loadError}</p>
        <button
          type="button"
          onClick={() => {
            setProfile(null);
            setLoadError(null);
          }}
          className="mt-2 text-xs font-medium text-on-error-container underline"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4 text-center">
        <p className="text-sm text-on-surface-variant">Sin datos de perfil.</p>
      </div>
    );
  }

  const hasAnyData =
    profile.phone ||
    profile.email ||
    profile.title ||
    profile.department ||
    profile.hireDate ||
    profile.addressLine1 ||
    profile.emergencyContactName;

  if (!hasAnyData && editingSection === null) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-on-surface-variant">Este empleado no tiene información de perfil.</p>
        <button
          type="button"
          onClick={() => handleEditStart("contact")}
          disabled={disabled}
          className="stitch-btn-secondary text-xs"
        >
          Agregar información
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Contact Information Section */}
      <section className="space-y-3">
        <h4 className="stitch-label inline-flex items-center gap-1.5">
          <MaterialIcon name="contact_phone" className="text-[16px]" />
          Datos de contacto
        </h4>
        <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4">
          {editingSection === "contact" ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="stitch-label mb-1.5 block" htmlFor="profile-phone">
                  Teléfono
                </label>
                <input
                  id="profile-phone"
                  type="tel"
                  value={formValues.phone ?? ""}
                  onChange={(e) => handleValueChange("phone", e.target.value)}
                  className="stitch-input text-sm"
                  placeholder="+1 555 123 4567"
                  disabled={isSubmitting}
                />
                {fieldErrors.phone ? (
                  <p className="mt-1 text-xs text-error">{fieldErrors.phone}</p>
                ) : null}
              </div>

              <div>
                <label className="stitch-label mb-1.5 block" htmlFor="profile-email">
                  Correo electrónico
                </label>
                <input
                  id="profile-email"
                  type="email"
                  value={formValues.email ?? ""}
                  onChange={(e) => handleValueChange("email", e.target.value)}
                  className="stitch-input text-sm"
                  placeholder="email@ejemplo.com"
                  disabled={isSubmitting}
                />
                {fieldErrors.email ? (
                  <p className="mt-1 text-xs text-error">{fieldErrors.email}</p>
                ) : null}
              </div>

              {submitError ? <p className="text-xs text-error">{submitError}</p> : null}
              {successMessage ? <p className="text-xs text-success">{successMessage}</p> : null}

              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="stitch-btn-primary px-3 py-1.5 text-xs disabled:opacity-60"
                >
                  {isSubmitting ? "Guardando…" : "Guardar"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleCancelEdit();
                    setShowConfirm(false);
                  }}
                  disabled={isSubmitting}
                  className="stitch-btn-secondary px-3 py-1.5 text-xs"
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="stitch-label">Teléfono</p>
                <p className="text-sm text-on-surface">{profile.phone ?? "—"}</p>
              </div>
              <div>
                <p className="stitch-label">Correo electrónico</p>
                <p className="text-sm text-on-surface">{profile.email ?? "—"}</p>
              </div>
              <button
                type="button"
                onClick={() => handleEditStart("contact")}
                disabled={disabled}
                className="stitch-btn-secondary px-3 py-1.5 text-xs"
              >
                Editar
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Job Information Section */}
      <section className="space-y-3">
        <h4 className="stitch-label inline-flex items-center gap-1.5">
          <MaterialIcon name="work" className="text-[16px]" />
          Información laboral
        </h4>
        <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4">
          {editingSection === "job" ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="stitch-label mb-1.5 block" htmlFor="profile-title">
                  Cargo
                </label>
                <input
                  id="profile-title"
                  type="text"
                  value={formValues.title ?? ""}
                  onChange={(e) => handleValueChange("title", e.target.value)}
                  className="stitch-input text-sm"
                  placeholder="Técnico"
                  disabled={isSubmitting}
                />
                {fieldErrors.title ? (
                  <p className="mt-1 text-xs text-error">{fieldErrors.title}</p>
                ) : null}
              </div>

              <div>
                <label className="stitch-label mb-1.5 block" htmlFor="profile-department">
                  Departamento
                </label>
                <input
                  id="profile-department"
                  type="text"
                  value={formValues.department ?? ""}
                  onChange={(e) => handleValueChange("department", e.target.value)}
                  className="stitch-input text-sm"
                  placeholder="Operaciones"
                  disabled={isSubmitting}
                />
                {fieldErrors.department ? (
                  <p className="mt-1 text-xs text-error">{fieldErrors.department}</p>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="stitch-label mb-1.5 block" htmlFor="profile-hire-date">
                    Fecha de contratación
                  </label>
                  <input
                    id="profile-hire-date"
                    type="date"
                    value={formValues.hireDate?.split("T")[0] ?? ""}
                    onChange={(e) => handleValueChange("hireDate", e.target.value)}
                    className="stitch-input text-sm"
                    disabled={isSubmitting}
                  />
                  {fieldErrors.hireDate ? (
                    <p className="mt-1 text-xs text-error">{fieldErrors.hireDate}</p>
                  ) : null}
                </div>

                <div>
                  <label className="stitch-label mb-1.5 block" htmlFor="profile-termination-date">
                    Fecha de terminación
                  </label>
                  <input
                    id="profile-termination-date"
                    type="date"
                    value={formValues.terminationDate?.split("T")[0] ?? ""}
                    onChange={(e) => handleValueChange("terminationDate", e.target.value)}
                    className="stitch-input text-sm"
                    disabled={isSubmitting}
                  />
                  {fieldErrors.terminationDate ? (
                    <p className="mt-1 text-xs text-error">{fieldErrors.terminationDate}</p>
                  ) : null}
                </div>
              </div>

              {submitError ? <p className="text-xs text-error">{submitError}</p> : null}
              {successMessage ? <p className="text-xs text-success">{successMessage}</p> : null}

              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="stitch-btn-primary px-3 py-1.5 text-xs disabled:opacity-60"
                >
                  {isSubmitting ? "Guardando…" : "Guardar"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleCancelEdit();
                    setShowConfirm(false);
                  }}
                  disabled={isSubmitting}
                  className="stitch-btn-secondary px-3 py-1.5 text-xs"
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="stitch-label">Cargo</p>
                  <p className="text-sm text-on-surface">{profile.title ?? "—"}</p>
                </div>
                <div>
                  <p className="stitch-label">Departamento</p>
                  <p className="text-sm text-on-surface">{profile.department ?? "—"}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="stitch-label">Fecha de contratación</p>
                  <p className="text-sm text-on-surface">{formatEmployeeDate(profile.hireDate)}</p>
                </div>
                <div>
                  <p className="stitch-label">Fecha de terminación</p>
                  <p className="text-sm text-on-surface">{formatEmployeeDate(profile.terminationDate)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleEditStart("job")}
                disabled={disabled}
                className="stitch-btn-secondary px-3 py-1.5 text-xs"
              >
                Editar
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Address Section */}
      <section className="space-y-3">
        <h4 className="stitch-label inline-flex items-center gap-1.5">
          <MaterialIcon name="location_on" className="text-[16px]" />
          Dirección
        </h4>
        <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4">
          {editingSection === "address" ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="stitch-label mb-1.5 block" htmlFor="profile-address-line1">
                  Línea de dirección 1
                </label>
                <input
                  id="profile-address-line1"
                  type="text"
                  value={formValues.addressLine1 ?? ""}
                  onChange={(e) => handleValueChange("addressLine1", e.target.value)}
                  className="stitch-input text-sm"
                  placeholder="Calle Principal 123"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="stitch-label mb-1.5 block" htmlFor="profile-address-line2">
                  Línea de dirección 2
                </label>
                <input
                  id="profile-address-line2"
                  type="text"
                  value={formValues.addressLine2 ?? ""}
                  onChange={(e) => handleValueChange("addressLine2", e.target.value)}
                  className="stitch-input text-sm"
                  placeholder="Interior,suite,etc."
                  disabled={isSubmitting}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="stitch-label mb-1.5 block" htmlFor="profile-city">
                    Ciudad
                  </label>
                  <input
                    id="profile-city"
                    type="text"
                    value={formValues.city ?? ""}
                    onChange={(e) => handleValueChange("city", e.target.value)}
                    className="stitch-input text-sm"
                    placeholder="Ciudad"
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label className="stitch-label mb-1.5 block" htmlFor="profile-state">
                    Estado / Región
                  </label>
                  <input
                    id="profile-state"
                    type="text"
                    value={formValues.stateOrRegion ?? ""}
                    onChange={(e) => handleValueChange("stateOrRegion", e.target.value)}
                    className="stitch-input text-sm"
                    placeholder="Estado"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="stitch-label mb-1.5 block" htmlFor="profile-postal">
                    Código postal
                  </label>
                  <input
                    id="profile-postal"
                    type="text"
                    value={formValues.postalCode ?? ""}
                    onChange={(e) => handleValueChange("postalCode", e.target.value)}
                    className="stitch-input text-sm"
                    placeholder="12345"
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label className="stitch-label mb-1.5 block" htmlFor="profile-country">
                    País
                  </label>
                  <input
                    id="profile-country"
                    type="text"
                    value={formValues.countryCode ?? ""}
                    onChange={(e) => handleValueChange("countryCode", e.target.value)}
                    className="stitch-input text-sm"
                    placeholder="US"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {submitError ? <p className="text-xs text-error">{submitError}</p> : null}
              {successMessage ? <p className="text-xs text-success">{successMessage}</p> : null}

              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="stitch-btn-primary px-3 py-1.5 text-xs disabled:opacity-60"
                >
                  {isSubmitting ? "Guardando…" : "Guardar"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleCancelEdit();
                    setShowConfirm(false);
                  }}
                  disabled={isSubmitting}
                  className="stitch-btn-secondary px-3 py-1.5 text-xs"
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="whitespace-pre-line text-sm text-on-surface">
                  {formatEmployeeAddress({
                    addressLine1: profile.addressLine1,
                    addressLine2: profile.addressLine2,
                    city: profile.city,
                    stateOrRegion: profile.stateOrRegion,
                    postalCode: profile.postalCode,
                    countryCode: profile.countryCode
                  })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleEditStart("address")}
                disabled={disabled}
                className="stitch-btn-secondary px-3 py-1.5 text-xs"
              >
                Editar
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Emergency Contact Section */}
      <section className="space-y-3">
        <h4 className="stitch-label inline-flex items-center gap-1.5">
          <MaterialIcon name="emergency" className="text-[16px]" />
          Contacto de emergencia
        </h4>
        <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4">
          {editingSection === "emergency" ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="stitch-label mb-1.5 block" htmlFor="profile-emergency-name">
                  Nombre del contacto
                </label>
                <input
                  id="profile-emergency-name"
                  type="text"
                  value={formValues.emergencyContactName ?? ""}
                  onChange={(e) => handleValueChange("emergencyContactName", e.target.value)}
                  className="stitch-input text-sm"
                  placeholder="Juan Pérez"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="stitch-label mb-1.5 block" htmlFor="profile-emergency-phone">
                  Teléfono
                </label>
                <input
                  id="profile-emergency-phone"
                  type="tel"
                  value={formValues.emergencyContactPhone ?? ""}
                  onChange={(e) => handleValueChange("emergencyContactPhone", e.target.value)}
                  className="stitch-input text-sm"
                  placeholder="+1 555 123 4567"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="stitch-label mb-1.5 block" htmlFor="profile-emergency-relationship">
                  Relación
                </label>
                <input
                  id="profile-emergency-relationship"
                  type="text"
                  value={formValues.emergencyContactRelationship ?? ""}
                  onChange={(e) => handleValueChange("emergencyContactRelationship", e.target.value)}
                  className="stitch-input text-sm"
                  placeholder="Cónyuge"
                  disabled={isSubmitting}
                />
              </div>

              {submitError ? <p className="text-xs text-error">{submitError}</p> : null}
              {successMessage ? <p className="text-xs text-success">{successMessage}</p> : null}

              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="stitch-btn-primary px-3 py-1.5 text-xs disabled:opacity-60"
                >
                  {isSubmitting ? "Guardando…" : "Guardar"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleCancelEdit();
                    setShowConfirm(false);
                  }}
                  disabled={isSubmitting}
                  className="stitch-btn-secondary px-3 py-1.5 text-xs"
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              <p className="whitespace-pre-line text-sm text-on-surface">
                {formatEmergencyContact(
                  profile.emergencyContactName,
                  profile.emergencyContactPhone,
                  profile.emergencyContactRelationship
                )}
              </p>
              <button
                type="button"
                onClick={() => handleEditStart("emergency")}
                disabled={disabled}
                className="stitch-btn-secondary px-3 py-1.5 text-xs"
              >
                Editar
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Confirmation Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/30 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-xl border border-outline-variant bg-surface-container-lowest p-5 shadow-card">
            <h3 className="text-sm font-semibold text-on-surface">¿Guardar cambios?</h3>
            <p className="mt-2 text-sm text-on-surface-variant">
              Se actualizarán los datos del perfil del empleado.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleConfirmSave}
                disabled={isSubmitting}
                className="stitch-btn-primary px-4 py-2 text-xs disabled:opacity-60"
              >
                {isSubmitting ? "Guardando…" : "Sí, guardar"}
              </button>
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={isSubmitting}
                className="stitch-btn-secondary px-4 py-2 text-xs"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
