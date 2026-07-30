export const RECEPTION_MODULE_DESCRIPTION =
  "Search an existing vehicle or customer, then create a work order for today.";

export const RECEPTION_SEARCH_FIRST_COPY =
  "Start by searching VIN, plate, phone, or customer name. If the vehicle already exists, receive it again instead of creating a duplicate.";

export const RECEPTION_SEARCH_BEFORE_CREATE =
  "Search before create — vehicles are saved once; each visit creates a new work order.";

export const RECEPTION_WORKFLOW_STEPS = [
  "Search",
  "Select vehicle",
  "Choose services",
  "Create work order"
] as const;

export const RECEPTION_VEHICLE_FOUND_LABEL = "Vehicle found";

export const RECEPTION_RECEIVE_VEHICLE_CTA = "Receive this vehicle";

export const RECEPTION_NO_MATCH_TITLE = "No match found";

export const RECEPTION_NO_MATCH_COPY =
  "Create a new customer and vehicle only if this is their first visit.";

export const RECEPTION_CREATE_NEW_VEHICLE_CTA = "Create new customer & vehicle";

export const RECEPTION_CREATE_INSTEAD_LINK = "Create new vehicle instead";

export const RECEPTION_EXISTING_VEHICLE_STEP_COPY =
  "This vehicle is already on file. You are creating a new work order — not another vehicle record.";

export const RECEPTION_NEW_VEHICLE_STEP_COPY =
  "First visit only. A vehicle record is created once, then future visits use Reception search.";

export const VEHICLES_MODULE_TITLE = "Vehicle Directory";

export const VEHICLES_MODULE_DESCRIPTION =
  "Review vehicles, owners, VINs, and service history.";

export const VEHICLES_RECEPTION_HELPER =
  "For daily intake, use Reception so existing vehicles are found before a new work order is created.";

export const VEHICLES_RECEIVE_CTA = "Receive vehicle";

export const VEHICLES_ADD_CTA = "Add vehicle";

export const CUSTOMERS_MODULE_TITLE = "Customers";

export const CUSTOMERS_MODULE_DESCRIPTION =
  "Manage service customers and the vehicles linked to them.";

export const CUSTOMERS_RELATIONSHIP_COPY =
  "Customers can have multiple vehicles. Each visit creates a new work order.";

export const JOBS_MODULE_TITLE = "Jobs";

export const JOBS_MODULE_DESCRIPTION =
  "Track active work orders, assigned employees, services, and status.";

export const JOBS_WORKFLOW_HELPER =
  "Services belong to the work order for this visit — not to the vehicle master record.";

export const WORK_ORDERS_MODULE_TITLE = "Work Orders";

export const WORK_ORDERS_MODULE_DESCRIPTION =
  "Browse and manage all work orders across vehicles, services, and assignments.";

export const WORK_ORDERS_RECEPTION_HELPER =
  "To receive a returning vehicle, use Reception to search first and create a new work order.";

export const SERVICES_MODULE_TITLE = "Services";

export const SERVICES_MODULE_DESCRIPTION =
  "Manage the services employees can select during reception and field work.";

export const SERVICES_NOT_COMPLETED_WORK_COPY =
  "Catalog services are templates for future jobs — not completed work or invoices.";

export const ADD_SERVICE_TO_WORK_ORDER_COPY =
  "Add services to this work order without creating another vehicle.";

export const WORK_ORDER_DETAIL_SERVICES_HEADING = "Services";

export const WORK_ORDER_MODEL_CALLOUT =
  "Customer → Vehicles → Work orders → Service lines. The vehicle is saved once; services are added per visit.";
