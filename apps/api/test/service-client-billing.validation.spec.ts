import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import {
  buildServiceClientWriteData,
  normalizeServiceClientName
} from "../src/modules/company-operations/service-client-billing.validation";

describe("service-client-billing.validation", () => {
  it("requires a non-empty name", () => {
    expect(() => normalizeServiceClientName("")).toThrow(BadRequestException);
    expect(normalizeServiceClientName(" Acme ")).toBe("Acme");
  });

  it("normalizes billing fields and lowercases email", () => {
    const data = buildServiceClientWriteData({
      name: "Acme Fleet",
      legalName: " Acme Fleet SRL ",
      taxId: " 1-31-12345 ",
      billingContactName: " Ana Pérez ",
      phone: "+1 (809) 555-0100",
      billingEmail: "Facturacion@Acme.Example",
      addressLine1: "Av. Winston Churchill 100",
      city: "Santo Domingo",
      country: "DO"
    });

    expect(data).toMatchObject({
      name: "Acme Fleet",
      legalName: "Acme Fleet SRL",
      taxId: "1-31-12345",
      billingContactName: "Ana Pérez",
      billingEmail: "facturacion@acme.example",
      addressLine1: "Av. Winston Churchill 100",
      addressLine2: null,
      city: "Santo Domingo",
      country: "DO"
    });
  });

  it("rejects invalid billing email", () => {
    expect(() =>
      buildServiceClientWriteData({
        name: "Acme",
        billingEmail: "not-an-email"
      })
    ).toThrow(BadRequestException);
  });
});
