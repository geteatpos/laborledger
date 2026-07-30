"use client";

import { useState } from "react";
import type { FormEvent } from "react";

import {
  LINE_ITEM_TYPE_OPTIONS,
  type LineItemType
} from "../lib/client-invoice-utils";
import { MaterialIcon } from "./ui/material-icon";
import type { DraftLineItem } from "./client-invoice-line-item-row";

type AddLineItemFormProps = {
  readonly currencyCode: string;
  readonly onAdd: (line: DraftLineItem) => void;
  readonly disabled?: boolean;
};

export function AddLineItemForm({ currencyCode, onAdd, disabled = false }: AddLineItemFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<LineItemType>("SERVICE");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState("");
  const [taxable, setTaxable] = useState(true);
  const [taxRate, setTaxRate] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function resetAndClose() {
    setIsOpen(false);
    setType("SERVICE");
    setDescription("");
    setQuantity(1);
    setUnitPrice("");
    setTaxable(true);
    setTaxRate(0);
    setErrorMessage(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (!description.trim()) {
      setErrorMessage("La descripción es obligatoria.");
      return;
    }

    const unitPriceMinor = Math.round(Number(unitPrice) * 100);
    if (isNaN(unitPriceMinor) || unitPriceMinor < 0) {
      setErrorMessage("El precio unitario debe ser válido.");
      return;
    }

    if (quantity <= 0) {
      setErrorMessage("La cantidad debe ser mayor a 0.");
      return;
    }

    onAdd({
      type,
      description: description.trim(),
      quantity,
      unitPriceMinor,
      taxable,
      taxRate
    });

    resetAndClose();
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        disabled={disabled}
        className="stitch-btn-secondary w-full justify-center py-2.5 text-xs disabled:opacity-50"
      >
        <MaterialIcon name="add" className="text-[16px]" />
        Agregar concepto
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-secondary/40 bg-secondary-container/10 p-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-on-surface">Nuevo concepto</p>
          <button
            type="button"
            onClick={resetAndClose}
            disabled={disabled}
            className="rounded-lg p-1 text-on-surface-variant hover:bg-surface-container-low disabled:opacity-50"
          >
            <MaterialIcon name="close" className="text-[16px]" />
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="stitch-label mb-1 block" htmlFor="line-type">
              Tipo
            </label>
            <select
              id="line-type"
              value={type}
              onChange={(e) => setType(e.target.value as LineItemType)}
              className="stitch-select text-sm"
              disabled={disabled}
            >
              {LINE_ITEM_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="stitch-label mb-1 block" htmlFor="line-description">
              Descripción
            </label>
            <input
              id="line-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="stitch-input text-sm"
              placeholder="Descripción del concepto"
              disabled={disabled}
            />
          </div>

          <div>
            <label className="stitch-label mb-1 block" htmlFor="line-quantity">
              Cantidad
            </label>
            <input
              id="line-quantity"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              min="0.01"
              step="0.01"
              className="stitch-input text-sm"
              disabled={disabled}
            />
          </div>

          <div>
            <label className="stitch-label mb-1 block" htmlFor="line-unit-price">
              Precio unitario ({currencyCode})
            </label>
            <input
              id="line-unit-price"
              type="number"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              min="0"
              step="0.01"
              className="stitch-input text-sm"
              placeholder="0.00"
              disabled={disabled}
            />
          </div>

          <div className="flex items-end gap-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={taxable}
                onChange={(e) => {
                  setTaxable(e.target.checked);
                  if (!e.target.checked) setTaxRate(0);
                }}
                className="accent-secondary"
                disabled={disabled}
              />
              <span className="text-sm text-on-surface">Gravado</span>
            </label>

            {taxable && (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={taxRate}
                  onChange={(e) => setTaxRate(Number(e.target.value))}
                  min="0"
                  max="100"
                  step="0.1"
                  className="stitch-input w-20 text-sm"
                  disabled={disabled}
                />
                <span className="text-sm text-on-surface-variant">%</span>
              </div>
            )}
          </div>
        </div>

        {errorMessage ? (
          <p className="text-sm text-error">{errorMessage}</p>
        ) : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={resetAndClose}
            disabled={disabled}
            className="stitch-btn-secondary px-3 py-1.5 text-xs"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={disabled}
            className="stitch-btn-primary px-3 py-1.5 text-xs"
          >
            Agregar
          </button>
        </div>
      </form>
    </div>
  );
}
