import { getSessionUser } from "@/lib/auth";
import { canManageUsers } from "@/lib/permissions";
import { PageHeader } from "@/components/PageHeader";
import { Tabs } from "@/components/Tabs";

/** Faqat yorliqlar uchun — ruxsat har sahifaning o'zida tekshiriladi. */
export default async function SpravochnikLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  const tabs = [
    { href: "/spravochnik/materiallar", label: "Materiallar" },
    { href: "/spravochnik/kategoriyalar", label: "Kategoriyalar" },
    { href: "/spravochnik/manbalar", label: "Kirim manbalari" },
    { href: "/spravochnik/hisoblar", label: "Hisoblar" },
    { href: "/spravochnik/firmalar", label: "Firmalar" },
    { href: "/spravochnik/obyektlar", label: "Ob'ektlar" },
    ...(user && canManageUsers(user) ? [{ href: "/spravochnik/foydalanuvchilar", label: "Foydalanuvchilar" }] : []),
  ];
  return (
    <>
      <PageHeader title="Spravochniklar" />
      <Tabs items={tabs} />
      {children}
    </>
  );
}
