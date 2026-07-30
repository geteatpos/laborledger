import { describe, expect, it } from "vitest";

import {
  buildServiceClientWritePayload,
  enrichServiceClientsWithLocationCounts,
  filterServiceClientsByQuery,
  resolveServiceClientWritePayload,
  serviceClientToFormState,
  validateServiceClientForm,
  validateServiceClientName
} from "../../apps/admin/src/lib/service-client-utils";

describe("service-client-utils", () => {
  it("rejects empty service client name", () => {
    expect(validateServiceClientName("")).toBe("El nombre del cliente es obligatorio.");
    expect(validateServiceClientName("   ")).toBe("El nombre del cliente es obligatorio.");
    expect(validateServiceClientName("Acme")).toBeUndefined();
  });

  it("filters service clients by name, contact, phone, or email", () => {
    const clients = enrichServiceClientsWithLocationCounts(
      [
        {
          id: "1",
          companyId: "c1",
          name: "Acme Facilities",
          legalName: null,
          taxId: null,
          billingContactName: "Jordan Lee",
          phone: "555-0100",
          billingEmail: "billing@acme.test",
          addressLine1: null,
          addressLine2: null,
          city: null,
          stateRegion: null,
          postalCode: null,
          country: null,
          archivedAt: null,
          createdAt: "2026-01-01T00:00:00.000Z"
        },
        {
          id: "2",
          companyId: "c1",
          name: "Northwind Services",
          legalName: null,
          taxId: null,
          billingContactName: null,
          phone: null,
          billingEmail: null,
          addressLine1: null,
          addressLine2: null,
          city: null,
          stateRegion: null,
          postalCode: null,
          country: null,
          archivedAt: null,
          createdAt: "2026-01-01T00:00:00.000Z"
        }
      ],
      []
    );

    expect(filterServiceClientsByQuery(clients, "acme")).toHaveLength(1);
    expect(filterServiceClientsByQuery(clients, "jordan")).toHaveLength(1);
    expect(filterServiceClientsByQuery(clients, "billing@acme")).toHaveLength(1);
    expect(filterServiceClientsByQuery(clients, "")).toHaveLength(2);
  });

  it("counts only active locations per service client", () => {
    const views = enrichServiceClientsWithLocationCounts(
      [
        {
          id: "sc1",
          companyId: "c1",
          name: "Acme",
          legalName: null,
          taxId: null,
          billingContactName: null,
          phone: null,
          billingEmail: null,
          addressLine1: null,
          addressLine2: null,
          city: null,
          stateRegion: null,
          postalCode: null,
          country: null,
          archivedAt: null,
          createdAt: "2026-01-01T00:00:00.000Z"
        }
      ],
      [
        { serviceClientId: "sc1", archivedAt: null },
        { serviceClientId: "sc1", archivedAt: "2026-02-01T00:00:00.000Z" },
        { serviceClientId: "sc2", archivedAt: null }
      ]
    );

    expect(views[0]?.locationCount).toBe(1);
  });

  it("builds write payload and validates billing email", () => {
    const form = serviceClientToFormState({
      name: "Acme",
      legalName: "Acme SRL",
      taxId: "123",
      billingContactName: "Ana",
      phone: "809-555",
      billingEmail: "Ana@Acme.Test",
      addressLine1: "Calle 1",
      addressLine2: null,
      city: "SD",
      stateRegion: null,
      postalCode: null,
      country: "DO"
    });

    expect(buildServiceClientWritePayload(form).billingEmail).toBe("ana@acme.test");
    expect(validateServiceClientForm({ ...form, billingEmail: "bad" }).billingEmail).toBeTruthy();
  });

  it("resolves BFF write bodies without dropping billing fields", () => {
    const resolved = resolveServiceClientWritePayload({
      name: "Acme",
      legalName: "Acme SRL",
      billingEmail: "billing@acme.test",
      phone: "809-555-0100",
      city: "Santo Domingo"
    });

    expect(resolved.ok).toBe(true);
    if (!resolved.ok) {
      return;
    }

    expect(resolved.payload).toMatchObject({
      name: "Acme",
      legalName: "Acme SRL",
      billingEmail: "billing@acme.test",
      phone: "809-555-0100",
      city: "Santo Domingo",
      taxId: null
    });
  });
});
