"use client";

import { useState } from "react";
import type { FormEvent } from "react";

import {
  formatClientInvoiceMoney,
  formatLineItemTypeLabel,
  LINE_ITEM_TYPE_OPTIONS,
  type LineItemType
} from "../lib/client-invoice-utils";
import { MaterialIcon } from "./ui/material-icon";

export type DraftLineItem = {
  id?: string;
  type: LineItemType;
  description: string;
  quantity: number;
  unitPriceMinor: number;
  taxable: boolean;
  taxRate: number;
  sortOrder?: number;
};

type ClientInvoiceLineItemRowProps = {
  readonly line: DraftLineItem;
  readonly currencyCode: string;
  readonly onSave: (line: DraftLineItem) => void;
  readonly onDelete: () => void;
  readonly disabled?: boolean;
};

export function ClientInvoiceLineItemRow({
  line,
  currencyCode,
  onSave,
  onDelete,
  disabled = false
}: ClientInvoiceLineItemRowProps) {
  const [isEditing, setIsEditing] = useState(!line.id);
  const [editForm, setEditForm] = useState<DraftLineItem>(line);
  
  const subtotal = line.quantity * line.unitPriceMinor;
  const taxAmount = line.taxable ? Math.round(subtotal * (line.taxRate / 100)) : 0;
  const total = subtotal + taxAmount;

  function startEditing() {
    setEditForm(line);
    setIsEditing(true);
  }

  function cancelEditing() {
    if (line.id) {
      setIsEditing(false);
      }
  }

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    const quantity = Number(formData.get("quantity"));
    const unitPriceMinor = Math.round(Number(formData.get("unitPrice")) * 100);

    if (isNaN(quantity) || quantity <= 0) {
      // Quantity validation error
      return;
    }

    if (isNaN(unitPriceMinor) || unitPriceMinor < 0) {
      // Unit price validation error
      return;
    }

    const updatedLine: DraftLineItem = {
      ...editForm,
      quantity,
      unitPriceMinor
    };
    if (editForm.id) {
      updatedLine.id = editForm.id;
    }

    onSave(updatedLine);
    setIsEditing(false);
  }

  if (isEditing) {
    return (
      <tr className="border-t border-outline-variant/50 bg-surface-container-low">
        <td className="px-3 py-3">
          <select
            name="type"
            value={editForm.type}
            onChange={(e) => setEditForm({ ...editForm, type: e.target.value as LineItemType })}
            className="stitch-select text-xs"
            disabled={disabled}
          >
            {LINE_ITEM_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </td>
        <td className="px-3 py-3">
          <input
            type="text"
            name="description"
            value={editForm.description}
            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
            className="stitch-input text-sm"
            placeholder="Descripción del concepto"
            disabled={disabled}
          />
        </td>
        <td className="px-3 py-3">
          <input
            type="number"
            name="quantity"
            defaultValue={editForm.quantity}
            min="0.01"
            step="0.01"
            className="stitch-input w-20 text-sm"
            disabled={disabled}
          />
        </td>
        <td className="px-3 py-3">
          <input
            type="number"
            name="unitPrice"
            defaultValue={(editForm.unitPriceMinor / 100).toFixed(2)}
            min="0"
            step="0.01"
            className="stitch-input w-24 text-sm"
            disabled={disabled}
          />
        </td>
        <td className="px-3 py-3">
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={editForm.taxable}
              onChange={(e) => setEditForm({ ...editForm, taxable: e.target.checked })}
              className="accent-secondary"
              disabled={disabled}
            />
            {editForm.taxRate > 0 && (
              <span className="text-xs text-on-surface-variant">{editForm.taxRate}%</span>
            )}
          </label>
        </td>
        <td className="px-3 py-3 text-right">
          <span className="text-sm font-semibold text-on-surface">
            {formatClientInvoiceMoney(total, currencyCode)}
          </span>
        </td>
        <td className="px-3 py-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={(e) => void handleSave(e as unknown as FormEvent<HTMLFormElement>)}
              disabled={disabled}
              className="rounded-lg p-1.5 text-secondary hover:bg-secondary-container/30 disabled:opacity-50"
              title="Guardar"
            >
              <MaterialIcon name="check" className="text-[16px]" />
            </button>
            <button
              type="button"
              onClick={cancelEditing}
              disabled={disabled}
              className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-low disabled:opacity-50"
              title="Cancelar"
            >
              <MaterialIcon name="close" className="text-[16px]" />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="group border-t border-outline-variant/50 transition hover:bg-surface-container-low/50">
      <td className="px-3 py-3">
        <span className="rounded-full bg-surface-container px-2 py-0.5 text-xs font-medium text-on-surface-variant">
          {formatLineItemTypeLabel(line.type)}
        </span>
      </td>
      <td className="px-3 py-3">
        <span className="text-sm text-on-surface">{line.description}</span>
      </td>
      <td className="px-3 py-3">
        <span className="text-sm text-on-surface">{line.quantity}</span>
      </td>
      <td className="px-3 py-3">
        <span className="text-sm text-on-surface">
          {formatClientInvoiceMoney(line.unitPriceMinor, currencyCode)}
        </span>
      </td>
      <td className="px-3 py-3">
        {line.taxable ? (
          <span className="text-xs text-on-surface-variant">Sí · {line.taxRate}%</span>
        ) : (
          <span className="text-xs text-on-surface-variant">No</span>
        )}
      </td>
      <td className="px-3 py-3 text-right">
        <span className="text-sm font-semibold text-on-surface">
          {formatClientInvoiceMoney(total, currencyCode)}
        </span>
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
          <button
            type="button"
            onClick={startEditing}
            disabled={disabled}
            className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-low disabled:opacity-50"
            title="Editar"
          >
            <MaterialIcon name="edit" className="text-[16px]" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={disabled}
            className="rounded-lg p-1.5 text-error hover:bg-error-container/30 disabled:opacity-50"
            title="Eliminar"
          >
            <MaterialIcon name="delete" className="text-[16px]" />
          </button>
        </div>
      </td>
    </tr>
  );
}
