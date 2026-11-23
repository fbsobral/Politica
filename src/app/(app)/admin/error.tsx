"use client";

/** Erro numa página do admin: mostra a mensagem em vez de deixar a área em branco. */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card-flat space-y-3 p-5">
      <p className="eyebrow">Algo deu errado</p>
      <h1 className="display text-2xl font-semibold">Não consegui abrir esta página do admin</h1>
      <p className="text-sm text-muted">Pode ser só o banco ocupado com uma atualização em andamento. Tente de novo em alguns instantes.</p>
      {error.digest && <p className="text-xs text-faint">Código para o log do servidor: {error.digest}</p>}
      <button type="button" onClick={reset} className="btn btn-primary btn-sm">Tentar de novo</button>
    </div>
  );
}
