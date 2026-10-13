"use client";

import { useFormStatus } from "react-dom";

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg className={`h-4 w-4 animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Botão de envio que mostra um loader enquanto a ação do formulário roda. */
export function SubmitButton({
  children,
  pendingText,
  className = "btn btn-primary",
  disabled,
  formAction,
  formNoValidate,
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
  disabled?: boolean;
  formAction?: (formData: FormData) => void | Promise<void>;
  formNoValidate?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={disabled || pending} aria-busy={pending} formAction={formAction} formNoValidate={formNoValidate} className={className}>
      {pending && <Spinner />}
      {pending ? (pendingText ?? children) : children}
    </button>
  );
}
