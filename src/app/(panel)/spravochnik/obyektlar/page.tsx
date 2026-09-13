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
        Объектни очиш ва ёпиш — «Объектлар» саҳифасида{canEdit ? "" : " (фақат директор)"}. Бу ерда номи ва манзили.
      </p>
      <ReferenceEditor
        endpoint="/api/sites"
        canEdit={canEdit}
        showActive={false}
        emptyValues={{ name: "", address: "" }}
        fields={[
          { key: "name", label: "Номи", type: "text" },
          { key: "address", label: "Манзил", type: "text" },
        ]}
        rows={sites.map((s) => ({ id: s.id, isActive: true, values: { name: s.name, address: s.address ?? "" } }))}
      />
    </>
  );
}
