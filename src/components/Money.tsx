import { formatSom } from "@/lib/money";

/**
 * Pul qiymati. `signed` bo'lsa manfiy qizil, musbat yashil.
 * Nol — xira, jadvalda ko'zni chalg'itmasin.
 */
export function Money({ value, signed = false, className = "" }: { value: bigint | string | null; signed?: boolean; className?: string }) {
  if (value === null) return <span className="text-ink-3">—</span>;
  const v = typeof value === "string" ? BigInt(value) : value;
  const color = v === 0n ? "text-ink-3" : signed ? (v < 0n ? "text-minus" : "text-plus") : "";
  return <span className={`num ${color} ${className}`}>{formatSom(v)}</span>;
}
