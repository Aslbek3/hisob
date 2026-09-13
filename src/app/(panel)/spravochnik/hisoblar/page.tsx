import { requirePageUser } from "@/lib/auth";
import { formatSom } from "@/lib/money";
import { ACCOUNT_TYPE_LABEL } from "@/lib/labels";
import { ReferenceEditor } from "@/components/ReferenceEditor";
import { listAccounts, listCompanies } from "@/services/reference";

export default async function AccountsRefPage() {
  await requirePageUser(["DIRECTOR", "ACCOUNTANT"]);
  const [rows, companies] = await Promise.all([listAccounts(), listCompanies()]);

  return (
    <>
      <p className="text-ink-3 mb-3 max-w-[720px]">
        Boshlang&apos;ich qoldiq — tizimga o&apos;tish kunidagi qoldiq. Hisobga birinchi yozuv tushgach uni o&apos;zgartirib
        bo&apos;lmaydi (aks holda yopilgan oylar qoldig&apos;i ham o&apos;zgarib ketardi).
      </p>
      <ReferenceEditor
        endpoint="/api/reference/accounts"
        canEdit
        emptyValues={{ name: "", type: "CASH", companyId: companies[0] ? String(companies[0].id) : null, openingBalance: "0", sortOrder: "0" }}
        fields={[
          { key: "name", label: "Nomi", type: "text" },
          {
            key: "type",
            label: "Turi",
            type: "select",
            width: "140px",
            options: Object.entries(ACCOUNT_TYPE_LABEL).map(([value, label]) => ({ value, label })),
          },
          {
            key: "companyId",
            label: "Firma",
            type: "select-id",
            width: "180px",
            options: companies.filter((c) => c.isActive).map((c) => ({ value: String(c.id), label: c.name })),
          },
          { key: "openingBalance", label: "Boshlang'ich qoldiq", type: "money", width: "170px", lockedWhenUsed: true },
          { key: "sortOrder", label: "Tartib", type: "number", width: "80px" },
        ]}
        rows={rows.map((a) => ({
          id: a.id,
          isActive: a.isActive,
          usage: a._count.entries + a._count.incomingTransfers,
          values: {
            name: a.name,
            type: a.type,
            companyId: a.companyId ? String(a.companyId) : null,
            openingBalance: formatSom(a.openingBalance),
            sortOrder: String(a.sortOrder),
          },
        }))}
      />
    </>
  );
}
