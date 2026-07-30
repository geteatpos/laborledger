import { describe, expect, it } from "vitest";

import { isLocationUsableByClient } from "../../apps/admin/src/lib/location-utils";
import { enrichServiceClientsWithLocationCounts } from "../../apps/admin/src/lib/service-client-utils";
import { filterLocationsForClient } from "../../apps/admin/src/lib/vehicle-utils";
import {
  isLocationLinkedToServiceClient,
  mapFieldLocationOption
} from "../../apps/api/src/modules/company-operations/service-client-location-access";
import { filterFieldLocationsForClient } from "../../apps/field/src/lib/field-location-utils";

describe("shared service client locations", () => {
  it("treats primary and linked clients as usable", () => {
    const location = {
      serviceClientId: "client-a",
      linkedServiceClientIds: ["client-a", "client-b"],
      archivedAt: null
    };

    expect(isLocationUsableByClient(location, "client-a")).toBe(true);
    expect(isLocationUsableByClient(location, "client-b")).toBe(true);
    expect(isLocationUsableByClient(location, "client-c")).toBe(false);
  });

  it("counts shared locations for each client", () => {
    const views = enrichServiceClientsWithLocationCounts(
      [
        {
          id: "client-a",
          companyId: "co-1",
          name: "A",
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
          createdAt: "2026-01-01"
        },
        {
          id: "client-b",
          companyId: "co-1",
          name: "B",
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
          createdAt: "2026-01-01"
        }
      ],
      [
        {
          serviceClientId: "client-a",
          linkedServiceClientIds: ["client-a", "client-b"],
          archivedAt: null
        }
      ]
    );

    expect(views.find((client) => client.id === "client-a")?.locationCount).toBe(1);
    expect(views.find((client) => client.id === "client-b")?.locationCount).toBe(1);
  });

  it("filters locations for shared clients", () => {
    const locations = [
      {
        id: "loc-1",
        companyId: "co-1",
        serviceClientId: "client-a",
        name: "Main",
        timezone: "America/New_York",
        archivedAt: null,
        createdAt: "2026-01-01",
        linkedServiceClientIds: ["client-a", "client-b"]
      }
    ];

    expect(filterLocationsForClient(locations, "client-b")).toHaveLength(1);
    expect(filterLocationsForClient(locations, "client-c")).toHaveLength(0);
  });

  it("matches API helper for primary or linked access", () => {
    expect(
      isLocationLinkedToServiceClient({
        locationServiceClientId: "client-a",
        serviceClientId: "client-b",
        linkedServiceClientIds: ["client-b"]
      })
    ).toBe(true);
  });

  it("maps field location options with linked ids", () => {
    expect(
      mapFieldLocationOption({
        id: "loc-1",
        name: "Airport",
        serviceClientId: "client-a",
        serviceClientLinks: [{ serviceClientId: "client-a" }, { serviceClientId: "client-b" }]
      })
    ).toEqual({
      id: "loc-1",
      name: "Airport",
      serviceClientId: "client-a",
      linkedServiceClientIds: ["client-a", "client-b"]
    });
  });

  it("filters field locations for shared-only clients", () => {
    const locations = [
      {
        id: "loc-1",
        name: "Airport",
        serviceClientId: "client-a",
        linkedServiceClientIds: ["client-a", "client-b"]
      },
      {
        id: "loc-2",
        name: "Downtown",
        serviceClientId: "client-a",
        linkedServiceClientIds: ["client-a"]
      }
    ];

    expect(filterFieldLocationsForClient(locations, "client-b").map((l) => l.id)).toEqual(["loc-1"]);
    expect(filterFieldLocationsForClient(locations, "client-a")).toHaveLength(2);
    expect(filterFieldLocationsForClient(locations, "client-c")).toHaveLength(0);
  });
});
