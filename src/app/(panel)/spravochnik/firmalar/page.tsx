import { requirePageUser } from "@/lib/auth";
import { ReferenceEditor } from "@/components/ReferenceEditor";
import { listCompanies } from "@/services/reference";

export default async function CompaniesPage() {
  await requirePageUser(["DIRECTOR", "ACCOUNTANT"]);
  const rows = await listCompanies();

  return (
    <>
      <p className="text-ink-3 mb-3">Firma nomini o&apos;zgartirish mumkin — hisoblar va yozuvlar bog&apos;lanishi buzilmaydi.</p>
      <ReferenceEditor
        endpoint="/api/reference/companies"
        canEdit
        usageLabel="Hisoblar"
        emptyValues={{ name: "" }}
        fields={[{ key: "name", label: "Nomi", type: "text" }]}
        rows={rows.map((c) => ({ id: c.id, isActive: c.isActive, usage: c._count.accounts, values: { name: c.name } }))}
      />
    </>
  );
}
