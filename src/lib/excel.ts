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
  columns: ExcelColumn<T>[];
  rows: T[];
  /** Pastki "Jami" qatori — tayyor hisoblangan qiymatlar (formula emas). */
  totals?: Partial<Record<number, ExcelCell>>;
};

/** Qator turini ustunlarga yetkazish uchun: sheet({ rows, columns: [{ value: (r) => r.name }] }). */
export function sheet<T>(s: ExcelSheet<T>): ExcelSheet<T> {
  return s;
}

function toCellValue(v: ExcelCell): ExcelJS.CellValue {
  if (typeof v === "bigint") return Number(v); // so'mda 9·10^15 gacha aniq
  return v;
}

export async function buildWorkbook(sheets: ExcelSheet<any>[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.created = new Date();

  for (const sheet of sheets) {
    const ws = wb.addWorksheet(sheet.name.slice(0, 31));
    let rowIndex = 1;

    if (sheet.title) {
      ws.getCell(1, 1).value = sheet.title;
      ws.getCell(1, 1).font = { bold: true, size: 12 };
      rowIndex = 3;
    }

    const headerRow = ws.getRow(rowIndex);
    sheet.columns.forEach((col, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = col.header;
      cell.font = { bold: true };
      cell.border = { bottom: { style: "thin" } };
      ws.getColumn(i + 1).width = col.width ?? 14;
    });
    ws.views = [{ state: "frozen", ySplit: rowIndex }];

    for (const row of sheet.rows) {
      rowIndex += 1;
      const r = ws.getRow(rowIndex);
      sheet.columns.forEach((col, i) => {
        const cell = r.getCell(i + 1);
        cell.value = toCellValue(col.value(row));
        if (col.kind === "money") cell.numFmt = "#,##0";
        if (col.kind === "qty") cell.numFmt = "#,##0.###";
        if (col.kind === "date") cell.numFmt = "dd.mm.yyyy";
      });
    }

    if (sheet.totals) {
      rowIndex += 1;
      const r = ws.getRow(rowIndex);
      r.getCell(1).value = "Jami";
      r.font = { bold: true };
      for (const [idx, value] of Object.entries(sheet.totals)) {
        const i = Number(idx);
        const cell = r.getCell(i + 1);
        cell.value = toCellValue(value ?? null);
        if (sheet.columns[i]?.kind === "money") cell.numFmt = "#,##0";
      }
      r.eachCell((c) => (c.border = { top: { style: "thin" } }));
    }
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** "2026-09-13" → Excel sana katagi (UTC yarim tun — vaqt zonasi siljimasin). */
export function excelDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
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
