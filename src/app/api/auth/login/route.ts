import { z } from "zod";
import { setSessionCookie } from "@/lib/auth";
import { errorResponse, jsonResponse } from "@/lib/api";
import { allowLoginAttempt, getClientIp, resetLoginAttempts } from "@/lib/rateLimit";
import { logError } from "@/lib/logger";
import { login, purgeExpiredSessions } from "@/services/auth";

const schema = z.object({ login: z.string().trim().min(1).max(64), password: z.string().min(1).max(200) });

// Ochiq route (sessiyasiz) — ruxsat tekshiruvi o'rniga urinishlar cheklovi.
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Login va parolni kiriting", 400);
  const { login: loginName, password } = parsed.data;

  if (!allowLoginAttempt(getClientIp(request), loginName)) {
    return errorResponse("Urinishlar juda ko'p. 15 daqiqadan keyin qayta urinib ko'ring.", 429);
  }

  try {
    const result = await login(loginName, password);
    if (!result) return errorResponse("Login yoki parol noto'g'ri", 401);
    resetLoginAttempts(loginName);
    await setSessionCookie(result.token);
    if (Math.random() < 0.1) void purgeExpiredSessions().catch(() => {});
    return jsonResponse({ role: result.user.role });
  } catch (error) {
    logError(error, { path: "/api/auth/login" });
    return errorResponse("Serverda xatolik", 500);
  }
}
