import { requirePageUser } from "@/lib/auth";
import { CounterpartyList } from "../CounterpartyList";

export default async function SuppliersRefPage() {
  await requirePageUser(["DIRECTOR", "ACCOUNTANT"]);
  return <CounterpartyList kind="SUPPLIER" hint="Бетон заводи, база ва ҳ.к. Қолдиқлари «Етказиб берувчилар» бўлимида." />;
}
