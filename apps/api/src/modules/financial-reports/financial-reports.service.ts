import { Inject, Injectable } from "@nestjs/common";
import { ClientInvoiceStatus, PaymentStatus } from "@prisma/client";

import type { AuthenticatedPrincipal } from "../identity-access/auth.types";
import { CompanyScopeService } from "../identity-access/company-scope.service";
import { PrismaService } from "../identity-access/prisma.service";
import {
  accumulateDebtor,
  invoiceBalanceMinor,
  isInvoiceDueSoon,
  isInvoiceOverdue,
  percentageChange,
  pickPrimaryCurrencyTotal,
  rankTopDebtors,
  sumByCurrency,
  type DebtorAccumulator
} from "./financial-reports.calculations";
import {
  buildPeriodKeys,
  periodKeyForInstant,
  previousPeriodRange,
  resolveFinancialReportDateRange,
  resolveTrendInterval,
  type FinancialReportDateRange
} from "./financial-reports-date-range";
import type {
  CompanyFinancialSummaryResponse,
  CompanyFinancialTrendsResponse,
  CompanyRecentPaymentsResponse,
  CompanyTopDebtorsResponse
} from "./financial-reports.types";

@Injectable()
export class FinancialReportsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CompanyScopeService) private readonly companyScopeService: CompanyScopeService
  ) {}

  async getFinancialSummary(
    principal: AuthenticatedPrincipal,
    companyId: string,
    query: { from?: string; to?: string; timezone?: string; preset?: string; comparison?: string }
  ): Promise<CompanyFinancialSummaryResponse> {
    const company = await this.companyScopeService.requireManagementCompany(principal, companyId);
    const range = resolveFinancialReportDateRange(query);
    const includeComparison = query.comparison !== "false";
    const previous = includeComparison ? previousPeriodRange(range) : null;
    const now = new Date();

    const [salesCurrent, salesPrevious, collectedCurrent, collectedPrevious, outstandingInvoices] =
      await Promise.all([
        this.loadSalesRows(companyId, range),
        previous ? this.loadSalesRows(companyId, previous) : Promise.resolve([]),
        this.loadCollectedRows(companyId, range),
        previous ? this.loadCollectedRows(companyId, previous) : Promise.resolve([]),
        this.prisma.clientInvoice.findMany({
          where: {
            companyId,
            status: ClientInvoiceStatus.ISSUED,
            balanceMinor: { gt: 0 }
          },
          select: {
            id: true,
            totalMinor: true,
            balanceMinor: true,
            dueDate: true,
            currencyCode: true,
            serviceClientId: true
          }
        })
      ]);

    const salesTotals = sumByCurrency(
      salesCurrent.map((row) => ({ currencyCode: row.currencyCode, amountMinor: row.totalMinor }))
    );
    const collectedTotals = sumByCurrency(
      collectedCurrent.map((row) => ({ currencyCode: row.currencyCode, amountMinor: row.amountMinor }))
    );
    const outstandingTotals = sumByCurrency(
      outstandingInvoices.map((row) => ({
        currencyCode: row.currencyCode,
        amountMinor: invoiceBalanceMinor(row)
      }))
    );

    const preferredCurrency = company.currencyCode || "USD";
    const salesPrimary = pickPrimaryCurrencyTotal(salesTotals, preferredCurrency);
    const collectedPrimary = pickPrimaryCurrencyTotal(collectedTotals, preferredCurrency);
    const outstandingPrimary = pickPrimaryCurrencyTotal(outstandingTotals, preferredCurrency);
    const currencyCode =
      salesPrimary.currencies[0] ??
      collectedPrimary.currencies[0] ??
      outstandingPrimary.currencies[0] ??
      preferredCurrency;

    const salesAmount = salesCurrent
      .filter((row) => row.currencyCode === currencyCode)
      .reduce((sum, row) => sum + row.totalMinor, 0);
    const salesPreviousAmount = salesPrevious
      .filter((row) => row.currencyCode === currencyCode)
      .reduce((sum, row) => sum + row.totalMinor, 0);
    const collectedAmount = collectedCurrent
      .filter((row) => row.currencyCode === currencyCode)
      .reduce((sum, row) => sum + row.amountMinor, 0);
    const collectedPreviousAmount = collectedPrevious
      .filter((row) => row.currencyCode === currencyCode)
      .reduce((sum, row) => sum + row.amountMinor, 0);

    const outstandingForCurrency = outstandingInvoices.filter((row) => row.currencyCode === currencyCode);
    const overdueInvoices = outstandingForCurrency.filter((row) => isInvoiceOverdue(row, now));
    const dueSoonInvoices = outstandingForCurrency.filter((row) => isInvoiceDueSoon(row, now));
    const overdueDebtorIds = new Set(overdueInvoices.map((row) => row.serviceClientId));

    const currencies = [
      ...new Set([
        ...salesPrimary.currencies,
        ...collectedPrimary.currencies,
        ...outstandingPrimary.currencies,
        preferredCurrency
      ])
    ].sort();

    return {
      companyId,
      currencyCode,
      period: {
        from: range.from,
        to: range.to,
        timezone: range.timezone
      },
      sales: {
        amountMinor: salesAmount,
        invoiceCount: salesCurrent.filter((row) => row.currencyCode === currencyCode).length,
        previousPeriodAmountMinor: salesPreviousAmount,
        percentageChange: includeComparison ? percentageChange(salesAmount, salesPreviousAmount) : null
      },
      collected: {
        amountMinor: collectedAmount,
        paymentCount: collectedCurrent.filter((row) => row.currencyCode === currencyCode).length,
        previousPeriodAmountMinor: collectedPreviousAmount,
        percentageChange: includeComparison
          ? percentageChange(collectedAmount, collectedPreviousAmount)
          : null
      },
      outstanding: {
        amountMinor: outstandingForCurrency.reduce((sum, row) => sum + invoiceBalanceMinor(row), 0),
        invoiceCount: outstandingForCurrency.length
      },
      overdue: {
        amountMinor: overdueInvoices.reduce((sum, row) => sum + invoiceBalanceMinor(row), 0),
        invoiceCount: overdueInvoices.length,
        debtorCount: overdueDebtorIds.size
      },
      dueSoon: {
        amountMinor: dueSoonInvoices.reduce((sum, row) => sum + invoiceBalanceMinor(row), 0),
        invoiceCount: dueSoonInvoices.length
      },
      currencies
    };
  }

  async getFinancialTrends(
    principal: AuthenticatedPrincipal,
    companyId: string,
    query: { from?: string; to?: string; timezone?: string; preset?: string; interval?: string }
  ): Promise<CompanyFinancialTrendsResponse> {
    const company = await this.companyScopeService.requireManagementCompany(principal, companyId);
    const range = resolveFinancialReportDateRange(query);
    const interval = resolveTrendInterval(range, query.interval);
    const periodKeys = buildPeriodKeys(range, interval);
    const currencyCode = company.currencyCode || "USD";

    const [salesRows, collectedRows] = await Promise.all([
      this.loadSalesRows(companyId, range),
      this.loadCollectedRows(companyId, range)
    ]);

    const seriesMap = new Map(periodKeys.map((key) => [key, { salesMinor: 0, collectedMinor: 0 }]));

    for (const row of salesRows) {
      if (row.currencyCode !== currencyCode || !row.issuedAt) {
        continue;
      }
      const key = periodKeyForInstant(row.issuedAt, range.timezone, interval, periodKeys);
      const bucket = seriesMap.get(key);
      if (bucket) {
        bucket.salesMinor += row.totalMinor;
      }
    }

    for (const row of collectedRows) {
      if (row.currencyCode !== currencyCode) {
        continue;
      }
      const key = periodKeyForInstant(row.receivedAt, range.timezone, interval, periodKeys);
      const bucket = seriesMap.get(key);
      if (bucket) {
        bucket.collectedMinor += row.amountMinor;
      }
    }

    return {
      companyId,
      currencyCode,
      period: {
        from: range.from,
        to: range.to,
        timezone: range.timezone
      },
      interval,
      series: periodKeys.map((period) => ({
        period,
        salesMinor: seriesMap.get(period)?.salesMinor ?? 0,
        collectedMinor: seriesMap.get(period)?.collectedMinor ?? 0
      }))
    };
  }

  async getTopDebtors(
    principal: AuthenticatedPrincipal,
    companyId: string,
    query: { limit?: string } = {}
  ): Promise<CompanyTopDebtorsResponse> {
    const company = await this.companyScopeService.requireManagementCompany(principal, companyId);
    const now = new Date();
    const limit = Math.min(Math.max(Number(query.limit) || 5, 1), 25);
    const currencyCode = company.currencyCode || "USD";

    const invoices = await this.prisma.clientInvoice.findMany({
      where: {
        companyId,
        status: ClientInvoiceStatus.ISSUED,
        balanceMinor: { gt: 0 },
        currencyCode
      },
      select: {
        balanceMinor: true,
        totalMinor: true,
        dueDate: true,
        currencyCode: true,
        serviceClientId: true,
        serviceClient: { select: { id: true, name: true } }
      }
    });

    const debtorMap = new Map<string, DebtorAccumulator>();
    for (const invoice of invoices) {
      accumulateDebtor(
        debtorMap,
        {
          serviceClientId: invoice.serviceClient.id,
          serviceClientName: invoice.serviceClient.name,
          balanceMinor: invoice.balanceMinor,
          totalMinor: invoice.totalMinor,
          dueDate: invoice.dueDate,
          currencyCode: invoice.currencyCode
        },
        now
      );
    }

    const debtors = rankTopDebtors([...debtorMap.values()], limit).map((debtor) => ({
      serviceClientId: debtor.serviceClientId,
      serviceClientName: debtor.serviceClientName,
      outstandingAmountMinor: debtor.outstandingAmountMinor,
      overdueAmountMinor: debtor.overdueAmountMinor,
      invoiceCount: debtor.invoiceCount,
      overdueInvoiceCount: debtor.overdueInvoiceCount,
      oldestDueDate: debtor.oldestDueDate ? debtor.oldestDueDate.toISOString() : null,
      currencyCode: debtor.currencyCode
    }));

    return {
      companyId,
      currencyCode,
      debtors
    };
  }

  async getRecentPayments(
    principal: AuthenticatedPrincipal,
    companyId: string,
    query: { limit?: string } = {}
  ): Promise<CompanyRecentPaymentsResponse> {
    const company = await this.companyScopeService.requireManagementCompany(principal, companyId);
    const limit = Math.min(Math.max(Number(query.limit) || 8, 1), 50);
    const currencyCode = company.currencyCode || "USD";

    const payments = await this.prisma.clientInvoicePayment.findMany({
      where: {
        companyId,
        status: PaymentStatus.POSTED,
        currencyCode
      },
      orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }],
      take: limit,
      select: {
        id: true,
        amountMinor: true,
        currencyCode: true,
        method: true,
        receivedAt: true,
        status: true,
        clientInvoice: {
          select: {
            id: true,
            invoiceNumber: true,
            serviceClient: { select: { name: true } }
          }
        }
      }
    });

    return {
      companyId,
      currencyCode,
      payments: payments.map((payment) => ({
        paymentId: payment.id,
        invoiceId: payment.clientInvoice.id,
        invoiceNumber: payment.clientInvoice.invoiceNumber,
        clientName: payment.clientInvoice.serviceClient.name,
        amountMinor: payment.amountMinor,
        currencyCode: payment.currencyCode,
        method: payment.method,
        receivedAt: payment.receivedAt.toISOString(),
        status: payment.status
      }))
    };
  }

  private loadSalesRows(companyId: string, range: FinancialReportDateRange) {
    return this.prisma.clientInvoice.findMany({
      where: {
        companyId,
        status: ClientInvoiceStatus.ISSUED,
        issuedAt: {
          gte: range.fromUtc,
          lt: range.toUtcExclusive
        }
      },
      select: {
        id: true,
        totalMinor: true,
        currencyCode: true,
        issuedAt: true
      }
    });
  }

  private loadCollectedRows(companyId: string, range: FinancialReportDateRange) {
    return this.prisma.clientInvoicePayment.findMany({
      where: {
        companyId,
        status: PaymentStatus.POSTED,
        receivedAt: {
          gte: range.fromUtc,
          lt: range.toUtcExclusive
        }
      },
      select: {
        id: true,
        amountMinor: true,
        currencyCode: true,
        receivedAt: true
      }
    });
  }
}
