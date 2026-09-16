import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canManageReference, canViewFinance, isOffice } from "@/lib/permissions";
import { ROLE_LABEL } from "@/lib/labels";
import { Sidebar, type NavItem } from "@/components/Sidebar";

/**
 * Panel karkasi. Bu yerdagi sessiya tekshiruvi faqat MENYU uchun — haqiqiy
 * himoya har bir sahifaning o'zida (requirePageUser), chunki layout va
 * sahifa parallel chiziladi.
 *
 * Menyu ataylab qisqa: asosiy foydalanuvchi har kuni faqat birinchi
 * to'rttasini ishlatadi, qolganlari "Бошқа" ostida.
 */
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const office = isOffice(user);

  const main: NavItem[] = [
    { href: "/kiritish", label: "Кунлик дафтар" },
    { href: "/hisobot", label: "Ҳисобот (Excel)" },
    ...(office ? [{ href: "/yetkazib", label: "Етказиб берувчилар" }] : []),
    ...(canViewFinance(user) ? [{ href: "/hisoblar", label: "Кассалар" }] : []),
  ];
  const more: NavItem[] = [
    { href: "/obyektlar", label: "Объектлар" },
    { href: "/jurnal", label: "Барча ёзувлар" },
    ...(office ? [{ href: "/oylar", label: "Ойлар" }] : []),
    ...(canManageReference(user) ? [{ href: "/spravochnik", label: "Рўйхатлар" }] : []),
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <Sidebar main={main} more={more} userName={user.name} roleLabel={ROLE_LABEL[user.role]} />
      <main className="flex-1 min-w-0 px-4 py-4 md:px-6 md:py-5">{children}</main>
    </div>
  );
}
