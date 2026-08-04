import { handleFieldClockStatus } from "@/lib/field-clock-route-handlers";

export async function GET(request: Request) {
  return handleFieldClockStatus(request);
}
