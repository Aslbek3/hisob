import { requirePageUser } from "@/lib/auth";
import { ReferenceEditor } from "@/components/ReferenceEditor";
import { listCategories } from "@/services/reference";

export default async function CategoriesPage() {
  await requirePageUser(["DIRECTOR", "ACCOUNTANT"]);
  const rows = await listCategories();

  return (
    <>
      <p className="text-ink-3 mb-3">Ҳисоботда харажатлар шу категориялар бўйича гуруҳланади. Ҳар бир номга битта категория берилади.</p>
      <ReferenceEditor
        endpoint="/api/reference/categories"
        canEdit
        emptyValues={{ name: "", sortOrder: "0" }}
        fields={[
          { key: "name", label: "Номи", type: "text" },
          { key: "sortOrder", label: "Тартиб", type: "number", width: "90px" },
        ]}
        rows={rows.map((c) => ({
          id: c.id,
          isActive: c.isActive,
          usage: c._count.entries,
          values: { name: c.name, sortOrder: String(c.sortOrder) },
        }))}
      />
    </>
  );
}
