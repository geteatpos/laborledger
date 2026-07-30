"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Approval = {
  status: string;
  note: string | null;
  contactMethod: string | null;
  decidedAt: string | null;
  createdAt: string;
  supervisor: { id: string; fullName: string | null; email: string } | null;
};

type Part = {
  id: string;
  name: string;
  quantity: number;
  notes: string | null;
  positionOrder: number;
  photoId: string | null;
  identifiedName: string | null;
  identifiedPartNumber: string | null;
  identifiedAt: string | null;
};

type Order = {
  id: string;
  workOrderNumber: string;
  status: string;
  isApproved: boolean;
  isRejected: boolean;
  vehicle: {
    vin: string;
    year: number | null;
    make: string | null;
    model: string | null;
    plate: string | null;
    color: string | null;
  };
  parts: Part[];
  approval: Approval | null;
};

type MechanicOrderDetailPanelProps = {
  readonly workOrderId: string;
  readonly order: Order;
  readonly accessLevel: "platform" | "group_owner" | "company_admin" | "supervisor";
  readonly canDecide: boolean;
};

type ShoppingLink = { store: string; url: string; price: number | null };

const PART_PHOTO_STREAM_URL = (id: string) => `/api/field/photos/${encodeURIComponent(id)}/stream`;

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

export function MechanicOrderDetailPanel({
  workOrderId,
  order,
  canDecide
}: MechanicOrderDetailPanelProps) {
  const router = useRouter();
  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);
  const [note, setNote] = useState("");
  const [contactMethod, setContactMethod] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openPhoto, setOpenPhoto] = useState<string | null>(null);
  const [shoppingForPart, setShoppingForPart] = useState<string | null>(null);
  const [shoppingLinks, setShoppingLinks] = useState<ShoppingLink[]>([]);
  const [shoppingLoading, setShoppingLoading] = useState(false);
  const [shoppingIdentifying, setShoppingIdentifying] = useState(false);
  const [identifiedPartName, setIdentifiedPartName] = useState<string | null>(null);
  const [identifiedPartNumber, setIdentifiedPartNumber] = useState<string | null>(null);
  const [shoppingError, setShoppingError] = useState<string | null>(null);

  useEffect(() => {
    if (!shoppingForPart) {
      setShoppingLinks([]);
      setIdentifiedPartName(null);
      setIdentifiedPartNumber(null);
      setShoppingError(null);
    }
  }, [shoppingForPart]);

  async function handleDecide() {
    setBusy(true);
    setError(null);
    try {
      const path = decision === "approve" ? "approve" : "reject";
      const response = await fetch(
        `/api/company-operations/mechanic-orders/${encodeURIComponent(workOrderId)}/${path}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            note: note.trim() || undefined,
            contactMethod: contactMethod.trim() || undefined
          })
        }
      );
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) {
        setError(payload.message ?? "Decision failed.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function openShoppingOptions(partId: string) {
    const part = order.parts.find((p) => p.id === partId);
    if (!part) {
      setError("Part not found.");
      return;
    }

    setShoppingForPart(partId);
    setShoppingLoading(true);
    setShoppingIdentifying(Boolean(!part.identifiedName));
    setShoppingError(null);
    setIdentifiedPartName(part.identifiedName);
    setIdentifiedPartNumber(part.identifiedPartNumber);

    try {
      let identifiedName = part.identifiedName;

      if (!identifiedName) {
        const identifyResponse = await fetch(
          `/api/company-operations/mechanic-orders/${encodeURIComponent(workOrderId)}/parts/${encodeURIComponent(partId)}/ai-identify`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              vin: order.vehicle.vin,
              photoId: part.photoId ?? undefined
            }),
            cache: "no-store"
          }
        );
        const identifyPayload = (await identifyResponse.json().catch(() => ({}))) as {
          identifiedName?: string;
          identifiedPartNumber?: string | null;
          message?: string;
        };
        if (!identifyResponse.ok || !identifyPayload.identifiedName) {
          identifiedName = part.name;
          setIdentifiedPartName(identifiedName);
          setIdentifiedPartNumber(null);
          setShoppingError(
            identifyPayload.message ??
              "AI could not identify this part. Showing search links with the existing name."
          );
        } else {
          identifiedName = identifyPayload.identifiedName;
          setIdentifiedPartName(identifiedName);
          setIdentifiedPartNumber(identifyPayload.identifiedPartNumber ?? null);
        }
      }

      const response = await fetch(
        `/api/company-operations/mechanic-orders/${encodeURIComponent(workOrderId)}/parts/${encodeURIComponent(partId)}/shopping-links`,
        { cache: "no-store", signal: AbortSignal.timeout(30_000) }
      );
      const payload = (await response.json().catch(() => ({}))) as
        | { links: ShoppingLink[] }
        | { message?: string };
      if (!response.ok || !("links" in payload)) {
        setShoppingLinks([]);
        setShoppingError(
          (payload as { message?: string }).message ?? "Could not load shopping links."
        );
        return;
      }
      setShoppingLinks(payload.links);
    } finally {
      setShoppingIdentifying(false);
      setShoppingLoading(false);
    }
  }

  async function reidentifyPart() {
    if (!shoppingForPart) return;
    const part = order.parts.find((p) => p.id === shoppingForPart);
    if (!part) return;

    setShoppingIdentifying(true);
    setShoppingError(null);
    try {
      const response = await fetch(
        `/api/company-operations/mechanic-orders/${encodeURIComponent(workOrderId)}/parts/${encodeURIComponent(part.id)}/ai-identify`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            vin: order.vehicle.vin,
            photoId: part.photoId ?? undefined
          }),
          cache: "no-store"
        }
      );
      const payload = (await response.json().catch(() => ({}))) as {
        identifiedName?: string;
        identifiedPartNumber?: string | null;
        message?: string;
      };
      if (!response.ok || !payload.identifiedName) {
        setShoppingError(payload.message ?? "AI could not identify this part.");
        return;
      }
      setIdentifiedPartName(payload.identifiedName);
      setIdentifiedPartNumber(payload.identifiedPartNumber ?? null);
      router.refresh();
    } finally {
      setShoppingIdentifying(false);
    }
  }

  const submitDisabled =
    busy || (decision === "reject" && !note.trim());

  return (
    <div className="space-y-6">
      <div>
        <Link href="/mechanic-orders" className="text-sm font-medium text-brand-700 hover:underline">
          ← All mechanic orders
        </Link>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Vehicle</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">VIN</dt>
            <dd className="mt-0.5 font-mono text-slate-900">{order.vehicle.vin}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Year / Make / Model</dt>
            <dd className="mt-0.5 font-medium text-slate-900">
              {[order.vehicle.year, order.vehicle.make, order.vehicle.model]
                .filter(Boolean)
                .join(" ") || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Plate</dt>
            <dd className="mt-0.5 text-slate-700">{order.vehicle.plate ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Color</dt>
            <dd className="mt-0.5 text-slate-700">{order.vehicle.color ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Work order</dt>
            <dd className="mt-0.5 font-mono text-slate-700">{order.workOrderNumber}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-lg font-semibold text-slate-900">Parts ({order.parts.length})</h2>
          {order.approval?.decidedAt ? (
            <span className="text-xs text-slate-500">{formatDateTime(order.approval.decidedAt)}</span>
          ) : null}
        </header>
        {order.parts.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">No parts documented.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-2">Part</th>
                <th className="px-5 py-2">Qty</th>
                <th className="px-5 py-2">Notes</th>
                <th className="px-5 py-2">Photo</th>
                <th className="px-5 py-2" />
              </tr>
            </thead>
            <tbody>
              {order.parts.map((part) => (
                <tr key={part.id} className="border-t border-slate-100">
                  <td className="px-5 py-3 font-medium text-slate-900">{part.name}</td>
                  <td className="px-5 py-3 text-slate-700">{part.quantity}</td>
                  <td className="px-5 py-3 text-slate-600">{part.notes ?? "—"}</td>
                  <td className="px-5 py-3">
                    {part.photoId ? (
                      <button
                        type="button"
                        onClick={() => setOpenPhoto(part.photoId)}
                        className="block h-12 w-12 overflow-hidden rounded-lg border border-slate-200"
                      >
                        <img
                          src={PART_PHOTO_STREAM_URL(part.photoId)}
                          alt="Part"
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">No photo</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openShoppingOptions(part.id)}
                      className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-800 hover:bg-violet-100"
                    >
                      Find part online (AI)
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {canDecide ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-amber-900">Approve or reject</h2>
          <p className="mt-1 text-sm text-amber-800">
            Contact the vehicle owner first, then record the outcome. Approving flips the work order back
            to ASSIGNED. Rejecting requires a note.
          </p>
          <label className="mt-4 block text-xs font-medium text-slate-700" htmlFor="mech-contact">
            Contact method / notes (visible to the employee)
          </label>
          <textarea
            id="mech-contact"
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Spoke with owner at 555-0101. They confirmed parts."
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={contactMethod}
            onChange={(event) => setContactMethod(event.target.value)}
            placeholder="Optional: phone / email used (kept private)"
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setDecision("approve");
                void handleDecide();
              }}
              disabled={busy}
              className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {busy && decision === "approve" ? "Approving…" : "Approve"}
            </button>
            <button
              type="button"
              onClick={() => {
                setDecision("reject");
                void handleDecide();
              }}
              disabled={submitDisabled}
              className="rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              {busy && decision === "reject" ? "Rejecting…" : "Reject"}
            </button>
          </div>
        </section>
      ) : null}

      {!canDecide && order.approval ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-emerald-900">
            {order.isApproved ? "Approved" : "Rejected"}
          </h2>
          <p className="mt-1 text-sm text-emerald-800">
            By {order.approval.supervisor?.fullName ?? "Supervisor"} · {formatDateTime(order.approval.decidedAt)}
          </p>
          {order.approval.note ? (
            <p className="mt-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-700">
              {order.approval.note}
            </p>
          ) : null}
          {order.approval.contactMethod ? (
            <p className="mt-1 text-xs text-emerald-700">
              Contact method: {order.approval.contactMethod}
            </p>
          ) : null}
        </section>
      ) : null}

      {openPhoto ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/70 p-6"
          onClick={() => setOpenPhoto(null)}
          role="dialog"
        >
          <img
            src={PART_PHOTO_STREAM_URL(openPhoto)}
            alt="Part photo"
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        </div>
      ) : null}

      {shoppingForPart ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/70 p-6"
          onClick={() => setShoppingForPart(null)}
          role="dialog"
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Find part online</h3>
              <button
                type="button"
                onClick={() => setShoppingForPart(null)}
                className="text-sm font-medium text-slate-500"
              >
                Close
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-violet-700">
                    Identified part
                  </p>
                  {shoppingIdentifying ? (
                    <p className="mt-1 text-sm text-violet-900">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-violet-500" />
                        Analyzing photo with AI…
                      </span>
                    </p>
                  ) : (
                    <p className="mt-1 break-words text-sm font-semibold text-violet-900">
                      {identifiedPartName ?? "—"}
                    </p>
                  )}
                  {identifiedPartNumber && !shoppingIdentifying ? (
                    <p className="mt-0.5 text-xs text-violet-800">
                      Part # <span className="font-mono">{identifiedPartNumber}</span>
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => void reidentifyPart()}
                  disabled={shoppingIdentifying}
                  className="rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-800 hover:bg-violet-100 disabled:opacity-60"
                >
                  {shoppingIdentifying ? "Re-running…" : "Re-identify"}
                </button>
              </div>
              {shoppingError ? (
                <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900">
                  {shoppingError}
                </p>
              ) : null}
            </div>

            {shoppingLoading && shoppingLinks.length === 0 ? (
              <p className="mt-4 text-sm text-slate-600">
                Loading shopping options and prices (this can take up to 20s)…
              </p>
            ) : shoppingLinks.length === 0 ? (
              <p className="mt-4 text-sm text-slate-600">No shopping options available.</p>
            ) : (
              <>
                <p className="mt-4 text-xs uppercase tracking-wide text-slate-500">
                  Cheapest first:
                </p>
                <ul className="mt-2 space-y-2">
                  {shoppingLinks.map((link, idx) => (
                    <li key={link.store}>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-brand-700 hover:bg-slate-50"
                      >
                        <span className="flex items-center gap-2">
                          {link.price != null ? (
                            <span
                              className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
                                idx === 0
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {idx === 0 ? "BEST" : `#${idx + 1}`}
                            </span>
                          ) : null}
                          <span>{link.store}</span>
                        </span>
                        <span className="flex items-center gap-3">
                          {link.price != null ? (
                            <span
                              className={`text-sm font-bold ${
                                idx === 0 ? "text-emerald-700" : "text-slate-700"
                              }`}
                            >
                              ${link.price.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">
                              price unavailable
                            </span>
                          )}
                          <span className="text-xs text-slate-500">Open ↗</span>
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}
    </div>
  );
}
