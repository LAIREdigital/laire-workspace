import Image from "next/image";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-full items-center justify-center bg-plum px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <Image src="/laire-logo-white.png" alt="LAIRE" width={150} height={62} priority />
          <p className="font-display text-sm font-semibold tracking-[0.2em] text-teal uppercase">Workspace</p>
        </div>
        <div className="rounded-xl bg-white p-6 shadow-xl">
          <LoginForm error={error} />
        </div>
        <p className="mt-6 text-center text-xs text-white/60">
          LAIRE staff use Google. Clients use the email address LAIRE invited.
        </p>
      </div>
    </main>
  );
}
