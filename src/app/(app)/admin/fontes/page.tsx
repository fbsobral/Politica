import { redirect } from "next/navigation";

// A antiga página "Fontes e buscas" foi dividida em Feeds RSS, Veículos e tiers, Buscas e Robô.
export default function FontesRedirect() {
  redirect("/admin/buscas");
}
