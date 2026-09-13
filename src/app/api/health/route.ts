import { jsonResponse } from "@/lib/api";
import { checkDatabase } from "@/services/health";

// Ochiq route — monitoring uchun, hech qanday ma'lumot qaytarmaydi.
export async function GET() {
  const db = await checkDatabase();
  return jsonResponse({ ok: db, db }, { status: db ? 200 : 503 });
}
