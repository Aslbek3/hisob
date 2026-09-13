import { ReferenceEditor } from "@/components/ReferenceEditor";
import { listCounterparties } from "@/services/reference";

/** Pul beruvchilar va yetkazib beruvchilar ro'yxati — bir xil ko'rinish, faqat turi farq qiladi. */
export async function CounterpartyList({ kind, hint }: { kind: "PAYER" | "SUPPLIER"; hint: string }) {
  const rows = await listCounterparties(kind);
  return (
    <>
      <p className="text-ink-3 mb-3">{hint}</p>
      <ReferenceEditor
        endpoint="/api/reference/counterparties"
        canEdit
        extra={{ kind }}
        emptyValues={{ name: "", phone: "", note: "" }}
        fields={[
          { key: "name", label: "Номи", type: "text" },
          { key: "phone", label: "Телефон", type: "text", width: "170px" },
          { key: "note", label: "Изоҳ", type: "text" },
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
