import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  serverExternalPackages: ["@prisma/client", "adm-zip"],
};

export default nextConfig;
