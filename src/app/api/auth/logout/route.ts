import { clearSessionCookie, getSessionToken } from "@/lib/auth";
import { jsonResponse } from "@/lib/api";
import { logout } from "@/services/auth";

// Chiqish — sessiya bo'lmasa ham xavfsiz (hech narsa qilmaydi).
export async function POST() {
  const token = await getSessionToken();
  if (token) await logout(token);
  await clearSessionCookie();
  return jsonResponse({ ok: true });
}
