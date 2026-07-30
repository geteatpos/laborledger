export function percentageChange(currentMinor: number, previousMinor: number): number | null {
  if (previousMinor === 0) {
    return null;
  }

  return Number((((currentMinor - previousMinor) / previousMinor) * 100).toFixed(1));
}

export function invoiceBalanceMinor(invoice: { balanceMinor: number; totalMinor: number }) {
  return invoice.balanceMinor > 0 ? invoice.balanceMinor : invoice.balanceMinor === 0 ? 0 : invoice.totalMinor;
}

export function isInvoiceOverdue(
  invoice: { dueDate: Date | null; balanceMinor: number; totalMinor: number },
  now: Date
) {
  if (!invoice.dueDate) {
    return false;
  }

  const balance = invoiceBalanceMinor(invoice);
  return balance > 0 && invoice.dueDate < now;
}

export function isInvoiceDueSoon(
  invoice: { dueDate: Date | null; balanceMinor: number; totalMinor: number },
  now: Date,
  withinDays = 7
) {
  if (!invoice.dueDate || isInvoiceOverdue(invoice, now)) {
    return false;
  }

  const balance = invoiceBalanceMinor(invoice);
  if (balance <= 0) {
    return false;
  }

  const msUntilDue = invoice.dueDate.getTime() - now.getTime();
  const daysUntilDue = msUntilDue / (24 * 60 * 60 * 1000);
  return daysUntilDue >= 0 && daysUntilDue <= withinDays;
}

export type DebtorAccumulator = {
  serviceClientId: string;
  serviceClientName: string;
  outstandingAmountMinor: number;
  overdueAmountMinor: number;
  invoiceCount: number;
  overdueInvoiceCount: number;
  oldestDueDate: Date | null;
  currencyCode: string;
};

export function accumulateDebtor(
  map: Map<string, DebtorAccumulator>,
  invoice: {
    serviceClientId: string;
    serviceClientName: string;
    balanceMinor: number;
    totalMinor: number;
    dueDate: Date | null;
    currencyCode: string;
  },
  now: Date
) {
  const balance = invoiceBalanceMinor(invoice);
  if (balance <= 0) {
    return;
  }

  const overdue = isInvoiceOverdue(invoice, now);
  const existing = map.get(invoice.serviceClientId) ?? {
    serviceClientId: invoice.serviceClientId,
    serviceClientName: invoice.serviceClientName,
    outstandingAmountMinor: 0,
    overdueAmountMinor: 0,
    invoiceCount: 0,
    overdueInvoiceCount: 0,
    oldestDueDate: null as Date | null,
    currencyCode: invoice.currencyCode
  };

  existing.outstandingAmountMinor += balance;
  existing.invoiceCount += 1;

  if (overdue) {
    existing.overdueAmountMinor += balance;
    existing.overdueInvoiceCount += 1;
  }

  if (invoice.dueDate) {
    if (!existing.oldestDueDate || invoice.dueDate < existing.oldestDueDate) {
      existing.oldestDueDate = invoice.dueDate;
    }
  }

  map.set(invoice.serviceClientId, existing);
}

export function rankTopDebtors(debtors: DebtorAccumulator[], limit = 5) {
  return [...debtors]
    .sort((a, b) => {
      if (b.overdueAmountMinor !== a.overdueAmountMinor) {
        return b.overdueAmountMinor - a.overdueAmountMinor;
      }
      return b.outstandingAmountMinor - a.outstandingAmountMinor;
    })
    .slice(0, limit);
}

export function sumByCurrency<T extends { currencyCode: string; amountMinor: number }>(
  rows: T[]
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(row.currencyCode, (totals.get(row.currencyCode) ?? 0) + row.amountMinor);
  }
  return totals;
}

export function pickPrimaryCurrencyTotal(
  totalsByCurrency: Map<string, number>,
  preferredCurrency: string
) {
  if (totalsByCurrency.has(preferredCurrency)) {
    return {
      currencyCode: preferredCurrency,
      amountMinor: totalsByCurrency.get(preferredCurrency) ?? 0,
      currencies: [...totalsByCurrency.keys()].sort()
    };
  }

  const currencies = [...totalsByCurrency.keys()].sort();
  const currencyCode = currencies[0] ?? preferredCurrency;
  return {
    currencyCode,
    amountMinor: totalsByCurrency.get(currencyCode) ?? 0,
    currencies
  };
}
