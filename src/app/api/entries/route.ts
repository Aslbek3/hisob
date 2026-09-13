import { z } from "zod";
import { jsonResponse, readBody, withUser } from "@/lib/api";
import { canUseEntryScreen, canViewJournal } from "@/lib/permissions";
import { createEntry, entryInputSchema, listEntriesForGrid } from "@/services/entries";

/**
 * GET — Kiritish jadvali uchun: ?kind=EXPENSE&date=2026-09-13&siteId=1&accountId=2
 * (jurnal sahifasi serverda chiziladi, unga API kerak emas).
 */
export async function GET(request: Request) {
  return withUser(request, canViewJournal, async (user) => {
    const p = new URL(request.url).searchParams;
    const header = z
      .object({
        kind: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
        date: z.string(),
        siteId: z.coerce.number().int().positive().nullable().catch(null),
        accountId: z.coerce.number().int().positive(),
      })
      .parse({ kind: p.get("kind"), date: p.get("date"), siteId: p.get("siteId"), accountId: p.get("accountId") });
    return jsonResponse({ rows: await listEntriesForGrid(user, header) });
  });
}

const createSchema = entryInputSchema.extend({ allowDuplicate: z.boolean().default(false) });

export async function POST(request: Request) {
  return withUser(request, canUseEntryScreen, async (user) => {
    const { allowDuplicate, ...input } = await readBody(request, createSchema);
    const row = await createEntry(user, input, { allowDuplicate });
    return jsonResponse({ row }, { status: 201 });
  });
}
