import { ClientInvoiceStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { sanitizeInvoicePdfFilename } from "../src/modules/client-invoice-pdf/client-invoice-pdf-filename";
import {
  CLIENT_INVOICE_PDF_DISCLAIMER,
  formatPdfInvoiceNumberLabel,
  formatPdfLineSummary,
  formatPdfMoney,
  formatPdfStatusLabel,
  formatPdfVehicleDetailLines
} from "../src/modules/client-invoice-pdf/client-invoice-pdf-format";
import { summarizeEmailAttachments } from "../src/modules/email/email-attachment-utils";

describe("PDF02 invoice PDF utilities", () => {
  it("sanitizes invoice PDF filenames", () => {
    expect(sanitizeInvoicePdfFilename("INV-20260622-0001", "clinv_123")).toBe(
      "invoice-INV-20260622-0001.pdf"
    );
    expect(sanitizeInvoicePdfFilename("INV/2026 0001", "clinv_123")).toBe("invoice-INV-2026-0001.pdf");
    expect(sanitizeInvoicePdfFilename(null, "clinv_abcdefghij")).toBe("invoice-draft-clinv_ab.pdf");
  });

  it("formats invoice labels and money for PDF output", () => {
    expect(formatPdfMoney(9900, "USD")).toBe("$99.00");
    expect(formatPdfStatusLabel(ClientInvoiceStatus.DRAFT)).toBe("Draft");
    expect(formatPdfStatusLabel(ClientInvoiceStatus.VOID)).toBe("Void");
    expect(formatPdfInvoiceNumberLabel(null, "clinv_abcdefghij")).toBe("Draft clinv_ab");
    expect(CLIENT_INVOICE_PDF_DISCLAIMER).toContain("does not process payments");
  });

  it("formats vehicle detail lines with label color VIN and plate", () => {
    expect(
      formatPdfVehicleDetailLines({
        makeSnapshot: "Nissan",
        vinSnapshot: "ML32AUHJ4RH020893",
        plateSnapshot: "ABC-123",
        colorSnapshot: "Black",
        vehicleLabelSnapshot: "2024 Nissan Versa"
      })
    ).toEqual([
      "2024 Nissan Versa",
      "Color: Black",
      "VIN: ML32AUHJ4RH020893",
      "Plate: ABC-123"
    ]);

    expect(
      formatPdfLineSummary({
        workOrderNumberSnapshot: "WO-1",
        vinSnapshot: "VIN123",
        vehicleLabelSnapshot: "2020 Honda Civic"
      })
    ).toBe("WO-1 · 2020 Honda Civic");
  });

  it("summarizes email attachments without content payloads", () => {
    const summary = summarizeEmailAttachments([
      {
        filename: "invoice-INV-1.pdf",
        contentType: "application/pdf",
        content: Buffer.from("%PDF-1.4 test")
      }
    ]);

    expect(summary).toEqual([
      {
        filename: "invoice-INV-1.pdf",
        contentType: "application/pdf",
        size: Buffer.from("%PDF-1.4 test").length
      }
    ]);
  });
});
