import ExcelJS from "exceljs";

/**
 * Excel eksport. Faqat qiymatlar — formula yo'q. Pul — raqam katak
 * (matn emas), shuning uchun Excel'da darhol qo'shib/saralab bo'ladi.
 */

export type ExcelCell = string | number | bigint | Date | null;

export type ExcelColumn<T> = {
  header: string;
  width?: number;
  kind?: "text" | "money" | "qty" | "date";
  value: (row: T) => ExcelCell;
};

export type ExcelSheet<T> = {
  name: string;
  title?: string;
  subtitle?: string;
  columns: ExcelColumn<T>[];
  rows: T[];
  /** Qator turi: "subtotal" — qalin, ustida chiziq (kunlik jami va h.k.). */
  rowKind?: (row: T) => "normal" | "subtotal";
  /** Pastki "Жами" qatori — tayyor hisoblangan qiymatlar (formula emas). */
  totals?: Partial<Record<number, ExcelCell>>;
  totalsLabel?: string;
};

/** Qator turini ustunlarga yetkazish uchun: sheet({ rows, columns: [{ value: (r) => r.name }] }). */
export function sheet<T>(s: ExcelSheet<T>): ExcelSheet<T> {
  return s;
}

function toCellValue(v: ExcelCell): ExcelJS.CellValue {
  if (typeof v === "bigint") return Number(v); // so'mda 9·10^15 gacha aniq
  return v;
}

const FORMAT = { money: "#,##0", qty: "#,##0.###", date: "dd.mm.yyyy" } as const;

export async function buildWorkbook(sheets: ExcelSheet<any>[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.created = new Date();
  const usedNames = new Set<string>();

  for (const sh of sheets) {
    // Varaq nomi: 31 belgi, takrorlanmas, taqiqlangan belgilarsiz
    let name = sh.name.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Varaq";
    for (let i = 2; usedNames.has(name); i++) name = `${sh.name.slice(0, 27)} (${i})`;
    usedNames.add(name);
    const ws = wb.addWorksheet(name);
    let rowIndex = 1;

    if (sh.title) {
      ws.getCell(rowIndex, 1).value = sh.title;
      ws.getCell(rowIndex, 1).font = { bold: true, size: 13 };
      rowIndex += 1;
    }
    if (sh.subtitle) {
      ws.getCell(rowIndex, 1).value = sh.subtitle;
      ws.getCell(rowIndex, 1).font = { color: { argb: "FF555555" } };
      rowIndex += 1;
    }
    if (sh.title || sh.subtitle) rowIndex += 1;

    const headerRow = ws.getRow(rowIndex);
    sh.columns.forEach((col, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = col.header;
      cell.font = { bold: true };
      cell.alignment = { wrapText: true, vertical: "middle" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF1F4" } };
      cell.border = { bottom: { style: "thin" } };
      ws.getColumn(i + 1).width = col.width ?? 14;
    });
    ws.views = [{ state: "frozen", ySplit: rowIndex }];

    for (const row of sh.rows) {
      rowIndex += 1;
      const r = ws.getRow(rowIndex);
      sh.columns.forEach((col, i) => {
        const cell = r.getCell(i + 1);
        cell.value = toCellValue(col.value(row));
        if (col.kind && col.kind !== "text") cell.numFmt = FORMAT[col.kind];
      });
      if (sh.rowKind?.(row) === "subtotal") {
        r.font = { bold: true };
        r.eachCell((c) => (c.border = { top: { style: "thin", color: { argb: "FFBBBBBB" } } }));
      }
    }

    if (sh.totals) {
      rowIndex += 1;
      const r = ws.getRow(rowIndex);
      r.getCell(1).value = sh.totalsLabel ?? "Жами";
      r.font = { bold: true, size: 12 };
      for (const [idx, value] of Object.entries(sh.totals)) {
        const i = Number(idx);
        const cell = r.getCell(i + 1);
        cell.value = toCellValue(value ?? null);
        const kind = sh.columns[i]?.kind;
        if (kind && kind !== "text") cell.numFmt = FORMAT[kind];
      }
      r.eachCell((c) => (c.border = { top: { style: "medium" } }));
    }
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** "2026-09-13" → Excel sana katagi (UTC yarim tun — vaqt zonasi siljimasin). */
export function excelDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

/** Fayl nomi uchun xavfsiz qism: "Объект 1 (янги)" → "Объект_1_янги". */
export function fileSafe(text: string): string {
  return text.replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_|_$/g, "");
}

export function excelResponse(buffer: Buffer, filename: string): Response {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "cache-control": "no-store",
    },
  });
}
