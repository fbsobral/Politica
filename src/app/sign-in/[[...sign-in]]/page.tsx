import { SignIn } from "@clerk/nextjs";
import { AuthShell } from "@/components/auth-shell";
import { clerkAppearance } from "@/lib/clerk-appearance";
import { isSignupOpen } from "@/lib/settings";

export default async function Page() {
  const open = await isSignupOpen();
  return (
    <AuthShell mode="entrar" showSwitch={open}>
      <SignIn
        fallbackRedirectUrl="/"
        signUpUrl="/sign-up"
        appearance={clerkAppearance({ hideFooterAction: true })}
      />
    </AuthShell>
  );
}
