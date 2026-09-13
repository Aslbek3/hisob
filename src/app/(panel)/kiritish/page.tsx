import { requirePageUser } from "@/lib/auth";
import { isValidIsoDate, todayIso } from "@/lib/dates";
import { isOffice } from "@/lib/permissions";
import { PageHeader } from "@/components/PageHeader";
import { getEntryOptions } from "@/services/reference";
import { getClosedMonths } from "@/services/periods";
import { DailyLedger } from "./DailyLedger";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function DaftarPage({ searchParams }: { searchParams: SP }) {
  const user = await requirePageUser();
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const num = (k: string) => {
    const n = Number(str(k));
    return Number.isInteger(n) && n > 0 ? n : null;
  };

  const [options, closed] = await Promise.all([getEntryOptions(user), getClosedMonths()]);
  const today = todayIso();
  const dateParam = str("date");
  const date = dateParam && isValidIsoDate(dateParam) && dateParam <= today ? dateParam : today;

  // Faqat mavjud (faol, ruxsat etilgan) ob'ekt; bitta bo'lsa — o'zi tanlanadi
  const siteId = num("siteId");
  const initialSite = siteId && options.sites.some((s) => s.id === siteId) ? siteId : options.sites.length === 1 ? options.sites[0].id : null;

  return (
    <>
      <PageHeader title="Кунлик дафтар" />
      <DailyLedger
        options={options}
        initialSiteId={initialSite}
        initialDate={date}
        today={today}
        closedMonths={[...closed]}
        focusId={num("focus")}
        showIncome={isOffice(user)}
        canAddNames={isOffice(user)}
      />
    </>
  );
}
