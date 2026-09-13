import { z } from "zod";
import { jsonResponse, parseId, readBody, withUser } from "@/lib/api";
import { canManageSites } from "@/lib/permissions";
import { setSiteStatus, updateSite } from "@/services/sites";

const schema = z.union([
  z.object({ status: z.enum(["ACTIVE", "ARCHIVED"]) }),
  z.object({ name: z.string(), address: z.string().nullable().optional() }),
]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withUser(request, canManageSites, async (user) => {
    const id = parseId((await params).id);
    const body = await readBody(request, schema);
    if ("status" in body) await setSiteStatus(user, id, body.status);
    else await updateSite(user, id, body);
    return jsonResponse({ ok: true });
  });
}
