import { requirePageUser } from "@/lib/auth";
import { UNITS } from "@/lib/units";
import { ReferenceEditor } from "@/components/ReferenceEditor";
import { listCategories, listMaterials } from "@/services/reference";

export default async function ItemsPage() {
  await requirePageUser(["DIRECTOR", "ACCOUNTANT"]);
  const [rows, categories] = await Promise.all([listMaterials(), listCategories()]);

  return (
    <>
      <p className="text-ink-3 mb-3 max-w-[760px]">
        Кунлик дафтарда танланадиган ҳамма нарса: материал (Бетон 250 марка), хизмат (Юк ташиш), ёқилғи ва ҳ.к.
        Бир ном фақат бир марта ёзилади — катта-кичик ҳарф ва ортиқча бўшлиқ фарқ қилмайди.
        Нарх доим битта бирлик учун ёзилади.
      </p>
      <ReferenceEditor
        endpoint="/api/reference/materials"
        canEdit
        emptyValues={{ name: "", unit: "dona", categoryId: null }}
        fields={[
          { key: "name", label: "Номи", type: "text", placeholder: "Бетон 250 марка" },
          { key: "unit", label: "Бирлик", type: "select", width: "130px", options: UNITS.map((u) => ({ value: u.code, label: u.label })), lockedWhenUsed: true },
          {
            key: "categoryId",
            label: "Категория",
            type: "select-id",
            width: "200px",
            options: categories.filter((c) => c.isActive).map((c) => ({ value: String(c.id), label: c.name })),
          },
        ]}
        rows={rows.map((m) => ({
          id: m.id,
          isActive: m.isActive,
          usage: m._count.entries,
          values: { name: m.name, unit: m.unit, categoryId: m.categoryId ? String(m.categoryId) : null },
        }))}
      />
    </>
  );
}
