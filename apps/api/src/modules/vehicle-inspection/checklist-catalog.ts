export const CHECKLIST_CATALOG = [
  { key: "wiper_front_driver",   label: "Wiper blade - front driver",   category: "BODY",       positionOrder: 1,  hasMeasurement: false },
  { key: "wiper_front_passenger",label: "Wiper blade - front passenger",category: "BODY",       positionOrder: 2,  hasMeasurement: false },
  { key: "lights",               label: "Lights",                       category: "LIGHTS",     positionOrder: 3,  hasMeasurement: false },
  { key: "body_panels",          label: "Body panels",                  category: "BODY",       positionOrder: 4,  hasMeasurement: false },
  { key: "windows",              label: "Windows",                      category: "GLASS",      positionOrder: 5,  hasMeasurement: false },
  { key: "mirrors",              label: "Mirrors",                      category: "BODY",       positionOrder: 6,  hasMeasurement: false },
  { key: "engine_air_filter",    label: "Engine air filter",            category: "FILTERS",    positionOrder: 7,  hasMeasurement: false },
  { key: "cabin_air_filter",     label: "Cabin air filter",             category: "FILTERS",    positionOrder: 8,  hasMeasurement: false },
  { key: "tire_fl",              label: "Tire tread - front left",      category: "TIRES",      positionOrder: 9,  hasMeasurement: true,  measurementUnit: "mm" },
  { key: "tire_fr",              label: "Tire tread - front right",     category: "TIRES",      positionOrder: 10, hasMeasurement: true,  measurementUnit: "mm" },
  { key: "tire_rl",              label: "Tire tread - rear left",       category: "TIRES",      positionOrder: 11, hasMeasurement: true,  measurementUnit: "mm" },
  { key: "tire_rr",              label: "Tire tread - rear right",      category: "TIRES",      positionOrder: 12, hasMeasurement: true,  measurementUnit: "mm" },
  { key: "brake_pads_front",     label: "Brake pads - front",           category: "BRAKES",     positionOrder: 13, hasMeasurement: true,  measurementUnit: "mm" },
  { key: "brake_pads_rear",      label: "Brake pads - rear",            category: "BRAKES",     positionOrder: 14, hasMeasurement: true,  measurementUnit: "mm" },
  { key: "rotors_front",         label: "Rotors - front",               category: "BRAKES",     positionOrder: 15, hasMeasurement: true,  measurementUnit: "mm" },
  { key: "rotors_rear",          label: "Rotors - rear",                category: "BRAKES",     positionOrder: 16, hasMeasurement: true,  measurementUnit: "mm" },
  { key: "brake_fluid",          label: "Brake fluid",                  category: "FLUIDS",     positionOrder: 17, hasMeasurement: false },
  { key: "battery",              label: "Battery",                      category: "ELECTRICAL", positionOrder: 18, hasMeasurement: false }
] as const;

export type ChecklistCatalogEntry = (typeof CHECKLIST_CATALOG)[number];

export function findCatalogEntry(key: string): ChecklistCatalogEntry | undefined {
  return CHECKLIST_CATALOG.find((entry) => entry.key === key);
}
