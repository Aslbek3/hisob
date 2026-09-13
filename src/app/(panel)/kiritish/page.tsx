import type { EntryKind } from "@prisma/client";
import { requirePageUser } from "@/lib/auth";
import { isValidIsoDate, todayIso } from "@/lib/dates";
import { isOffice } from "@/lib/permissions";
import { PageHeader } from "@/components/PageHeader";
import { getEntryOptions } from "@/services/reference";
import { getClosedMonths } from "@/services/periods";
import { EntryGrid } from "./EntryGrid";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function KiritishPage({ searchParams }: { searchParams: SP }) {
  const user = await requirePageUser();
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const num = (k: string) => {
    const n = Number(str(k));
    return Number.isInteger(n) && n > 0 ? n : null;
  };

  const [options, closed] = await Promise.all([getEntryOptions(user), getClosedMonths()]);
  const allowedKinds: EntryKind[] = isOffice(user) ? ["EXPENSE", "INCOME", "TRANSFER"] : ["EXPENSE"];
  const today = todayIso();

  const kindParam = str("kind") as EntryKind | undefined;
  const kind = kindParam && allowedKinds.includes(kindParam) ? kindParam : "EXPENSE";
  const dateParam = str("date");
  const date = dateParam && isValidIsoDate(dateParam) && dateParam <= today ? dateParam : today;

  // Faqat mavjud (faol, ruxsat etilgan) qiymatlar qabul qilinadi; bitta ob'ekt bo'lsa — o'zi tanlanadi
  const siteId = num("siteId");
  const accountId = num("accountId");
  const validSite = siteId && options.sites.some((s) => s.id === siteId) ? siteId : options.sites.length === 1 ? options.sites[0].id : null;
  const validAccount = accountId && options.accounts.some((a) => a.id === accountId) ? accountId : null;

  return (
    <>
      <PageHeader title="Kiritish" />
      <EntryGrid
        options={options}
        allowedKinds={allowedKinds}
        initialHeader={{ kind, siteId: validSite, accountId: validAccount, date }}
        closedMonths={[...closed]}
        today={today}
        focusId={num("focus")}
      />
    </>
  );
}
