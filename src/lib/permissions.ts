import type { EntryKind } from "@prisma/client";
import type { SessionUser } from "@/types/auth";

/**
 * Barcha ruxsat qoidalari shu yerda. Har bir API route boshida shu
 * funksiyalardan biri chaqiriladi; servislar ham muhim joylarda qayta
 * tekshiradi (masalan prorabning ob'ekti va 24 soatlik muddati).
 */

/** Prorab o'z yozuvini shu muddat ichida tuzata/bekor qila oladi. */
export const FOREMAN_EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

export const isDirector = (u: SessionUser) => u.role === "DIRECTOR";
export const isAccountant = (u: SessionUser) => u.role === "ACCOUNTANT";
export const isForeman = (u: SessionUser) => u.role === "FOREMAN";

/** Direktor va buxgalter — "ofis": hamma ob'ekt, kirim, kassa qoldiqlari. */
export const isOffice = (u: SessionUser) => isDirector(u) || isAccountant(u);

/** Kassa qoldiqlari va kirimni ko'rish. Prorab ko'rmaydi. */
export function canViewFinance(user: SessionUser): boolean {
  return isOffice(user);
}

export function canViewSite(user: SessionUser, siteId: number): boolean {
  return isOffice(user) || user.siteIds.includes(siteId);
}

/** Yozuv kiritish: prorab faqat chiqim va faqat o'z ob'ektiga. */
export function canCreateEntry(user: SessionUser, kind: EntryKind, siteId: number | null): boolean {
  if (isOffice(user)) return true;
  return kind === "EXPENSE" && siteId !== null && user.siteIds.includes(siteId);
}

/** Kiritish ekranini ochish — hamma rollar (prorab faqat chiqim rejimida). */
export function canUseEntryScreen(_user: SessionUser): boolean {
  return true;
}

/**
 * Mavjud yozuvni tuzatish yoki bekor qilish.
 * Ofis — istalgan yozuv. Prorab — faqat o'zi kiritgan chiqim, o'z ob'ektida,
 * kiritilganidan 24 soat ichida.
 */
export function canModifyEntry(
  user: SessionUser,
  entry: { kind: EntryKind; siteId: number | null; createdById: number; createdAt: Date },
  now: Date = new Date()
): boolean {
  if (isOffice(user)) return true;
  return (
    entry.kind === "EXPENSE" &&
    entry.createdById === user.id &&
    entry.siteId !== null &&
    user.siteIds.includes(entry.siteId) &&
    now.getTime() - entry.createdAt.getTime() < FOREMAN_EDIT_WINDOW_MS
  );
}

/** Jurnalni ko'rish — hamma (prorab faqat o'z ob'ektlari chiqimini ko'radi, servis cheklaydi). */
export function canViewJournal(_user: SessionUser): boolean {
  return true;
}

/** Ob'ekt ochish, arxivlash, qayta ochish — faqat direktor. */
export function canManageSites(user: SessionUser): boolean {
  return isDirector(user);
}

/** Oy yopish va qayta ochish — faqat direktor. */
export function canClosePeriods(user: SessionUser): boolean {
  return isDirector(user);
}

/** Spravochniklar (material, kategoriya, firma, hisob, kirim manbalari). */
export function canManageReference(user: SessionUser): boolean {
  return isOffice(user);
}

/** Foydalanuvchilarni boshqarish — faqat direktor. */
export function canManageUsers(user: SessionUser): boolean {
  return isDirector(user);
}

/** Audit jurnalini (o'zgarishlar tarixini) ko'rish. */
export function canViewAudit(user: SessionUser): boolean {
  return isOffice(user);
}
