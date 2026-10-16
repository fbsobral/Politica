/** Aparência dos componentes do Clerk: cartão limpo, integrado ao restante do app. */
export function clerkAppearance(opts: { hideFooterAction?: boolean } = {}) {
  return {
    variables: { colorPrimary: "#17407f", borderRadius: "0.75rem", fontFamily: "var(--font-geist-sans), system-ui, sans-serif" },
    elements: {
      rootBox: { width: "100%" },
      cardBox: { width: "100%", boxShadow: "0 2px 4px rgba(20,24,31,.04), 0 12px 32px rgba(20,24,31,.08)", border: "1px solid var(--line)", borderRadius: "1.25rem" },
      card: { boxShadow: "none" },
      headerTitle: { fontFamily: "var(--font-fraunces), Georgia, serif", fontWeight: 600 },
      ...(opts.hideFooterAction ? { footerAction: { display: "none" } } : {}),
    },
  } as const;
}
