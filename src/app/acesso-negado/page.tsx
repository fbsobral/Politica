import { SignOutButton } from "@clerk/nextjs";
import { AuthShell } from "@/components/auth-shell";

export const metadata = { title: "Acesso não liberado" };

export default function AcessoNegado() {
  return (
    <AuthShell>
      <div className="card w-full max-w-md p-6 text-center">
        <h1 className="display text-2xl font-semibold">Acesso não liberado</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          O app é por convite. Este e-mail ainda não foi cadastrado por um administrador. Peça para ser adicionado e entre de novo.
        </p>
        <SignOutButton redirectUrl="/sign-in">
          <button className="btn btn-primary mt-5 w-full">Sair e usar outro e-mail</button>
        </SignOutButton>
      </div>
    </AuthShell>
  );
}
