import { errorResponse, jsonResponse, parseId, withUser } from "@/lib/api";
import { canManageReference } from "@/lib/permissions";
import { isReferenceType, saveReference } from "@/services/reference";

export async function PATCH(request: Request, { params }: { params: Promise<{ type: string; id: string }> }) {
  return withUser(request, canManageReference, async (user) => {
    const { type, id } = await params;
    if (!isReferenceType(type)) return errorResponse("Noma'lum spravochnik", 404);
    const saved = await saveReference(user, type, parseId(id), await request.json());
    return jsonResponse({ id: saved.id });
  });
}
