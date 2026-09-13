import { errorResponse, jsonResponse, withUser } from "@/lib/api";
import { canManageReference } from "@/lib/permissions";
import { isReferenceType, saveReference } from "@/services/reference";

/** Spravochnikka yangi qiymat: /api/reference/materials, /api/reference/accounts ... */
export async function POST(request: Request, { params }: { params: Promise<{ type: string }> }) {
  return withUser(request, canManageReference, async (user) => {
    const { type } = await params;
    if (!isReferenceType(type)) return errorResponse("Noma'lum spravochnik", 404);
    const saved = await saveReference(user, type, null, await request.json());
    return jsonResponse({ id: saved.id }, { status: 201 });
  });
}
