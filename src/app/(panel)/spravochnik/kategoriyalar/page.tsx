import { requirePageUser } from "@/lib/auth";
import { ReferenceEditor } from "@/components/ReferenceEditor";
import { listCategories } from "@/services/reference";

export default async function CategoriesPage() {
  await requirePageUser(["DIRECTOR", "ACCOUNTANT"]);
  const rows = await listCategories();

  return (
    <ReferenceEditor
      endpoint="/api/reference/categories"
      canEdit
      emptyValues={{ name: "", isMaterial: false, sortOrder: "0" }}
      fields={[
        { key: "name", label: "Nomi", type: "text" },
        { key: "isMaterial", label: "Material tanlanadi", type: "checkbox", width: "150px", lockedWhenUsed: true },
        { key: "sortOrder", label: "Tartib", type: "number", width: "90px" },
      ]}
      rows={rows.map((c) => ({
        id: c.id,
        isActive: c.isActive,
        usage: c._count.entries,
        values: { name: c.name, isMaterial: c.isMaterial, sortOrder: String(c.sortOrder) },
      }))}
    />
  );
}
