import { jsonResponse, parseId, readBody, withUser } from "@/lib/api";
import { canManageUsers } from "@/lib/permissions";
import { updateUser, updateUserSchema } from "@/services/users";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withUser(request, canManageUsers, async (user) => {
    const id = parseId((await params).id);
    return jsonResponse(await updateUser(user, id, await readBody(request, updateUserSchema)));
  });
}
