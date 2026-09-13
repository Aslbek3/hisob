import Link from "next/link";
import { requirePageUser } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { formatQuantity } from "@/lib/money";
import { unitLabel } from "@/lib/units";
import { KIND_LABEL } from "@/lib/labels";
import { isOffice } from "@/lib/permissions";
import { PageHeader } from "@/components/PageHeader";
import { Money } from "@/components/Money";
import { ExportLink } from "@/components/ExportLink";
import { listEntries, parseEntryFilters, type EntryFilters } from "@/services/entries";
import { getFilterOptions } from "@/services/reference";

const PAGE_SIZE = 100;
type SP = Promise<Record<string, string | string[] | undefined>>;

function toQuery(f: EntryFilters, extra: Record<string, string> = {}): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v !== undefined && !(k === "status" && v === "ACTIVE")) qs.set(k, String(v));
  for (const [k, v] of Object.entries(extra)) qs.set(k, v);
  return qs.toString();
}

/** Barcha yozuvlar — qidirish va filtr. Kundalik ish uchun emas, tekshirish uchun. */
export default async function JurnalPage({ searchParams }: { searchParams: SP }) {
  const user = await requirePageUser();
  const sp = await searchParams;
  const filters = parseEntryFilters(sp);
  const page = Math.max(1, Number(sp.page) || 1);
  const office = isOffice(user);

  const [result, opts] = await Promise.all([listEntries(user, filters, page, PAGE_SIZE), getFilterOptions(user)]);
  const pages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
  const query = toQuery(filters);

  return (
    <>
      <PageHeader title="Барча ёзувлар" subtitle={`${result.total} та ёзув`} actions={<ExportLink href={`/api/export/jurnal?${query}`} />} />

      {/* Filtr — oddiy GET forma, JavaScript'siz ishlaydi */}
      <form className="flex flex-wrap items-end gap-2 mb-3 bg-paper border border-line px-3 py-2.5">
        <Filter label="Дан">
          <input type="date" name="from" defaultValue={filters.from} className="field" />
        </Filter>
        <Filter label="Гача">
          <input type="date" name="to" defaultValue={filters.to} className="field" />
        </Filter>
        <Filter label="Объект">
          <Select name="siteId" value={filters.siteId} options={opts.sites} />
        </Filter>
        {office && (
          <Filter label="Ҳисоб">
            <Select name="accountId" value={filters.accountId} options={opts.accounts} />
          </Filter>
        )}
        <Filter label="Категория">
          <Select name="categoryId" value={filters.categoryId} options={opts.categories} />
        </Filter>
        <Filter label="Контрагент">
          <Select name="counterpartyId" value={filters.counterpartyId} options={opts.counterparties} />
        </Filter>
        {office && (
          <Filter label="Тури">
            <select name="kind" defaultValue={filters.kind ?? ""} className="field">
              <option value="">Ҳаммаси</option>
              {Object.entries(KIND_LABEL).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </Filter>
        )}
        <Filter label="Ҳолати">
          <select name="status" defaultValue={filters.status} className="field">
            <option value="ACTIVE">Фаол</option>
            <option value="CANCELLED">Бекор қилинган</option>
            <option value="ALL">Ҳаммаси</option>
          </select>
        </Filter>
        <Filter label="Қидириш">
          <input name="q" defaultValue={filters.q} placeholder="ном, изоҳ" className="field w-[170px]" />
        </Filter>
        {filters.materialId && <input type="hidden" name="materialId" value={filters.materialId} />}
        <button className="btn btn-primary">Кўрсатиш</button>
        <Link href="/jurnal" className="btn">
          Тозалаш
        </Link>
      </form>

      <div className="flex flex-wrap gap-x-6 mb-2">
        <span>
          Харажат: <b><Money value={result.sums.expense} /></b>
        </span>
        {office && (
          <>
            <span>
              Кирим: <b><Money value={result.sums.income} /></b>
            </span>
            <span>
              Етказиб берувчига тўлов: <b><Money value={result.sums.supplierPayment} /></b>
            </span>
          </>
        )}
      </div>

      <div className="overflow-x-auto border border-line">
        <table className="tbl">
          <thead>
            <tr>
              <th className="num">№</th>
              <th>Сана</th>
              {office && <th>Тури</th>}
              <th>Объект</th>
              <th>Ким тўлади</th>
              <th>Номи / тавсиф</th>
              <th className="num">Миқдор</th>
              <th className="num">Нарх</th>
              <th className="num">Сумма</th>
              <th>Киритган</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center text-ink-3 py-6">
                  Ёзув топилмади
                </td>
              </tr>
            )}
            {result.rows.map((r) => {
              const cancelled = r.status === "CANCELLED";
              const withQty = r.kind === "EXPENSE" || r.kind === "GOODS_RECEIPT";
              return (
                <tr key={r.id} className={cancelled ? "text-ink-3 line-through" : ""}>
                  <td className="num">
                    <Link href={`/jurnal/${r.id}`} className="link">
                      {r.id}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap">{formatDate(r.date)}</td>
                  {office && <td className="text-[14px]">{KIND_LABEL[r.kind]}</td>}
                  <td>{r.siteName ?? "—"}</td>
                  <td className="whitespace-nowrap">
                    {r.kind === "GOODS_RECEIPT" ? "Қарзга" : r.accountName}
                    {r.toAccountName && <> → {r.toAccountName}</>}
                  </td>
                  <td>
                    {[r.materialName, r.counterpartyName].filter(Boolean).join(" · ")}
                    {r.note && <div className="text-[13px] text-ink-3">{r.note}</div>}
                    {cancelled && <div className="text-[13px]">Бекор: {r.cancelReason}</div>}
                  </td>
                  <td className="num">{withQty ? `${formatQuantity(r.quantity)} ${r.unit ? unitLabel(r.unit) : ""}` : ""}</td>
                  <td className="num">{withQty ? <Money value={r.unitPrice} /> : ""}</td>
                  <td className="num font-medium">
                    <Money value={r.amount} />
                  </td>
                  <td className="text-[13px] text-ink-2 whitespace-nowrap">{r.createdByName}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center gap-3 mt-3">
          {page > 1 && (
            <Link className="btn" href={`/jurnal?${toQuery(filters, { page: String(page - 1) })}`}>
              ← Олдинги
            </Link>
          )}
          <span className="text-ink-3">
            {page} / {pages}
          </span>
          {page < pages && (
            <Link className="btn" href={`/jurnal?${toQuery(filters, { page: String(page + 1) })}`}>
              Кейинги →
            </Link>
          )}
        </div>
      )}
    </>
  );
}

function Filter({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[13px] text-ink-3">{label}</span>
      {children}
    </label>
  );
}

function Select({ name, value, options }: { name: string; value?: number; options: { id: number; name: string }[] }) {
  return (
    <select name={name} defaultValue={value ?? ""} className="field max-w-[180px]">
      <option value="">Ҳаммаси</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </select>
  );
}
