import { errorResponse, parseId, withUser } from "@/lib/api";
import { excelResponse } from "@/lib/excel";
import { isValidIsoDate, monthStartIso, todayIso } from "@/lib/dates";
import { canViewFinance, canViewJournal } from "@/lib/permissions";
import { parseEntryFilters } from "@/services/entries";
import {
  exportBalances,
  exportJournal,
  exportPeriodReport,
  exportSite,
  exportSites,
  exportStatement,
  exportSupplierStatement,
} from "@/services/exports";

/**
 * Excel eksport:
 *   /hisobot?siteId=&from=&to=   — davriy hisobot (Telegram uchun)
 *   /jurnal?...  /obyektlar  /obyekt?id=
 *   /hisoblar  /hisob?id=&month=  /yetkazib?id=&from=&to=   — faqat ofis
 */
const FINANCE = new Set(["hisoblar", "hisob", "yetkazib"]);

export async function GET(request: Request, { params }: { params: Promise<{ report: string }> }) {
  const { report } = await params;

  return withUser(request, FINANCE.has(report) ? canViewFinance : canViewJournal, async (user) => {
    const p = new URL(request.url).searchParams;
    const date = (k: string) => {
      const v = p.get(k);
      return v && isValidIsoDate(v) ? v : undefined;
    };
    const optionalId = () => (p.get("siteId") ? parseId(p.get("siteId")!) : undefined);

    let file;
    switch (report) {
      case "hisobot": {
        const today = todayIso();
        file = await exportPeriodReport(user, { siteId: optionalId(), from: date("from") ?? today, to: date("to") ?? today });
        break;
      }
      case "jurnal":
        file = await exportJournal(user, parseEntryFilters(p));
        break;
      case "obyektlar":
        file = await exportSites(user);
        break;
      case "obyekt":
        file = await exportSite(user, parseId(p.get("id") ?? ""));
        break;
      case "hisoblar":
        file = await exportBalances();
        break;
      case "hisob":
        file = await exportStatement(user, parseId(p.get("id") ?? ""), date("month") ?? monthStartIso(todayIso()));
        break;
      case "yetkazib":
        file = await exportSupplierStatement(user, parseId(p.get("id") ?? ""), { from: date("from"), to: date("to") });
        break;
      default:
        return errorResponse("Номаълум ҳисобот", 404);
    }
    return excelResponse(file.buffer, file.filename);
  });
}
