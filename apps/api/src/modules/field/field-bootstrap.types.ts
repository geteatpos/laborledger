export type FieldBootstrapCompany = {
  id: string;
  name: string;
  legalName: string | null;
};

export type FieldBootstrapLocation = {
  id: string;
  name: string;
  timezone: string;
};

export type FieldBootstrapFeatures = {
  clockEnabled: boolean;
  vehicleIntakeEnabled: boolean;
  laborWorkEnabled: boolean;
};

export type FieldBootstrapResponse = {
  ready: boolean;
  company: FieldBootstrapCompany | null;
  location: FieldBootstrapLocation | null;
  branding: {
    appTitle: string;
    subtitle: string | null;
  };
  features: FieldBootstrapFeatures;
  clock: {
    available: boolean;
  };
  employeeLogin: {
    mode: "pin";
    pinLength: 6;
  };
  message: string | null;
};

export type FieldSiteViewRecord = {
  id: string;
  companyId: string;
  locationId: string;
  hostname: string;
  displayName: string | null;
  ready: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  clockAvailable: boolean;
};
