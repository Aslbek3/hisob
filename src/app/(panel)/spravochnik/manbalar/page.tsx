import { requirePageUser } from "@/lib/auth";
import { CounterpartyList } from "../CounterpartyList";

export default async function PayersPage() {
  await requirePageUser(["DIRECTOR", "ACCOUNTANT"]);
  return <CounterpartyList kind="PAYER" hint="Пул кимдан келади: инвестор, буюртмачи, таъсисчи ва ҳ.к." />;
}
