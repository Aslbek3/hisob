import { z } from "zod";
import { jsonResponse, readBody, withUser } from "@/lib/api";
import { canUseEntryScreen, canViewJournal } from "@/lib/permissions";
import { createEntry, entryInputSchema, getDay } from "@/services/entries";

/**
 * GET — Kunlik daftar uchun: ?siteId=1&date=2026-09-13 → { expenses, incomes }
 * (jurnal sahifasi serverda chiziladi, unga API kerak emas).
 */
export async function GET(request: Request) {
  return withUser(request, canViewJournal, async (user) => {
    const p = new URL(request.url).searchParams;
    const q = z
      .object({ siteId: z.coerce.number().int().positive(), date: z.string() })
      .parse({ siteId: p.get("siteId"), date: p.get("date") });
    return jsonResponse(await getDay(user, q.siteId, q.date));
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
