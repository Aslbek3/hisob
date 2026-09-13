import { getSessionUser } from "@/lib/auth";
import { canManageUsers } from "@/lib/permissions";
import { PageHeader } from "@/components/PageHeader";
import { Tabs } from "@/components/Tabs";

/** Faqat yorliqlar uchun — ruxsat har sahifaning o'zida tekshiriladi. */
export default async function SpravochnikLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  const tabs = [
    { href: "/spravochnik/materiallar", label: "Номлар" },
    { href: "/spravochnik/kategoriyalar", label: "Категориялар" },
    { href: "/spravochnik/yetkazib", label: "Етказиб берувчилар" },
    { href: "/spravochnik/manbalar", label: "Пул берувчилар" },
    { href: "/spravochnik/hisoblar", label: "Кассалар" },
    { href: "/spravochnik/firmalar", label: "Фирмалар" },
    { href: "/spravochnik/obyektlar", label: "Объектлар" },
    ...(user && canManageUsers(user) ? [{ href: "/spravochnik/foydalanuvchilar", label: "Фойдаланувчилар" }] : []),
  ];
  return (
    <>
      <PageHeader title="Рўйхатлар" />
      <Tabs items={tabs} />
      {children}
    </>
  );
}
