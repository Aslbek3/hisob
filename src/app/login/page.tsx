import { redirect } from "next/navigation";
import { getSessionUser, homeFor } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect(homeFor(user));

  return (
    <main className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-[340px]">
        <h1 className="text-lg font-semibold mb-1">Hisob</h1>
        <p className="text-ink-3 mb-6">Qurilish kirim-chiqim tizimi</p>
        <LoginForm />
      </div>
    </main>
  );
}
