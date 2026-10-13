import { SignUp } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";

// Cadastro somente por convite: sem o ticket do convite (__clerk_ticket), volta para o login.
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  if (!sp.__clerk_ticket) redirect("/sign-in");
  return (
    <AuthShell>
      <SignUp fallbackRedirectUrl="/onboarding" appearance={{ variables: { colorPrimary: "#17407f", borderRadius: "0.75rem", fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }, elements: { footerAction: { display: "none" } } }} />
    </AuthShell>
  );
}
