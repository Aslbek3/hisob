/**
 * Xatolarni PM2 logiga bitta qator JSON qilib yozadi. Parol/token maydonlari
 * avtomatik yashiriladi.
 */
const SECRET_KEYS = /pass|token|secret|cookie|authorization/i;

function redact(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(redact);
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([k, v]) => [
      k,
      SECRET_KEYS.test(k) ? "[REDACTED]" : redact(v),
    ])
  );
}

export function logError(error: unknown, context: Record<string, unknown> = {}) {
  const err = error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { value: String(error) };
  console.error(
    JSON.stringify(
      { level: "error", at: new Date().toISOString(), ...(redact(context) as object), error: err },
      (_k, v) => (typeof v === "bigint" ? v.toString() : v)
    )
  );
}
