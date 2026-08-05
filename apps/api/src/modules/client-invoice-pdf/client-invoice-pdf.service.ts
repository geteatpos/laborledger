import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ClientInvoiceStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import PDFDocument from "pdfkit";

import type { AuthenticatedPrincipal } from "../identity-access/auth.types";
import { CompanyScopeService } from "../identity-access/company-scope.service";
import { PrismaService } from "../identity-access/prisma.service";
import { sanitizeInvoicePdfFilename } from "./client-invoice-pdf-filename";
import {
  CLIENT_INVOICE_PDF_DISCLAIMER,
  formatPdfDate,
  formatPdfInvoiceNumberLabel,
  formatPdfMoney,
  formatPdfStatusLabel,
  formatPdfVehicleDetailLines,
  pickPdfInvoiceVehicle
} from "./client-invoice-pdf-format";
import {
  formatCompanyAddressLines,
  formatCompanyContactLines,
  type CompanyProfileSource
} from "../company-operations/company-profile-display";

export type ClientInvoicePdfResult = {
  buffer: Buffer;
  filename: string;
};

type InvoicePdfSource = {
  id: string;
  invoiceNumber: string | null;
  status: ClientInvoiceStatus;
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  currencyCode: string;
  notes: string | null;
  issuerSnapshot: Prisma.JsonValue | null;
  billToSnapshot: Prisma.JsonValue | null;
  dueDate: Date | null;
  paymentTermsDays: number | null;
  amountPaidMinor: number;
  balanceMinor: number;
  createdAt: Date;
  issuedAt: Date | null;
  voidedAt: Date | null;
  voidReason: string | null;
  serviceClient: { name: string };
  issuedByUser: { fullName: string | null } | null;
  voidedByUser: { fullName: string | null } | null;
  lines: Array<{
    serviceNameSnapshot: string;
    workOrderNumberSnapshot: string | null;
    vinSnapshot: string | null;
    makeSnapshot?: string | null;
    plateSnapshot?: string | null;
    colorSnapshot?: string | null;
    description?: string | null;
    vehicleLabelSnapshot: string | null;
    quantity: number;
    unitPriceMinor: number;
    lineTotalMinor: number;
    currencyCode: string;
  }>;
};

@Injectable()
export class ClientInvoicePdfService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CompanyScopeService) private readonly companyScopeService: CompanyScopeService
  ) {}

  async generateClientInvoicePdf(
    principal: AuthenticatedPrincipal,
    clientInvoiceId: string
  ): Promise<ClientInvoicePdfResult> {
    const { invoice, companyProfile } = await this.loadInvoiceForPdf(principal, clientInvoiceId);
    return this.renderInvoicePdf(invoice, companyProfile);
  }

  async generateClientInvoicePdfForDelivery(
    invoice: InvoicePdfSource & { companyId: string },
    companyProfile: CompanyProfileSource
  ): Promise<ClientInvoicePdfResult> {
    return this.renderInvoicePdf(
      {
        ...invoice,
        lines: invoice.lines.map((line) => this.enrichInvoicePdfLine(line))
      },
      companyProfile
    );
  }

  private async loadInvoiceForPdf(principal: AuthenticatedPrincipal, clientInvoiceId: string) {
    const invoice = await this.prisma.clientInvoice.findUnique({
      where: { id: clientInvoiceId },
      include: {
        serviceClient: { select: { name: true } },
        issuedByUser: { select: { fullName: true } },
        voidedByUser: { select: { fullName: true } },
        lines: {
          orderBy: { createdAt: "asc" },
          include: {
            vehicle: {
              select: {
                vin: true,
                plate: true,
                color: true,
                year: true,
                make: true,
                model: true
              }
            }
          }
        }
      }
    });

    if (!invoice) {
      throw new NotFoundException("Client invoice not found.");
    }

    await this.companyScopeService.requireManagementCompany(principal, invoice.companyId);

    const company = await this.prisma.company.findUnique({
      where: { id: invoice.companyId },
      select: {
        name: true,
        legalName: true,
        phone: true,
        billingEmail: true,
        primaryContactName: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        stateRegion: true,
        postalCode: true,
        country: true
      }
    });

    if (!company) {
      throw new NotFoundException("Company not found.");
    }

    return {
      invoice: {
        ...invoice,
        lines: invoice.lines.map((line) => this.enrichInvoicePdfLine(line))
      },
      companyProfile: this.snapshotCompanyProfile(invoice.issuerSnapshot) ?? company
    };
  }

  private enrichInvoicePdfLine(line: {
    serviceNameSnapshot: string;
    workOrderNumberSnapshot: string | null;
    vinSnapshot: string | null;
    makeSnapshot?: string | null;
    plateSnapshot?: string | null;
    colorSnapshot?: string | null;
    description?: string | null;
    vehicleLabelSnapshot: string | null;
    quantity: number;
    unitPriceMinor: number;
    lineTotalMinor: number;
    currencyCode: string;
    vehicle?: {
      vin: string;
      plate: string | null;
      color: string | null;
      year: number | null;
      make: string | null;
      model: string | null;
    } | null;
  }): InvoicePdfSource["lines"][number] {
    const vehicle = line.vehicle;
    const labelFromVehicle = vehicle
      ? [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ").trim() || null
      : null;

    return {
      serviceNameSnapshot: line.serviceNameSnapshot,
      workOrderNumberSnapshot: line.workOrderNumberSnapshot,
      vinSnapshot: line.vinSnapshot?.trim() || vehicle?.vin || null,
      makeSnapshot: line.makeSnapshot?.trim() || vehicle?.make?.trim() || null,
      plateSnapshot: line.plateSnapshot?.trim() || vehicle?.plate?.trim() || null,
      colorSnapshot: line.colorSnapshot?.trim() || vehicle?.color?.trim() || null,
      description: line.description ?? null,
      vehicleLabelSnapshot: line.vehicleLabelSnapshot?.trim() || labelFromVehicle,
      quantity: line.quantity,
      unitPriceMinor: line.unitPriceMinor,
      lineTotalMinor: line.lineTotalMinor,
      currencyCode: line.currencyCode
    };
  }

  private async renderInvoicePdf(
    invoice: InvoicePdfSource,
    companyProfile: CompanyProfileSource
  ): Promise<ClientInvoicePdfResult> {
    const renderCompanyProfile = this.snapshotCompanyProfile(invoice.issuerSnapshot) ?? companyProfile;
    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: "LETTER" });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      this.drawStatusWatermark(doc, invoice.status);

      const COLORS = {
        primary: "#2563EB",
        primarySoft: "#EFF6FF",
        slate900: "#0F172A",
        slate700: "#334155",
        slate500: "#64748B",
        slate300: "#CBD5E1",
        slate200: "#E2E8F0",
        slate100: "#F1F5F9",
        slate50: "#F8FAFC",
        white: "#FFFFFF",
        success: "#15803D",
        successSoft: "#F0FDF4",
        error: "#B91C1C",
        errorSoft: "#FEF2F2"
      };

      const left = 50;
      const pageWidth = 512;
      const colGap = 24;
      const colWidth = (pageWidth - colGap) / 2;
      const rightColX = left + colWidth + colGap;

      const drawDivider = (atY: number, color = COLORS.slate200) => {
        doc.strokeColor(color).lineWidth(0.5).moveTo(left, atY).lineTo(left + pageWidth, atY).stroke();
      };

      const drawLabeledBlock = (
        title: string,
        name: string,
        detailLines: string[],
        x: number,
        startY: number,
        width: number
      ) => {
        let cursor = startY;
        doc
          .fontSize(8)
          .fillColor(COLORS.primary)
          .text(title, x, cursor, { width, lineBreak: false, characterSpacing: 0.6 });
        cursor += 14;
        doc.fontSize(11).fillColor(COLORS.slate900).text(name, x, cursor, { width });
        cursor = doc.y + 4;
        for (const detail of detailLines) {
          doc.fontSize(9).fillColor(COLORS.slate500).text(detail, x, cursor, { width });
          cursor = doc.y + 2;
        }
        return cursor;
      };

      const measureLabeledBlockHeight = (title: string, name: string, detailLines: string[], width: number) => {
        let height = 14 + doc.fontSize(11).heightOfString(name, { width }) + 4;
        for (const detail of detailLines) {
          height += doc.fontSize(9).heightOfString(detail, { width }) + 2;
        }
        return height;
      };

      doc.fillColor(COLORS.primary).rect(0, 0, 612, 8).fill();

      let y = 32;
      doc
        .fontSize(8)
        .fillColor(COLORS.slate500)
        .text("INVOICE", left, y, { width: 200, lineBreak: false, characterSpacing: 1.2 });
      y += 14;

      const invoiceLabel = formatPdfInvoiceNumberLabel(invoice.invoiceNumber, invoice.id);
      doc.fontSize(24).fillColor(COLORS.slate900).text(invoiceLabel, left, y, { width: 360, lineBreak: false });

      const statusPalette =
        invoice.status === "ISSUED"
          ? { fg: COLORS.success, bg: COLORS.successSoft }
          : invoice.status === "VOID"
            ? { fg: COLORS.error, bg: COLORS.errorSoft }
            : { fg: COLORS.slate500, bg: COLORS.slate100 };
      const statusText = formatPdfStatusLabel(invoice.status).toUpperCase();
      const statusPillWidth = doc.fontSize(9).widthOfString(statusText, { characterSpacing: 0.4 }) + 20;
      const statusPillX = left + pageWidth - statusPillWidth;
      doc.fillColor(statusPalette.bg).roundedRect(statusPillX, y + 4, statusPillWidth, 20, 10).fill();
      doc
        .fontSize(9)
        .fillColor(statusPalette.fg)
        .text(statusText, statusPillX, y + 10, {
          width: statusPillWidth,
          align: "center",
          lineBreak: false,
          characterSpacing: 0.4
        });

      y += 44;

      const issuerLines = [
        ...formatCompanyAddressLines(renderCompanyProfile),
        ...formatCompanyContactLines(renderCompanyProfile),
        `Tax ID: ${this.snapshotString(invoice.issuerSnapshot, "taxId") ?? "Not provided"}`
      ];
      const billToProfile = this.snapshotBillToProfile(invoice.billToSnapshot);
      const billToName = billToProfile?.name ?? invoice.serviceClient.name;
      const billToLines = billToProfile
        ? [
            ...formatCompanyAddressLines(billToProfile),
            ...formatCompanyContactLines(billToProfile),
            `Tax ID: ${this.snapshotString(invoice.billToSnapshot, "taxId") ?? "Not provided"}`
          ]
        : [`Tax ID: ${this.snapshotString(invoice.billToSnapshot, "taxId") ?? "Not provided"}`];

      const cardPadding = 14;
      const cardInnerWidth = colWidth - cardPadding * 2;
      const fromName = renderCompanyProfile.legalName?.trim() || renderCompanyProfile.name;
      const cardHeight =
        Math.max(
          measureLabeledBlockHeight("FROM", fromName, issuerLines, cardInnerWidth),
          measureLabeledBlockHeight("BILL TO", billToName, billToLines, cardInnerWidth)
        ) +
        cardPadding * 2;

      const partyTop = y;
      doc.fillColor(COLORS.slate50).roundedRect(left, partyTop, colWidth, cardHeight, 6).fill();
      doc.fillColor(COLORS.slate50).roundedRect(rightColX, partyTop, colWidth, cardHeight, 6).fill();

      drawLabeledBlock("FROM", fromName, issuerLines, left + cardPadding, partyTop + cardPadding, cardInnerWidth);
      drawLabeledBlock(
        "BILL TO",
        billToName,
        billToLines,
        rightColX + cardPadding,
        partyTop + cardPadding,
        cardInnerWidth
      );
      y = partyTop + cardHeight + 18;

      const metaItems: Array<{ label: string; value: string; accent?: string }> = [
        { label: "DATE", value: formatPdfDate(invoice.createdAt) },
        { label: "ISSUED", value: invoice.issuedAt ? formatPdfDate(invoice.issuedAt) : "Pending" },
        { label: "DUE", value: invoice.dueDate ? formatPdfDate(invoice.dueDate) : "Not set" },
        { label: "TERMS", value: this.formatPaymentTerms(invoice.paymentTermsDays) }
      ];
      if (invoice.voidedAt) {
        metaItems.push({
          label: "VOIDED",
          value: formatPdfDate(invoice.voidedAt),
          accent: COLORS.error
        });
      }

      const metaCardHeight = 46;
      doc.fillColor(COLORS.slate50).roundedRect(left, y, pageWidth, metaCardHeight, 6).fill();

      const metaWidth = pageWidth / metaItems.length;
      metaItems.forEach((item, index) => {
        const x = left + metaWidth * index + cardPadding;
        if (index > 0) {
          doc
            .strokeColor(COLORS.slate200)
            .lineWidth(0.5)
            .moveTo(left + metaWidth * index, y + 10)
            .lineTo(left + metaWidth * index, y + metaCardHeight - 10)
            .stroke();
        }
        doc
          .fontSize(8)
          .fillColor(COLORS.slate500)
          .text(item.label, x, y + 12, { width: metaWidth - cardPadding - 8, lineBreak: false, characterSpacing: 0.4 });
        doc
          .fontSize(10)
          .fillColor(item.accent ?? COLORS.slate900)
          .text(item.value, x, y + 24, { width: metaWidth - cardPadding - 8, lineBreak: false });
      });
      y += metaCardHeight + 18;

      if (invoice.voidReason?.trim()) {
        doc.fontSize(9).fillColor(COLORS.error).text(`Void reason: ${invoice.voidReason.trim()}`, left, y, {
          width: pageWidth
        });
        y = doc.y + 12;
      }

      drawDivider(y, COLORS.slate300);
      y += 10;

      const invoiceVehicle = pickPdfInvoiceVehicle(invoice.lines);
      if (invoiceVehicle) {
        const vehicleDetails = formatPdfVehicleDetailLines(invoiceVehicle);
        const woLabel = invoiceVehicle.workOrderNumberSnapshot?.trim();
        doc
          .fontSize(8)
          .fillColor(COLORS.primary)
          .text("VEHICLE", left, y, { width: pageWidth, lineBreak: false, characterSpacing: 0.6 });
        y += 14;
        if (woLabel) {
          doc.fontSize(9).fillColor(COLORS.slate500).text(`Work order: ${woLabel}`, left, y, {
            width: pageWidth,
            lineBreak: false
          });
          y += 12;
        }
        doc.fontSize(10).fillColor(COLORS.slate900).text(vehicleDetails.join("  ·  "), left, y, { width: pageWidth });
        y = doc.y + 10;
        drawDivider(y, COLORS.slate300);
        y += 10;
      }

      const colDescriptionX = left;
      const colQtyX = left + 300;
      const colUnitX = left + 350;
      const colAmountX = left + 445;
      const descriptionWidth = 240;

      doc.fillColor(COLORS.slate100).rect(left, y - 6, pageWidth, 22).fill();
      doc.fontSize(8).fillColor(COLORS.slate500);
      doc.text("DESCRIPTION", colDescriptionX + 8, y, { width: descriptionWidth - 8, lineBreak: false });
      doc.text("QTY", colQtyX, y, { width: 40, lineBreak: false });
      doc.text("UNIT PRICE", colUnitX, y, { width: 85, align: "right", lineBreak: false });
      doc.text("AMOUNT", colAmountX, y, { width: 65 - 8, align: "right", lineBreak: false });
      y += 16;
      drawDivider(y, COLORS.slate300);
      y += 10;

      invoice.lines.forEach((line, rowIndex) => {
        const descriptionText = line.serviceNameSnapshot;
        const secondaryNote = line.description?.trim() || null;

        doc.fontSize(10);
        let descriptionHeight = doc.heightOfString(descriptionText, { width: descriptionWidth - 8 });
        if (secondaryNote) {
          descriptionHeight += 2 + doc.heightOfString(secondaryNote, { width: descriptionWidth - 8 });
        }
        const rowHeight = Math.max(descriptionHeight, 14) + 14;

        if (y + rowHeight > 720) {
          doc.addPage();
          this.drawStatusWatermark(doc, invoice.status);
          y = 50;
        }

        const rowTop = y;
        if (rowIndex % 2 === 1) {
          doc.fillColor(COLORS.slate50).rect(left, rowTop - 6, pageWidth, rowHeight).fill();
        }
        doc.fontSize(10).fillColor(COLORS.slate900).text(descriptionText, colDescriptionX + 8, rowTop, {
          width: descriptionWidth - 8
        });
        if (secondaryNote) {
          const noteY = rowTop + doc.heightOfString(descriptionText, { width: descriptionWidth - 8 }) + 1;
          doc.fontSize(8).fillColor(COLORS.slate500).text(secondaryNote, colDescriptionX + 8, noteY, {
            width: descriptionWidth - 8
          });
        }
        doc.fontSize(10).fillColor(COLORS.slate900).text(String(line.quantity), colQtyX, rowTop, {
          width: 40,
          lineBreak: false
        });
        doc
          .fontSize(10)
          .fillColor(COLORS.slate900)
          .text(formatPdfMoney(line.unitPriceMinor, line.currencyCode), colUnitX, rowTop, {
            width: 85,
            align: "right",
            lineBreak: false
          });
        doc
          .fontSize(10)
          .fillColor(COLORS.slate900)
          .text(formatPdfMoney(line.lineTotalMinor, line.currencyCode), colAmountX, rowTop, {
            width: 65,
            align: "right",
            lineBreak: false
          });

        y = rowTop + rowHeight;
        drawDivider(y - 6, COLORS.slate100);
      });

      y += 12;
      if (y > 640) {
        doc.addPage();
        this.drawStatusWatermark(doc, invoice.status);
        y = 50;
      }

      const totalsX = left + 320;
      const totalsW = 192;
      doc.fillColor(COLORS.slate50).roundedRect(totalsX - 8, y - 6, totalsW + 8, 108, 6).fill();

      doc.fontSize(9).fillColor(COLORS.slate500).text("Subtotal", totalsX, y, { width: 90, lineBreak: false });
      doc
        .fillColor(COLORS.slate700)
        .text(formatPdfMoney(invoice.subtotalMinor, invoice.currencyCode), totalsX + 90, y, {
          width: 90,
          align: "right",
          lineBreak: false
        });

      doc.fontSize(9).fillColor(COLORS.slate500).text("Tax", totalsX, y + 18, { width: 90, lineBreak: false });
      doc
        .fillColor(COLORS.slate700)
        .text(formatPdfMoney(invoice.taxMinor, invoice.currencyCode), totalsX + 90, y + 18, {
          width: 90,
          align: "right",
          lineBreak: false
        });

      drawDivider(y + 34, COLORS.slate300);

      doc.fontSize(12).fillColor(COLORS.primary).text("Total", totalsX, y + 42, { width: 90, lineBreak: false });
      doc
        .fontSize(14)
        .fillColor(COLORS.primary)
        .text(formatPdfMoney(invoice.totalMinor, invoice.currencyCode), totalsX + 90, y + 40, {
          width: 90,
          align: "right",
          lineBreak: false
        });

      doc.fontSize(9).fillColor(COLORS.slate500).text("Paid", totalsX, y + 66, { width: 90, lineBreak: false });
      doc
        .fillColor(COLORS.slate700)
        .text(formatPdfMoney(invoice.amountPaidMinor, invoice.currencyCode), totalsX + 90, y + 66, {
          width: 90,
          align: "right",
          lineBreak: false
        });

      doc.fontSize(10).fillColor(COLORS.slate900).text("Balance", totalsX, y + 84, { width: 90, lineBreak: false });
      doc
        .fontSize(12)
        .fillColor(COLORS.slate900)
        .text(formatPdfMoney(invoice.balanceMinor, invoice.currencyCode), totalsX + 90, y + 82, {
          width: 90,
          align: "right",
          lineBreak: false
        });

      y += 120;

      const paymentInstructions = this.snapshotString(invoice.issuerSnapshot, "paymentInstructions");
      doc.fontSize(8).fillColor(COLORS.slate500).text("PAYMENT INSTRUCTIONS", left, y, {
        width: pageWidth,
        lineBreak: false
      });
      y += 12;
      doc
        .fontSize(10)
        .fillColor(COLORS.slate700)
        .text(paymentInstructions || "No payment instructions provided.", left, y, {
          width: pageWidth
        });
      y = doc.y + 16;

      doc.fontSize(8).fillColor(COLORS.slate500).text("NOTES", left, y, { width: pageWidth, lineBreak: false });
      y += 12;
      doc
        .fontSize(10)
        .fillColor(COLORS.slate700)
        .text(invoice.notes?.trim() || "No notes provided.", left, y, { width: pageWidth });
      y = doc.y + 20;

      if (y > 740) {
        doc.addPage();
        this.drawStatusWatermark(doc, invoice.status);
        y = 50;
      }

      drawDivider(y, COLORS.slate200);
      y += 10;
      doc.fontSize(8).fillColor(COLORS.slate500).text(CLIENT_INVOICE_PDF_DISCLAIMER, left, y, {
        width: pageWidth - 80
      });
      doc.fontSize(8).fillColor(COLORS.primary).text("LaborLedger", left + pageWidth - 70, y, {
        width: 70,
        align: "right",
        lineBreak: false
      });

      doc.end();
    });

    return {
      buffer,
      filename: sanitizeInvoicePdfFilename(invoice.invoiceNumber, invoice.id)
    };
  }

  private drawStatusWatermark(doc: InstanceType<typeof PDFDocument>, status: ClientInvoiceStatus) {
    if (status !== ClientInvoiceStatus.DRAFT && status !== ClientInvoiceStatus.VOID) {
      return;
    }

    const label = status === ClientInvoiceStatus.DRAFT ? "DRAFT" : "VOID";

    doc.save();
    doc.rotate(-35, { origin: [306, 396] });
    doc.fontSize(72).fillColor("#e2e8f0").text(label, 120, 320, {
      width: 400,
      align: "center"
    });
    doc.restore();
    doc.fillColor("#0f172a");
  }

  private snapshotCompanyProfile(snapshot: Prisma.JsonValue | null): CompanyProfileSource | null {
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
      return null;
    }

    const value = snapshot as Record<string, unknown>;
    const name = typeof value.name === "string" && value.name.trim() ? value.name : null;
    if (!name) {
      return null;
    }

    return {
      name,
      legalName: this.optionalSnapshotString(value.legalName),
      phone: this.optionalSnapshotString(value.phone),
      billingEmail: this.optionalSnapshotString(value.billingEmail),
      primaryContactName: this.optionalSnapshotString(value.primaryContactName),
      addressLine1: this.optionalSnapshotString(value.addressLine1),
      addressLine2: this.optionalSnapshotString(value.addressLine2),
      city: this.optionalSnapshotString(value.city),
      stateRegion: this.optionalSnapshotString(value.stateRegion),
      postalCode: this.optionalSnapshotString(value.postalCode),
      country: this.optionalSnapshotString(value.country)
    };
  }

  private snapshotBillToProfile(snapshot: Prisma.JsonValue | null): CompanyProfileSource | null {
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
      return null;
    }

    const value = snapshot as Record<string, unknown>;
    const name =
      this.optionalSnapshotString(value.name) ??
      this.optionalSnapshotString(value.legalName);
    if (!name) {
      return null;
    }

    return {
      name,
      legalName: this.optionalSnapshotString(value.legalName),
      phone: this.optionalSnapshotString(value.phone),
      billingEmail: this.optionalSnapshotString(value.billingEmail),
      primaryContactName:
        this.optionalSnapshotString(value.primaryContactName) ??
        this.optionalSnapshotString(value.billingContactName),
      addressLine1: this.optionalSnapshotString(value.addressLine1),
      addressLine2: this.optionalSnapshotString(value.addressLine2),
      city: this.optionalSnapshotString(value.city),
      stateRegion: this.optionalSnapshotString(value.stateRegion),
      postalCode: this.optionalSnapshotString(value.postalCode),
      country: this.optionalSnapshotString(value.country)
    };
  }

  private optionalSnapshotString(value: unknown) {
    return typeof value === "string" && value.trim() ? value : null;
  }

  private snapshotString(snapshot: Prisma.JsonValue | null, key: string) {
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
      return null;
    }

    return this.optionalSnapshotString((snapshot as Record<string, unknown>)[key]);
  }

  private formatPaymentTerms(paymentTermsDays: number | null) {
    return typeof paymentTermsDays === "number" ? `Net ${paymentTermsDays}` : "Not set";
  }
}
