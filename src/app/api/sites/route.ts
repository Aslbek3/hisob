import { z } from "zod";
import { jsonResponse, readBody, withUser } from "@/lib/api";
import { canManageSites } from "@/lib/permissions";
import { createSite } from "@/services/sites";

const schema = z.object({ name: z.string(), address: z.string().nullable().optional() });

export async function POST(request: Request) {
  return withUser(request, canManageSites, async (user) => {
    const site = await createSite(user, await readBody(request, schema));
    return jsonResponse({ id: site.id }, { status: 201 });
  });
}
