import { SignIn } from "@clerk/nextjs";
import { AuthShell } from "@/components/auth-shell";

export default function Page() {
  return (
    <AuthShell>
      <SignIn fallbackRedirectUrl="/" appearance={{ variables: { colorPrimary: "#17407f", borderRadius: "0.75rem", fontFamily: "var(--font-geist-sans), system-ui, sans-serif" } }} />
    </AuthShell>
  );
}
