"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { PrimaryActionButton } from "@/components/shared/PrimaryActionButton";
import {
  type FieldVehiclePhotoAngle
} from "@/lib/field-photos-client";

type VehiclePhotosCaptureProps = {
  readonly vehicleId: string;
  readonly workOrderId: string;
  readonly onDone: () => void;
};

type PhotoRecord = {
  id: string;
  angle: FieldVehiclePhotoAngle | null;
  sizeBytes: number;
};

type AngleOption = {
  value: FieldVehiclePhotoAngle;
  label: string;
};

type PendingPhoto = {
  id: string;
  file: File;
  previewUrl: string;
  selectedAngle: FieldVehiclePhotoAngle;
};

const ANGLE_OPTIONS: AngleOption[] = [
  { value: "FRONT", label: "Front" },
  { value: "REAR", label: "Rear" },
  { value: "DRIVER_SIDE", label: "Driver side" },
  { value: "PASSENGER_SIDE", label: "Passenger side" },
  { value: "TOP", label: "Top" },
  { value: "DETAIL", label: "Detail" },
  { value: "OTHER", label: "Other" }
];

const SUGGESTED_RECEPTION_COUNT = 4;
const MAX_BYTES = 10 * 1024 * 1024;

export function VehiclePhotosCapture({
  vehicleId,
  workOrderId,
  onDone
}: VehiclePhotosCaptureProps) {
  const [existingPhotos, setExistingPhotos] = useState<PhotoRecord[]>([]);
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const params = new URLSearchParams({ workOrderId });
      const response = await fetch(
        `/api/field/vehicles/${encodeURIComponent(vehicleId)}/photos?${params.toString()}`,
        { cache: "no-store" }
      );

      if (response.ok) {
        const payload = (await response.json().catch(() => [])) as PhotoRecord[];
        setExistingPhotos(payload);
      } else {
        const error = (await response.json().catch(() => ({}))) as { message?: string };
        if (response.status !== 401) {
          setErrorMessage(error.message ?? "Unable to load photos.");
        }
      }
    } catch {
      setErrorMessage("Network error while loading photos.");
    } finally {
      setIsLoading(false);
    }
  }, [vehicleId, workOrderId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const totalCount = existingPhotos.length + pending.length;
  const meetsSuggestion = totalCount >= SUGGESTED_RECEPTION_COUNT;
  const hasUploading = pending.some((entry) => uploadingId === entry.id);

  function handleFileChosen(event: React.ChangeEvent<HTMLInputElement>) {
    setErrorMessage(null);
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (file.size > MAX_BYTES) {
      setErrorMessage("Photo is larger than 10MB. Choose a smaller file.");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Select an image file (JPG, PNG, HEIC, WEBP).");
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    const id = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setPending((current) => [
      ...current,
      { id, file, previewUrl, selectedAngle: "FRONT" }
    ]);
  }

  function updatePendingAngle(id: string, angle: FieldVehiclePhotoAngle) {
    setPending((current) =>
      current.map((entry) =>
        entry.id === id ? { ...entry, selectedAngle: angle } : entry
      )
    );
  }

  function removePending(id: string) {
    setPending((current) => {
      const next = current.filter((entry) => entry.id !== id);
      const removed = current.find((entry) => entry.id === id);
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return next;
    });
  }

  async function handleUpload(entry: PendingPhoto) {
    setErrorMessage(null);
    setUploadingId(entry.id);

    const formData = new FormData();
    formData.append("photo", entry.file);
    formData.append("workOrderId", workOrderId);
    formData.append("category", "RECEPTION");
    formData.append("angle", entry.selectedAngle);

    try {
      const response = await fetch(
        `/api/field/vehicles/${encodeURIComponent(vehicleId)}/photos`,
        { method: "POST", body: formData }
      );

      const payload = (await response.json().catch(() => ({}))) as
        | { id: string; angle: FieldVehiclePhotoAngle | null; sizeBytes: number }
        | { message: string };

      if (!response.ok || !("id" in payload)) {
        setErrorMessage(
          (payload as { message?: string }).message ?? "Could not upload the photo."
        );
        return;
      }

      URL.revokeObjectURL(entry.previewUrl);
      setPending((current) => current.filter((photo) => photo.id !== entry.id));
      setExistingPhotos((current) => [
        {
          id: payload.id,
          angle: payload.angle,
          sizeBytes: payload.sizeBytes
        },
        ...current
      ]);
    } catch {
      setErrorMessage("Network error while uploading the photo.");
    } finally {
      setUploadingId(null);
    }
  }

  useEffect(() => {
    return () => {
      pending.forEach((entry) => URL.revokeObjectURL(entry.previewUrl));
    };
  }, [pending]);

  const counterTone = useMemo(
    () =>
      meetsSuggestion
        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : "border-amber-200 bg-amber-50 text-amber-900",
    [meetsSuggestion]
  );

  return (
    <div className="space-y-4 pb-28">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs uppercase tracking-wide text-slate-500">Reception photos</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-900">
          Vehicle reception photos
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Take at least 4 photos of the vehicle exterior.
        </p>

        <div
          className={`mt-3 inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold ${counterTone}`}
        >
          {totalCount} {totalCount === 1 ? "photo" : "photos"} added
          {meetsSuggestion ? <span aria-hidden="true">✓</span> : null}
        </div>

        {errorMessage ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center">
          <span className="text-base font-semibold text-slate-900">Add photo</span>
          <span className="text-xs text-slate-500">
            Opens your camera. JPG/PNG/HEIC up to 10MB.
          </span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChosen}
            className="sr-only"
          />
        </label>
      </section>

      {pending.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Ready to upload
          </h3>
          {pending.map((entry) => (
            <PendingPhotoRow
              key={entry.id}
              entry={entry}
              uploading={uploadingId === entry.id}
              onAngleChange={(angle) => updatePendingAngle(entry.id, angle)}
              onUpload={() => void handleUpload(entry)}
              onRemove={() => removePending(entry.id)}
            />
          ))}
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Already uploaded
        </h3>
        {isLoading ? (
          <p className="mt-3 text-sm text-slate-500">Loading photos…</p>
        ) : existingPhotos.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No photos recorded yet.</p>
        ) : (
          <ul className="mt-3 grid grid-cols-2 gap-3">
            {existingPhotos.map((photo) => (
              <li
                key={photo.id}
                className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
              >
                <img
                  src={`/api/field/photos/${encodeURIComponent(photo.id)}/stream`}
                  alt={photo.angle ? `${photo.angle.toLowerCase()} view` : "Vehicle photo"}
                  className="aspect-square w-full object-cover"
                  loading="lazy"
                />
                <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-[11px]">
                  <span className="font-semibold uppercase tracking-wide text-slate-700">
                    {photo.angle ?? "Photo"}
                  </span>
                  <span className="text-slate-500">
                    {(photo.sizeBytes / 1024).toFixed(0)} KB
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="sticky bottom-0 left-0 right-0 -mx-4 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-md backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-600">
            Photos are recommended but not blocking. You can continue without them.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <PrimaryActionButton
              label="Skip for now"
              variant="secondary"
              onClick={onDone}
              disabled={hasUploading}
            />
            <PrimaryActionButton
              label="Continue"
              variant="kiosk"
              onClick={onDone}
              disabled={hasUploading}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function PendingPhotoRow({
  entry,
  uploading,
  onAngleChange,
  onUpload,
  onRemove
}: {
  readonly entry: PendingPhoto;
  readonly uploading: boolean;
  readonly onAngleChange: (angle: FieldVehiclePhotoAngle) => void;
  readonly onUpload: () => void;
  readonly onRemove: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex gap-3">
        <img
          src={entry.previewUrl}
          alt="Selected photo preview"
          className="h-24 w-24 flex-shrink-0 rounded-lg border border-slate-200 object-cover"
        />
        <div className="flex-1 space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
            Angle
          </label>
          <select
            value={entry.selectedAngle}
            onChange={(event) =>
              onAngleChange(event.target.value as FieldVehiclePhotoAngle)
            }
            disabled={uploading}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
          >
            {ANGLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onUpload}
              disabled={uploading}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white disabled:bg-slate-300"
            >
              {uploading ? "Uploading…" : "Upload"}
            </button>
            <button
              type="button"
              onClick={onRemove}
              disabled={uploading}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 disabled:text-slate-400"
            >
              Remove
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
