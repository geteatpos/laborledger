"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export type AdminPhotoAngle =
  | "FRONT"
  | "REAR"
  | "DRIVER_SIDE"
  | "PASSENGER_SIDE"
  | "TOP"
  | "DETAIL"
  | "OTHER";

export type AdminPhotoCategory =
  | "RECEPTION"
  | "EXTERIOR"
  | "INTERIOR"
  | "DAMAGE"
  | "PART";

export type AdminPhoto = {
  id: string;
  groupId: string;
  companyId: string;
  vehicleId: string;
  workOrderId: string | null;
  uploadedByEmployeeId: string | null;
  uploadedByUserId: string | null;
  category: AdminPhotoCategory;
  angle: AdminPhotoAngle | null;
  filePath: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  widthPx: number | null;
  heightPx: number | null;
  capturedAt: string | null;
  uploadedAt: string;
  caption: string | null;
  deletedAt: string | null;
};

export type VehiclePhotosGalleryBlockProps = {
  readonly companyId: string;
  readonly vehicleId: string;
  readonly workOrderId?: string;
};

const ANGLE_LABELS: Record<AdminPhotoAngle, string> = {
  FRONT: "Front",
  REAR: "Rear",
  DRIVER_SIDE: "Driver side",
  PASSENGER_SIDE: "Passenger side",
  TOP: "Top",
  DETAIL: "Detail",
  OTHER: "Other"
};

export function VehiclePhotosGalleryBlock({
  companyId,
  vehicleId,
  workOrderId
}: VehiclePhotosGalleryBlockProps) {
  const [photos, setPhotos] = useState<AdminPhoto[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<AdminPhoto | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const params = new URLSearchParams();
      if (workOrderId) params.set("workOrderId", workOrderId);

      try {
        const response = await fetch(
          `/api/company-operations/companies/${encodeURIComponent(companyId)}/vehicles/${encodeURIComponent(vehicleId)}/photos?${params.toString()}`,
          { cache: "no-store" }
        );

        if (cancelled) {
          return;
        }

        if (!response.ok) {
          setPhotos([]);
          return;
        }

        const payload = (await response.json().catch(() => [])) as AdminPhoto[];
        setPhotos(Array.isArray(payload) ? payload : []);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [companyId, vehicleId, workOrderId]);

  const ordered = useMemo(() => {
    if (!photos) {
      return [];
    }
    return [...photos].sort((a, b) => {
      if (b.uploadedAt === a.uploadedAt) {
        return a.id.localeCompare(b.id);
      }
      return b.uploadedAt.localeCompare(a.uploadedAt);
    });
  }, [photos]);

  if (isLoading) {
    return (
      <section className="space-y-3">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">
          Reception photos
        </h3>
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-500">
          Loading photos…
        </div>
      </section>
    );
  }

  if (!ordered.length) {
    return (
      <section className="space-y-3">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">
          Reception photos
        </h3>
        <div className="inline-flex rounded-md border border-slate-200 bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
          No photos recorded
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">
          Reception photos
        </h3>
        <span className="inline-flex rounded-md border border-slate-200 bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700">
          {ordered.length} {ordered.length === 1 ? "photo" : "photos"}
        </span>
      </div>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {ordered.map((photo) => (
          <li
            key={photo.id}
            className="group overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
          >
            <button
              type="button"
              onClick={() => setSelected(photo)}
              className="block w-full text-left"
              aria-label={`Open photo ${photo.angle ?? ""}`.trim()}
            >
              <div className="relative">
                <img
                  src={`/api/company-operations/companies/${encodeURIComponent(companyId)}/photos/${encodeURIComponent(photo.id)}/stream`}
                  alt={photo.angle ? `${ANGLE_LABELS[photo.angle]} view` : "Vehicle photo"}
                  className="aspect-square w-full object-cover transition-transform group-hover:scale-[1.02]"
                  loading="lazy"
                />
                {photo.angle ? (
                  <span className="absolute left-2 top-2 inline-flex rounded-md bg-slate-900/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                    {ANGLE_LABELS[photo.angle]}
                  </span>
                ) : null}
              </div>
            </button>
            <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-[11px]">
              <span className="text-slate-500">{formatSize(photo.sizeBytes)}</span>
              <Link
                href={`/api/company-operations/companies/${encodeURIComponent(companyId)}/photos/${encodeURIComponent(photo.id)}/stream`}
                download={photo.originalFilename}
                className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
              >
                Download
              </Link>
            </div>
          </li>
        ))}
      </ul>

      {selected ? (
        <PhotoModal photo={selected} companyId={companyId} onClose={() => setSelected(null)} />
      ) : null}
    </section>
  );
}

function PhotoModal({
  photo,
  companyId,
  onClose
}: {
  readonly photo: AdminPhoto;
  readonly companyId: string;
  readonly onClose: () => void;
}) {
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-full bg-slate-900/70 px-3 py-1.5 text-xs font-semibold text-white"
        >
          Close
        </button>
        <img
          src={`/api/company-operations/companies/${encodeURIComponent(companyId)}/photos/${encodeURIComponent(photo.id)}/stream`}
          alt={photo.angle ? `${ANGLE_LABELS[photo.angle]} view` : "Vehicle photo"}
          className="max-h-[70vh] w-full object-contain"
        />
        <div className="space-y-1 border-t border-slate-200 p-4 text-sm text-slate-700">
          {photo.angle ? (
            <p>
              <span className="font-semibold">Angle:</span> {ANGLE_LABELS[photo.angle]}
            </p>
          ) : null}
          <p>
            <span className="font-semibold">Uploaded:</span>{" "}
            {new Date(photo.uploadedAt).toLocaleString()}
          </p>
          <p>
            <span className="font-semibold">Size:</span> {formatSize(photo.sizeBytes)}
          </p>
          <p>
            <span className="font-semibold">File:</span>{" "}
            <span className="font-mono text-xs">{photo.originalFilename}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
