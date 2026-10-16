import { SignUp } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { clerkAppearance } from "@/lib/clerk-appearance";
import { isSignupOpen } from "@/lib/settings";

// Cadastro aberto: qualquer pessoa cria conta. Com o cadastro fechado (Admin → Usuários), só abre com o ticket do convite.
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const open = await isSignupOpen();
  if (!open && !sp.__clerk_ticket) redirect("/sign-in");
  return (
    <AuthShell mode="cadastrar">
      <SignUp
        fallbackRedirectUrl="/onboarding"
        signInUrl="/sign-in"
        appearance={clerkAppearance({ hideFooterAction: true })}
      />
    </AuthShell>
  );
}
