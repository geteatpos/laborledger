import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { ClientInvoiceDeliveryStatus, ClientInvoiceStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";

import type { AuthenticatedPrincipal } from "../identity-access/auth.types";
import { CompanyScopeService } from "../identity-access/company-scope.service";
import { PrismaService } from "../identity-access/prisma.service";
import { EmailService } from "../email/email.service";
import { ClientInvoicePdfService } from "../client-invoice-pdf/client-invoice-pdf.service";
import {
  buildClientInvoiceEmailBodies,
  buildClientInvoiceEmailSubject
} from "./client-invoice-email-content";
import {
  resolveCompanyDisplayName,
  type CompanyProfileSource
} from "../company-operations/company-profile-display";

type SendClientInvoiceEmailInput = {
  recipientEmail: string;
  message?: string;
};

type InvoiceDeliveryProfile = CompanyProfileSource & {
  taxId: string | null;
  paymentInstructions: string | null;
};

@Injectable()
export class ClientInvoiceDeliveryService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CompanyScopeService) private readonly companyScopeService: CompanyScopeService,
    @Inject(EmailService) private readonly emailService: EmailService,
    @Inject(ClientInvoicePdfService) private readonly clientInvoicePdfService: ClientInvoicePdfService
  ) {}

  async listDeliveries(principal: AuthenticatedPrincipal, clientInvoiceId: string) {
    const invoice = await this.requireIssuedOrAnyInvoiceAccess(principal, clientInvoiceId);

    const deliveries = await this.prisma.clientInvoiceDelivery.findMany({
      where: { clientInvoiceId: invoice.id },
      orderBy: [{ attemptedAt: "desc" }],
      include: {
        sentByUser: { select: { id: true, fullName: true, email: true } }
      }
    });

    return deliveries.map((delivery) => this.mapDelivery(delivery));
  }

  async sendClientInvoiceByEmail(
    principal: AuthenticatedPrincipal,
    clientInvoiceId: string,
    input: SendClientInvoiceEmailInput
  ) {
    const invoice = await this.requireIssuedOrAnyInvoiceAccess(principal, clientInvoiceId);
    await this.companyScopeService.requireManagementCompany(principal, invoice.companyId);

    if (invoice.status !== ClientInvoiceStatus.ISSUED) {
      if (invoice.status === ClientInvoiceStatus.DRAFT) {
        throw new BadRequestException("Issue invoice before sending by email.");
      }

      throw new BadRequestException("Voided invoices cannot be sent.");
    }

    const recipientEmail = input.recipientEmail?.trim().toLowerCase() ?? "";
    if (!this.isValidEmail(recipientEmail)) {
      throw new BadRequestException("A valid recipient email is required.");
    }

    const company = await this.prisma.company.findUnique({
      where: { id: invoice.companyId },
      select: {
        id: true,
        name: true,
        groupId: true,
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

    if (!invoice.invoiceNumber || !invoice.issuedAt) {
      throw new BadRequestException("Issued invoice is missing invoice number or issue date.");
    }

    const issuerProfile = this.snapshotInvoiceIssuer(invoice.issuerSnapshot) ?? {
      ...company,
      taxId: null,
      paymentInstructions: null
    };
    const billToName = this.snapshotBillToName(invoice.billToSnapshot) ?? invoice.serviceClient.name;
    const companyDisplayName = resolveCompanyDisplayName(issuerProfile);
    const optionalNote = input.message?.trim() || undefined;
    const subject = buildClientInvoiceEmailSubject({
      invoiceNumber: invoice.invoiceNumber,
      companyName: companyDisplayName
    });
    const { textBody, htmlBody } = buildClientInvoiceEmailBodies({
      companyName: companyDisplayName,
      serviceClientName: billToName,
      invoiceNumber: invoice.invoiceNumber,
      issuedAt: invoice.issuedAt,
      dueDate: invoice.dueDate,
      paymentTermsDays: invoice.paymentTermsDays,
      subtotalMinor: invoice.subtotalMinor,
      taxMinor: invoice.taxMinor,
      totalMinor: invoice.totalMinor,
      balanceMinor: invoice.balanceMinor,
      currencyCode: invoice.currencyCode,
      lines: invoice.lines,
      contactPhone: issuerProfile.phone,
      contactBillingEmail: issuerProfile.billingEmail,
      contactName: issuerProfile.primaryContactName,
      taxId: issuerProfile.taxId,
      paymentInstructions: issuerProfile.paymentInstructions ?? invoice.notes,
      ...(optionalNote ? { optionalNote } : {})
    });

    const { fromEmail, fromName } = this.emailService.resolveFromIdentity();
    const attemptedAt = new Date();

    let pdfResult;

    try {
      pdfResult = await this.clientInvoicePdfService.generateClientInvoicePdfForDelivery(
        invoice,
        company
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unable to generate invoice PDF attachment.";

      await this.recordInvoiceEmailAttempt({
        invoice,
        principal,
        recipientEmail,
        subject,
        ...(optionalNote ? { optionalNote } : {}),
        attemptedAt,
        provider: "pdf",
        providerMessageId: null,
        errorMessage,
        success: false
      });

      throw new BadRequestException(errorMessage);
    }

    const sendResult = await this.emailService.send({
      to: recipientEmail,
      fromEmail,
      fromName,
      subject,
      textBody,
      htmlBody,
      attachments: [
        {
          filename: pdfResult.filename,
          content: pdfResult.buffer,
          contentType: "application/pdf"
        }
      ]
    });

    const delivery = await this.recordInvoiceEmailAttempt({
      invoice,
      principal,
      recipientEmail,
      subject,
      ...(optionalNote ? { optionalNote } : {}),
      attemptedAt,
      provider: sendResult.provider,
      providerMessageId: sendResult.providerMessageId ?? null,
      errorMessage: sendResult.errorMessage ?? null,
      success: sendResult.success
    });

    if (!sendResult.success) {
      throw new BadRequestException(sendResult.errorMessage ?? "Unable to send invoice email.");
    }

    return this.mapDelivery(delivery);
  }

  private async recordInvoiceEmailAttempt(input: {
    invoice: {
      id: string;
      groupId: string;
      companyId: string;
    };
    principal: AuthenticatedPrincipal;
    recipientEmail: string;
    subject: string;
    optionalNote?: string;
    attemptedAt: Date;
    provider: string;
    providerMessageId: string | null;
    errorMessage: string | null;
    success: boolean;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.clientInvoiceDelivery.create({
        data: {
          groupId: input.invoice.groupId,
          companyId: input.invoice.companyId,
          clientInvoiceId: input.invoice.id,
          channel: "email",
          recipientEmail: input.recipientEmail,
          subject: input.subject,
          status: input.success ? ClientInvoiceDeliveryStatus.SENT : ClientInvoiceDeliveryStatus.FAILED,
          provider: input.provider,
          providerMessageId: input.providerMessageId,
          errorMessage: input.errorMessage,
          messageNote: input.optionalNote ?? null,
          sentAt: input.success ? input.attemptedAt : null,
          attemptedAt: input.attemptedAt,
          sentByUserId: input.principal.userId
        },
        include: {
          sentByUser: { select: { id: true, fullName: true, email: true } }
        }
      });

      await tx.auditEvent.create({
        data: {
          actorUserId: input.principal.userId,
          action: input.success ? "CLIENT_INVOICE_EMAIL_SENT" : "CLIENT_INVOICE_EMAIL_FAILED",
          targetType: "ClientInvoice",
          targetId: input.invoice.id,
          groupId: input.invoice.groupId,
          companyId: input.invoice.companyId,
          metadata: {
            deliveryId: created.id,
            recipientEmail: input.recipientEmail,
            provider: input.provider,
            status: created.status,
            ...(input.errorMessage ? { errorMessage: input.errorMessage } : {})
          }
        }
      });

      return created;
    });
  }

  private async requireIssuedOrAnyInvoiceAccess(
    principal: AuthenticatedPrincipal,
    clientInvoiceId: string
  ) {
    const invoice = await this.prisma.clientInvoice.findUnique({
      where: { id: clientInvoiceId },
      include: {
        serviceClient: { select: { id: true, name: true } },
        issuedByUser: { select: { fullName: true } },
        voidedByUser: { select: { fullName: true } },
        lines: { orderBy: { createdAt: "asc" } }
      }
    });

    if (!invoice) {
      throw new NotFoundException("Client invoice not found.");
    }

    await this.companyScopeService.requireManagementCompany(principal, invoice.companyId);
    return invoice;
  }

  private mapDelivery(
    delivery: {
      id: string;
      channel: string;
      recipientEmail: string;
      subject: string;
      status: ClientInvoiceDeliveryStatus;
      provider: string;
      providerMessageId: string | null;
      errorMessage: string | null;
      messageNote: string | null;
      sentAt: Date | null;
      attemptedAt: Date;
      createdAt: Date;
      sentByUser: { id: string; fullName: string | null; email: string } | null;
    }
  ) {
    return {
      id: delivery.id,
      channel: delivery.channel,
      recipientEmail: delivery.recipientEmail,
      subject: delivery.subject,
      status: delivery.status,
      provider: delivery.provider,
      providerMessageId: delivery.providerMessageId,
      errorMessage: delivery.errorMessage,
      messageNote: delivery.messageNote,
      sentAt: delivery.sentAt,
      attemptedAt: delivery.attemptedAt,
      createdAt: delivery.createdAt,
      sentByUser: delivery.sentByUser
    };
  }

  private isValidEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email);
  }

  private snapshotInvoiceIssuer(snapshot: Prisma.JsonValue | null): InvoiceDeliveryProfile | null {
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
      return null;
    }

    const value = snapshot as Record<string, unknown>;
    const name = this.optionalSnapshotString(value.name);
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
      country: this.optionalSnapshotString(value.country),
      taxId: this.optionalSnapshotString(value.taxId),
      paymentInstructions: this.optionalSnapshotString(value.paymentInstructions)
    };
  }

  private snapshotBillToName(snapshot: Prisma.JsonValue | null) {
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
      return null;
    }

    return this.optionalSnapshotString((snapshot as Record<string, unknown>).name);
  }

  private optionalSnapshotString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }
}
