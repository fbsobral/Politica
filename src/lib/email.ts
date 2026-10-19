import { Resend } from "resend";

let resend: Resend | null = null;

export function emailEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

/** Motivo da última falha de envio (para diagnóstico nos resumos). */
export let lastEmailError: string | null = null;

export async function sendEmail(opts: { to: string; subject: string; html: string }): Promise<boolean> {
  if (!emailEnabled()) {
    lastEmailError = "RESEND_API_KEY ausente";
    console.log(`[email] RESEND_API_KEY ausente — e-mail "${opts.subject}" para ${opts.to} não enviado`);
    return false;
  }
  resend ??= new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || "Política <onboarding@resend.dev>",
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  });
  if (error) {
    lastEmailError = error.message;
    console.warn("[email] erro Resend:", error.message);
    return false;
  }
  return true;
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function layout(title: string, inner: string, to?: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#18181b">
<div style="max-width:620px;margin:0 auto;padding:24px 16px">
  <div style="background:#fff;border-radius:12px;padding:24px;border:1px solid #e4e4e7">
    <h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(title)}</h1>
    ${inner}
  </div>
  <p style="font-size:12px;color:#71717a;text-align:center;margin-top:16px">
    ${to ? `Enviado para ${escapeHtml(to)} · ` : ""}<a href="${appUrl()}/configuracoes" style="color:#71717a">Gerenciar e-mails</a>
  </p>
</div></body></html>`;
}
