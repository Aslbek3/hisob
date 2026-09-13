import { requirePageUser } from "@/lib/auth";
import { canManageSites } from "@/lib/permissions";
import { ReferenceEditor } from "@/components/ReferenceEditor";
import { listSites } from "@/services/sites";

export default async function SitesRefPage() {
  const user = await requirePageUser(["DIRECTOR", "ACCOUNTANT"]);
  const sites = await listSites(user, { monthsBack: 1 });
  const canEdit = canManageSites(user);

  return (
    <>
      <p className="text-ink-3 mb-3">
        Ob&apos;ektni ochish va yopish — &quot;Ob&apos;ektlar&quot; sahifasida{canEdit ? "" : " (faqat direktor)"}. Bu yerda nomi va manzili.
      </p>
      <ReferenceEditor
        endpoint="/api/sites"
        canEdit={canEdit}
        showActive={false}
        emptyValues={{ name: "", address: "" }}
        fields={[
          { key: "name", label: "Nomi", type: "text" },
          { key: "address", label: "Manzil", type: "text" },
        ]}
        rows={sites.map((s) => ({ id: s.id, isActive: true, values: { name: s.name, address: s.address ?? "" } }))}
      />
    </>
  );
}
