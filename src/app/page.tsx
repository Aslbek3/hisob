import { redirect } from "next/navigation";
import { homeFor, requirePageUser } from "@/lib/auth";

export default async function Home() {
  const user = await requirePageUser();
  redirect(homeFor(user));
}
