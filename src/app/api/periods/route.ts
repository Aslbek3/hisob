import { z } from "zod";
import { jsonResponse, readBody, withUser } from "@/lib/api";
import { isValidIsoDate } from "@/lib/dates";
import { canClosePeriods } from "@/lib/permissions";
import { closeMonth, reopenMonth } from "@/services/periods";

const month = z.string().refine(isValidIsoDate, "Oy noto'g'ri");
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("close"), month }),
  z.object({ action: z.literal("reopen"), month, reason: z.string().trim().min(3, "Qayta ochish sababini yozing").max(300) }),
]);

export async function POST(request: Request) {
  return withUser(request, canClosePeriods, async (user) => {
    const body = await readBody(request, schema);
    if (body.action === "close") await closeMonth(user, body.month);
    else await reopenMonth(user, body.month, body.reason);
    return jsonResponse({ ok: true });
  });
}
