/**
 * Login urinishlarini cheklash — xotirada (shuning uchun PM2 fork rejimida,
 * bitta jarayon). 5 foydalanuvchi uchun Redis ortiqcha.
 */
type Bucket = { count: number; resetAt: number };

const WINDOW_MS = 15 * 60 * 1000;
const LIMITS = { ip: 40, login: 10 } as const;

const buckets = new Map<string, Bucket>();

function hit(key: string, max: number, now: number): boolean {
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  b.count += 1;
  return b.count <= max;
}

/** true — urinishga ruxsat; false — cheklovga urildi (429). */
export function allowLoginAttempt(ip: string, login: string): boolean {
  const now = Date.now();
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }
  const ipOk = hit(`ip:${ip}`, LIMITS.ip, now);
  const loginOk = hit(`login:${login.toLowerCase()}`, LIMITS.login, now);
  return ipOk && loginOk;
}

/** Muvaffaqiyatli kirishdan keyin shu login hisobchisi tozalanadi. */
export function resetLoginAttempts(login: string) {
  buckets.delete(`login:${login.toLowerCase()}`);
}

/**
 * Mijoz IP'si. Nginx `X-Real-IP`ni o'zi qayta yozadi (mijoz soxtalashtira
 * olmaydi) — docs/nginx.conf.example ga qarang.
 */
export function getClientIp(request: Request): string {
  return request.headers.get("x-real-ip") ?? "local";
}
