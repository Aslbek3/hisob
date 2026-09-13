import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import type { SessionUser } from "@/types/auth";
import { getSessionUser } from "@/lib/auth";
import { ServiceError, forbidden } from "@/lib/errors";
import { logError } from "@/lib/logger";

/** BigInt'ni aniq saqlab JSON qiladi (Number'ga aylantirilmaydi). */
export function jsonResponse(data: unknown, init?: ResponseInit): Response {
  const body = JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
  return new NextResponse(body, {
    ...init,
    headers: { "content-type": "application/json; charset=utf-8", ...(init?.headers ?? {}) },
  });
}

export function errorResponse(message: string, status: number, extra?: Record<string, unknown>): Response {
  return jsonResponse({ error: message, ...extra }, { status });
}

/**
 * Har bir API route shu orqali o'tadi:
 *   1) sessiya tekshiruvi (yo'q bo'lsa 401),
 *   2) `check` — permissions.ts dagi ruxsat funksiyasi (false bo'lsa 403),
 *   3) handler; ServiceError/ZodError — tushunarli xabar, qolgani — log + 500.
 */
export async function withUser(
  request: Request,
  check: (user: SessionUser) => boolean,
  handler: (user: SessionUser) => Promise<Response>
): Promise<Response> {
  const user = await getSessionUser();
  if (!user) return errorResponse("Тизимга қайта киринг", 401);
  if (!check(user)) return errorResponse(forbidden().message, 403);

  try {
    return await handler(user);
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.message, error.status, { code: error.code, details: error.details });
    }
    if (error instanceof ZodError) {
      const first = error.issues[0];
      return errorResponse(first?.message ?? "Маълумот нотўғри", 400, { code: "VALIDATION" });
    }
    logError(error, { path: new URL(request.url).pathname, method: request.method, userId: user.id });
    return errorResponse("Серверда хатолик. Қайта уриниб кўринг.", 500);
  }
}

/** So'rov tanasini o'qib, zod sxemasi bo'yicha tekshiradi. */
export async function readBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ServiceError("Сўров нотўғри", 400);
  }
  return schema.parse(raw);
}

/** URL'dagi [id] ni musbat butun songa aylantiradi. */
export function parseId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new ServiceError("Нотўғри идентификатор", 400);
  return id;
}
