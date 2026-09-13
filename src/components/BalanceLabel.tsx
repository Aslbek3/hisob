import { Money } from "@/components/Money";

/** Yetkazib beruvchi qoldig'i so'z bilan: "Бизга товар қарз" / "Биз пул қарзмиз". */
export function BalanceLabel({ value }: { value: bigint }) {
  if (value === 0n) return <span className="text-ink-3">Тенг</span>;
  return value > 0n ? (
    <span className="text-plus">
      Бизга товар қарз: <b><Money value={value} /></b>
    </span>
  ) : (
    <span className="text-minus">
      Биз пул қарзмиз: <b><Money value={-value} /></b>
    </span>
  );
}
