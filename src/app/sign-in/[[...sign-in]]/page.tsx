import { SignIn } from "@clerk/nextjs";
import { AuthShell } from "@/components/auth-shell";
import { isSignupOpen } from "@/lib/settings";

export default async function Page() {
  const open = await isSignupOpen();
  return (
    <AuthShell>
      <SignIn
        fallbackRedirectUrl="/"
        signUpUrl="/sign-up"
        appearance={{ variables: { colorPrimary: "#17407f", borderRadius: "0.75rem", fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }, elements: open ? {} : { footerAction: { display: "none" } } }}
      />
    </AuthShell>
  );
}
