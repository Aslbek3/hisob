import { requirePageUser } from "@/lib/auth";
import { ReferenceEditor } from "@/components/ReferenceEditor";
import { listCompanies } from "@/services/reference";

export default async function CompaniesPage() {
  await requirePageUser(["DIRECTOR", "ACCOUNTANT"]);
  const rows = await listCompanies();

  return (
    <>
      <p className="text-ink-3 mb-3">Фирма номини ўзгартириш мумкин — кассалар ва ёзувлар боғланиши бузилмайди.</p>
      <ReferenceEditor
        endpoint="/api/reference/companies"
        canEdit
        usageLabel="Кассалар"
        emptyValues={{ name: "" }}
        fields={[{ key: "name", label: "Номи", type: "text" }]}
        rows={rows.map((c) => ({ id: c.id, isActive: c.isActive, usage: c._count.accounts, values: { name: c.name } }))}
      />
    </>
  );
}
