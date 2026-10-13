"use client";

import { useFormStatus } from "react-dom";
import { Spinner } from "@/components/submit-button";

/** Botão de envio que pede confirmação antes de executar (ações destrutivas ou em massa). */
export function ConfirmButton({
  children,
  message,
  className = "btn btn-danger btn-sm",
  pendingText,
  formAction,
}: {
  children: React.ReactNode;
  message: string;
  className?: string;
  pendingText?: string;
  formAction?: (formData: FormData) => void | Promise<void>;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      formAction={formAction}
      formNoValidate
      disabled={pending}
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {pending && <Spinner />}
      {pending ? (pendingText ?? children) : children}
    </button>
  );
}
