import type { NextConfig } from "next";

/** Cabeçalhos de segurança de todas as respostas. */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // não restringe scripts (o Clerk e o Next precisam deles), mas fecha os vetores de clique, <base>, formulários externos e plugins
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
  { key: "Cross-Origin-Resource-Policy", value: "same-site" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: { unoptimized: true },
  serverExternalPackages: ["@prisma/client", "adm-zip"],
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // respostas de API com dados do usuário não devem ficar em cache de proxy ou do navegador
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }] },
    ];
  },
};

export default nextConfig;
