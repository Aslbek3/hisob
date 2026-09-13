import { requirePageUser } from "@/lib/auth";
import { ReferenceEditor } from "@/components/ReferenceEditor";
import { listCounterparties } from "@/services/reference";

export default async function PayersPage() {
  await requirePageUser(["DIRECTOR", "ACCOUNTANT"]);
  const rows = await listCounterparties();

  return (
    <>
      <p className="text-ink-3 mb-3">Kirim kimdan kelishi mumkin: buyurtmachi, investor, ta&apos;sischi va h.k.</p>
      <ReferenceEditor
        endpoint="/api/reference/counterparties"
        canEdit
        emptyValues={{ name: "", phone: "", note: "" }}
        fields={[
          { key: "name", label: "Nomi", type: "text" },
          { key: "phone", label: "Telefon", type: "text", width: "160px" },
          { key: "note", label: "Izoh", type: "text" },
        ]}
        rows={rows.map((c) => ({
          id: c.id,
          isActive: c.isActive,
          usage: c._count.entries,
          values: { name: c.name, phone: c.phone ?? "", note: c.note ?? "" },
        }))}
      />
    </>
  );
}
