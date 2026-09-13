import { requirePageUser } from "@/lib/auth";
import { UNITS } from "@/lib/units";
import { ReferenceEditor } from "@/components/ReferenceEditor";
import { listMaterials } from "@/services/reference";

export default async function MaterialsPage() {
  await requirePageUser(["DIRECTOR", "ACCOUNTANT"]);
  const rows = await listMaterials();

  return (
    <>
      <p className="text-ink-3 mb-3 max-w-[720px]">
        Material bir marta kiritiladi va keyin faqat ro&apos;yxatdan tanlanadi. Katta-kichik harf, ortiqcha bo&apos;shliq va
        o&apos; / o‘ / oʻ farqi hisobga olinmaydi — &quot;Sement M400&quot; va &quot;sement  m400&quot; bitta material.
        Narx doim bitta birlik uchun kiritiladi.
      </p>
      <ReferenceEditor
        endpoint="/api/reference/materials"
        canEdit
        emptyValues={{ name: "", unit: "kg" }}
        fields={[
          { key: "name", label: "Nomi", type: "text", placeholder: "Sement M400" },
          {
            key: "unit",
            label: "Birlik",
            type: "select",
            width: "140px",
            options: UNITS.map((u) => ({ value: u.code, label: u.label })),
            lockedWhenUsed: true,
          },
        ]}
        rows={rows.map((m) => ({ id: m.id, isActive: m.isActive, usage: m._count.entries, values: { name: m.name, unit: m.unit } }))}
      />
    </>
  );
}
