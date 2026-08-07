import { handleFieldClockAction } from "@/lib/field-clock-route-handlers";

export async function POST(request: Request) {
  return handleFieldClockAction(request, "clock_in");
}
