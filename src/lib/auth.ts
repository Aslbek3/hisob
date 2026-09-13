import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import type { SessionUser } from "@/types/auth";
import { getUserByToken, SESSION_TTL_MS } from "@/services/auth";

export const SESSION_COOKIE = "hisob_session";

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Joriy foydalanuvchi (bazadan tekshirilgan) yoki null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = await getSessionToken();
  if (!token) return null;
  return getUserByToken(token);
}

/** Rolga qarab bosh sahifa. */
export function homeFor(user: SessionUser): string {
  return user.role === "FOREMAN" ? "/kiritish" : "/obyektlar";
}

/**
 * Sahifa uchun tekshiruv. HAR SAHIFADA chaqiriladi, layout'da emas: App
 * Router layout va sahifani parallel chizadi — layout'dagi redirect()
 * sahifa mazmuni HTML'ga tushib qolishini to'xtatmaydi.
 */
export async function requirePageUser(roles?: Role[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (roles && !roles.includes(user.role)) redirect(homeFor(user));
  return user;
}
