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
      <PageHeader title="Jurnal" subtitle={`${result.total} ta yozuv`} actions={<ExportLink href={`/api/export/jurnal?${query}`} />} />

      {/* Filtr — oddiy GET forma, JavaScript'siz ishlaydi */}
      <form className="flex flex-wrap items-end gap-2 mb-3 bg-paper border border-line px-3 py-2.5 text-[13px]">
        <Filter label="Dan">
          <input type="date" name="from" defaultValue={filters.from} className="field" />
        </Filter>
        <Filter label="Gacha">
          <input type="date" name="to" defaultValue={filters.to} className="field" />
        </Filter>
        <Filter label="Ob'ekt">
          <Select name="siteId" value={filters.siteId} options={opts.sites} />
        </Filter>
        {office && (
          <Filter label="Hisob">
            <Select name="accountId" value={filters.accountId} options={opts.accounts} />
          </Filter>
        )}
        <Filter label="Kategoriya">
          <Select name="categoryId" value={filters.categoryId} options={opts.categories} />
        </Filter>
        {office && (
          <>
            <Filter label="Turi">
              <select name="kind" defaultValue={filters.kind ?? ""} className="field">
                <option value="">Hammasi</option>
                <option value="EXPENSE">Chiqim</option>
                <option value="INCOME">Kirim</option>
                <option value="TRANSFER">O&apos;tkazma</option>
              </select>
            </Filter>
            <Filter label="Kiritgan">
              <Select name="createdById" value={filters.createdById} options={opts.users} />
            </Filter>
          </>
        )}
        <Filter label="Holati">
          <select name="status" defaultValue={filters.status} className="field">
            <option value="ACTIVE">Faol</option>
            <option value="CANCELLED">Bekor qilingan</option>
            <option value="ALL">Hammasi</option>
          </select>
        </Filter>
        <Filter label="Qidirish">
          <input name="q" defaultValue={filters.q} placeholder="izoh, material, kimdan" className="field w-[180px]" />
        </Filter>
        {filters.materialId && <input type="hidden" name="materialId" value={filters.materialId} />}
        <button className="btn btn-primary">Ko&apos;rsatish</button>
        <Link href="/jurnal" className="btn">
          Tozalash
        </Link>
      </form>

      <div className="flex flex-wrap gap-x-6 mb-2 text-[13px]">
        <span>
          Chiqim: <b><Money value={result.sums.expense} /></b>
        </span>
        {office && (
          <>
            <span>
              Kirim: <b><Money value={result.sums.income} /></b>
            </span>
            <span>
              O&apos;tkazma: <b><Money value={result.sums.transfer} /></b>
            </span>
          </>
        )}
      </div>

      <div className="overflow-x-auto border border-line">
        <table className="tbl">
          <thead>
            <tr>
              <th className="num">№</th>
              <th>Sana</th>
              {office && <th>Turi</th>}
              <th>Ob&apos;ekt</th>
              <th>Hisob</th>
              <th>Tavsif</th>
              <th className="num">Miqdor</th>
              <th className="num">Narx</th>
              <th className="num">Summa</th>
              <th>Kiritgan</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center text-ink-3 py-6">
                  Yozuv topilmadi
                </td>
              </tr>
            )}
            {result.rows.map((r) => {
              const cancelled = r.status === "CANCELLED";
              return (
                <tr key={r.id} className={cancelled ? "text-ink-3 line-through" : ""}>
                  <td className="num">
                    <Link href={`/jurnal/${r.id}`} className="link no-underline">
                      #{r.id}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap">{formatDate(r.date)}</td>
                  {office && <td>{KIND_LABEL[r.kind]}</td>}
                  <td>{r.siteName ?? "—"}</td>
                  <td className="whitespace-nowrap">
                    {r.accountName}
                    {r.toAccountName && <> → {r.toAccountName}</>}
                  </td>
                  <td>
                    {[r.categoryName, r.materialName, r.counterpartyName].filter(Boolean).join(" · ")}
                    {r.note && <div className="text-[12px] text-ink-3">{r.note}</div>}
                    {cancelled && <div className="text-[12px] no-underline">Bekor: {r.cancelReason}</div>}
                  </td>
                  <td className="num">
                    {r.kind === "EXPENSE" ? `${formatQuantity(r.quantity)} ${r.unit ? unitLabel(r.unit) : ""}` : ""}
                  </td>
                  <td className="num">{r.kind === "EXPENSE" ? <Money value={r.unitPrice} /> : ""}</td>
                  <td className="num font-medium">
                    <Money value={r.amount} />
                  </td>
                  <td className="text-[12px] text-ink-2 whitespace-nowrap">{r.createdByName}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center gap-3 mt-3 text-[13px]">
          {page > 1 && (
            <Link className="btn" href={`/jurnal?${toQuery(filters, { page: String(page - 1) })}`}>
              ← Oldingi
            </Link>
          )}
          <span className="text-ink-3">
            {page} / {pages}
          </span>
          {page < pages && (
            <Link className="btn" href={`/jurnal?${toQuery(filters, { page: String(page + 1) })}`}>
              Keyingi →
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
      <span className="text-[12px] text-ink-3">{label}</span>
      {children}
    </label>
  );
}

function Select({ name, value, options }: { name: string; value?: number; options: { id: number; name: string }[] }) {
  return (
    <select name={name} defaultValue={value ?? ""} className="field max-w-[180px]">
      <option value="">Hammasi</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </select>
  );
}
