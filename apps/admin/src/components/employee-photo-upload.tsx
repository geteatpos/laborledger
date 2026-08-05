"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { employeeInitials, employeePhotoApiPath } from "../lib/employee-utils";

type EmployeePhotoUploadProps = {
  readonly employeeId: string;
  readonly companyId: string;
  readonly fullName: string;
  readonly hasPhoto: boolean;
  readonly disabled?: boolean;
  readonly onPhotoChange?: () => void;
};

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export function EmployeePhotoUpload({
  employeeId,
  companyId,
  fullName,
  hasPhoto: initialHasPhoto,
  disabled = false,
  onPhotoChange
}: EmployeePhotoUploadProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [hasPhoto, setHasPhoto] = useState(initialHasPhoto);
  const [cacheBust, setCacheBust] = useState(() => Date.now());
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    setHasPhoto(initialHasPhoto);
    setPreviewUrl(null);
    setCacheBust(Date.now());
  }, [employeeId, initialHasPhoto]);

  const initials = employeeInitials(fullName);
  const photoPath = employeePhotoApiPath(companyId, employeeId);
  const photoSrc = previewUrl ?? (hasPhoto
    ? `${photoPath}?t=${cacheBust}`
    : null);

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setValidationError(null);
    setUploadError(null);
    setSuccessMessage(null);

    if (!file) {
      return;
    }

    // Validate type
    if (!ALLOWED_TYPES.includes(file.type)) {
      setValidationError("Tipo de archivo no válido. Usa JPEG, PNG o WebP.");
      return;
    }

    // Validate size
    if (file.size > MAX_SIZE_BYTES) {
      setValidationError("El archivo es demasiado grande. Máximo 5MB.");
      return;
    }

    setSelectedFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }

  function handleCancelPreview() {
    setPreviewUrl(null);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = selectedFile;
    if (!file) {
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setSuccessMessage(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(
        photoPath,
        {
          method: "POST",
          body: formData
        }
      );

      const payload = (await response.json().catch(() => ({}))) as {
        message?: string | string[];
      };

      if (!response.ok) {
        const message = Array.isArray(payload.message)
          ? payload.message.join(" ")
          : payload.message ?? "No se pudo subir la foto.";
        setUploadError(message);
        return;
      }

      setSuccessMessage("Foto subida correctamente.");
      setHasPhoto(true);
      setCacheBust(Date.now());
      setPreviewUrl(null);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      onPhotoChange?.();
      router.refresh();
    } catch {
      setUploadError("Error de conexión. Intenta de nuevo.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    setDeleteError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(
        photoPath,
        {
          method: "DELETE"
        }
      );

      const payload = (await response.json().catch(() => ({}))) as {
        message?: string | string[];
      };

      if (!response.ok) {
        const message = Array.isArray(payload.message)
          ? payload.message.join(" ")
          : payload.message ?? "No se pudo eliminar la foto.";
        setDeleteError(message);
        return;
      }

      setSuccessMessage("Foto eliminada.");
      setHasPhoto(false);
      setPreviewUrl(null);
      setShowDeleteConfirm(false);
      onPhotoChange?.();
      router.refresh();
    } catch {
      setDeleteError("Error de conexión. Intenta de nuevo.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Photo preview area */}
      <div className="flex flex-col items-center gap-3">
        {/* Avatar / Photo */}
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border-2 border-outline-variant bg-surface-container-low">
          {photoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoSrc}
              alt={`Foto de ${fullName}`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-primary-container text-lg font-semibold text-on-primary-container">
              {initials}
            </div>
          )}

          {/* Loading overlay */}
          {(isUploading || isDeleting) && (
            <div className="absolute inset-0 flex items-center justify-center bg-on-surface/40">
              <span className="text-xs font-medium text-white">...</span>
            </div>
          )}
        </div>

        {/* Upload form (shown when preview is available) */}
        {previewUrl && (
          <form onSubmit={handleUpload} className="flex flex-col items-center gap-2">
            <p className="text-xs text-on-surface-variant">Vista previa de la nueva foto</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={isUploading}
                className="stitch-btn-primary px-3 py-1.5 text-xs disabled:opacity-60"
              >
                {isUploading ? "Subiendo…" : "Confirmar"}
              </button>
              <button
                type="button"
                onClick={handleCancelPreview}
                disabled={isUploading}
                className="stitch-btn-secondary px-3 py-1.5 text-xs"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {/* Action buttons (shown when no preview) */}
        {!previewUrl && (
          <div className="flex flex-wrap gap-2">
            <label
              className={`stitch-btn-secondary cursor-pointer px-3 py-1.5 text-xs ${disabled || isUploading || isDeleting ? "opacity-50" : ""}`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={ALLOWED_TYPES.join(",")}
                onChange={handleFileSelect}
                disabled={disabled || isUploading || isDeleting}
                className="sr-only"
              />
              {hasPhoto ? "Cambiar" : "Subir foto"}
            </label>

            {hasPhoto && !previewUrl && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={disabled || isUploading || isDeleting}
                className="stitch-btn-ghost px-3 py-1.5 text-xs text-error"
              >
                Eliminar
              </button>
            )}
          </div>
        )}
      </div>

      {/* Validation error */}
      {validationError ? (
        <p className="text-center text-xs text-error">{validationError}</p>
      ) : null}

      {/* Upload error */}
      {uploadError ? (
        <p className="text-center text-xs text-error">{uploadError}</p>
      ) : null}

      {/* Delete error */}
      {deleteError ? (
        <p className="text-center text-xs text-error">{deleteError}</p>
      ) : null}

      {/* Success message */}
      {successMessage ? (
        <p className="text-center text-xs text-success">{successMessage}</p>
      ) : null}

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="rounded-lg border border-outline-variant bg-surface-container-low p-3">
          <p className="text-xs text-on-surface">¿Eliminar la foto de perfil?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="stitch-btn-danger px-3 py-1.5 text-xs disabled:opacity-60"
            >
              {isDeleting ? "Eliminando…" : "Sí, eliminar"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowDeleteConfirm(false);
                setDeleteError(null);
              }}
              disabled={isDeleting}
              className="stitch-btn-secondary px-3 py-1.5 text-xs"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Help text */}
      {!hasPhoto && !previewUrl && !validationError && (
        <p className="text-center text-xs text-on-surface-variant">
          JPEG, PNG o WebP. Máximo 5MB.
        </p>
      )}
    </div>
  );
}
