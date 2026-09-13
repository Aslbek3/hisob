import { errorResponse, parseId, withUser } from "@/lib/api";
import { excelResponse } from "@/lib/excel";
import { isValidIsoDate, monthStartIso, todayIso } from "@/lib/dates";
import { canViewFinance, canViewJournal } from "@/lib/permissions";
import { parseEntryFilters } from "@/services/entries";
import { exportBalances, exportJournal, exportSite, exportSites, exportStatement } from "@/services/exports";

/**
 * Excel eksport: /api/export/jurnal?..., /obyektlar, /obyekt?id=, /hisoblar, /hisob?id=&month=
 * Jurnal va ob'ektlar — hamma (prorab o'z doirasida), hisoblar — faqat ofis.
 */
export async function GET(request: Request, { params }: { params: Promise<{ report: string }> }) {
  const { report } = await params;
  const finance = report === "hisoblar" || report === "hisob";

  return withUser(request, finance ? canViewFinance : canViewJournal, async (user) => {
    const p = new URL(request.url).searchParams;
    let file;
    switch (report) {
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
      case "hisob": {
        const month = p.get("month");
        file = await exportStatement(user, parseId(p.get("id") ?? ""), month && isValidIsoDate(month) ? month : monthStartIso(todayIso()));
        break;
      }
      default:
        return errorResponse("Noma'lum hisobot", 404);
    }
    return excelResponse(file.buffer, file.filename);
  });
}
