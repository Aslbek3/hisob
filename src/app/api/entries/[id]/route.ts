import { z } from "zod";
import { jsonResponse, parseId, readBody, withUser } from "@/lib/api";
import { canUseEntryScreen } from "@/lib/permissions";
import { entryInputSchema, updateEntry } from "@/services/entries";

const updateSchema = entryInputSchema.extend({ allowDuplicate: z.boolean().default(false) });

// Aniq yozuvga ruxsat (prorab: o'zniki, 24 soat) servisda canModifyEntry bilan tekshiriladi.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withUser(request, canUseEntryScreen, async (user) => {
    const id = parseId((await params).id);
    const { allowDuplicate, ...input } = await readBody(request, updateSchema);
    const row = await updateEntry(user, id, input, { allowDuplicate });
    return jsonResponse({ row });
  });
}
