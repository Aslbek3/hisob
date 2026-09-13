import { jsonResponse, readBody, withUser } from "@/lib/api";
import { canManageUsers } from "@/lib/permissions";
import { createUser, createUserSchema } from "@/services/users";

export async function POST(request: Request) {
  return withUser(request, canManageUsers, async (user) => {
    const created = await createUser(user, await readBody(request, createUserSchema));
    return jsonResponse(created, { status: 201 });
  });
}
