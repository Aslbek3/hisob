import { z } from "zod";
import { jsonResponse, parseId, readBody, withUser } from "@/lib/api";
import { canUseEntryScreen } from "@/lib/permissions";
import { cancelEntry } from "@/services/entries";

const schema = z.object({ reason: z.string().max(300) });

// Aniq yozuvga ruxsat (prorab: o'zniki, 24 soat) servisda canModifyEntry bilan tekshiriladi.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withUser(request, canUseEntryScreen, async (user) => {
    const id = parseId((await params).id);
    const { reason } = await readBody(request, schema);
    return jsonResponse({ row: await cancelEntry(user, id, reason) });
  });
}
