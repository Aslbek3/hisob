import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canManageReference, canViewFinance, isOffice } from "@/lib/permissions";
import { ROLE_LABEL } from "@/lib/labels";
import { Sidebar, type NavItem } from "@/components/Sidebar";

/**
 * Panel karkasi. Bu yerdagi sessiya tekshiruvi faqat MENYU uchun — haqiqiy
 * himoya har bir sahifaning o'zida (requirePageUser), chunki layout va
 * sahifa parallel chiziladi.
 */
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const nav: NavItem[] = [
    { href: "/obyektlar", label: "Ob'ektlar" },
    { href: "/kiritish", label: "Kiritish" },
    { href: "/jurnal", label: "Jurnal" },
    ...(canViewFinance(user) ? [{ href: "/hisoblar", label: "Hisoblar" }] : []),
    ...(isOffice(user) ? [{ href: "/oylar", label: "Oylar" }] : []),
    ...(canManageReference(user) ? [{ href: "/spravochnik", label: "Spravochniklar" }] : []),
  ];

  return (
    <div className="min-h-screen flex">
      <Sidebar nav={nav} userName={user.name} roleLabel={ROLE_LABEL[user.role]} />
      <main className="flex-1 min-w-0 px-6 py-5">{children}</main>
    </div>
  );
}
