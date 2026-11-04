"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/** Celular: chamada fixa embaixo, ao alcance do polegar, que aparece depois que o botão do topo sai da tela. */
export function StickyCta() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const on = () => setShow(window.scrollY > 640);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <div aria-hidden={!show} className={`fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/90 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl transition-transform duration-300 sm:hidden ${show ? "translate-y-0" : "translate-y-full"}`}>
      <Link href="/sign-up" tabIndex={show ? 0 : -1} className="btn btn-primary w-full !py-3 !text-base">Criar minha conta</Link>
    </div>
  );
}
