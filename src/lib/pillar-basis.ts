/** Origem das metas do módulo Pilares (separado para poder ser usado em componentes sem levar o acesso ao banco). */
export type Basis = "internacional" | "brasil" | "ideal" | "estados" | "historico";

export const BASIS: Record<Basis, { label: string; short: string; desc: string }> = {
  internacional: { label: "Referência internacional", short: "Internacional", desc: "Meta ou média de organismos internacionais (ONU/ODS, OMS, OCDE, OIT, FMI, Banco Mundial)." },
  brasil: { label: "Meta brasileira", short: "Meta do Brasil", desc: "Número fixado em lei, plano nacional ou norma oficial do Brasil (ou, na falta, referência técnica brasileira)." },
  ideal: { label: "Ideal declarado", short: "Ideal", desc: "A lei ou o compromisso falam em universalizar ou eliminar, sem número: usamos 100% ou zero." },
  estados: { label: "Projeção: melhor estado", short: "Melhor estado", desc: "Sem meta oficial: o melhor resultado entre os 27 estados no mesmo ano, uma vitória que já aconteceu no Brasil e mostra o que é alcançável." },
  historico: { label: "Projeção: melhor da própria série", short: "Melhor histórico", desc: "Sem meta oficial nem comparação entre estados: o melhor resultado que este lugar já teve nos últimos 20 anos." },
};
